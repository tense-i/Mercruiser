import { generateText } from 'ai';
import { z } from 'zod';

import { getConfiguredAiMode, getStudioModel, hasRealCredentials } from '@/lib/ai/provider';
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

export type ChapterBlueprint = z.infer<typeof ChapterBlueprintSchema>;

function parseFirstJsonBlock(text: string) {
  const fencedMatch = text.match(/```json\s*([\s\S]*?)```/i);
  if (fencedMatch?.[1]) {
    return JSON.parse(fencedMatch[1]);
  }

  const objectMatch = text.match(/\{[\s\S]*\}/);
  if (objectMatch?.[0]) {
    return JSON.parse(objectMatch[0]);
  }

  throw new Error('No JSON payload found in script analysis response');
}

function fallbackAnalyzeSourceText(sourceContent: string) {
  const segments = sourceContent
    .split(/\n{2,}|(?<=[。！？!?])\s*/)
    .map((item) => item.trim())
    .filter(Boolean);

  const chunkSize = Math.max(1, Math.ceil(segments.length / Math.min(4, Math.max(1, segments.length))));
  const chapterChunks: string[] = [];

  for (let index = 0; index < segments.length; index += chunkSize) {
    chapterChunks.push(segments.slice(index, index + chunkSize).join('\n'));
  }

  const chapters = chapterChunks.slice(0, 6).map((chunk, index) => ({
    title: `章节 ${index + 1}`,
    content: chunk,
    scene: index % 2 === 0 ? '主场景' : '转场场景',
    dialogues:
      index === 0
        ? [
            {
              speaker: '旁白',
              content: chunk.slice(0, 24),
            },
          ]
        : [],
    estimatedDurationSeconds: Math.min(90, Math.max(18, Math.round(chunk.length / 18))),
  }));

  return chapters.length
    ? chapters
    : [
        {
          title: '章节 1',
          content: sourceContent,
          scene: '主场景',
          dialogues: [],
          estimatedDurationSeconds: Math.min(120, Math.max(18, Math.round(sourceContent.length / 18))),
        },
      ];
}

export async function analyzeSourceTextToChapters(input: {
  workspace: StudioWorkspace;
  seriesName: string;
  episodeTitle: string;
  sourceTitle: string;
  sourceContent: string;
}) {
  const { workspace, seriesName, episodeTitle, sourceTitle, sourceContent } = input;
  const mode = getConfiguredAiMode({ settingsMode: workspace.settings.ai.mode });

  if (!hasRealCredentials(mode)) {
    return {
      chapters: fallbackAnalyzeSourceText(sourceContent),
      mode: 'fallback' as const,
      reason: 'no_real_credentials',
    };
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
        settingsMode: workspace.settings.ai.mode,
        settingsModel: workspace.settings.ai.model,
      }),
      prompt,
    });

    const parsed = ChapterAnalysisSchema.parse(parseFirstJsonBlock(text));
    return {
      chapters: parsed.chapters,
      mode: 'ai' as const,
    };
  } catch (error) {
    return {
      chapters: fallbackAnalyzeSourceText(sourceContent),
      mode: 'fallback' as const,
      reason: error instanceof Error ? error.message : 'analysis_failed',
    };
  }
}
