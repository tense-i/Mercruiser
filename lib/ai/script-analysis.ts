import { generateText } from 'ai';
import { z } from 'zod';

import { getConfiguredAiMode, getScriptGenerationFailureMessage, getStudioModel, hasRealCredentials } from '@/lib/ai/provider';
import type { StudioWorkspace } from '@/lib/domain/types';

const ChapterBlueprintSchema = z.object({
  title: z.string().min(1),
  content: z.string().min(1),
  scene: z.string().min(1),
  dialogues: z
    .array(
      z.object({
        speaker: z.string().min(1),
        content: z.string().min(1),
      }),
    )
    .default([]),
  estimatedDurationSeconds: z.number().int().positive(),
});

const ChapterAnalysisSchema = z.object({
  chapters: z.array(ChapterBlueprintSchema).min(1).max(8),
});

const AssetBlueprintSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['character', 'scene', 'prop']),
  description: z.string().min(1),
  prompt: z.string().min(1),
  chapterIndexes: z.array(z.number().int().positive()).min(1).max(8),
});

const AssetAnalysisSchema = z.object({
  assets: z.array(AssetBlueprintSchema).min(1).max(12),
});

const DirectorPlanBlueprintSchema = z.object({
  theme: z.string().min(1),
  visualStyle: z.string().min(1),
  narrativeStructure: z.string().min(1),
  soundDirection: z.string().min(1),
  transitionStrategy: z.string().min(1),
});

const ShotBlueprintSchema = z.object({
  chapterId: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  scene: z.string().min(1),
  shotSize: z.enum(['大远景', '远景', '全景', '中景', '近景', '特写', '大特写']),
  cameraMove: z.string().min(1),
  action: z.string().min(1),
  emotion: z.string().min(1),
  composition: z.string().min(1),
  lighting: z.string().min(1),
  cameraMotion: z.string().min(1),
  prompt: z.string().min(1),
  videoDesc: z.string().min(1),
  dialogue: z.string().default(''),
  sfx: z.string().default(''),
  durationSeconds: z.number().int().positive(),
  referenceAssetNames: z.array(z.string()).default([]),
  track: z.string().min(1),
});

const ShotGenerationOutputSchema = z.object({
  directorPlan: DirectorPlanBlueprintSchema,
  shots: z.array(ShotBlueprintSchema).min(1).max(32),
});

export type ChapterBlueprint = z.infer<typeof ChapterBlueprintSchema>;
export type AssetBlueprint = z.infer<typeof AssetBlueprintSchema>;
export type ShotBlueprint = z.infer<typeof ShotBlueprintSchema>;
export type DirectorPlanBlueprint = z.infer<typeof DirectorPlanBlueprintSchema>;

export class ScriptAnalysisError extends Error {
  constructor(public readonly reason: string, message: string) {
    super(message);
    this.name = 'ScriptAnalysisError';
  }
}

function stripThinkingBlocks(text: string) {
  return text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
}

function parseFirstJsonBlock(text: string) {
  const cleaned = stripThinkingBlocks(text);

  const fencedMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fencedMatch?.[1]) {
    return JSON.parse(fencedMatch[1].trim());
  }

  const objectMatch = cleaned.match(/\{[\s\S]*\}/);
  if (objectMatch?.[0]) {
    return JSON.parse(objectMatch[0]);
  }

  throw new Error('No JSON payload found in script analysis response');
}

function fallbackAnalyzeSourceText(sourceContent: string) {
  const segments = sourceContent
    .split(/[。！？!?\n]+/)
    .map((segment) => segment.trim())
    .filter(Boolean);

  const picked = (segments.length ? segments : [sourceContent.trim() || '原文内容'])
    .slice(0, 4)
    .map((segment, index) => ({
      title: `章节 ${index + 1}`,
      content: segment,
      scene: `场景 ${index + 1}`,
      dialogues: [],
      estimatedDurationSeconds: 30,
    }));

  return picked;
}

function normalizeFailureReason(error: unknown) {
  if (error instanceof ScriptAnalysisError) {
    return error.reason;
  }

  if (error instanceof SyntaxError || error instanceof z.ZodError) {
    return 'invalid_ai_response';
  }

  if (error instanceof Error && error.message.includes('No JSON payload found')) {
    return 'invalid_ai_response';
  }

  return error instanceof Error ? error.message : 'analysis_failed';
}

