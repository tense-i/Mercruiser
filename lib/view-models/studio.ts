import { workstationTabs } from '@/lib/domain/enums';
import type { StudioWorkspace } from '@/lib/domain/types';
import { buildGateSnapshot } from '@/lib/workflow/gate-engine';

function filterByIds<T extends Record<K, string>, K extends keyof T>(items: T[], ids: string[], key: K): T[] {
  const idSet = new Set(ids);
  return items.filter((item) => idSet.has(item[key]));
}

function buildUsageSummary(workspace: StudioWorkspace, scope: { seriesId?: string; episodeId?: string } = {}) {
  const records = workspace.apiUsageRecords.filter((record) => {
    if (scope.episodeId) {
      return record.episodeId === scope.episodeId;
    }
    if (scope.seriesId) {
      return record.seriesId === scope.seriesId;
    }
    return true;
  });

  return {
    totalCost: records.reduce((sum, record) => sum + (record.estimatedCost ?? 0), 0),
    requestCount: records.length,
    records: records.slice(0, 20),
    alerts: workspace.usageAlerts,
    currency: workspace.settings.usage.currency,
  };
}

function buildCascadeWarnings(workspace: StudioWorkspace, episodeId: string) {
  const shots = workspace.shots.filter((shot) => shot.episodeId === episodeId);
  return shots
    .filter((shot) => shot.assetRefStatus !== 'valid')
    .map((shot) => ({
      shotId: shot.id,
      shotTitle: shot.title,
      severity: shot.assetRefStatus === 'broken' ? 'critical' : 'warning',
      message:
        shot.assetRefStatus === 'broken'
          ? `镜头 ${shot.title} 存在 broken 资产引用。`
          : `镜头 ${shot.title} 的资产引用已过期，建议重新生成。`,
    }));
}

const stageToStation = {
  script_generation: 'script',
  asset_extraction: 'subjects',
  asset_rendering: 'subjects',
  shot_generation: 'shots',
  shot_rendering: 'storyboard',
  storyboard: 'storyboard',
  final_cut: 'final-cut',
  export: 'final-cut',
} as const;

function getStationLabel(tab: (typeof workstationTabs)[number]) {
  switch (tab) {
    case 'overview':
      return '概览';
    case 'script':
      return '剧本';
    case 'subjects':
      return '主体';
    case 'shots':
      return '分镜';
    case 'storyboard':
      return '故事板';
    case 'final-cut':
      return '成片';
  }
}

function getStationDescription(tab: (typeof workstationTabs)[number]) {
  switch (tab) {
    case 'overview':
      return '查看当前集状态、门禁、告警与下一步建议';
    case 'script':
      return '维护原文与章节剧本，并控制上游返工';
    case 'subjects':
      return '提取与维护角色、场景、道具等主体资产';
    case 'shots':
      return '生成并修订结构化镜头，检查资产引用';
    case 'storyboard':
      return '选择镜头主版本并收敛故事板输出';
    case 'final-cut':
      return '装配时间线并准备导出成片';
  }
}

function getStationPrimaryAction(tab: (typeof workstationTabs)[number], gate: ReturnType<typeof buildGateSnapshot>) {
  if (!gate) {
    return null;
  }

  switch (tab) {
    case 'script':
      return gate.availableActions.find((action) => action.kind === 'generate_script') ?? null;
    case 'subjects':
      return gate.availableActions.find((action) => action.kind === 'extract_assets')
        ?? gate.availableActions.find((action) => action.kind === 'generate_asset_images')
        ?? null;
    case 'shots':
      return gate.availableActions.find((action) => action.kind === 'generate_shots') ?? null;
    case 'storyboard':
      return gate.availableActions.find((action) => action.kind === 'generate_shot_images')
        ?? gate.availableActions.find((action) => action.kind === 'open_storyboard')
        ?? null;
    case 'final-cut':
      return gate.availableActions.find((action) => action.kind === 'open_final_cut')
        ?? gate.availableActions.find((action) => action.kind === 'export_episode')
        ?? null;
    default:
      return null;
  }
}

