import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { randomUUID } from "node:crypto";
import Database from "better-sqlite3";
import type {
  AssetRecord,
  EntityRecord,
  EpisodeRecord,
  EpisodeScriptWorkspaceConfigRecord,
  EpisodeSnapshot,
  EpisodeStage,
  FinalCutRecord,
  ScriptRecord,
  SeriesRecord,
  SeriesSharedAssetRecord,
  SeriesSharedAssetVariantRecord,
  SeriesStrategyRecord,
  SeriesStatus,
  ScriptStyleReference,
  StageStatus,
  StoryboardRecord,
  TaskRecord,
  VendorConfig,
  VendorModel,
  VideoCandidateRecord,
} from "@/server/mvp/types";

const DB_FILE = join(process.cwd(), "data", "mercruiser-mvp.sqlite");

const nowIso = () => new Date().toISOString();
const DEFAULT_SCRIPT_WORKSPACE_NOTES = [
  "先稳剧情冲突，再补对白节奏。",
  "关键角色关系先写清，再推进分镜。",
  "高价值段落优先生成多个视频候选。",
];

const defaultVendors: VendorConfig[] = [
  {
    id: "openai",
    name: "OpenAI",
    provider: "openai",
    baseUrl: "https://api.openai.com/v1",
    apiKey: process.env.OPENAI_API_KEY ?? "",
    enabled: true,
    models: [
      { name: "GPT-5.4", modelName: "gpt-5.4", type: "text", supportsTools: true },
      { name: "GPT-5.2", modelName: "gpt-5.2", type: "text", supportsTools: true },
      { name: "GPT Image 1", modelName: "gpt-image-1", type: "image" },
    ],
    config: {},
  },
  {
    id: "google",
    name: "Google Gemini",
    provider: "google",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY ?? process.env.GOOGLE_API_KEY ?? "",
    enabled: true,
    models: [
      { name: "Gemini 2.5 Pro", modelName: "gemini-2.5-pro", type: "text", supportsTools: true },
      { name: "Gemini 2.5 Flash", modelName: "gemini-2.5-flash", type: "text", supportsTools: true },
      { name: "Gemini 3.1 Flash Image", modelName: "gemini-3.1-flash-image-preview", type: "image" },
    ],
    config: {},
  },
  {
    id: "volcengine",
    name: "Volcengine Ark",
    provider: "openai-compatible",
    baseUrl: "https://ark.cn-beijing.volces.com/api/v3",
    apiKey: process.env.VOLCENGINE_API_KEY ?? "",
    enabled: true,
    models: [
      { name: "Doubao Seed 2.0 Pro", modelName: "doubao-seed-2-0-pro-260215", type: "text", supportsTools: true },
      { name: "Doubao Seedream 5.0 Lite", modelName: "doubao-seedream-5-0-260128", type: "image" },
      { name: "Doubao Seedance 1.5 Pro", modelName: "doubao-seedance-1-5-pro-251215", type: "video" },
    ],
    config: {
      imageEndpoint: "/images/generations",
      videoCreateEndpoint: "/contents/generations/tasks",
      videoQueryEndpoint: "/contents/generations/tasks/{id}",
    },
  },
  {
    id: "toonflow-gateway",
    name: "Toonflow Gateway",
    provider: "openai-compatible",
    baseUrl: "https://api.toonflow.net/v1",
    apiKey: process.env.TOONFLOW_API_KEY ?? "",
    enabled: true,
    models: [
      { name: "GPT-5.4", modelName: "gpt-5.4", type: "text", supportsTools: true },
      { name: "Wan2.6 I2V", modelName: "Wan2.6-I2V-720P", type: "video" },
      { name: "Doubao Seedream 5.0 Lite", modelName: "Doubao-Seedream-5.0-Lite", type: "image" },
    ],
    config: {
      imageEndpoint: "/images/generations",
      videoCreateEndpoint: "/contents/generations/tasks",
      videoQueryEndpoint: "/contents/generations/tasks/{id}",
    },
  },
  {
    id: "siliconflow",
    name: "SiliconFlow",
    provider: "openai-compatible",
    baseUrl: "https://api.siliconflow.cn/v1",
    apiKey: process.env.SILICONFLOW_API_KEY ?? "",
    enabled: true,
    models: [
      { name: "DeepSeek V3", modelName: "deepseek-ai/DeepSeek-V3", type: "text", supportsTools: true },
      { name: "Kwai Kolors", modelName: "Kwai-Kolors/Kolors", type: "image" },
      { name: "Wan2.2 T2V", modelName: "Wan-AI/Wan2.2-T2V-A14B", type: "video" },
    ],
    config: {
      imageEndpoint: "/images/generations",
      videoCreateEndpoint: "/video/submit",
      videoQueryEndpoint: "/video/status",
      videoQueryMethod: "POST",
      videoApiFlavor: "siliconflow-v1",
    },
  },
];

let dbInstance: Database.Database | null = null;

