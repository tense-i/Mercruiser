import { z } from 'zod';

import {
  assetTypes,
  episodeStatuses,
  seriesStatuses,
  shotStatuses,
  stationStatuses,
  takeKinds,
  taskKinds,
  taskStatuses,
  workflowActionKinds,
  workflowStages,
  workstationTabs,
  assetProcessingStates,
} from '@/lib/domain/enums';

export const SeriesStatusSchema = z.enum(seriesStatuses);
export const EpisodeStatusSchema = z.enum(episodeStatuses);
export const StationStatusSchema = z.enum(stationStatuses);
export const ShotStatusSchema = z.enum(shotStatuses);
export const AssetTypeSchema = z.enum(assetTypes);
export const TakeKindSchema = z.enum(takeKinds);
export const TaskStatusSchema = z.enum(taskStatuses);
export const TaskKindSchema = z.enum(taskKinds);
export const WorkstationTabSchema = z.enum(workstationTabs);
export const AssetProcessingStateSchema = z.enum(assetProcessingStates);
export const WorkflowStageSchema = z.enum(workflowStages);
export const WorkflowActionKindSchema = z.enum(workflowActionKinds);

export const DialogueLineSchema = z.object({
  speaker: z.string(),
  content: z.string(),
});

export const SourceDocumentSchema = z.object({
  id: z.string(),
  episodeId: z.string(),
  title: z.string(),
  content: z.string(),
  importedAt: z.string(),
});

export const AssetStateSchema = z.object({
  id: z.string(),
  name: z.string(),
  notes: z.string().default(''),
});

export const AssetVersionSchema = z.object({
  id: z.string(),
  label: z.string(),
  imageUrl: z.string().url().or(z.string().startsWith('/')),
  createdAt: z.string(),
  isSelected: z.boolean(),
});

export const TakeSchema = z.object({
  id: z.string(),
  kind: TakeKindSchema,
  label: z.string(),
  url: z.string().url().or(z.string().startsWith('/')),
  durationSeconds: z.number().int().nonnegative().nullable().default(null),
  isSelected: z.boolean(),
});

export const ContinuityIssueSchema = z.object({
  id: z.string(),
  severity: z.enum(['warning', 'error']),
  message: z.string(),
});