function computeStationProgress(tab: (typeof workstationTabs)[number], workspace: StudioWorkspace, episodeId: string) {
  const episode = workspace.episodes.find((item) => item.id === episodeId);
  if (!episode) {
    return 0;
  }

  if (tab === 'overview') return episode.progress;
  if (tab === 'script') return episode.chapterIds.length ? 100 : 0;
  if (tab === 'subjects') {
    const assets = workspace.assets.filter((asset) => episode.assetIds.includes(asset.id));
    return assets.length ? Math.round((assets.filter((asset) => asset.state === 'completed').length / assets.length) * 100) : 0;
  }
  if (tab === 'shots') return episode.shotIds.length ? 100 : 0;
  if (tab === 'storyboard') {
    const shots = workspace.shots.filter((shot) => episode.shotIds.includes(shot.id));
    return shots.length ? Math.round((shots.filter((shot) => shot.images.some((image) => image.isSelected)).length / shots.length) * 100) : 0;
  }

  const finalCut = workspace.finalCuts.find((item) => item.id === episode.finalCutId);
  return finalCut?.tracks.some((track) => track.items.length > 0) ? 100 : 0;
}

function buildEpisodeWorkflow(workspace: StudioWorkspace, episodeId: string, gate: ReturnType<typeof buildGateSnapshot>) {
  const episode = workspace.episodes.find((item) => item.id === episodeId);
  if (!episode) {
    return null;
  }

  const currentStation = stageToStation[gate?.currentStage ?? 'script_generation'] ?? 'overview';
  const dirtyShots = workspace.shots.some((shot) => shot.episodeId === episodeId && shot.assetRefStatus !== 'valid');
  const dirtyStoryboard = workspace.storyboards.some((item) => item.episodeId === episodeId && item.selectedTakeId === null);
  const dirtyFinalCut = !workspace.finalCuts.find((item) => item.id === episode.finalCutId)?.tracks.some((track) => track.items.length > 0);

  const stations = workstationTabs.map((tab) => {
    const blockingReasons =
      tab === 'overview'
        ? []
        : gate?.blockedReasons.filter((reason) => {
            if (tab === 'script') return reason.includes('原文') || reason.includes('章节') || reason.includes('剧本');
            if (tab === 'subjects') return reason.includes('主体') || reason.includes('资产');
            if (tab === 'shots') return reason.includes('分镜') || reason.includes('资产引用');
            if (tab === 'storyboard') return reason.includes('分镜图片') || reason.includes('故事板') || reason.includes('过期');
            if (tab === 'final-cut') return reason.includes('成片') || reason.includes('导出') || reason.includes('故事板');
            return false;
          }) ?? [];

    const isDirty =
      tab === 'shots'
        ? dirtyShots
        : tab === 'storyboard'
          ? dirtyShots || dirtyStoryboard
          : tab === 'final-cut'
            ? dirtyShots || dirtyStoryboard || dirtyFinalCut
            : false;

    const canEnter =
      tab === 'overview'
      || tab === 'script'
      || (tab === 'subjects' && episode.chapterIds.length > 0)
      || (tab === 'shots' && episode.assetIds.length > 0)
      || (tab === 'storyboard' && episode.shotIds.length > 0)
      || (tab === 'final-cut' && episode.storyboardIds.length > 0);

    return {
      id: tab,
      label: getStationLabel(tab),
      description: getStationDescription(tab),
      status: episode.stationStates[tab],
      progress: computeStationProgress(tab, workspace, episodeId),
      isCurrent: currentStation === tab,
      isDirty,
      canEnter,
      blockingReasons,
      primaryAction: getStationPrimaryAction(tab, gate),
    };
  });

  return {
    currentStation,
    stations,
    blockedReasons: gate?.blockedReasons ?? [],
    requiredInputs: gate?.requiredInputs ?? [],
    recommendedAction: stations.find((station) => station.isCurrent)?.primaryAction ?? gate?.availableActions.find((action) => action.enabled) ?? null,
  };
}

export function buildDashboardView(workspace: StudioWorkspace) {
  const producingSeries = workspace.series.filter((series) => series.status === 'producing').length;
  const activeTasks = workspace.tasks.filter((task) => task.status === 'running' || task.status === 'failed');
  return {
    stats: [
      { label: '系列总数', value: workspace.series.length.toString(), accent: 'accent' },
      { label: '生产中系列', value: producingSeries.toString(), accent: 'secondary' },
      { label: '任务告警', value: activeTasks.length.toString(), accent: activeTasks.length ? 'warning' : 'neutral' },
      { label: '全局资产', value: workspace.globalAssets.length.toString(), accent: 'neutral' },
    ],
    series: workspace.series,
    tasks: workspace.tasks.slice(0, 6),
    usageSummary: buildUsageSummary(workspace),
  };
}