export function toScriptAnalysisError(error: unknown, mode: ReturnType<typeof getConfiguredAiMode>) {
  if (error instanceof ScriptAnalysisError) {
    return error;
  }

  const reason = normalizeFailureReason(error);
  return new ScriptAnalysisError(reason, getScriptGenerationFailureMessage(mode, reason));
}

export async function analyzeSourceTextToChapters(input: {
  workspace: StudioWorkspace;
  seriesName: string;
  episodeTitle: string;
  sourceTitle: string;
  sourceContent: string;
  aiOverride?: { mode?: string; model?: string; apiKey?: string };
}) {
  const { workspace, seriesName, episodeTitle, sourceTitle, sourceContent, aiOverride } = input;
  const effectiveMode = aiOverride?.mode ?? workspace.settings.ai.mode;
  const effectiveModel = aiOverride?.model ?? workspace.settings.ai.model;
  const effectiveApiKey = aiOverride?.apiKey ?? null;
  const mode = getConfiguredAiMode({ settingsMode: effectiveMode });

  if (!hasRealCredentials(mode, effectiveApiKey)) {
    if (mode === 'mock') {
      return {
        chapters: fallbackAnalyzeSourceText(sourceContent),
        mode: 'fallback' as const,
        reason: 'mock',
      };
    }

    throw new ScriptAnalysisError('no_real_credentials', getScriptGenerationFailureMessage(mode, 'no_real_credentials'));
  }

  try {
    const prompt = [
      '你是 Mercruiser Studio 的 ScriptAgent。',
      '请分析下面的完整原文，并把它拆成 3-8 个结构化章节。',
      '必须覆盖全文主要叙事推进，不能只截取前几段。',
      '返回严格 JSON，不要输出任何解释。',
      'JSON 结构：{"chapters":[{"title":"...","content":"...","scene":"...","dialogues":[{"speaker":"...","content":"..."}],"estimatedDurationSeconds":30}]}',
      '要求：',
      '1. title 简洁',
      '2. content 保留章节核心叙事',
      '3. scene 给出场景标签',
      '4. dialogues 只在能明确提取到对白时填写，否则返回 []',
      '5. estimatedDurationSeconds 取 15-90 秒之间的整数',
      '',
      `系列：${seriesName}`,
      `集数：${episodeTitle}`,
      `原文标题：${sourceTitle}`,
      '',
      '完整原文：',
      sourceContent,
    ].join('\n');

    const { text } = await generateText({
      model: getStudioModel({
        settingsMode: effectiveMode,
        settingsModel: effectiveModel,
        apiKey: effectiveApiKey,
      }),
      prompt,
      abortSignal: AbortSignal.timeout(5 * 60 * 1000),
    });

    const parsed = ChapterAnalysisSchema.parse(parseFirstJsonBlock(text));
    return {
      chapters: parsed.chapters,
      mode: 'ai' as const,
      reason: null,
    };
  } catch (error) {
    throw toScriptAnalysisError(error, mode);
  }
}

function fallbackGenerateShots(
  chapters: Array<{
    id: string;
    index: number;
    title: string;
    content: string;
    scene: string;
    dialogues: Array<{ speaker: string; content: string }>;
    estimatedDurationSeconds: number;
  }>,
  assets: Array<{ id: string; name: string; type: string }>,
): z.infer<typeof ShotGenerationOutputSchema> {
  const assetNames = assets.map((a) => a.name);
  return {
    directorPlan: {
      theme: '在压迫环境中维持主动性',
      visualStyle: '冷暖交错画面，强调空间压缩与人物轮廓光',
      narrativeStructure: '前段追逐建立压迫，中段交易制造选择，尾段留下钩子',
      soundDirection: '雨声、电流声形成持续底噪',
      transitionStrategy: '以空间遮挡和光影跳变作为转场主轴',
    },
    shots: chapters.map((chapter) => ({
      chapterId: chapter.id,
      title: `${chapter.title} 开场`,
      description: chapter.content.slice(0, 90),
      scene: chapter.scene,
      shotSize: '中景' as const,
      cameraMove: '缓推',
      action: '角色推进当前场面动作',
      emotion: '警觉',
      composition: '中景，前景元素制造纵深',
      lighting: '叙事主光 + 辅助轮廓光',
      cameraMotion: '缓推',
      prompt: `根据章节《${chapter.title}》生成高一致性叙事镜头，突出关键动作与场景层次。`,
      videoDesc: `${chapter.scene}，中景，角色动作围绕章节核心冲突展开。`,
      dialogue: chapter.dialogues.map((line) => `${line.speaker}: ${line.content}`).join('\n'),
      sfx: '环境音待补充',
      durationSeconds: Math.max(3, Math.min(30, chapter.estimatedDurationSeconds)),
      referenceAssetNames: assetNames.slice(0, 2),
      track: chapter.scene,
    })),
  };
}

