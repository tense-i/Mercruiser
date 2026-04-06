import type { StudioWorkspace } from '@/lib/domain/types';
import { buildGateSnapshot } from '@/lib/workflow/gate-engine';

export function syncEpisodeWorkflow(workspace: StudioWorkspace, episodeId: string) {
  const episode = workspace.episodes.find((item) => item.id === episodeId);
  if (!episode) {
    return null;
  }

  const gate = buildGateSnapshot(workspace, episodeId);
  if (!gate) {
    return null;
  }

  episode.currentStage = gate.currentStage;
  const existing = workspace.gateSnapshots.find((item) => item.episodeId === episodeId);
  if (existing) {
    Object.assign(existing, gate);
  } else {
    workspace.gateSnapshots.push(gate);
  }

  return gate;
}