function parseJson<T>(raw: unknown, fallback: T): T {
  if (typeof raw !== "string" || raw.length === 0) {
    return fallback;
  }
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function tableHasColumn(db: Database.Database, table: string, column: string): boolean {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  return rows.some((row) => row.name === column);
}

function ensureDb(): Database.Database {
  if (dbInstance) {
    return dbInstance;
  }

  mkdirSync(dirname(DB_FILE), { recursive: true });
  const db = new Database(DB_FILE);
  db.pragma("journal_mode = WAL");

  db.exec(`
    CREATE TABLE IF NOT EXISTS series (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      summary TEXT NOT NULL,
      genre TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'initialized',
      worldview TEXT NOT NULL DEFAULT '',
      visual_guide TEXT NOT NULL DEFAULT '',
      director_guide TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS episodes (
      id TEXT PRIMARY KEY,
      series_id TEXT NOT NULL,
      code TEXT NOT NULL,
      title TEXT NOT NULL,
      synopsis TEXT NOT NULL,
      source_text TEXT NOT NULL,
      stage TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(series_id) REFERENCES series(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS episode_entities (
      id TEXT PRIMARY KEY,
      episode_id TEXT NOT NULL,
      type TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      prompt TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY(episode_id) REFERENCES episodes(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS episode_scripts (
      id TEXT PRIMARY KEY,
      episode_id TEXT NOT NULL,
      version INTEGER NOT NULL,
      strategy TEXT NOT NULL,
      outline_json TEXT NOT NULL,
      script_text TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY(episode_id) REFERENCES episodes(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS episode_assets (
      id TEXT PRIMARY KEY,
      episode_id TEXT NOT NULL,
      type TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      prompt TEXT NOT NULL,
      image_url TEXT,
      locked INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      FOREIGN KEY(episode_id) REFERENCES episodes(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS episode_storyboards (
      id TEXT PRIMARY KEY,
      episode_id TEXT NOT NULL,
      shot_index INTEGER NOT NULL,
      title TEXT NOT NULL,
      action TEXT NOT NULL,
      dialogue TEXT NOT NULL,
      prompt TEXT NOT NULL,
      duration_seconds INTEGER NOT NULL,
      asset_refs_json TEXT NOT NULL,
      status TEXT NOT NULL,
      image_url TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY(episode_id) REFERENCES episodes(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS episode_video_candidates (
      id TEXT PRIMARY KEY,
      episode_id TEXT NOT NULL,
      storyboard_id TEXT NOT NULL,
      provider TEXT NOT NULL,
      model TEXT NOT NULL,
      status TEXT NOT NULL,
      summary TEXT NOT NULL,
      video_url TEXT,
      local_path TEXT,
      selected INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      FOREIGN KEY(episode_id) REFERENCES episodes(id) ON DELETE CASCADE,
      FOREIGN KEY(storyboard_id) REFERENCES episode_storyboards(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS episode_final_cuts (
      episode_id TEXT PRIMARY KEY,
      file_path TEXT NOT NULL,
      file_url TEXT NOT NULL,
      format TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY(episode_id) REFERENCES episodes(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS vendors (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      provider TEXT NOT NULL,
      base_url TEXT NOT NULL,
      api_key TEXT NOT NULL,
      enabled INTEGER NOT NULL,
      models_json TEXT NOT NULL,
      config_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      series_id TEXT NOT NULL,
      episode_id TEXT NOT NULL,
      stage TEXT NOT NULL,
      action TEXT NOT NULL,
      status TEXT NOT NULL,
      input_json TEXT NOT NULL,
      output_json TEXT,
      error TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(series_id) REFERENCES series(id) ON DELETE CASCADE,
      FOREIGN KEY(episode_id) REFERENCES episodes(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS series_strategies (
      series_id TEXT PRIMARY KEY,
      text_model_ref TEXT,
      image_model_ref TEXT,
      video_model_ref TEXT,
      prompt_policies_json TEXT NOT NULL DEFAULT '[]',
      agent_policies_json TEXT NOT NULL DEFAULT '[]',
      updated_at TEXT NOT NULL,
      FOREIGN KEY(series_id) REFERENCES series(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS episode_script_workspaces (
      episode_id TEXT PRIMARY KEY,
      target_words INTEGER NOT NULL DEFAULT 1200,
      aspect_ratio TEXT NOT NULL DEFAULT '9:16',
      creation_mode TEXT NOT NULL DEFAULT 'image_to_video',
      visual_tone TEXT NOT NULL DEFAULT 'realistic',
      chapter_cursor TEXT NOT NULL DEFAULT '',
      quick_notes_json TEXT NOT NULL DEFAULT '[]',
      style_references_json TEXT NOT NULL DEFAULT '[]',
      updated_at TEXT NOT NULL,
      FOREIGN KEY(episode_id) REFERENCES episodes(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS series_shared_assets (
      id TEXT PRIMARY KEY,
      series_id TEXT NOT NULL,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      summary TEXT NOT NULL DEFAULT '',
      main_version TEXT NOT NULL DEFAULT 'v1',
      locked INTEGER NOT NULL DEFAULT 0,
      note TEXT NOT NULL DEFAULT '',
      owner TEXT NOT NULL DEFAULT '',
      episode_refs_json TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(series_id) REFERENCES series(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS series_shared_asset_variants (
      id TEXT PRIMARY KEY,
      asset_id TEXT NOT NULL,
      label TEXT NOT NULL,
      prompt TEXT NOT NULL DEFAULT '',
      selected INTEGER NOT NULL DEFAULT 0,
      locked INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(asset_id) REFERENCES series_shared_assets(id) ON DELETE CASCADE
    );
  `);

  if (!tableHasColumn(db, "series", "worldview")) {
    db.exec("ALTER TABLE series ADD COLUMN worldview TEXT NOT NULL DEFAULT ''");
  }
  if (!tableHasColumn(db, "series", "status")) {
    db.exec("ALTER TABLE series ADD COLUMN status TEXT NOT NULL DEFAULT 'initialized'");
  }
  if (!tableHasColumn(db, "series", "visual_guide")) {
    db.exec("ALTER TABLE series ADD COLUMN visual_guide TEXT NOT NULL DEFAULT ''");
  }
  if (!tableHasColumn(db, "series", "director_guide")) {
    db.exec("ALTER TABLE series ADD COLUMN director_guide TEXT NOT NULL DEFAULT ''");
  }

  const insertVendor = db.prepare(`
    INSERT OR IGNORE INTO vendors (
      id, name, provider, base_url, api_key, enabled, models_json, config_json, created_at, updated_at
    ) VALUES (
      @id, @name, @provider, @baseUrl, @apiKey, @enabled, @modelsJson, @configJson, @createdAt, @updatedAt
    )
  `);
  const vendorSeedAt = nowIso();
  const vendorSeedTx = db.transaction((vendors: VendorConfig[]) => {
    for (const vendor of vendors) {
      insertVendor.run({
        id: vendor.id,
        name: vendor.name,
        provider: vendor.provider,
        baseUrl: vendor.baseUrl,
        apiKey: vendor.apiKey,
        enabled: vendor.enabled ? 1 : 0,
        modelsJson: JSON.stringify(vendor.models),
        configJson: JSON.stringify(vendor.config ?? {}),
        createdAt: vendorSeedAt,
        updatedAt: vendorSeedAt,
      });
    }
  });
  vendorSeedTx(defaultVendors);

  dbInstance = db;
  return db;
}

function mapEpisode(row: Record<string, unknown>): EpisodeRecord {
  return {
    id: String(row.id),
    seriesId: String(row.series_id),
    code: String(row.code),
    title: String(row.title),
    synopsis: String(row.synopsis),
    sourceText: String(row.source_text),
    stage: String(row.stage) as EpisodeStage,
    status: String(row.status) as StageStatus,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function mapSeries(row: Record<string, unknown>): SeriesRecord {
  return {
    id: String(row.id),
    title: String(row.title),
    summary: String(row.summary),
    genre: String(row.genre),
    status: String(row.status ?? "initialized") as SeriesStatus,
    worldview: String(row.worldview ?? ""),
    visualGuide: String(row.visual_guide ?? ""),
    directorGuide: String(row.director_guide ?? ""),
    createdAt: String(row.created_at),
  };
}

export const mvpStore = {
  db: ensureDb,

  listVendors(): VendorConfig[] {
    const db = ensureDb();
    const rows = db.prepare("SELECT * FROM vendors ORDER BY created_at ASC").all() as Record<string, unknown>[];
    return rows.map((row) => ({
      id: String(row.id),
      name: String(row.name),
      provider: String(row.provider) as VendorConfig["provider"],
      baseUrl: String(row.base_url),
      apiKey: String(row.api_key),
      enabled: Number(row.enabled) === 1,
      models: parseJson<VendorModel[]>(row.models_json, []),
      config: parseJson<Record<string, string>>(row.config_json, {}),
    }));
  },

  saveVendor(vendor: VendorConfig): VendorConfig {
    const db = ensureDb();
    const now = nowIso();
    db.prepare(
      `
      INSERT INTO vendors (id, name, provider, base_url, api_key, enabled, models_json, config_json, created_at, updated_at)
      VALUES (@id, @name, @provider, @baseUrl, @apiKey, @enabled, @modelsJson, @configJson, @createdAt, @updatedAt)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        provider = excluded.provider,
        base_url = excluded.base_url,
        api_key = excluded.api_key,
        enabled = excluded.enabled,
        models_json = excluded.models_json,
        config_json = excluded.config_json,
        updated_at = excluded.updated_at
      `,
    ).run({
      id: vendor.id,
      name: vendor.name,
      provider: vendor.provider,
      baseUrl: vendor.baseUrl,
      apiKey: vendor.apiKey,
      enabled: vendor.enabled ? 1 : 0,
      modelsJson: JSON.stringify(vendor.models),
      configJson: JSON.stringify(vendor.config ?? {}),
      createdAt: now,
      updatedAt: now,
    });
    return vendor;
  },

  importSeries(input: {
    title: string;
    summary: string;
    genre?: string;
    status?: SeriesStatus;
    worldview?: string;
    visualGuide?: string;
    directorGuide?: string;
    episodeSources: Array<{ title: string; synopsis: string; text: string }>;
  }): {
    series: SeriesRecord;
    episodes: EpisodeRecord[];
  } {
    const db = ensureDb();
    const seriesId = `series_${randomUUID()}`;
    const createdAt = nowIso();
    const genre = input.genre ?? "AI 短剧";
    const status = input.status ?? "initialized";
    const worldview = input.worldview ?? "围绕核心角色关系推进，确保多集叙事一致性。";
    const visualGuide = input.visualGuide ?? "写实电影感，保持主角色与主场景跨集一致。";
    const directorGuide = input.directorGuide ?? "先稳叙事再加速冲突，关键镜头优先保证衔接。";
    db.prepare(
      "INSERT INTO series (id, title, summary, genre, status, worldview, visual_guide, director_guide, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    ).run(seriesId, input.title, input.summary, genre, status, worldview, visualGuide, directorGuide, createdAt);

    const insertEpisode = db.prepare(
      `INSERT INTO episodes (
        id, series_id, code, title, synopsis, source_text, stage, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    const insertWorkspace = db.prepare(
      `INSERT INTO episode_script_workspaces (
        episode_id, target_words, aspect_ratio, creation_mode, visual_tone, chapter_cursor, quick_notes_json, style_references_json, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );

    const episodes: EpisodeRecord[] = [];
    const tx = db.transaction(() => {
      db.prepare(
        `INSERT OR IGNORE INTO series_strategies (
          series_id, text_model_ref, image_model_ref, video_model_ref, prompt_policies_json, agent_policies_json, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ).run(seriesId, null, null, null, "[]", "[]", createdAt);

      input.episodeSources.forEach((source, index) => {
        const id = `episode_${randomUUID()}`;
        const code = `Episode ${(index + 1).toString().padStart(2, "0")}`;
        insertEpisode.run(
          id,
          seriesId,
          code,
          source.title,
          source.synopsis,
          source.text,
          "planning",
          "not_started",
          createdAt,
          createdAt,
        );
        insertWorkspace.run(
          id,
          1200,
          "9:16",
          "image_to_video",
          "realistic",
          id,
          JSON.stringify(DEFAULT_SCRIPT_WORKSPACE_NOTES),
          "[]",
          createdAt,
        );

        episodes.push({
          id,
          seriesId,
          code,
          title: source.title,
          synopsis: source.synopsis,
          sourceText: source.text,
          stage: "planning",
          status: "not_started",
          createdAt,
          updatedAt: createdAt,
        });
      });
    });
    tx();

    return {
      series: {
        id: seriesId,
        title: input.title,
        summary: input.summary,
        genre,
        status,
        worldview,
        visualGuide,
        directorGuide,
        createdAt,
      },
      episodes,
    };
  },

  getSeries(seriesId: string): SeriesRecord | null {
    const db = ensureDb();
    const row = db.prepare("SELECT * FROM series WHERE id = ?").get(seriesId) as Record<string, unknown> | undefined;
    return row ? mapSeries(row) : null;
  },

  listSeries(): SeriesRecord[] {
    const db = ensureDb();
    const rows = db.prepare("SELECT * FROM series ORDER BY created_at DESC").all() as Record<string, unknown>[];
    return rows.map(mapSeries);
  },

  updateSeries(
    seriesId: string,
    patch: Partial<Pick<SeriesRecord, "title" | "summary" | "genre" | "status" | "worldview" | "visualGuide" | "directorGuide">>,
  ): SeriesRecord | null {
    const db = ensureDb();
    const current = this.getSeries(seriesId);
    if (!current) {
      return null;
    }
    const next = {
      ...current,
      ...patch,
    };
    db.prepare(
      `UPDATE series
       SET title = ?, summary = ?, genre = ?, status = ?, worldview = ?, visual_guide = ?, director_guide = ?
       WHERE id = ?`,
    ).run(
      next.title,
      next.summary,
      next.genre,
      next.status,
      next.worldview,
      next.visualGuide,
      next.directorGuide,
      seriesId,
    );
    return this.getSeries(seriesId);
  },

  deleteSeries(seriesId: string): boolean {
    const db = ensureDb();
    const result = db.prepare("DELETE FROM series WHERE id = ?").run(seriesId);
    return result.changes > 0;
  },

  updateSeriesStatus(seriesId: string, status: SeriesStatus): void {
    const db = ensureDb();
    db.prepare("UPDATE series SET status = ? WHERE id = ?").run(status, seriesId);
  },

  getSeriesStrategy(seriesId: string): SeriesStrategyRecord | null {
    const db = ensureDb();
    const row = db.prepare("SELECT * FROM series_strategies WHERE series_id = ?").get(seriesId) as Record<string, unknown> | undefined;
    if (!row) {
      return null;
    }
    return {
      seriesId,
      textModelRef: row.text_model_ref ? String(row.text_model_ref) : null,
      imageModelRef: row.image_model_ref ? String(row.image_model_ref) : null,
      videoModelRef: row.video_model_ref ? String(row.video_model_ref) : null,
      promptPolicies: parseJson<Array<{ stage: string; policy: string }>>(row.prompt_policies_json, []),
      agentPolicies: parseJson<Array<{ name: string; value: string }>>(row.agent_policies_json, []),
      updatedAt: String(row.updated_at),
    };
  },

  saveSeriesStrategy(input: {
    seriesId: string;
    textModelRef?: string | null;
    imageModelRef?: string | null;
    videoModelRef?: string | null;
    promptPolicies?: Array<{ stage: string; policy: string }>;
    agentPolicies?: Array<{ name: string; value: string }>;
  }): SeriesStrategyRecord {
    const db = ensureDb();
    const now = nowIso();
    const prev = this.getSeriesStrategy(input.seriesId);
    const record: SeriesStrategyRecord = {
      seriesId: input.seriesId,
      textModelRef: input.textModelRef ?? prev?.textModelRef ?? null,
      imageModelRef: input.imageModelRef ?? prev?.imageModelRef ?? null,
      videoModelRef: input.videoModelRef ?? prev?.videoModelRef ?? null,
      promptPolicies: input.promptPolicies ?? prev?.promptPolicies ?? [],
      agentPolicies: input.agentPolicies ?? prev?.agentPolicies ?? [],
      updatedAt: now,
    };
    db.prepare(
      `INSERT INTO series_strategies (
        series_id, text_model_ref, image_model_ref, video_model_ref, prompt_policies_json, agent_policies_json, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(series_id) DO UPDATE SET
        text_model_ref = excluded.text_model_ref,
        image_model_ref = excluded.image_model_ref,
        video_model_ref = excluded.video_model_ref,
        prompt_policies_json = excluded.prompt_policies_json,
        agent_policies_json = excluded.agent_policies_json,
        updated_at = excluded.updated_at`,
    ).run(
      record.seriesId,
      record.textModelRef,
      record.imageModelRef,
      record.videoModelRef,
      JSON.stringify(record.promptPolicies),
      JSON.stringify(record.agentPolicies),
      record.updatedAt,
    );
    return record;
  },

  listSeriesSharedAssets(seriesId: string): SeriesSharedAssetRecord[] {
    const db = ensureDb();
    const rows = db
      .prepare("SELECT * FROM series_shared_assets WHERE series_id = ? ORDER BY updated_at DESC")
      .all(seriesId) as Record<string, unknown>[];

    return rows.map((row) => ({
      id: String(row.id),
      seriesId: String(row.series_id),
      name: String(row.name),
      category: String(row.category) as SeriesSharedAssetRecord["category"],
      summary: String(row.summary ?? ""),
      mainVersion: String(row.main_version ?? "v1"),
      locked: Number(row.locked) === 1,
      note: String(row.note ?? ""),
      owner: String(row.owner ?? ""),
      episodeRefs: parseJson<string[]>(row.episode_refs_json, []),
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
    }));
  },

  listSeriesSharedAssetVariants(assetId: string): SeriesSharedAssetVariantRecord[] {
    const db = ensureDb();
    const rows = db
      .prepare("SELECT * FROM series_shared_asset_variants WHERE asset_id = ? ORDER BY created_at ASC")
      .all(assetId) as Record<string, unknown>[];

    return rows.map((row) => ({
      id: String(row.id),
      assetId: String(row.asset_id),
      label: String(row.label),
      prompt: String(row.prompt ?? ""),
      selected: Number(row.selected) === 1,
      locked: Number(row.locked) === 1,
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
    }));
  },

  saveSeriesSharedAsset(input: {
    seriesId: string;
    name: string;
    category: SeriesSharedAssetRecord["category"];
    summary: string;
    mainVersion: string;
    locked: boolean;
    note?: string;
    owner?: string;
    episodeRefs?: string[];
    variants: Array<{
      id?: string;
      label: string;
      prompt: string;
      selected: boolean;
      locked: boolean;
    }>;
  }): { asset: SeriesSharedAssetRecord; variants: SeriesSharedAssetVariantRecord[] } {
    const db = ensureDb();
    const now = nowIso();
    const existing = db
      .prepare("SELECT * FROM series_shared_assets WHERE series_id = ? AND category = ? AND name = ?")
      .get(input.seriesId, input.category, input.name) as Record<string, unknown> | undefined;

    const assetId = existing ? String(existing.id) : `shared_asset_${randomUUID()}`;
    const createdAt = existing ? String(existing.created_at) : now;
    const note =
      input.note ??
      (input.locked ? "已锁定系列主版本" : "可继续调整主版本与锁定状态");
    const owner = input.owner ?? (existing?.owner ? String(existing.owner) : "");
    const episodeRefs = input.episodeRefs ?? parseJson<string[]>(existing?.episode_refs_json, []);

    const asset: SeriesSharedAssetRecord = {
      id: assetId,
      seriesId: input.seriesId,
      name: input.name,
      category: input.category,
      summary: input.summary,
      mainVersion: input.mainVersion,
      locked: input.locked,
      note,
      owner,
      episodeRefs,
      createdAt,
      updatedAt: now,
    };

    const variants = input.variants.map((variant) => ({
      id: variant.id ?? `shared_asset_variant_${randomUUID()}`,
      assetId,
      label: variant.label,
      prompt: variant.prompt,
      selected: variant.selected,
      locked: variant.locked,
      createdAt: now,
      updatedAt: now,
    }));

    const tx = db.transaction(() => {
      db.prepare(
        `INSERT INTO series_shared_assets (
          id, series_id, name, category, summary, main_version, locked, note, owner, episode_refs_json, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          summary = excluded.summary,
          main_version = excluded.main_version,
          locked = excluded.locked,
          note = excluded.note,
          owner = excluded.owner,
          episode_refs_json = excluded.episode_refs_json,
          updated_at = excluded.updated_at`,
      ).run(
        asset.id,
        asset.seriesId,
        asset.name,
        asset.category,
        asset.summary,
        asset.mainVersion,
        asset.locked ? 1 : 0,
        asset.note,
        asset.owner,
        JSON.stringify(asset.episodeRefs),
        asset.createdAt,
        asset.updatedAt,
      );

      db.prepare("DELETE FROM series_shared_asset_variants WHERE asset_id = ?").run(assetId);
      const insertVariant = db.prepare(
        `INSERT INTO series_shared_asset_variants (
          id, asset_id, label, prompt, selected, locked, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      );
      for (const variant of variants) {
        insertVariant.run(
          variant.id,
          variant.assetId,
          variant.label,
          variant.prompt,
          variant.selected ? 1 : 0,
          variant.locked ? 1 : 0,
          variant.createdAt,
          variant.updatedAt,
        );
      }
    });
    tx();

    return { asset, variants };
  },

  createEpisode(input: {
    seriesId: string;
    title: string;
    synopsis: string;
    sourceText?: string;
  }): EpisodeRecord {
    const db = ensureDb();
    const createdAt = nowIso();
    const existingCount = (db.prepare("SELECT COUNT(*) AS count FROM episodes WHERE series_id = ?").get(input.seriesId) as { count: number }).count;
    const code = `Episode ${(existingCount + 1).toString().padStart(2, "0")}`;
    const episodeId = `episode_${randomUUID()}`;
    const sourceText = input.sourceText?.trim() || input.synopsis || input.title;

    const tx = db.transaction(() => {
      db.prepare(
        `INSERT INTO episodes (
          id, series_id, code, title, synopsis, source_text, stage, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        episodeId,
        input.seriesId,
        code,
        input.title,
        input.synopsis,
        sourceText,
        "planning",
        "not_started",
        createdAt,
        createdAt,
      );
      db.prepare(
        `INSERT INTO episode_script_workspaces (
          episode_id, target_words, aspect_ratio, creation_mode, visual_tone, chapter_cursor, quick_notes_json, style_references_json, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        episodeId,
        1200,
        "9:16",
        "image_to_video",
        "realistic",
        episodeId,
        JSON.stringify(DEFAULT_SCRIPT_WORKSPACE_NOTES),
        "[]",
        createdAt,
      );
    });
    tx();

    return {
      id: episodeId,
      seriesId: input.seriesId,
      code,
      title: input.title,
      synopsis: input.synopsis,
      sourceText,
      stage: "planning",
      status: "not_started",
      createdAt,
      updatedAt: createdAt,
    };
  },

  createEpisodesBatch(input: {
    seriesId: string;
    episodes: Array<{ title: string; synopsis: string; sourceText?: string }>;
  }): EpisodeRecord[] {
    const created: EpisodeRecord[] = [];
    for (const item of input.episodes) {
      created.push(
        this.createEpisode({
          seriesId: input.seriesId,
          title: item.title,
          synopsis: item.synopsis,
          sourceText: item.sourceText,
        }),
      );
    }
    return created;
  },

  listEpisodes(seriesId: string): EpisodeRecord[] {
    const db = ensureDb();
    const rows = db
      .prepare("SELECT * FROM episodes WHERE series_id = ? ORDER BY created_at ASC")
      .all(seriesId) as Record<string, unknown>[];
    return rows.map(mapEpisode);
  },

  getEpisode(episodeId: string): EpisodeRecord | null {
    const db = ensureDb();
    const row = db.prepare("SELECT * FROM episodes WHERE id = ?").get(episodeId) as Record<string, unknown> | undefined;
    return row ? mapEpisode(row) : null;
  },

  updateEpisode(
    episodeId: string,
    input: {
      title?: string;
      synopsis?: string;
      sourceText?: string;
    },
  ): EpisodeRecord | null {
    const db = ensureDb();
    const current = this.getEpisode(episodeId);
    if (!current) {
      return null;
    }

    const updated: EpisodeRecord = {
      ...current,
      title: input.title ?? current.title,
      synopsis: input.synopsis ?? current.synopsis,
      sourceText: input.sourceText ?? current.sourceText,
      updatedAt: nowIso(),
    };

    db.prepare(
      `UPDATE episodes
      SET title = ?, synopsis = ?, source_text = ?, updated_at = ?
      WHERE id = ?`,
    ).run(updated.title, updated.synopsis, updated.sourceText, updated.updatedAt, episodeId);

    return updated;
  },

  updateEpisodeStage(episodeId: string, stage: EpisodeStage, status: StageStatus): void {
    const db = ensureDb();
    db.prepare("UPDATE episodes SET stage = ?, status = ?, updated_at = ? WHERE id = ?").run(stage, status, nowIso(), episodeId);
  },

  replaceEntities(episodeId: string, entities: Array<Omit<EntityRecord, "id" | "episodeId" | "createdAt">>): EntityRecord[] {
    const db = ensureDb();
    const createdAt = nowIso();
    const insert = db.prepare(
      "INSERT INTO episode_entities (id, episode_id, type, name, description, prompt, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    );
    const rows: EntityRecord[] = [];

    const tx = db.transaction(() => {
      db.prepare("DELETE FROM episode_entities WHERE episode_id = ?").run(episodeId);
      entities.forEach((entity) => {
        const id = `entity_${randomUUID()}`;
        insert.run(id, episodeId, entity.type, entity.name, entity.description, entity.prompt, createdAt);
        rows.push({
          id,
          episodeId,
          type: entity.type,
          name: entity.name,
          description: entity.description,
          prompt: entity.prompt,
          createdAt,
        });
      });
    });
    tx();
    return rows;
  },

  listEntities(episodeId: string): EntityRecord[] {
    const db = ensureDb();
    const rows = db
      .prepare("SELECT * FROM episode_entities WHERE episode_id = ? ORDER BY created_at ASC")
      .all(episodeId) as Record<string, unknown>[];
    return rows.map((row) => ({
      id: String(row.id),
      episodeId: String(row.episode_id),
      type: String(row.type) as EntityRecord["type"],
      name: String(row.name),
      description: String(row.description),
      prompt: String(row.prompt),
      createdAt: String(row.created_at),
    }));
  },

  saveScript(episodeId: string, input: { strategy: string; outline: string[]; scriptText: string }): ScriptRecord {
    const db = ensureDb();
    const previousVersion = (db
      .prepare("SELECT MAX(version) AS version FROM episode_scripts WHERE episode_id = ?")
      .get(episodeId) as { version: number | null }).version;
    const version = (previousVersion ?? 0) + 1;
    const id = `script_${randomUUID()}`;
    const createdAt = nowIso();

    db.prepare(
      "INSERT INTO episode_scripts (id, episode_id, version, strategy, outline_json, script_text, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    ).run(id, episodeId, version, input.strategy, JSON.stringify(input.outline), input.scriptText, createdAt);

    return {
      id,
      episodeId,
      version,
      strategy: input.strategy,
      outline: input.outline,
      scriptText: input.scriptText,
      createdAt,
    };
  },

  getLatestScript(episodeId: string): ScriptRecord | null {
    const db = ensureDb();
    const row = db
      .prepare("SELECT * FROM episode_scripts WHERE episode_id = ? ORDER BY version DESC LIMIT 1")
      .get(episodeId) as Record<string, unknown> | undefined;
    if (!row) {
      return null;
    }
    return {
      id: String(row.id),
      episodeId: String(row.episode_id),
      version: Number(row.version),
      strategy: String(row.strategy),
      outline: parseJson<string[]>(row.outline_json, []),
      scriptText: String(row.script_text),
      createdAt: String(row.created_at),
    };
  },

  getEpisodeScriptWorkspaceConfig(episodeId: string): EpisodeScriptWorkspaceConfigRecord | null {
    const db = ensureDb();
    const row = db
      .prepare("SELECT * FROM episode_script_workspaces WHERE episode_id = ?")
      .get(episodeId) as Record<string, unknown> | undefined;
    if (!row) {
      return null;
    }
    return {
      episodeId,
      targetWords: Number(row.target_words ?? 1200),
      aspectRatio: String(row.aspect_ratio ?? "9:16") as EpisodeScriptWorkspaceConfigRecord["aspectRatio"],
      creationMode: String(row.creation_mode ?? "image_to_video") as EpisodeScriptWorkspaceConfigRecord["creationMode"],
      visualTone: String(row.visual_tone ?? "realistic") as EpisodeScriptWorkspaceConfigRecord["visualTone"],
      chapterCursor: String(row.chapter_cursor ?? episodeId),
      quickNotes: parseJson<string[]>(row.quick_notes_json, []),
      styleReferences: parseJson<ScriptStyleReference[]>(row.style_references_json, []),
      updatedAt: String(row.updated_at),
    };
  },

  saveEpisodeScriptWorkspaceConfig(input: {
    episodeId: string;
    targetWords?: number;
    aspectRatio?: EpisodeScriptWorkspaceConfigRecord["aspectRatio"];
    creationMode?: EpisodeScriptWorkspaceConfigRecord["creationMode"];
    visualTone?: EpisodeScriptWorkspaceConfigRecord["visualTone"];
    chapterCursor?: string;
    quickNotes?: string[];
    styleReferences?: ScriptStyleReference[];
  }): EpisodeScriptWorkspaceConfigRecord {
    const db = ensureDb();
    const now = nowIso();
    const prev = this.getEpisodeScriptWorkspaceConfig(input.episodeId);
    const record: EpisodeScriptWorkspaceConfigRecord = {
      episodeId: input.episodeId,
      targetWords: input.targetWords ?? prev?.targetWords ?? 1200,
      aspectRatio: input.aspectRatio ?? prev?.aspectRatio ?? "9:16",
      creationMode: input.creationMode ?? prev?.creationMode ?? "image_to_video",
      visualTone: input.visualTone ?? prev?.visualTone ?? "realistic",
      chapterCursor: input.chapterCursor ?? prev?.chapterCursor ?? input.episodeId,
      quickNotes:
        input.quickNotes ??
        prev?.quickNotes ?? [
          "先明确冲突，再补对白节奏。",
          "风格参数保持跨集一致。",
          "确认剧本后再进入资产阶段。",
        ],
      styleReferences: input.styleReferences ?? prev?.styleReferences ?? [],
      updatedAt: now,
    };

    db.prepare(
      `INSERT INTO episode_script_workspaces (
        episode_id, target_words, aspect_ratio, creation_mode, visual_tone, chapter_cursor, quick_notes_json, style_references_json, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(episode_id) DO UPDATE SET
        target_words = excluded.target_words,
        aspect_ratio = excluded.aspect_ratio,
        creation_mode = excluded.creation_mode,
        visual_tone = excluded.visual_tone,
        chapter_cursor = excluded.chapter_cursor,
        quick_notes_json = excluded.quick_notes_json,
        style_references_json = excluded.style_references_json,
        updated_at = excluded.updated_at`,
    ).run(
      record.episodeId,
      record.targetWords,
      record.aspectRatio,
      record.creationMode,
      record.visualTone,
      record.chapterCursor,
      JSON.stringify(record.quickNotes),
      JSON.stringify(record.styleReferences),
      record.updatedAt,
    );

    return record;
  },

  replaceAssets(
    episodeId: string,
    assets: Array<Omit<AssetRecord, "id" | "episodeId" | "createdAt" | "locked" | "imageUrl"> & { imageUrl?: string | null; locked?: boolean }>,
  ): AssetRecord[] {
    const db = ensureDb();
    const createdAt = nowIso();
    const insert = db.prepare(
      "INSERT INTO episode_assets (id, episode_id, type, name, description, prompt, image_url, locked, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    );
    const rows: AssetRecord[] = [];

    const tx = db.transaction(() => {
      db.prepare("DELETE FROM episode_assets WHERE episode_id = ?").run(episodeId);
      assets.forEach((asset) => {
        const id = `asset_${randomUUID()}`;
        const locked = asset.locked ? 1 : 0;
        insert.run(
          id,
          episodeId,
          asset.type,
          asset.name,
          asset.description,
          asset.prompt,
          asset.imageUrl ?? null,
          locked,
          createdAt,
        );
        rows.push({
          id,
          episodeId,
          type: asset.type,
          name: asset.name,
          description: asset.description,
          prompt: asset.prompt,
          imageUrl: asset.imageUrl ?? null,
          locked: Boolean(asset.locked),
          createdAt,
        });
      });
    });
    tx();

    return rows;
  },

  listAssets(episodeId: string): AssetRecord[] {
    const db = ensureDb();
    const rows = db
      .prepare("SELECT * FROM episode_assets WHERE episode_id = ? ORDER BY created_at ASC")
      .all(episodeId) as Record<string, unknown>[];
    return rows.map((row) => ({
      id: String(row.id),
      episodeId: String(row.episode_id),
      type: String(row.type) as AssetRecord["type"],
      name: String(row.name),
      description: String(row.description),
      prompt: String(row.prompt),
      imageUrl: row.image_url ? String(row.image_url) : null,
      locked: Number(row.locked) === 1,
      createdAt: String(row.created_at),
    }));
  },

  replaceStoryboards(
    episodeId: string,
    storyboards: Array<Omit<StoryboardRecord, "id" | "episodeId" | "createdAt" | "imageUrl" | "status"> & { imageUrl?: string | null; status?: StoryboardRecord["status"] }>,
  ): StoryboardRecord[] {
    const db = ensureDb();
    const createdAt = nowIso();
    const insert = db.prepare(
      `INSERT INTO episode_storyboards (
        id, episode_id, shot_index, title, action, dialogue, prompt, duration_seconds, asset_refs_json, status, image_url, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    const rows: StoryboardRecord[] = [];

    const tx = db.transaction(() => {
      db.prepare("DELETE FROM episode_storyboards WHERE episode_id = ?").run(episodeId);
      storyboards.forEach((item) => {
        const id = `shot_${randomUUID()}`;
        const status = item.status ?? "draft";
        insert.run(
          id,
          episodeId,
          item.shotIndex,
          item.title,
          item.action,
          item.dialogue,
          item.prompt,
          item.durationSeconds,
          JSON.stringify(item.assetRefs),
          status,
          item.imageUrl ?? null,
          createdAt,
        );
        rows.push({
          id,
          episodeId,
          shotIndex: item.shotIndex,
          title: item.title,
          action: item.action,
          dialogue: item.dialogue,
          prompt: item.prompt,
          durationSeconds: item.durationSeconds,
          assetRefs: item.assetRefs,
          status,
          imageUrl: item.imageUrl ?? null,
          createdAt,
        });
      });
    });
    tx();
    return rows;
  },

  listStoryboards(episodeId: string): StoryboardRecord[] {
    const db = ensureDb();
    const rows = db
      .prepare("SELECT * FROM episode_storyboards WHERE episode_id = ? ORDER BY shot_index ASC")
      .all(episodeId) as Record<string, unknown>[];
    return rows.map((row) => ({
      id: String(row.id),
      episodeId: String(row.episode_id),
      shotIndex: Number(row.shot_index),
      title: String(row.title),
      action: String(row.action),
      dialogue: String(row.dialogue),
      prompt: String(row.prompt),
      durationSeconds: Number(row.duration_seconds),
      assetRefs: parseJson<string[]>(row.asset_refs_json, []),
      status: String(row.status) as StoryboardRecord["status"],
      imageUrl: row.image_url ? String(row.image_url) : null,
      createdAt: String(row.created_at),
    }));
  },

  replaceVideoCandidates(
    episodeId: string,
    candidates: Array<Omit<VideoCandidateRecord, "id" | "episodeId" | "createdAt" | "selected"> & { selected?: boolean }>,
  ): VideoCandidateRecord[] {
    const db = ensureDb();
    const createdAt = nowIso();
    const insert = db.prepare(
      `INSERT INTO episode_video_candidates (
        id, episode_id, storyboard_id, provider, model, status, summary, video_url, local_path, selected, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    const rows: VideoCandidateRecord[] = [];

    const tx = db.transaction(() => {
      db.prepare("DELETE FROM episode_video_candidates WHERE episode_id = ?").run(episodeId);
      candidates.forEach((item) => {
        const id = `video_${randomUUID()}`;
        const selected = item.selected ? 1 : 0;
        insert.run(
          id,
          episodeId,
          item.storyboardId,
          item.provider,
          item.model,
          item.status,
          item.summary,
          item.videoUrl ?? null,
          item.localPath ?? null,
          selected,
          createdAt,
        );
        rows.push({
          id,
          episodeId,
          storyboardId: item.storyboardId,
          provider: item.provider,
          model: item.model,
          status: item.status,
          summary: item.summary,
          videoUrl: item.videoUrl ?? null,
          localPath: item.localPath ?? null,
          selected: Boolean(item.selected),
          createdAt,
        });
      });
    });
    tx();

    return rows;
  },

  listVideoCandidates(episodeId: string): VideoCandidateRecord[] {
    const db = ensureDb();
    const rows = db
      .prepare("SELECT * FROM episode_video_candidates WHERE episode_id = ? ORDER BY created_at ASC")
      .all(episodeId) as Record<string, unknown>[];
    return rows.map((row) => ({
      id: String(row.id),
      episodeId: String(row.episode_id),
      storyboardId: String(row.storyboard_id),
      provider: String(row.provider),
      model: String(row.model),
      status: String(row.status) as VideoCandidateRecord["status"],
      summary: String(row.summary),
      videoUrl: row.video_url ? String(row.video_url) : null,
      localPath: row.local_path ? String(row.local_path) : null,
      selected: Number(row.selected) === 1,
      createdAt: String(row.created_at),
    }));
  },

  selectVideoCandidate(episodeId: string, candidateId: string): VideoCandidateRecord | null {
    const db = ensureDb();
    const target = db
      .prepare("SELECT storyboard_id FROM episode_video_candidates WHERE episode_id = ? AND id = ?")
      .get(episodeId, candidateId) as { storyboard_id?: string } | undefined;
    if (!target?.storyboard_id) {
      return null;
    }

    const tx = db.transaction(() => {
      db.prepare("UPDATE episode_video_candidates SET selected = 0 WHERE episode_id = ? AND storyboard_id = ?").run(
        episodeId,
        target.storyboard_id,
      );
      db.prepare("UPDATE episode_video_candidates SET selected = 1 WHERE episode_id = ? AND id = ?").run(episodeId, candidateId);
    });
    tx();

    const row = db
      .prepare("SELECT * FROM episode_video_candidates WHERE episode_id = ? AND id = ?")
      .get(episodeId, candidateId) as Record<string, unknown> | undefined;

    if (!row) {
      return null;
    }

    return {
      id: String(row.id),
      episodeId: String(row.episode_id),
      storyboardId: String(row.storyboard_id),
      provider: String(row.provider),
      model: String(row.model),
      status: String(row.status) as VideoCandidateRecord["status"],
      summary: String(row.summary),
      videoUrl: row.video_url ? String(row.video_url) : null,
      localPath: row.local_path ? String(row.local_path) : null,
      selected: Number(row.selected) === 1,
      createdAt: String(row.created_at),
    };
  },

  saveFinalCut(record: FinalCutRecord): FinalCutRecord {
    const db = ensureDb();
    db.prepare(
      `INSERT INTO episode_final_cuts (episode_id, file_path, file_url, format, created_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(episode_id) DO UPDATE SET
         file_path = excluded.file_path,
         file_url = excluded.file_url,
         format = excluded.format,
         created_at = excluded.created_at`,
    ).run(record.episodeId, record.filePath, record.fileUrl, record.format, record.createdAt);
    return record;
  },

  getFinalCut(episodeId: string): FinalCutRecord | null {
    const db = ensureDb();
    const row = db.prepare("SELECT * FROM episode_final_cuts WHERE episode_id = ?").get(episodeId) as Record<string, unknown> | undefined;
    if (!row) {
      return null;
    }
    return {
      episodeId: String(row.episode_id),
      filePath: String(row.file_path),
      fileUrl: String(row.file_url),
      format: String(row.format),
      createdAt: String(row.created_at),
    };
  },

  createTask(input: {
    seriesId: string;
    episodeId: string;
    stage: EpisodeStage;
    action: string;
    status?: TaskRecord["status"];
    payload?: Record<string, unknown>;
  }): TaskRecord {
    const db = ensureDb();
    const createdAt = nowIso();
    const task: TaskRecord = {
      id: `task_${randomUUID()}`,
      seriesId: input.seriesId,
      episodeId: input.episodeId,
      stage: input.stage,
      action: input.action,
      status: input.status ?? "running",
      input: input.payload ?? {},
      output: null,
      error: null,
      createdAt,
      updatedAt: createdAt,
    };
    db.prepare(
      `INSERT INTO tasks (id, series_id, episode_id, stage, action, status, input_json, output_json, error, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      task.id,
      task.seriesId,
      task.episodeId,
      task.stage,
      task.action,
      task.status,
      JSON.stringify(task.input),
      null,
      null,
      task.createdAt,
      task.updatedAt,
    );
    return task;
  },

  updateTask(taskId: string, patch: { status?: TaskRecord["status"]; output?: Record<string, unknown> | null; error?: string | null }): void {
    const db = ensureDb();
    const existing = db.prepare("SELECT * FROM tasks WHERE id = ?").get(taskId) as Record<string, unknown> | undefined;
    if (!existing) {
      return;
    }
    const status = patch.status ?? (String(existing.status) as TaskRecord["status"]);
    const outputJson = patch.output === undefined ? existing.output_json : patch.output ? JSON.stringify(patch.output) : null;
    const errorValue = patch.error === undefined ? existing.error : patch.error;
    db.prepare("UPDATE tasks SET status = ?, output_json = ?, error = ?, updated_at = ? WHERE id = ?").run(
      status,
      outputJson,
      errorValue,
      nowIso(),
      taskId,
    );
  },

  listTasks(
    filter?:
      | string
      | {
          episodeId?: string;
          seriesId?: string;
          stage?: EpisodeStage;
          status?: TaskRecord["status"];
        },
  ): TaskRecord[] {
    const db = ensureDb();
    const normalized = typeof filter === "string" ? { episodeId: filter } : filter ?? {};
    const where: string[] = [];
    const params: Array<string> = [];
    if (normalized.episodeId) {
      where.push("episode_id = ?");
      params.push(normalized.episodeId);
    }
    if (normalized.seriesId) {
      where.push("series_id = ?");
      params.push(normalized.seriesId);
    }
    if (normalized.stage) {
      where.push("stage = ?");
      params.push(normalized.stage);
    }
    if (normalized.status) {
      where.push("status = ?");
      params.push(normalized.status);
    }
    const sql = `SELECT * FROM tasks${where.length > 0 ? ` WHERE ${where.join(" AND ")}` : ""} ORDER BY created_at DESC`;
    const rows = db.prepare(sql).all(...params) as Record<string, unknown>[];

    return rows.map((row) => ({
      id: String(row.id),
      seriesId: String(row.series_id),
      episodeId: String(row.episode_id),
      stage: String(row.stage) as EpisodeStage,
      action: String(row.action),
      status: String(row.status) as TaskRecord["status"],
      input: parseJson<Record<string, unknown>>(row.input_json, {}),
      output: row.output_json ? parseJson<Record<string, unknown>>(row.output_json, {}) : null,
      error: row.error ? String(row.error) : null,
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
    }));
  },

  getTask(taskId: string): TaskRecord | null {
    const db = ensureDb();
    const row = db.prepare("SELECT * FROM tasks WHERE id = ?").get(taskId) as Record<string, unknown> | undefined;
    if (!row) {
      return null;
    }
    return {
      id: String(row.id),
      seriesId: String(row.series_id),
      episodeId: String(row.episode_id),
      stage: String(row.stage) as EpisodeStage,
      action: String(row.action),
      status: String(row.status) as TaskRecord["status"],
      input: parseJson<Record<string, unknown>>(row.input_json, {}),
      output: row.output_json ? parseJson<Record<string, unknown>>(row.output_json, {}) : null,
      error: row.error ? String(row.error) : null,
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
    };
  },

  getEpisodeSnapshot(episodeId: string): EpisodeSnapshot | null {
    const episode = this.getEpisode(episodeId);
    if (!episode) {
      return null;
    }

    return {
      episode,
      entities: this.listEntities(episodeId),
      script: this.getLatestScript(episodeId),
      assets: this.listAssets(episodeId),
      storyboards: this.listStoryboards(episodeId),
      videos: this.listVideoCandidates(episodeId),
      finalCut: this.getFinalCut(episodeId),
    };
  },
};