export async function generateShotsFromScript(input: {
  workspace: StudioWorkspace;
  seriesName: string;
  episodeTitle: string;
  chapters: Array<{
    id: string;
    index: number;
    title: string;
    content: string;
    scene: string;
    dialogues: Array<{ speaker: string; content: string }>;
    estimatedDurationSeconds: number;
  }>;
  assets: Array<{ id: string; name: string; type: string; description: string; prompt: string }>;
  aiOverride?: { mode?: string; model?: string; apiKey?: string };
}) {
  const { workspace, seriesName, episodeTitle, chapters, assets, aiOverride } = input;
  const effectiveMode = aiOverride?.mode ?? workspace.settings.ai.mode;
  const effectiveModel = aiOverride?.model ?? workspace.settings.ai.model;
  const effectiveApiKey = aiOverride?.apiKey ?? null;
  const mode = getConfiguredAiMode({ settingsMode: effectiveMode });

  if (!hasRealCredentials(mode, effectiveApiKey)) {
    return {
      ...fallbackGenerateShots(chapters, assets),
      mode: 'mock' as const,
    };
  }

  try {
    const chapterText = chapters
      .map((chapter) =>
        [
          `章节ID：${chapter.id}`,
          `索引：${chapter.index}`,
          `标题：${chapter.title}`,
          `场景：${chapter.scene}`,
          `预计时长：${chapter.estimatedDurationSeconds}秒`,
          `正文：${chapter.content}`,
          `对白：${chapter.dialogues.map((line) => `${line.speaker}: ${line.content}`).join('；') || '无'}`,
        ].join('\n'),
      )
      .join('\n\n');

    const assetText = assets
      .map((asset) => `- ${asset.name}（${asset.type}）：${asset.description}`)
      .join('\n');

    const prompt = [
      '你是 Mercruiser Studio 的 ProductionAgent。',
      '请根据下面的章节列表和已确认主体，为本集生成结构化分镜表，每章生成 1 条分镜。',
      '返回严格 JSON，不要输出任何解释。',
      'JSON 结构：',
      '{',
      '  "directorPlan": {',
      '    "theme": "...",',
      '    "visualStyle": "...",',
      '    "narrativeStructure": "...",',
      '    "soundDirection": "...",',
      '    "transitionStrategy": "..."',
      '  },',
      '  "shots": [{',
      '    "chapterId": "<必须是输入中的章节ID>",',
      '    "title": "...",',
      '    "description": "...",',
      '    "scene": "...",',
      '    "shotSize": "中景",',
      '    "cameraMove": "...",',
      '    "action": "...",',
      '    "emotion": "...",',
      '    "composition": "...",',
      '    "lighting": "...",',
      '    "cameraMotion": "...",',
      '    "prompt": "<英文，用于图像生成，具体可视化>",',
      '    "videoDesc": "<中文，视频描述>",',
      '    "dialogue": "...",',
      '    "sfx": "...",',
      '    "durationSeconds": 4,',
      '    "referenceAssetNames": ["<来自主体列表的名称>"],',
      '    "track": "<场景分组，如：夜市、地下通道>"',
      '  }]',
      '}',
      '要求：',
      '1. 每个章节生成恰好 1 条分镜，chapterId 必须完整匹配输入',
      '2. prompt 必须英文，具体描述视觉元素、构图、光线',
      '3. referenceAssetNames 只从已有主体中选取',
      '4. durationSeconds 参考章节预计时长，取 3-30 秒',
      '5. shotSize 从 [大远景,远景,全景,中景,近景,特写,大特写] 中选一个',
      '',
      `系列：${seriesName}`,
      `集数：${episodeTitle}`,
      '',
      '已确认主体：',
      assetText,
      '',
      '章节列表：',
      chapterText,
    ].join('\n');

    const { text } = await generateText({
      model: getStudioModel({
        settingsMode: effectiveMode,
        settingsModel: effectiveModel,
        apiKey: effectiveApiKey,
      }),
      prompt,
      abortSignal: AbortSignal.timeout(5 * 60 * 1000),
    });

    const parsed = ShotGenerationOutputSchema.parse(parseFirstJsonBlock(text));
    return {
      ...parsed,
      mode: 'ai' as const,
    };
  } catch (error) {
    throw toScriptAnalysisError(error, mode);
  }
}

