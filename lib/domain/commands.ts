import { z } from 'zod';

const ExpectedRevisionSchema = z.number().int().positive().optional();
const BatchSnapshotSchema = z.object({
  assetId: z.string().optional(),
  shotId: z.string().optional(),
  revision: z.number().int().positive(),
});

export const UpdateChapterCommandSchema = z.object({
  type: z.literal('updateChapter'),
  chapterId: z.string(),
  content: z.string().min(1),
  expectedRevision: ExpectedRevisionSchema,
});

export const GenerateScriptFromSourceCommandSchema = z.object({
  type: z.literal('generateScriptFromSource'),
  episodeId: z.string(),
});

export const ImportSourceDocumentCommandSchema = z.object({
  type: z.literal('importSourceDocument'),
  episodeId: z.string(),
  title: z.string().min(1),
  content: z.string().min(1),
});

export const ExtractAssetsFromScriptCommandSchema = z.object({
  type: z.literal('extractAssetsFromScript'),
  episodeId: z.string(),
});

export const GenerateAssetImagesCommandSchema = z.object({
  type: z.literal('generateAssetImages'),
  episodeId: z.string(),
  assetSnapshots: z.array(BatchSnapshotSchema).optional(),
});

export const UpdateAssetCommandSchema = z.object({
  type: z.literal('updateAsset'),
  assetId: z.string(),
  description: z.string(),
  prompt: z.string().optional(),
  voice: z.string().optional(),
  isShared: z.boolean().optional(),
  expectedRevision: ExpectedRevisionSchema,
});

export const PromoteAssetCommandSchema = z.object({
  type: z.literal('promoteAssetToShared'),
  assetId: z.string(),
});

export const PromoteAssetToGlobalCommandSchema = z.object({
  type: z.literal('promoteAssetToGlobal'),
  assetId: z.string(),
});

export const ImportGlobalAssetCommandSchema = z.object({
  type: z.literal('importGlobalAssetToSeries'),
  globalAssetId: z.string(),
  seriesId: z.string(),
  mode: z.enum(['linked', 'detached']).default('linked'),
});

export const SelectAssetImageCommandSchema = z.object({
  type: z.literal('selectAssetImage'),
  assetId: z.string(),
  imageId: z.string(),
  expectedRevision: ExpectedRevisionSchema,
});

export const UpdateShotCommandSchema = z.object({
  type: z.literal('updateShot'),
  shotId: z.string(),
  prompt: z.string(),
  scene: z.string(),
  composition: z.string(),
  lighting: z.string(),
  cameraMotion: z.string(),
  dialogue: z.string(),
  durationSeconds: z.number().int().positive(),
  expectedRevision: ExpectedRevisionSchema,
});

export const SelectTakeCommandSchema = z.object({
  type: z.literal('selectTake'),
  shotId: z.string(),
  takeId: z.string(),
  expectedRevision: ExpectedRevisionSchema,
});

export const ApplyGenerationPresetCommandSchema = z.object({
  type: z.literal('applyGenerationPreset'),
  presetId: z.string(),
  targetType: z.enum(['asset', 'shot']),
  targetId: z.string(),
});

export const UpdateTimelineItemCommandSchema = z.object({
  type: z.literal('updateTimelineItem'),
  finalCutId: z.string(),
  trackId: z.string(),
  itemId: z.string(),
  label: z.string(),
  locked: z.boolean(),
  expectedRevision: ExpectedRevisionSchema,
});

export const UpdateSettingsCommandSchema = z.object({
  type: z.literal('updateSettings'),
  settings: z.object({
    ai: z
      .object({
        mode: z.enum(['mock', 'google', 'gateway', 'siliconflow']).optional(),
        model: z.string().optional(),
        systemPrompt: z.string().optional(),
        skillPrompt: z.string().optional(),
        memoryEnabled: z.boolean().optional(),
      })
      .optional(),
    workspace: z
      .object({
        aspectRatio: z.string().optional(),
        creationMode: z.string().optional(),
        defaultStyle: z.string().optional(),
        dataPath: z.string().optional(),
      })
      .optional(),
    governance: z
      .object({
        requestLogging: z.boolean().optional(),
        allowAgentWrites: z.boolean().optional(),
        permissionMode: z.enum(['private', 'invite_only', 'role_based']).optional(),
        reservedRoles: z.array(z.string()).optional(),
      })
      .optional(),
    usage: z
      .object({
        currency: z.enum(['USD', 'CNY']).optional(),
        singleTaskLimit: z.number().nonnegative().optional(),
        dailyLimit: z.number().nonnegative().optional(),
        monthlyLimit: z.number().nonnegative().optional(),
        notifyMethod: z.enum(['toast', 'email', 'block']).optional(),
        defaultImageCost: z.number().nonnegative().optional(),
        defaultVideoSecondCost: z.number().nonnegative().optional(),
        defaultTextCost: z.number().nonnegative().optional(),
      })
      .optional(),
  }),
});

export const GenerateShotsCommandSchema = z.object({
  type: z.literal('generateShotsFromChapters'),
  episodeId: z.string(),
  assetSnapshots: z.array(BatchSnapshotSchema).optional(),
});

export const GenerateShotImagesCommandSchema = z.object({
  type: z.literal('generateShotImages'),
  episodeId: z.string(),
  shotSnapshots: z.array(BatchSnapshotSchema).optional(),
});

export const RetryTaskCommandSchema = z.object({
  type: z.literal('retryTask'),
  taskId: z.string(),
});

export const StudioCommandSchema = z.discriminatedUnion('type', [
  UpdateChapterCommandSchema,
  ImportSourceDocumentCommandSchema,
  GenerateScriptFromSourceCommandSchema,
  ExtractAssetsFromScriptCommandSchema,
  GenerateAssetImagesCommandSchema,
  UpdateAssetCommandSchema,
  PromoteAssetCommandSchema,
  PromoteAssetToGlobalCommandSchema,
  ImportGlobalAssetCommandSchema,
  SelectAssetImageCommandSchema,
  UpdateShotCommandSchema,
  SelectTakeCommandSchema,
  ApplyGenerationPresetCommandSchema,
  UpdateTimelineItemCommandSchema,
  UpdateSettingsCommandSchema,
  GenerateShotsCommandSchema,
  GenerateShotImagesCommandSchema,
  RetryTaskCommandSchema,
]);

export type StudioCommand = z.infer<typeof StudioCommandSchema>;
