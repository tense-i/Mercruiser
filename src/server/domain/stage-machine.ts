import type { EpisodeStage, StageStatus } from "@/server/types";

export const EPISODE_STAGE_ORDER: EpisodeStage[] = [
  "planning",
  "script",
  "assets",
  "storyboard",
  "video",
  "review",
  "export",
];

export function episodeStageProgress(stage: EpisodeStage, status: StageStatus): number {
  const index = EPISODE_STAGE_ORDER.indexOf(stage);
  const base = Math.max(0, index) / EPISODE_STAGE_ORDER.length;
  if (status === "done") {
    return Math.round(((index + 1) / EPISODE_STAGE_ORDER.length) * 100);
  }
  if (status === "ready") {
    return Math.round((base + 0.7 / EPISODE_STAGE_ORDER.length) * 100);
  }
  if (status === "in_progress") {
    return Math.round((base + 0.5 / EPISODE_STAGE_ORDER.length) * 100);
  }
  if (status === "blocked") {
    return Math.round((base + 0.35 / EPISODE_STAGE_ORDER.length) * 100);
  }
  return Math.round((base + 0.15 / EPISODE_STAGE_ORDER.length) * 100);
}

export function canEnterStage(stage: EpisodeStage, stageProgress: Record<EpisodeStage, StageStatus>): boolean {
  if (stage === "planning") {
    return true;
  }
  const idx = EPISODE_STAGE_ORDER.indexOf(stage);
  const prev = EPISODE_STAGE_ORDER[idx - 1];
  if (!prev) {
    return true;
  }
  return stageProgress[prev] === "done" || stageProgress[prev] === "ready";
}
