import { extname, join, relative, sep } from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { generateEpisodeAssets, generateEpisodeEntities, generateEpisodeScript, generateEpisodeStoryboards } from "@/server/mvp/agent";
import { concatFinalCut, createSyntheticClip } from "@/server/mvp/media";
import { mvpStore } from "@/server/mvp/store";
import type { EpisodeRecord, EpisodeSnapshot, EpisodeStage, VideoCandidateRecord } from "@/server/mvp/types";
import { runVideoModel } from "@/server/mvp/vendors";

type EpisodeSourceInput = {
  title: string;
  synopsis: string;
  text: string;
};

type PipelineOptions = {
  textModelRef?: string;
  videoModelRef?: string;
};

const PUBLIC_ROOT = join(process.cwd(), "public");

const nowIso = () => new Date().toISOString();

function toPublicUrl(absPath: string): string {
  const rel = relative(PUBLIC_ROOT, absPath).split(sep).join("/");
  return `/${rel}`;
}

function compactText(input: string): string {
  return input.replace(/\s+/g, " ").trim();
}

function buildSynopsis(text: string): string {
  const cleaned = compactText(text);
  if (cleaned.length <= 72) {
    return cleaned;
  }
  return `${cleaned.slice(0, 72)}...`;
}

function chunkByHeadings(text: string): EpisodeSourceInput[] {
  const headingRegex = /(第[0-9一二三四五六七八九十百千万两]+[章节回集][^\n]*)/g;
  const parts = text.split(headingRegex).map((item) => item.trim()).filter(Boolean);

  if (parts.length < 3) {
    return [];
  }

  const episodes: EpisodeSourceInput[] = [];
  for (let i = 1; i < parts.length; i += 2) {
    const heading = parts[i] ?? `第${episodes.length + 1}集`;
    const body = compactText(parts[i + 1] ?? "");
    if (!body) {
      continue;
    }
    episodes.push({
      title: heading,
      synopsis: buildSynopsis(body),
      text: body,
    });
  }

  return episodes;
}

function chunkByLength(text: string, maxEpisodes: number): EpisodeSourceInput[] {
  const blocks = text
    .split(/\n{2,}/)
    .map((item) => compactText(item))
    .filter(Boolean);

  if (blocks.length === 0) {
    return [];
  }

  const totalLen = blocks.reduce((sum, block) => sum + block.length, 0);
  const targetLen = Math.max(1200, Math.floor(totalLen / Math.max(1, maxEpisodes)));

  const episodes: EpisodeSourceInput[] = [];
  let current = "";

  const flush = () => {
    const body = compactText(current);
    if (!body) {
      return;
    }
    const index = episodes.length + 1;
    episodes.push({
      title: `第${index}集`,
      synopsis: buildSynopsis(body),
      text: body,
    });
    current = "";
  };

  for (const block of blocks) {
    if (!current) {
      current = block;
      continue;
    }
    if (current.length + block.length > targetLen && episodes.length + 1 < maxEpisodes) {
      flush();
      current = block;
      continue;
    }
    current = `${current}\n\n${block}`;
  }
  flush();

  return episodes;
}

export function splitNovelToEpisodes(input: {
  text: string;
  maxEpisodes?: number;
}): EpisodeSourceInput[] {
  const normalized = input.text.replace(/\r\n/g, "\n").trim();
  if (!normalized) {
    return [];
  }

  const byHeadings = chunkByHeadings(normalized);
  if (byHeadings.length > 0) {
    return byHeadings;
  }

  return chunkByLength(normalized, input.maxEpisodes ?? 12);
}

function getEpisodeOrThrow(episodeId: string): EpisodeRecord {
  const episode = mvpStore.getEpisode(episodeId);
  if (!episode) {
    throw new Error(`未找到集数: ${episodeId}`);
  }
  return episode;
}

