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
    workflowRuns,
  };
}

export type DashboardView = ReturnType<typeof buildDashboardView>;
export type SeriesView = NonNullable<ReturnType<typeof buildSeriesView>>;
export type EpisodeWorkspaceView = NonNullable<ReturnType<typeof buildEpisodeWorkspaceView>>;