export async function analyzeChaptersToAssets(input: {
  workspace: StudioWorkspace;
  seriesName: string;
  episodeTitle: string;
  chapters: Array<{
    id: string;
    index: number;
    title: string;
    content: string;
    scene: string;
    dialogues: Array<{ speaker: string; content: string }>;
  }>;
  aiOverride?: { mode?: string; model?: string; apiKey?: string };
}) {
  const { workspace, seriesName, episodeTitle, chapters, aiOverride } = input;
  const effectiveMode = aiOverride?.mode ?? workspace.settings.ai.mode;
  const effectiveModel = aiOverride?.model ?? workspace.settings.ai.model;
  const effectiveApiKey = aiOverride?.apiKey ?? null;
  const mode = getConfiguredAiMode({ settingsMode: effectiveMode });

  if (!hasRealCredentials(mode, effectiveApiKey)) {
    throw new ScriptAnalysisError('no_real_credentials', getScriptGenerationFailureMessage(mode, 'no_real_credentials'));
  }

  try {
    const chapterText = chapters
      .map((chapter) => [
        `章节索引：${chapter.index}`,
        `标题：${chapter.title}`,
        `场景：${chapter.scene}`,
        `正文：${chapter.content}`,
        `对白：${chapter.dialogues.map((line) => `${line.speaker}: ${line.content}`).join('；') || '无'}`,
      ].join('\n'))
      .join('\n\n');

    const prompt = [
      '你是 Mercruiser Studio 的 AssetAgent。',
      '请根据下面已经生成好的章节内容，提取本集后续分镜和主体设计真正需要的角色、场景、道具。',
      '禁止输出泛化占位主体、禁止编造与章节无关的对象。',
      '返回严格 JSON，不要输出任何解释。',
      'JSON 结构：{"assets":[{"name":"...","type":"character|scene|prop","description":"...","prompt":"...","chapterIndexes":[1,2]}]}',
      '要求：',
      '1. 只保留对本集视觉生产有价值的主体',
      '2. name 必须来自当前章节语义，不能使用“角色1/场景1/道具1”之类占位词',
      '3. description 用中文，说明该主体在本集中的叙事/视觉作用',
      '4. prompt 用英文，用于后续图像生成，要求具体、可视觉化',
      '5. chapterIndexes 必须对应输入章节索引',
      '6. 总数控制在 2-8 个，优先关键角色、核心场景、重要道具',
      '',
      `系列：${seriesName}`,
      `集数：${episodeTitle}`,
      '',
      '章节内容：',
      chapterText,
    ].join('\n');

    const { text } = await generateText({
      model: getStudioModel({
        settingsMode: effectiveMode,
        settingsModel: effectiveModel,
        apiKey: effectiveApiKey,
      }),
      prompt,
      abortSignal: AbortSignal.timeout(5 * 60 * 1000),
    });

    const parsed = AssetAnalysisSchema.parse(parseFirstJsonBlock(text));
    return {
      assets: parsed.assets,
      mode: 'ai' as const,
      reason: null,
    };
  } catch (error) {
    throw toScriptAnalysisError(error, mode);
  }
}