function refreshSeriesStatus(seriesId: string): void {
  const episodes = mvpStore.listEpisodes(seriesId);
  if (episodes.length === 0) {
    mvpStore.updateSeriesStatus(seriesId, "initialized");
    return;
  }

  const doneCount = episodes.filter((episode) => episode.status === "done").length;
  if (doneCount === episodes.length) {
    mvpStore.updateSeriesStatus(seriesId, "done");
    return;
  }
  if (doneCount > 0) {
    mvpStore.updateSeriesStatus(seriesId, "partial_done");
    return;
  }
  mvpStore.updateSeriesStatus(seriesId, "producing");
}

async function runTask<T>(input: {
  episode: EpisodeRecord;
  stage: EpisodeStage;
  action: string;
  payload?: Record<string, unknown>;
  onErrorStatus?: { stage: EpisodeStage; status: "blocked" };
  runner: () => Promise<T>;
  toOutput?: (value: T) => Record<string, unknown>;
}): Promise<T> {
  const task = mvpStore.createTask({
    seriesId: input.episode.seriesId,
    episodeId: input.episode.id,
    stage: input.stage,
    action: input.action,
    payload: input.payload,
  });

  try {
    const value = await input.runner();
    mvpStore.updateTask(task.id, {
      status: "success",
      output: input.toOutput ? input.toOutput(value) : ({ ok: true } satisfies Record<string, unknown>),
    });
    return value;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    mvpStore.updateTask(task.id, {
      status: "failed",
      error: message,
    });
    if (input.onErrorStatus) {
      mvpStore.updateEpisodeStage(input.episode.id, input.onErrorStatus.stage, input.onErrorStatus.status);
    }
    throw error;
  }
}

async function ensureEpisodeScript(episodeId: string, options: PipelineOptions): Promise<void> {
  if (!mvpStore.getLatestScript(episodeId)) {
    await runScriptStage({ episodeId, ...options });
  }
}

async function ensureEpisodeAssets(episodeId: string, options: PipelineOptions): Promise<void> {
  if (mvpStore.listAssets(episodeId).length === 0) {
    await runAssetsStage({ episodeId, ...options });
  }
}

async function ensureEpisodeStoryboards(episodeId: string, options: PipelineOptions): Promise<void> {
  if (mvpStore.listStoryboards(episodeId).length === 0) {
    await runStoryboardStage({ episodeId, ...options });
  }
}

async function downloadRemoteVideo(input: {
  episodeId: string;
  storyboardId: string;
  index: number;
  url: string;
}): Promise<{ absPath: string; publicUrl: string }> {
  const dir = join(PUBLIC_ROOT, "mvp-media", input.episodeId, "videos");
  await mkdir(dir, { recursive: true });

  let ext = ".mp4";
  try {
    const parsed = new URL(input.url);
    const maybeExt = extname(parsed.pathname);
    if (maybeExt) {
      ext = maybeExt;
    }
  } catch {
    // Keep default .mp4 if URL parsing fails.
  }

  const absPath = join(dir, `${input.storyboardId}-${input.index + 1}-remote${ext}`);
  const resp = await fetch(input.url);
  if (!resp.ok) {
    throw new Error(`下载远端视频失败: ${resp.status}`);
  }
  const bytes = new Uint8Array(await resp.arrayBuffer());
  await writeFile(absPath, bytes);

  return {
    absPath,
    publicUrl: toPublicUrl(absPath),
  };
}

export function importSeriesFromNovel(input: {
  title: string;
  summary?: string;
  genre?: string;
  worldview?: string;
  visualGuide?: string;
  directorGuide?: string;
  rawText?: string;
  episodeSources?: EpisodeSourceInput[];
  maxEpisodes?: number;
}): { seriesId: string; episodeIds: string[]; snapshot: { title: string; summary: string; episodeCount: number } } {
  const episodeSources =
    input.episodeSources && input.episodeSources.length > 0
      ? input.episodeSources
      : splitNovelToEpisodes({
          text: input.rawText ?? "",
          maxEpisodes: input.maxEpisodes,
        });

  if (episodeSources.length === 0) {
    throw new Error("导入失败：没有可用的分集内容");
  }

  const summary = (input.summary && input.summary.trim()) || buildSynopsis(episodeSources[0]?.text ?? "");
  const result = mvpStore.importSeries({
    title: input.title,
    summary,
    genre: input.genre,
    status: "producing",
    worldview: input.worldview,
    visualGuide: input.visualGuide,
    directorGuide: input.directorGuide,
    episodeSources,
  });

  return {
    seriesId: result.series.id,
    episodeIds: result.episodes.map((episode) => episode.id),
    snapshot: {
      title: result.series.title,
      summary: result.series.summary,
      episodeCount: result.episodes.length,
    },
  };
}

