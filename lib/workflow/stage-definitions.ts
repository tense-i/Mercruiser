import type { StudioWorkspace } from '@/lib/domain/types';
import type { workflowStages } from '@/lib/domain/enums';

export type WorkflowStage = (typeof workflowStages)[number];

export const stageOrder: WorkflowStage[] = [
  'script_generation',
  'asset_extraction',
  'asset_rendering',
  'shot_generation',
  'shot_rendering',
  'storyboard',
  'final_cut',
  'export',
];

export function getEpisodeDependencies(workspace: StudioWorkspace, episodeId: string) {
  const episode = workspace.episodes.find((item) => item.id === episodeId);
  if (!episode) {
    return null;
  }

  return {
    episode,
    sourceDocument: workspace.sourceDocuments.find((item) => item.id === episode.sourceDocumentId) ?? null,
    chapters: workspace.chapters.filter((chapter) => chapter.episodeId === episodeId).sort((a, b) => a.index - b.index),
    assets: workspace.assets.filter((asset) => asset.episodeId === episodeId || (asset.isShared && asset.seriesId === episode.seriesId)),
    ownAssets: workspace.assets.filter((asset) => asset.episodeId === episodeId),
    shots: workspace.shots.filter((shot) => shot.episodeId === episodeId).sort((a, b) => a.index - b.index),
    storyboards: workspace.storyboards.filter((storyboard) => storyboard.episodeId === episodeId),
    finalCut: workspace.finalCuts.find((item) => item.id === episode.finalCutId) ?? null,
    directorPlan: workspace.directorPlans.find((item) => item.id === episode.directorPlanId) ?? null,
  };
}
