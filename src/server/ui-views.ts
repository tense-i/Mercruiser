import type {
  EpisodeScriptWorkspaceView,
  EpisodeSnapshot,
  EpisodeStage,
  EpisodeStudioView,
  ScriptStyleReference,
  SeriesDetailView,
  SeriesEpisodeSummaryView,
  SharedAssetView,
  StageStatus,
} from "@/server/mvp/types";
import { mvpStore } from "@/server/mvp/store";
import { getDefaultModelRef } from "@/server/mvp/vendors";

const STAGE_ORDER: EpisodeStage[] = ["planning", "script", "assets", "storyboard", "video", "review", "export"];

function toLocalTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${d} ${hh}:${mm}`;
}

function modelFromRef(modelRef: string | null): string {
  if (!modelRef) {
    return "未配置";
  }
  const [, model] = modelRef.split(":");
  return model ?? modelRef;
}

const defaultScriptStyleReferences: ScriptStyleReference[] = [
  {
    id: "realistic-urban",
    title: "都市写实",
    summary: "冷暖对冲、真实肤色、强调人物情绪细节。",
    tone: "realistic",
    palette: "from-[#566078] via-[#2f3a4e] to-[#151b25]",
    selected: true,
  },
  {
    id: "realistic-night",
    title: "夜景电影感",
    summary: "深色夜景、边缘高光、强调悬疑氛围。",
    tone: "realistic",
    palette: "from-[#2f2d42] via-[#1d1f33] to-[#101521]",
    selected: false,
  },
  {
    id: "anime-clean",
    title: "动漫清透",
    summary: "线条明确、色彩明快、角色辨识度高。",
    tone: "anime",
    palette: "from-[#5765d8] via-[#364ac1] to-[#212b79]",
    selected: true,
  },
  {
    id: "anime-cinematic",
    title: "动漫电影感",
    summary: "强调镜头层次和光影反差，适合情绪冲突段落。",
    tone: "anime",
    palette: "from-[#795ecf] via-[#5842aa] to-[#2f2566]",
    selected: false,
  },
];

function normalizeProgress(stage: EpisodeStage, status: StageStatus): number {
  const stageIndex = STAGE_ORDER.indexOf(stage);
  const stageRatio = Math.max(0, stageIndex) / STAGE_ORDER.length;
  if (status === "done") {
    return Math.round(((stageIndex + 1) / STAGE_ORDER.length) * 100);
  }
  if (status === "ready") {
    return Math.max(5, Math.round((stageRatio + 0.7 / STAGE_ORDER.length) * 100));
  }
  if (status === "in_progress") {
    return Math.max(5, Math.round((stageRatio + 0.5 / STAGE_ORDER.length) * 100));
  }
  if (status === "blocked") {
    return Math.max(5, Math.round((stageRatio + 0.35 / STAGE_ORDER.length) * 100));
  }
  return Math.max(1, Math.round((stageRatio + 0.15 / STAGE_ORDER.length) * 100));
}

function buildSeriesEpisodeSummary(seriesId: string): SeriesEpisodeSummaryView[] {
  const episodes = mvpStore.listEpisodes(seriesId);
  return episodes.map((episode) => {
    const tasks = mvpStore.listTasks(episode.id);
    const failed = tasks.filter((task) => task.status === "failed").slice(0, 2).map((task) => task.error ?? `${task.action} 执行失败`);
    const blockers = episode.status === "blocked" ? (failed.length > 0 ? failed : ["存在阻塞任务，需人工处理"]) : [];
    return {
      id: episode.id,
      code: episode.code,
      title: episode.title,
      synopsis: episode.synopsis,
      stage: episode.stage,
      status: episode.status,
      progress: normalizeProgress(episode.stage, episode.status),
      blockers,
    };
  });
}

function toCategory(type: "character" | "scene" | "prop"): "characters" | "scenes" | "props" {
  if (type === "character") {
    return "characters";
  }
  if (type === "scene") {
    return "scenes";
  }
  return "props";
}

function buildSharedAssets(seriesId: string): SharedAssetView[] {
  const episodes = mvpStore.listEpisodes(seriesId);
  const persistedAssets = mvpStore.listSeriesSharedAssets(seriesId);
  const persistedByIdentity = new Map(
    persistedAssets.map((asset) => [`${asset.category}:${asset.name}`, asset] as const),
  );
  const assetRows = episodes.flatMap((episode) => {
    const assets = mvpStore.listAssets(episode.id);
    return assets.map((asset) => ({
      ...asset,
      episodeCode: episode.code,
    }));
  });

  const grouped = new Map<string, typeof assetRows>();
  for (const asset of assetRows) {
    const key = `${asset.type}:${asset.name}`;
    const bucket = grouped.get(key) ?? [];
    bucket.push(asset);
    grouped.set(key, bucket);
  }

  const output: SharedAssetView[] = [];
  grouped.forEach((bucket) => {
    bucket.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const latest = bucket[bucket.length - 1]!;
    const category = toCategory(latest.type);
    const persisted = persistedByIdentity.get(`${category}:${latest.name}`);
    const persistedVariants = persisted ? mvpStore.listSeriesSharedAssetVariants(persisted.id) : [];
    const derivedVariants = bucket.map((asset, index) => ({
      id: asset.id,
      label: `v${index + 1}`,
      prompt: asset.prompt,
      selected: index === bucket.length - 1,
      locked: asset.locked,
    }));
    const variants =
      persistedVariants.length > 0
        ? persistedVariants.map((variant) => ({
            id: variant.id,
            label: variant.label,
            prompt: variant.prompt,
            selected: variant.selected,
            locked: variant.locked,
          }))
        : derivedVariants;
    const selectedVariant = variants.find((variant) => variant.selected) ?? variants[variants.length - 1];

    output.push({
      id: persisted?.id ?? latest.id,
      name: latest.name,
      category,
      summary: persisted?.summary || latest.description,
      mainVersion: persisted?.mainVersion ?? selectedVariant?.label ?? "v1",
      locked: persisted?.locked ?? bucket.some((asset) => asset.locked),
      note:
        persisted?.note ||
        (bucket.some((asset) => asset.locked) ? "含已锁定主版本" : "尚未锁定主版本"),
      owner: persisted?.owner || latest.episodeCode,
      episodeRefs: persisted?.episodeRefs.length ? persisted.episodeRefs : Array.from(new Set(bucket.map((asset) => asset.episodeCode))),
      variants,
    });
  });

  return output;
}

export function buildSeriesDetailView(seriesId: string): SeriesDetailView | null {
  const series = mvpStore.getSeries(seriesId);
  if (!series) {
    return null;
  }

  const episodes = buildSeriesEpisodeSummary(seriesId);
  const sharedAssets = buildSharedAssets(seriesId);
  const tasks = mvpStore.listTasks().filter((task) => task.seriesId === seriesId);
  const now = Date.now();
  const tasks24h = tasks.filter((task) => now - new Date(task.updatedAt).getTime() <= 24 * 60 * 60 * 1000);
  const success24h = tasks24h.filter((task) => task.status === "success").length;
  const failed24h = tasks24h.filter((task) => task.status === "failed").length;

  const blockedEpisodes = episodes.filter((episode) => episode.status === "blocked");
  const inProgressEpisode = episodes.find((episode) => episode.status === "in_progress");
  const focusEpisode = blockedEpisodes[0] ?? inProgressEpisode ?? episodes[0];

  const completion =
    episodes.length === 0
      ? 0
      : Math.round(
          episodes.reduce((sum, item) => sum + item.progress, 0) / Math.max(1, episodes.length),
        );
  const strategy = mvpStore.getSeriesStrategy(seriesId);

  return {
    id: series.id,
    title: series.title,
    subtitle: `系列总控：${series.genre} 生产线`,
    worldview: series.worldview || "系列世界观尚未配置。",
    visualGuide: series.visualGuide || "视觉规则尚未配置。",
    directorGuide: series.directorGuide || "导演规则尚未配置。",
    stats: [
      { label: "集数总量", value: String(episodes.length), note: `已完成 ${episodes.filter((item) => item.status === "done").length} 集` },
      { label: "共享资产", value: String(sharedAssets.length), note: `锁定主资产 ${sharedAssets.filter((asset) => asset.locked).length}` },
      { label: "阶段阻塞", value: String(blockedEpisodes.length), note: blockedEpisodes.length > 0 ? "存在待处理风险项" : "暂无阻塞" },
      { label: "近 24h 成功任务", value: String(success24h), note: `失败 ${failed24h} 条` },
    ],
    episodes,
    sharedAssets,
    strategy: {
      models: {
        text: modelFromRef(strategy?.textModelRef ?? getDefaultModelRef("text")),
        image: modelFromRef(strategy?.imageModelRef ?? getDefaultModelRef("image")),
        video: modelFromRef(strategy?.videoModelRef ?? getDefaultModelRef("video")),
      },
      promptPolicies:
        strategy?.promptPolicies && strategy.promptPolicies.length > 0
          ? strategy.promptPolicies
          : [
              { stage: "剧本", policy: "先输出剧情骨架，再输出对白分场版。" },
              { stage: "资产", policy: "优先复用共享资产，新增资产附带回流标记。" },
              { stage: "分镜", policy: "每帧包含动作、对白、提示词与时长。" },
            ],
      agentPolicies:
        strategy?.agentPolicies && strategy.agentPolicies.length > 0
          ? strategy.agentPolicies
          : [
              { name: "阻塞升级阈值", value: "同阶段失败 >= 2 次触发人工审阅" },
              { name: "自动重试策略", value: "仅对可恢复错误自动重试 1 次" },
              { name: "推荐动作模式", value: "优先给出下一步明确动作" },
            ],
    },
    orchestrator: {
      focus: focusEpisode ? `${focusEpisode.code} · ${focusEpisode.title}` : "暂无集数",
      completion,
      blocking:
        blockedEpisodes.length > 0
          ? blockedEpisodes.flatMap((episode) => episode.blockers).slice(0, 2).join("；")
          : "当前无阻塞项",
      nextStep: blockedEpisodes.length > 0 ? "优先处理阻塞集数后再推进新任务。" : "从当前进行中集数继续推进至导出阶段。",
      recommendations: [
        "优先锁定关键分镜和视频主版本。",
        "完成后将稳定资产回流到系列共享库。",
        "对失败任务执行重试或改用本地 fallback。",
      ],
      queuePreview: tasks
        .slice(0, 3)
        .map((task) => ({
          id: task.id,
          title: `${task.episodeId} / ${task.action}`,
          status: task.status,
        })),
    },
  };
}

export function buildEpisodeScriptWorkspaceView(episodeId: string): EpisodeScriptWorkspaceView | null {
  const episode = mvpStore.getEpisode(episodeId);
  if (!episode) {
    return null;
  }
  const series = mvpStore.getSeries(episode.seriesId);
  if (!series) {
    return null;
  }

  const workspaceConfig = mvpStore.getEpisodeScriptWorkspaceConfig(episodeId);
  const currentScript = mvpStore.getLatestScript(episodeId);
  const storedChapters = mvpStore.listEpisodeChapters(episodeId);

  const chapters = storedChapters.map((chapter) => {
    const status: "active" | "ready" | "draft" =
      chapter.id === (workspaceConfig?.chapterCursor || storedChapters[0]?.id)
        ? "active"
        : chapter.content.trim()
          ? "ready"
          : "draft";

    return {
    id: chapter.id,
    code: chapter.chapterCode,
    title: chapter.title,
    content: chapter.content,
    orderIndex: chapter.orderIndex,
    progress:
      chapter.content.trim().length > 0
        ? Math.min(100, Math.round((chapter.content.replace(/\s+/g, "").length / (workspaceConfig?.targetWords ?? 1200)) * 100))
        : 0,
      status,
    };
  });

  return {
    seriesId: series.id,
    episodeId: episode.id,
    seriesTitle: series.title,
    episodeCode: episode.code,
    episodeTitle: episode.title,
    scriptText: currentScript?.scriptText ?? chapters[0]?.content ?? `${episode.code} · ${episode.title}\n\n${episode.sourceText}`,
    targetWords: workspaceConfig?.targetWords ?? 1200,
    chapterCursor: workspaceConfig?.chapterCursor || chapters[0]?.id || episodeId,
    chapters,
    config: {
      aspectRatio: workspaceConfig?.aspectRatio ?? "9:16",
      creationMode: workspaceConfig?.creationMode ?? "image_to_video",
      visualTone: workspaceConfig?.visualTone ?? "realistic",
    },
    styleReferences:
      workspaceConfig?.styleReferences && workspaceConfig.styleReferences.length > 0
        ? workspaceConfig.styleReferences
        : defaultScriptStyleReferences,
    quickNotes:
      workspaceConfig?.quickNotes && workspaceConfig.quickNotes.length > 0
        ? workspaceConfig.quickNotes
        : [
            "先确认章节冲突点，再润色对白。",
            "阶段推进默认：剧本确认后再触发资产。",
            "分镜与视频阶段保持角色视觉一致。",
          ],
  };
}

function deriveStageProgress(snapshot: EpisodeSnapshot): Record<EpisodeStage, StageStatus> {
  const storyboards = snapshot.storyboards;
  const videos = snapshot.videos;
  const selectedReady = videos.filter((video) => video.status === "ready" && video.selected).length;
  const videoDone = storyboards.length > 0 && selectedReady >= storyboards.length;

  const stageProgress: Record<EpisodeStage, StageStatus> = {
    planning: snapshot.entities.length > 0 ? "done" : "not_started",
    script: snapshot.script ? "done" : "not_started",
    assets: snapshot.assets.length > 0 ? "done" : "not_started",
    storyboard: snapshot.storyboards.length > 0 ? "done" : "not_started",
    video: videoDone ? "done" : videos.length > 0 ? "in_progress" : "not_started",
    review: videoDone ? "ready" : "not_started",
    export: snapshot.finalCut ? "done" : "not_started",
  };

  if (stageProgress[snapshot.episode.stage] !== "done") {
    stageProgress[snapshot.episode.stage] = snapshot.episode.status;
  }

  return stageProgress;
}

function tipByStage(stage: EpisodeStage): string[] {
  const tips: Record<EpisodeStage, string[]> = {
    planning: ["先确认剧情目标，再触发实体识别。", "原文拆分尽量保持每集冲突完整。"],
    script: ["先看骨架再看对白，避免节奏拖沓。", "关键冲突场景建议保留短对白。"],
    assets: ["优先锁定角色主版本。", "场景与道具提示词保持跨集一致。"],
    storyboard: ["先修复衔接问题，再优化光影。", "关键帧优先锁定，避免后续漂移。"],
    video: ["每帧至少保留一个可用候选。", "远端失败时可直接选本地 fallback。"],
    review: ["先补齐缺失项再进入导出。", "审校通过后再锁定最终候选。"],
    export: ["导出前确认片段顺序。", "导出后记录版本与时间。"],
  };
  return tips[stage];
}

export function buildEpisodeStudioView(episodeId: string): EpisodeStudioView | null {
  const snapshot = mvpStore.getEpisodeSnapshot(episodeId);
  if (!snapshot) {
    return null;
  }

  const stageProgress = deriveStageProgress(snapshot);
  const tasks = mvpStore.listTasks(episodeId);
  const failedTasks = tasks.filter((task) => task.status === "failed");

  const outline =
    snapshot.script?.outline.length && snapshot.script.outline.length > 0
      ? snapshot.script.outline
      : snapshot.episode.sourceText
          .split(/[。！？\n]/)
          .map((item) => item.trim())
          .filter(Boolean)
          .slice(0, 4);

  const draftBlocks =
    snapshot.script?.scriptText
      .split(/\n{2,}/)
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 8)
      .map((content, index) => ({
        id: `s${index + 1}`,
        heading: `${index + 1}-${index + 1} 场景`,
        content,
      })) ?? [];

  const storyboardMap = new Map(snapshot.storyboards.map((item) => [item.id, item]));
  const checklist = [
    { item: "剧本已生成", done: Boolean(snapshot.script), action: "前往剧本阶段生成/修订" },
    { item: "资产已提取", done: snapshot.assets.length > 0, action: "前往资产阶段提取并锁定" },
    { item: "分镜可执行", done: snapshot.storyboards.length > 0, action: "前往分镜阶段生成镜头" },
    {
      item: "每帧视频已选定最终版本",
      done: snapshot.storyboards.length > 0 && snapshot.videos.filter((item) => item.selected && item.status === "ready").length >= snapshot.storyboards.length,
      action: "前往视频阶段选择候选",
    },
    { item: "成片已导出", done: Boolean(snapshot.finalCut), action: "前往导出阶段生成成片" },
  ];
  const reviewCompletion = Math.round((checklist.filter((item) => item.done).length / checklist.length) * 100);

  const exportHistory = tasks
    .filter((task) => task.stage === "export" && task.status === "success")
    .map((task, index) => ({
      version: `v${index + 1}`,
      format: "MP4",
      time: toLocalTime(task.updatedAt),
      operator: "Local Agent",
    }));

  if (snapshot.finalCut && exportHistory.length === 0) {
    exportHistory.push({
      version: "v1",
      format: snapshot.finalCut.format.toUpperCase(),
      time: toLocalTime(snapshot.finalCut.createdAt),
      operator: "Local Agent",
    });
  }

  const completionScore = Math.round(
    Object.values(stageProgress).reduce((sum, status) => {
      const scoreMap: Record<StageStatus, number> = {
        not_started: 0,
        in_progress: 50,
        blocked: 35,
        ready: 80,
        done: 100,
      };
      return sum + scoreMap[status];
    }, 0) / STAGE_ORDER.length,
  );

  const blockers =
    snapshot.episode.status === "blocked"
      ? failedTasks.slice(0, 2).map((task) => task.error ?? `${task.action} 执行失败`)
      : [];

  return {
    seriesId: snapshot.episode.seriesId,
    episodeId: snapshot.episode.id,
    episodeTitle: `${snapshot.episode.code} · ${snapshot.episode.title}`,
    sourceText: snapshot.episode.sourceText,
    stageProgress,
    planning: {
      adaptationGoal: snapshot.script?.strategy ?? "先明确冲突与角色关系，再推进短剧节奏。",
      splitParams: "按剧情冲突点自动拆分",
      outline,
    },
    script: {
      skeleton: outline,
      strategy: snapshot.script?.strategy ?? "当前暂无剧本策略，请先执行剧本阶段。",
      draft: draftBlocks,
    },
    assets: {
      extracted: snapshot.assets.map((asset) => ({
        id: asset.id,
        name: asset.name,
        type: asset.type === "character" ? "角色" : asset.type === "scene" ? "场景" : "道具",
        matchedSeriesAsset: `${asset.name} / ${asset.locked ? "locked" : "candidate"}`,
      })),
      variants: snapshot.assets.map((asset, index) => ({
        assetId: asset.id,
        variantName: `${asset.name} 变体 v${index + 1}`,
        status: asset.locked ? "已锁定" : "待锁定",
        note: asset.prompt,
      })),
    },
    storyboard: {
      frames: snapshot.storyboards.map((frame) => ({
        id: frame.id,
        shot: `Frame ${String(frame.shotIndex).padStart(2, "0")}`,
        action: frame.action,
        dialogue: frame.dialogue,
        prompt: frame.prompt,
        status: frame.status,
      })),
    },
    video: {
      candidates: snapshot.videos.map((candidate) => ({
        id: candidate.id,
        frameId: storyboardMap.get(candidate.storyboardId)
          ? `Frame ${String(storyboardMap.get(candidate.storyboardId)?.shotIndex ?? 0).padStart(2, "0")}`
          : candidate.storyboardId,
        model: candidate.model,
        duration: `${storyboardMap.get(candidate.storyboardId)?.durationSeconds ?? 3}s`,
        status: candidate.status,
        selected: candidate.selected,
        summary: candidate.summary,
      })),
    },
    review: {
      completion: reviewCompletion,
      checklist,
    },
    export: {
      options: [
        { label: "导出格式", value: "MP4" },
        { label: "片段数量", value: String(snapshot.storyboards.length) },
        { label: "最终文件", value: snapshot.finalCut?.fileUrl ?? "尚未生成" },
      ],
      history: exportHistory,
    },
    orchestrator: {
      currentStage: snapshot.episode.stage,
      completion: completionScore,
      blockers,
      nextAction:
        snapshot.episode.stage === "planning"
          ? "执行实体识别"
          : snapshot.episode.stage === "script"
            ? "生成剧本"
            : snapshot.episode.stage === "assets"
              ? "生成资产"
              : snapshot.episode.stage === "storyboard"
                ? "生成分镜"
                : snapshot.episode.stage === "video"
                  ? "生成并选择视频候选"
                  : snapshot.episode.stage === "review"
                    ? "完成审校检查"
                    : "导出成片",
      tips: tipByStage(snapshot.episode.stage),
    },
  };
}