export const SeriesSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  status: SeriesStatusSchema,
  coverUrl: z.string().url().or(z.string().startsWith('/')),
  genre: z.string(),
  style: z.string(),
  worldRules: z.array(z.string()).default([]),
  episodeIds: z.array(z.string()).default([]),
  progress: z.number().int().min(0).max(100),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const EpisodeSchema = z.object({
  id: z.string(),
  seriesId: z.string(),
  index: z.number().int().positive(),
  title: z.string(),
  logline: z.string(),
  status: EpisodeStatusSchema,
  progress: z.number().int().min(0).max(100),
  stationStates: z.record(WorkstationTabSchema, StationStatusSchema),
  sourceDocumentId: z.string().nullable().default(null),
  currentStage: WorkflowStageSchema.default('script_generation'),
  chapterIds: z.array(z.string()).default([]),
  assetIds: z.array(z.string()).default([]),
  shotIds: z.array(z.string()).default([]),
  storyboardIds: z.array(z.string()).default([]),
  directorPlanId: z.string().nullable().default(null),
  finalCutId: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const ChapterSchema = z.object({
  id: z.string(),
  episodeId: z.string(),
  index: z.number().int().positive(),
  title: z.string(),
  content: z.string(),
  scene: z.string().default('未标注场景'),
  dialogues: z.array(DialogueLineSchema).default([]),
  audioStatus: z.enum(['not_ready', 'ready', 'locked']),
  estimatedDurationSeconds: z.number().int().positive(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const AssetSchema = z.object({
  id: z.string(),
  seriesId: z.string(),
  episodeId: z.string().nullable().default(null),
  name: z.string(),
  type: AssetTypeSchema,
  description: z.string(),
  prompt: z.string().default(''),
  chapterIds: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
  isShared: z.boolean(),
  isFaceLocked: z.boolean().default(false),
  voice: z.string().default(''),
  state: AssetProcessingStateSchema.default('pending'),
  states: z.array(AssetStateSchema).default([]),
  selectedStateId: z.string().nullable().default(null),
  versions: z.array(AssetVersionSchema).default([]),
  images: z.array(AssetVersionSchema).default([]),
  parentAssetId: z.string().nullable().default(null),
  variantName: z.string().nullable().default(null),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const DirectorPlanSchema = z.object({
  id: z.string(),
  episodeId: z.string(),
  theme: z.string(),
  visualStyle: z.string(),
  narrativeStructure: z.string(),
  sceneIntent: z.string(),
  soundDirection: z.string(),
  transitionStrategy: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const ShotSchema = z.object({
  id: z.string(),
  episodeId: z.string(),
  chapterId: z.string().nullable().default(null),
  index: z.number().int().positive(),
  title: z.string(),
  description: z.string(),
  scene: z.string(),
  associatedAssetIds: z.array(z.string()).default([]),
  associatedAssetNames: z.array(z.string()).default([]),
  duration: z.number().int().positive().max(8).default(3),
  shotSize: z.enum(['大远景', '远景', '全景', '中景', '近景', '特写', '大特写']).default('中景'),
  cameraMove: z.string().default('定镜'),
  action: z.string().default(''),
  emotion: z.string().default(''),
  sound: z.string().default(''),
  composition: z.string(),
  lighting: z.string(),
  cameraMotion: z.string(),
  prompt: z.string(),
  videoDesc: z.string().default(''),
  dialogue: z.string().default(''),
  sfx: z.string().default(''),
  durationSeconds: z.number().int().positive(),
  status: ShotStatusSchema,
  continuityStatus: z.enum(['clear', 'warning', 'error']).default('clear'),
  continuityIssues: z.array(ContinuityIssueSchema).default([]),
  referenceAssetIds: z.array(z.string()).default([]),
  takes: z.array(TakeSchema).default([]),
  images: z.array(AssetVersionSchema).default([]),
  state: z.enum(['draft', 'ready', 'generating', 'completed', 'failed']).default('draft'),
  track: z.string().default('default'),
  trackId: z.string().default('track_default'),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const StoryboardItemSchema = z.object({
  id: z.string(),
  episodeId: z.string(),
  shotId: z.string(),
  subtitle: z.string().default(''),
  notes: z.string().default(''),
  selectedTakeId: z.string().nullable().default(null),
  referenceAssetIds: z.array(z.string()).default([]),
  updatedAt: z.string(),
});

export const TrackItemSchema = z.object({
  id: z.string(),
  label: z.string(),
  shotId: z.string().nullable().default(null),
  takeId: z.string().nullable().default(null),
  startSeconds: z.number().nonnegative(),
  endSeconds: z.number().positive(),
  locked: z.boolean().default(false),
});

export const TrackSchema = z.object({
  id: z.string(),
  type: z.enum(['video', 'dialogue', 'audio']),
  name: z.string(),
  items: z.array(TrackItemSchema).default([]),
});

export const FinalCutSchema = z.object({
  id: z.string(),
  episodeId: z.string(),
  resolution: z.string(),
  fps: z.number().int().positive(),
  exportStatus: z.enum(['draft', 'review', 'ready']),
  notes: z.string().default(''),
  tracks: z.array(TrackSchema).default([]),
  updatedAt: z.string(),
});

export const TaskRecordSchema = z.object({
  id: z.string(),
  kind: TaskKindSchema,
  targetType: z.enum(['series', 'episode', 'chapter', 'asset', 'shot', 'storyboard', 'settings', 'agent']),
  targetId: z.string(),
  title: z.string(),
  description: z.string(),
  status: TaskStatusSchema,
  retryable: z.boolean().default(false),
  link: z.string(),
  error: z.string().nullable().default(null),
  logs: z.array(z.string()).default([]),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const ToolCallLogSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: z.enum(['pending', 'completed', 'failed']),
  summary: z.string(),
});

export const AgentRunSchema = z.object({
  id: z.string(),
  scopeType: z.enum(['workspace', 'series', 'episode']),
  scopeId: z.string(),
  prompt: z.string(),
  summary: z.string(),
  status: z.enum(['completed', 'failed']),
  toolCalls: z.array(ToolCallLogSchema).default([]),
  createdAt: z.string(),
  completedAt: z.string().nullable().default(null),
});

export const GateSnapshotSchema = z.object({
  episodeId: z.string(),
  currentStage: WorkflowStageSchema,
  availableActions: z.array(
    z.object({
      kind: WorkflowActionKindSchema,
      enabled: z.boolean(),
      label: z.string(),
      reason: z.string().nullable().default(null),
    }),
  ),
  blockedReasons: z.array(z.string()).default([]),
  requiredInputs: z.array(z.string()).default([]),
  updatedAt: z.string(),
});

export const WorkflowRunSchema = z.object({
  id: z.string(),
  episodeId: z.string(),
  stage: WorkflowStageSchema,
  agent: z.enum(['script', 'asset', 'production', 'recovery']),
  status: z.enum(['idle', 'running', 'completed', 'failed']),
  summary: z.string(),
  taskId: z.string().nullable().default(null),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const SettingsSchema = z.object({
  locale: z.string(),
  ai: z.object({
    mode: z.enum(['mock', 'google', 'gateway']),
    model: z.string(),
    systemPrompt: z.string(),
    skillPrompt: z.string(),
    memoryEnabled: z.boolean(),
  }),
  workspace: z.object({
    aspectRatio: z.string(),
    creationMode: z.string(),
    defaultStyle: z.string(),
    dataPath: z.string(),
  }),
  governance: z.object({
    requestLogging: z.boolean(),
    allowAgentWrites: z.boolean(),
  }),
});

export const StudioWorkspaceSchema = z.object({
  version: z.literal(1),
  meta: z.object({
    name: z.string(),
    updatedAt: z.string(),
  }),
  series: z.array(SeriesSchema),
  episodes: z.array(EpisodeSchema),
  sourceDocuments: z.array(SourceDocumentSchema).default([]),
  chapters: z.array(ChapterSchema),
  assets: z.array(AssetSchema),
  directorPlans: z.array(DirectorPlanSchema).default([]),
  shots: z.array(ShotSchema),
  storyboards: z.array(StoryboardItemSchema),
  finalCuts: z.array(FinalCutSchema),
  tasks: z.array(TaskRecordSchema),
  settings: SettingsSchema,
  agentRuns: z.array(AgentRunSchema),
  workflowRuns: z.array(WorkflowRunSchema).default([]),
  gateSnapshots: z.array(GateSnapshotSchema).default([]),
});
