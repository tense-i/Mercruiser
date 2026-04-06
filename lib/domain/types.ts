import type { z } from 'zod';

import type {
  AgentRunSchema,
  APIUsageRecordSchema,
  AssetSchema,
  BrokenAssetRefSchema,
  ChapterSchema,
  DialogueTrackSchema,
  DirectorPlanSchema,
  EpisodeSchema,
  FinalCutSchema,
  GateSnapshotSchema,
  GenerationPresetSchema,
  GlobalAssetSchema,
  MultimodalInputSchema,
  SettingsSchema,
  SeriesSchema,
  ShotAssetSnapshotSchema,
  ShotSchema,
  StoryboardItemSchema,
  StudioWorkspaceSchema,
  TaskRecordSchema,
  UsageAlertSchema,
  WorkflowRunSchema,
} from '@/lib/domain/schema';

export type Series = z.infer<typeof SeriesSchema>;
export type Episode = z.infer<typeof EpisodeSchema>;
export type Chapter = z.infer<typeof ChapterSchema>;
export type Asset = z.infer<typeof AssetSchema>;
export type GlobalAsset = z.infer<typeof GlobalAssetSchema>;
export type GenerationPreset = z.infer<typeof GenerationPresetSchema>;
export type APIUsageRecord = z.infer<typeof APIUsageRecordSchema>;
export type UsageAlert = z.infer<typeof UsageAlertSchema>;
export type DirectorPlan = z.infer<typeof DirectorPlanSchema>;
export type Shot = z.infer<typeof ShotSchema>;
export type ShotAssetSnapshot = z.infer<typeof ShotAssetSnapshotSchema>;
export type BrokenAssetRef = z.infer<typeof BrokenAssetRefSchema>;
export type DialogueTrack = z.infer<typeof DialogueTrackSchema>;
export type MultimodalInput = z.infer<typeof MultimodalInputSchema>;
export type StoryboardItem = z.infer<typeof StoryboardItemSchema>;
export type FinalCut = z.infer<typeof FinalCutSchema>;
export type TaskRecord = z.infer<typeof TaskRecordSchema>;
export type Settings = z.infer<typeof SettingsSchema>;
export type AgentRun = z.infer<typeof AgentRunSchema>;
export type GateSnapshot = z.infer<typeof GateSnapshotSchema>;
export type WorkflowRun = z.infer<typeof WorkflowRunSchema>;
export type StudioWorkspace = z.infer<typeof StudioWorkspaceSchema>;
