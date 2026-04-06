import type { z } from 'zod';

import type {
  AgentRunSchema,
  AssetSchema,
  ChapterSchema,
  SourceDocumentSchema,
  DirectorPlanSchema,
  EpisodeSchema,
  FinalCutSchema,
  SettingsSchema,
  SeriesSchema,
  ShotSchema,
  StoryboardItemSchema,
  StudioWorkspaceSchema,
  TaskRecordSchema,
  GateSnapshotSchema,
  WorkflowRunSchema,
} from '@/lib/domain/schema';

export type Series = z.infer<typeof SeriesSchema>;
export type Episode = z.infer<typeof EpisodeSchema>;
export type Chapter = z.infer<typeof ChapterSchema>;
export type SourceDocument = z.infer<typeof SourceDocumentSchema>;
export type Asset = z.infer<typeof AssetSchema>;
export type DirectorPlan = z.infer<typeof DirectorPlanSchema>;
export type Shot = z.infer<typeof ShotSchema>;
export type StoryboardItem = z.infer<typeof StoryboardItemSchema>;
export type FinalCut = z.infer<typeof FinalCutSchema>;
export type TaskRecord = z.infer<typeof TaskRecordSchema>;
export type Settings = z.infer<typeof SettingsSchema>;
export type AgentRun = z.infer<typeof AgentRunSchema>;
export type GateSnapshot = z.infer<typeof GateSnapshotSchema>;
export type WorkflowRun = z.infer<typeof WorkflowRunSchema>;
export type StudioWorkspace = z.infer<typeof StudioWorkspaceSchema>;
