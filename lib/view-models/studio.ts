import type { StudioWorkspace } from '@/lib/domain/types';
import { buildGateSnapshot } from '@/lib/workflow/gate-engine';

export function buildDashboardView(workspace: StudioWorkspace) {
  const producingSeries = workspace.series.filter((series) => series.status === 'producing').length;
  const activeTasks = workspace.tasks.filter((task) => task.status === 'running' || task.status === 'failed');
  return {
    stats: [
      { label: '系列总数', value: workspace.series.length.toString(), accent: 'accent' },
      { label: '生产中系列', value: producingSeries.toString(), accent: 'secondary' },
      { label: '任务告警', value: activeTasks.length.toString(), accent: activeTasks.length ? 'warning' : 'neutral' },
    ],
    series: workspace.series,
    tasks: workspace.tasks.slice(0, 6),
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
  const tasks = workspace.tasks.filter((task) => task.targetType === 'series' || episodes.some((episode) => episode.id === task.targetId)).slice(0, 8);

  return { series, episodes, sharedAssets, tasks };
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

  return {
    series,
    episode,
    sourceDocument,
    chapters,
    assets,
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

function filterByIds<T extends Record<K, string>, K extends keyof T>(items: T[], ids: string[], key: K): T[] {
  const idSet = new Set(ids);
  return items.filter((item) => idSet.has(item[key]));
}

export type DashboardView = ReturnType<typeof buildDashboardView>;
export type SeriesView = NonNullable<ReturnType<typeof buildSeriesView>>;
export type EpisodeWorkspaceView = NonNullable<ReturnType<typeof buildEpisodeWorkspaceView>>;