export async function bootstrapSeriesToScript(input: {
  seriesId: string;
  episodeIds: string[];
  textModelRef?: string;
}): Promise<void> {
  mvpStore.updateSeriesStatus(input.seriesId, "producing");
  for (const episodeId of input.episodeIds) {
    try {
      await runEntitiesStage({
        episodeId,
        textModelRef: input.textModelRef,
      });
      await runScriptStage({
        episodeId,
        textModelRef: input.textModelRef,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[bootstrapSeriesToScript] series=${input.seriesId} episode=${episodeId} failed: ${message}`);
    }
  }
  mvpStore.updateSeriesStatus(input.seriesId, "setting");
}

export async function bootstrapSeriesToAssets(input: {
  seriesId: string;
  episodeIds: string[];
  textModelRef?: string;
}): Promise<void> {
  await bootstrapSeriesToScript(input);
  for (const episodeId of input.episodeIds) {
    try {
      await runAssetsStage({
        episodeId,
        textModelRef: input.textModelRef,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[bootstrapSeriesToAssets] series=${input.seriesId} episode=${episodeId} failed: ${message}`);
    }
  }
}

export async function runEntitiesStage(input: { episodeId: string; textModelRef?: string }): Promise<EpisodeSnapshot> {
  const episode = getEpisodeOrThrow(input.episodeId);
  mvpStore.updateEpisodeStage(episode.id, "planning", "in_progress");

  await runTask({
    episode,
    stage: "planning",
    action: "extract-entities",
    payload: {
      textModelRef: input.textModelRef ?? null,
    },
    onErrorStatus: { stage: "planning", status: "blocked" },
    toOutput: (value) => ({
      count: value.entities.length,
      summary: value.summary,
      modelRef: value.modelRef,
    }),
    runner: async () => {
      const result = await generateEpisodeEntities({
        sourceText: episode.sourceText,
        modelRef: input.textModelRef,
      });

      const entities = mvpStore.replaceEntities(
        episode.id,
        result.entities.map((entity) => ({
          type: entity.type,
          name: entity.name,
          description: entity.description,
          prompt: entity.prompt,
        })),
      );

      return {
        ...result,
        entities,
      };
    },
  });

  mvpStore.updateEpisodeStage(episode.id, "script", "ready");
  refreshSeriesStatus(episode.seriesId);
  const snapshot = mvpStore.getEpisodeSnapshot(episode.id);
  if (!snapshot) {
    throw new Error(`无法读取集数快照: ${episode.id}`);
  }
  return snapshot;
}

export async function runScriptStage(input: { episodeId: string; textModelRef?: string }): Promise<EpisodeSnapshot> {
  const episode = getEpisodeOrThrow(input.episodeId);
  const entities = mvpStore.listEntities(episode.id);
  if (entities.length === 0) {
    await runEntitiesStage({ episodeId: episode.id, textModelRef: input.textModelRef });
  }

  const resolvedEntities = mvpStore.listEntities(episode.id);
  mvpStore.updateEpisodeStage(episode.id, "script", "in_progress");

  await runTask({
    episode,
    stage: "script",
    action: "generate-script",
    payload: {
      textModelRef: input.textModelRef ?? null,
      entityCount: resolvedEntities.length,
    },
    onErrorStatus: { stage: "script", status: "blocked" },
    toOutput: (value) => ({
      modelRef: value.modelRef,
      outlineCount: value.outline.length,
      scriptLength: value.scriptText.length,
    }),
    runner: async () => {
      const script = await generateEpisodeScript({
        sourceText: episode.sourceText,
        entities: resolvedEntities,
        modelRef: input.textModelRef,
      });

      mvpStore.saveScript(episode.id, {
        strategy: script.strategy,
        outline: script.outline,
        scriptText: script.scriptText,
      });
      return script;
    },
  });

  mvpStore.updateEpisodeStage(episode.id, "assets", "ready");
  refreshSeriesStatus(episode.seriesId);
  const snapshot = mvpStore.getEpisodeSnapshot(episode.id);
  if (!snapshot) {
    throw new Error(`无法读取集数快照: ${episode.id}`);
  }
  return snapshot;
}

export async function runAssetsStage(input: { episodeId: string; textModelRef?: string }): Promise<EpisodeSnapshot> {
  const episode = getEpisodeOrThrow(input.episodeId);
  await ensureEpisodeScript(episode.id, { textModelRef: input.textModelRef });

  const entities = mvpStore.listEntities(episode.id);
  const script = mvpStore.getLatestScript(episode.id);
  if (!script) {
    throw new Error("剧本尚未生成");
  }

  mvpStore.updateEpisodeStage(episode.id, "assets", "in_progress");

  await runTask({
    episode,
    stage: "assets",
    action: "generate-assets",
    payload: {
      textModelRef: input.textModelRef ?? null,
      entityCount: entities.length,
    },
    onErrorStatus: { stage: "assets", status: "blocked" },
    toOutput: (value) => ({
      modelRef: value.modelRef,
      assetCount: value.assets.length,
    }),
    runner: async () => {
      const generated = await generateEpisodeAssets({
        entities,
        scriptText: script.scriptText,
        modelRef: input.textModelRef,
      });

      mvpStore.replaceAssets(
        episode.id,
        generated.assets.map((asset) => ({
          type: asset.type,
          name: asset.name,
          description: asset.description,
          prompt: asset.prompt,
          imageUrl: null,
          locked: false,
        })),
      );

      return generated;
    },
  });

  mvpStore.updateEpisodeStage(episode.id, "storyboard", "ready");
  refreshSeriesStatus(episode.seriesId);
  const snapshot = mvpStore.getEpisodeSnapshot(episode.id);
  if (!snapshot) {
    throw new Error(`无法读取集数快照: ${episode.id}`);
  }
  return snapshot;
}

export async function runStoryboardStage(input: { episodeId: string; textModelRef?: string }): Promise<EpisodeSnapshot> {
  const episode = getEpisodeOrThrow(input.episodeId);
  await ensureEpisodeAssets(episode.id, { textModelRef: input.textModelRef });

  const script = mvpStore.getLatestScript(episode.id);
  const assets = mvpStore.listAssets(episode.id);
  if (!script) {
    throw new Error("剧本尚未生成");
  }

  mvpStore.updateEpisodeStage(episode.id, "storyboard", "in_progress");

  await runTask({
    episode,
    stage: "storyboard",
    action: "generate-storyboards",
    payload: {
      textModelRef: input.textModelRef ?? null,
      assetCount: assets.length,
    },
    onErrorStatus: { stage: "storyboard", status: "blocked" },
    toOutput: (value) => ({
      modelRef: value.modelRef,
      shotCount: value.shots.length,
    }),
    runner: async () => {
      const generated = await generateEpisodeStoryboards({
        scriptText: script.scriptText,
        assets,
        modelRef: input.textModelRef,
      });

      mvpStore.replaceStoryboards(
        episode.id,
        generated.shots.map((shot, index) => ({
          shotIndex: index + 1,
          title: shot.title,
          action: shot.action,
          dialogue: shot.dialogue,
          prompt: shot.prompt,
          durationSeconds: shot.durationSeconds,
          assetRefs: shot.assetRefs,
          imageUrl: null,
          status: "draft",
        })),
      );

      return generated;
    },
  });

  mvpStore.updateEpisodeStage(episode.id, "video", "ready");
  refreshSeriesStatus(episode.seriesId);
  const snapshot = mvpStore.getEpisodeSnapshot(episode.id);
  if (!snapshot) {
    throw new Error(`无法读取集数快照: ${episode.id}`);
  }
  return snapshot;
}

export async function runVideoStage(input: { episodeId: string; videoModelRef?: string }): Promise<EpisodeSnapshot> {
  const episode = getEpisodeOrThrow(input.episodeId);
  await ensureEpisodeStoryboards(episode.id, {});
  const storyboards = mvpStore.listStoryboards(episode.id);
  if (storyboards.length === 0) {
    throw new Error("分镜尚未生成");
  }

  mvpStore.updateEpisodeStage(episode.id, "video", "in_progress");

  await runTask({
    episode,
    stage: "video",
    action: "generate-videos",
    payload: {
      videoModelRef: input.videoModelRef ?? null,
      storyboardCount: storyboards.length,
    },
    onErrorStatus: { stage: "video", status: "blocked" },
    toOutput: (value) => ({
      candidateCount: value.length,
      selectedCount: value.filter((item) => item.selected).length,
    }),
    runner: async () => {
      const generated: Array<Omit<VideoCandidateRecord, "id" | "episodeId" | "createdAt"> & { selected?: boolean }> = [];

      for (let i = 0; i < storyboards.length; i += 1) {
        const shot = storyboards[i]!;
        let hasVendorSelection = false;

        try {
          const vendorResult = await runVideoModel({
            prompt: shot.prompt || `${shot.title}，${shot.action}，${shot.dialogue}`,
            modelRef: input.videoModelRef,
            durationSeconds: shot.durationSeconds,
          });

          const [provider = "vendor", model = "video-model"] = vendorResult.modelRef.split(":");

          if (vendorResult.videoUrl) {
            try {
              const downloaded = await downloadRemoteVideo({
                episodeId: episode.id,
                storyboardId: shot.id,
                index: i,
                url: vendorResult.videoUrl,
              });

              generated.push({
                storyboardId: shot.id,
                provider,
                model,
                status: "ready",
                summary: "供应商视频已生成并落地本地缓存",
                videoUrl: downloaded.publicUrl,
                localPath: downloaded.absPath,
                selected: true,
              });
              hasVendorSelection = true;
            } catch {
              generated.push({
                storyboardId: shot.id,
                provider,
                model,
                status: "ready",
                summary: "供应商视频已生成（远程地址）",
                videoUrl: vendorResult.videoUrl,
                localPath: null,
                selected: false,
              });
            }
          } else {
            generated.push({
              storyboardId: shot.id,
              provider,
              model,
              status: "rendering",
              summary: vendorResult.taskId ? `远端任务排队中: ${vendorResult.taskId}` : "远端任务创建成功，等待轮询",
              videoUrl: null,
              localPath: null,
              selected: false,
            });
          }
        } catch (error) {
          generated.push({
            storyboardId: shot.id,
            provider: "vendor",
            model: input.videoModelRef ?? "auto",
            status: "failed",
            summary: error instanceof Error ? error.message : String(error),
            videoUrl: null,
            localPath: null,
            selected: false,
          });
        }

        const fallback = await createSyntheticClip({
          episodeId: episode.id,
          storyboardId: shot.id,
          index: i,
          durationSeconds: shot.durationSeconds,
          label: shot.title,
        });
        generated.push({
          storyboardId: shot.id,
          provider: "local-fallback",
          model: "ffmpeg-synthetic",
          status: "ready",
          summary: "本地 FFmpeg 合成占位视频",
          videoUrl: fallback.publicUrl,
          localPath: fallback.absPath,
          selected: !hasVendorSelection,
        });
      }

      return mvpStore.replaceVideoCandidates(episode.id, generated);
    },
  });

  mvpStore.updateEpisodeStage(episode.id, "review", "ready");
  refreshSeriesStatus(episode.seriesId);
  const snapshot = mvpStore.getEpisodeSnapshot(episode.id);
  if (!snapshot) {
    throw new Error(`无法读取集数快照: ${episode.id}`);
  }
  return snapshot;
}

export function selectVideoCandidate(input: { episodeId: string; candidateId: string }): EpisodeSnapshot {
  const episode = getEpisodeOrThrow(input.episodeId);
  const selected = mvpStore.selectVideoCandidate(episode.id, input.candidateId);
  if (!selected) {
    throw new Error(`未找到候选视频: ${input.candidateId}`);
  }
  const snapshot = mvpStore.getEpisodeSnapshot(episode.id);
  if (!snapshot) {
    throw new Error(`无法读取集数快照: ${episode.id}`);
  }
  return snapshot;
}

export async function runFinalCutStage(input: { episodeId: string }): Promise<EpisodeSnapshot> {
  const episode = getEpisodeOrThrow(input.episodeId);
  if (mvpStore.listVideoCandidates(episode.id).length === 0) {
    await runVideoStage({ episodeId: episode.id });
  }

  const storyboards = mvpStore.listStoryboards(episode.id);
  const videos = mvpStore.listVideoCandidates(episode.id);

  mvpStore.updateEpisodeStage(episode.id, "export", "in_progress");

  await runTask({
    episode,
    stage: "export",
    action: "assemble-final-cut",
    payload: {
      storyboardCount: storyboards.length,
      candidateCount: videos.length,
    },
    onErrorStatus: { stage: "export", status: "blocked" },
    toOutput: (value) => ({
      fileUrl: value.fileUrl,
      format: value.format,
      clipCount: value.clipCount,
    }),
    runner: async () => {
      const clipAbsPaths: string[] = [];

      for (let i = 0; i < storyboards.length; i += 1) {
        const shot = storyboards[i]!;
        const perShot = videos.filter((item) => item.storyboardId === shot.id && item.status === "ready");
        const picked =
          perShot.find((item) => item.selected && item.localPath) ??
          perShot.find((item) => Boolean(item.localPath));

        if (picked?.localPath) {
          clipAbsPaths.push(picked.localPath);
          continue;
        }

        const fallback = await createSyntheticClip({
          episodeId: episode.id,
          storyboardId: shot.id,
          index: i,
          durationSeconds: shot.durationSeconds,
          label: `${shot.title}-fallback`,
        });
        clipAbsPaths.push(fallback.absPath);
      }

      if (clipAbsPaths.length === 0) {
        throw new Error("没有可装配的视频片段");
      }

      const finalCut = await concatFinalCut({
        episodeId: episode.id,
        clipAbsPaths,
      });

      const record = mvpStore.saveFinalCut({
        episodeId: episode.id,
        filePath: finalCut.absPath,
        fileUrl: finalCut.publicUrl,
        format: "mp4",
        createdAt: nowIso(),
      });

      return {
        ...record,
        clipCount: clipAbsPaths.length,
      };
    },
  });

  mvpStore.updateEpisodeStage(episode.id, "export", "done");
  refreshSeriesStatus(episode.seriesId);
  const snapshot = mvpStore.getEpisodeSnapshot(episode.id);
  if (!snapshot) {
    throw new Error(`无法读取集数快照: ${episode.id}`);
  }
  return snapshot;
}

export async function runEpisodePipeline(input: {
  episodeId: string;
  textModelRef?: string;
  videoModelRef?: string;
}): Promise<EpisodeSnapshot> {
  await runEntitiesStage({ episodeId: input.episodeId, textModelRef: input.textModelRef });
  await runScriptStage({ episodeId: input.episodeId, textModelRef: input.textModelRef });
  await runAssetsStage({ episodeId: input.episodeId, textModelRef: input.textModelRef });
  await runStoryboardStage({ episodeId: input.episodeId, textModelRef: input.textModelRef });
  await runVideoStage({ episodeId: input.episodeId, videoModelRef: input.videoModelRef });
  return runFinalCutStage({ episodeId: input.episodeId });
}
