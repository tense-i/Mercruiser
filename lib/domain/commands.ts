import { z } from 'zod';

export const UpdateChapterCommandSchema = z.object({
  type: z.literal('updateChapter'),
  chapterId: z.string(),
  content: z.string().min(1),
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
});

export const UpdateAssetCommandSchema = z.object({
  type: z.literal('updateAsset'),
  assetId: z.string(),
  description: z.string(),
  prompt: z.string().optional(),
  voice: z.string().optional(),
  isShared: z.boolean().optional(),
});

export const PromoteAssetCommandSchema = z.object({
  type: z.literal('promoteAssetToShared'),
  assetId: z.string(),
});

export const SelectAssetImageCommandSchema = z.object({
  type: z.literal('selectAssetImage'),
  assetId: z.string(),
  imageId: z.string(),
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
});

export const SelectTakeCommandSchema = z.object({
  type: z.literal('selectTake'),
  shotId: z.string(),
  takeId: z.string(),
});

export const UpdateTimelineItemCommandSchema = z.object({
  type: z.literal('updateTimelineItem'),
  finalCutId: z.string(),
  trackId: z.string(),
  itemId: z.string(),
  label: z.string(),
  locked: z.boolean(),
});

export const UpdateSettingsCommandSchema = z.object({
  type: z.literal('updateSettings'),
  settings: z.object({
    ai: z
      .object({
        mode: z.enum(['mock', 'google', 'gateway']).optional(),
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
      })
      .optional(),
  }),
});

export const GenerateShotsCommandSchema = z.object({
  type: z.literal('generateShotsFromChapters'),
  episodeId: z.string(),
});

export const GenerateShotImagesCommandSchema = z.object({
  type: z.literal('generateShotImages'),
  episodeId: z.string(),
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
  SelectAssetImageCommandSchema,
  UpdateShotCommandSchema,
  SelectTakeCommandSchema,
  UpdateTimelineItemCommandSchema,
  UpdateSettingsCommandSchema,
  GenerateShotsCommandSchema,
  GenerateShotImagesCommandSchema,
  RetryTaskCommandSchema,
]);

export type StudioCommand = z.infer<typeof StudioCommandSchema>;
