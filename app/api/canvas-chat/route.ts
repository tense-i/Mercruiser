import { generateText, tool, stepCountIs } from 'ai';
import { z } from 'zod';

import { getStudioModel, hasRealCredentials, getConfiguredAiMode } from '@/lib/ai/provider';
import { studioRepository } from '@/lib/server/repository/studio-repository';
import { assertLocalMutationRequest } from '@/lib/server/request-guard';

export async function POST(req: Request) {
  assertLocalMutationRequest(req);

  const body = (await req.json()) as {
    episodeId: string;
    messages: Array<{ role: 'user' | 'assistant'; content: string }>;
    workspace: {
      settings: { ai: { mode: string; model: string } };
    };
  };

  const { episodeId, messages, workspace } = body;

  const view = await studioRepository.getEpisodeWorkspaceView(episodeId);
  if (!view) {
    return new Response('Episode not found', { status: 404 });
  }

  const mode = getConfiguredAiMode({ settingsMode: workspace.settings.ai.mode });
  if (!hasRealCredentials(mode)) {
    return new Response(
      JSON.stringify({ error: '请先在设置中配置 AI 密钥才能使用画布对话功能。' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }

  const chaptersCtx = view.chapters
    .map((c) => `章节[${c.id}] "${c.title}" 场景:${c.scene} 内容:${c.content.slice(0, 120)}...`)
    .join('\n');

  const assetsCtx = view.assets
    .map((a) => `主体[${a.id}] "${a.name}" 类型:${a.type} 描述:${a.description.slice(0, 80)}`)
    .join('\n');

  const shotsCtx = view.shots
    .map((s) => `分镜[${s.id}] #${s.index} "${s.title}" ${s.durationSeconds}s 对白:${s.dialogue?.slice(0, 60) ?? '无'}`)
    .join('\n');

  const systemPrompt = `你是 Mercruiser Studio 的画布 AI 助手，帮助用户理解和修改当前集的内容。

当前集：${view.episode.title}（ID: ${episodeId}）

## 章节列表
${chaptersCtx || '暂无章节'}

## 主体列表
${assetsCtx || '暂无主体'}

## 分镜列表
${shotsCtx || '暂无分镜'}

你可以：
1. 回答关于内容的问题
2. 使用 updateChapter 工具更新章节内容
3. 使用 updateAsset 工具更新主体描述
4. 使用 updateShot 工具更新分镜信息
5. 使用 generateShotImages 工具触发特定分镜的图片重新生成

操作前先确认用户意图，操作后告知结果。用中文回复。`;

  const result = await generateText({
    model: getStudioModel({
      settingsMode: workspace.settings.ai.mode,
      settingsModel: workspace.settings.ai.model,
    }),
    system: systemPrompt,
    messages,
    tools: {
      updateChapter: tool({
        description: '提议更新章节的标题或正文内容（不立即保存，等待用户确认）',
        inputSchema: z.object({
          chapterId: z.string().describe('章节ID'),
          title: z.string().optional().describe('新标题'),
          content: z.string().optional().describe('新正文内容'),
          scene: z.string().optional().describe('新场景描述'),
        }),
        execute: async ({ chapterId, title, content, scene }: { chapterId: string; title?: string; content?: string; scene?: string }) => {
          const chapter = view.chapters.find((c) => c.id === chapterId);
          if (!chapter) return { ok: false, error: `章节 ${chapterId} 不存在` };
          return {
            proposalId: crypto.randomUUID(),
            kind: 'updateChapter' as const,
            anchorNodeId: chapterId,
            args: { chapterId, title: title ?? chapter.title, content: content ?? chapter.content, scene: scene ?? chapter.scene },
            diff: [
              ...(title && title !== chapter.title ? [{ field: '标题', from: chapter.title, to: title }] : []),
              ...(scene && scene !== chapter.scene ? [{ field: '场景', from: chapter.scene, to: scene }] : []),
              ...(content && content !== chapter.content ? [{ field: '内容', from: chapter.content.slice(0, 60) + '...', to: content.slice(0, 60) + '...' }] : []),
            ],
            summary: `修改章节「${chapter.title}」`,
          };
        },
      }),

      updateAsset: tool({
        description: '提议更新主体的名称或描述（不立即保存，等待用户确认）',
        inputSchema: z.object({
          assetId: z.string().describe('主体ID'),
          name: z.string().optional().describe('新名称'),
          description: z.string().optional().describe('新描述'),
          prompt: z.string().optional().describe('新图片提示词（英文）'),
        }),
        execute: async ({ assetId, name, description, prompt }: { assetId: string; name?: string; description?: string; prompt?: string }) => {
          const asset = view.assets.find((a) => a.id === assetId);
          if (!asset) return { ok: false, error: `主体 ${assetId} 不存在` };
          return {
            proposalId: crypto.randomUUID(),
            kind: 'updateAsset' as const,
            anchorNodeId: assetId,
            args: { assetId, name: name ?? asset.name, description: description ?? asset.description, prompt: prompt ?? asset.prompt },
            diff: [
              ...(name && name !== asset.name ? [{ field: '名称', from: asset.name, to: name }] : []),
              ...(description && description !== asset.description ? [{ field: '描述', from: asset.description.slice(0, 60) + '...', to: description.slice(0, 60) + '...' }] : []),
              ...(prompt && prompt !== asset.prompt ? [{ field: '提示词', from: (asset.prompt ?? '').slice(0, 60) + '...', to: prompt.slice(0, 60) + '...' }] : []),
            ],
            summary: `修改主体「${asset.name}」`,
          };
        },
      }),

      updateShot: tool({
        description: '提议更新分镜的描述、对白或音效（不立即保存，等待用户确认）',
        inputSchema: z.object({
          shotId: z.string().describe('分镜ID'),
          title: z.string().optional().describe('新标题'),
          description: z.string().optional().describe('新描述'),
          dialogue: z.string().optional().describe('新对白'),
          sfx: z.string().optional().describe('新音效描述'),
          prompt: z.string().optional().describe('新图片提示词（英文）'),
        }),
        execute: async ({ shotId, title, description, dialogue, sfx, prompt }: { shotId: string; title?: string; description?: string; dialogue?: string; sfx?: string; prompt?: string }) => {
          const shot = view.shots.find((s) => s.id === shotId);
          if (!shot) return { ok: false, error: `分镜 ${shotId} 不存在` };
          return {
            proposalId: crypto.randomUUID(),
            kind: 'updateShot' as const,
            anchorNodeId: shotId,
            args: { shotId, title: title ?? shot.title, description: description ?? shot.description, dialogue: dialogue ?? shot.dialogue, sfx: sfx ?? shot.sfx, prompt: prompt ?? shot.prompt },
            diff: [
              ...(title && title !== shot.title ? [{ field: '标题', from: shot.title, to: title }] : []),
              ...(dialogue && dialogue !== shot.dialogue ? [{ field: '对白', from: shot.dialogue?.slice(0, 60) ?? '', to: dialogue.slice(0, 60) }] : []),
              ...(sfx && sfx !== shot.sfx ? [{ field: '音效', from: shot.sfx ?? '', to: sfx }] : []),
              ...(description && description !== shot.description ? [{ field: '描述', from: shot.description?.slice(0, 60) ?? '', to: description.slice(0, 60) }] : []),
            ],
            summary: `修改分镜「${shot.title}」`,
          };
        },
      }),
    },
    stopWhen: stepCountIs(3),
  });

  // Collect all proposals from tool results across steps
  const proposals = result.steps.flatMap((step) =>
    (step.toolResults ?? []).flatMap((r) => {
      const output = r.output as Record<string, unknown>;
      return output.proposalId ? [output] : [];
    }),
  );

  return Response.json({ reply: result.text, proposals });
}