export function buildSeriesView(workspace: StudioWorkspace, seriesId: string) {
  const series = workspace.series.find((item) => item.id === seriesId);
  if (!series) {
    return null;
  }

  const episodes = workspace.episodes
    .filter((episode) => episode.seriesId === seriesId)
    .sort((left, right) => left.index - right.index)
    .map((episode) => ({
      ...episode,
      gate: buildGateSnapshot(workspace, episode.id),
    }));
  const sharedAssets = workspace.assets.filter((asset) => asset.seriesId === seriesId && asset.isShared);
  const promotableAssets = workspace.assets.filter((asset) => asset.seriesId === seriesId && !asset.isShared);
  const globalAssets = workspace.globalAssets.filter((asset) => asset.usedInSeries.some((item) => item.seriesId === seriesId));
  const availableGlobalAssets = workspace.globalAssets;
  const generationPresets = workspace.generationPresets.filter((preset) => preset.scope === 'global' || preset.scopeId === seriesId || preset.scope === 'user');
  const tasks = workspace.tasks.filter((task) => task.targetType === 'series' || episodes.some((episode) => episode.id === task.targetId)).slice(0, 8);
  const sharedAssetUsage = sharedAssets.map((asset) => ({
    assetId: asset.id,
    episodeIds: episodes.filter((episode) => episode.assetIds.includes(asset.id)).map((episode) => episode.id),
  }));

  return {
    series,
    episodes,
    sharedAssets,
    promotableAssets,
    globalAssets,
    availableGlobalAssets,
    sharedAssetUsage,
    generationPresets,
    usageSummary: buildUsageSummary(workspace, { seriesId }),
    tasks,
  };
}

export function buildEpisodeWorkspaceView(workspace: StudioWorkspace, episodeId: string) {
  const episode = workspace.episodes.find((item) => item.id === episodeId);
  if (!episode) {
    return null;
  }

  const series = workspace.series.find((item) => item.id === episode.seriesId) ?? null;
  const sourceDocument = workspace.sourceDocuments.find((item) => item.id === episode.sourceDocumentId) ?? null;
  const chapters = filterByIds(workspace.chapters, episode.chapterIds, 'id').sort((left, right) => left.index - right.index);
  const assets = filterByIds(workspace.assets, episode.assetIds, 'id');
  const shots = filterByIds(workspace.shots, episode.shotIds, 'id').sort((left, right) => left.index - right.index);
  const storyboards = filterByIds(workspace.storyboards, episode.storyboardIds, 'id');
  const finalCut = workspace.finalCuts.find((item) => item.id === episode.finalCutId) ?? null;
  const directorPlan = workspace.directorPlans.find((item) => item.id === episode.directorPlanId) ?? null;
  const tasks = workspace.tasks.filter((task) => task.targetId === episode.id || episode.chapterIds.includes(task.targetId) || episode.shotIds.includes(task.targetId) || episode.assetIds.includes(task.targetId)).slice(0, 10);
  const agentRuns = workspace.agentRuns.filter((run) => run.scopeId === episode.id).slice(-6).reverse();
  const gate = buildGateSnapshot(workspace, episodeId);
  const workflowRuns = workspace.workflowRuns.filter((run) => run.episodeId === episodeId).slice(-8).reverse();
  const generationPresets = workspace.generationPresets.filter((preset) => preset.scope === 'global' || preset.scope === 'user' || preset.scopeId === episode.seriesId);
  const globalAssets = workspace.globalAssets.filter((asset) => asset.usedInSeries.some((item) => item.seriesId === episode.seriesId));
  const workflow = buildEpisodeWorkflow(workspace, episodeId, gate);

  return {
    series,
    episode,
    sourceDocument,
    chapters,
    assets,
    globalAssets,
    generationPresets,
    usageSummary: buildUsageSummary(workspace, { episodeId }),
    cascadeWarnings: buildCascadeWarnings(workspace, episodeId),
    directorPlan,
    shots,
    storyboards,
    finalCut,
    tasks,
    agentRuns,
    gate,
    workflow,
    workflowRuns,
  };
}

export type DashboardView = ReturnType<typeof buildDashboardView>;
export type SeriesView = NonNullable<ReturnType<typeof buildSeriesView>>;
export type EpisodeWorkspaceView = NonNullable<ReturnType<typeof buildEpisodeWorkspaceView>>;
export type EpisodeWorkflowView = NonNullable<EpisodeWorkspaceView['workflow']>;
export type EpisodeStationView = EpisodeWorkflowView['stations'][number];
export type EpisodeStationId = EpisodeStationView['id'];
