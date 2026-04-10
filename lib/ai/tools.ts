import { tool, generateText, type LanguageModel } from 'ai';
import { z } from 'zod';

import { studioRepository } from '@/lib/server/repository/studio-repository';

export function createStudioTools(
  context: { seriesId?: string; episodeId?: string },
  options: { getModel?: () => LanguageModel } = {},
) {
  const { getModel } = options;
  return {
    get_episode_workspace: tool({
      description: '读取当前单集工作区，包括阶段门禁、章节、主体、镜头、故事板与任务状态。',
      inputSchema: z.object({
        episodeId: z.string().optional(),
      }),
      execute: async ({ episodeId }) => {
        const resolvedEpisodeId = episodeId ?? context.episodeId;
        if (!resolvedEpisodeId) {
          return { ok: false, message: 'No episode context available' };
        }

        const view = await studioRepository.getEpisodeWorkspaceView(resolvedEpisodeId);
        if (!view) {
          return { ok: false, message: 'Episode not found' };
        }

        return {
          ok: true,
          episode: {
            id: view.episode.id,
            title: view.episode.title,
            stationStates: view.episode.stationStates,
            progress: view.episode.progress,
            currentStage: view.episode.currentStage,
          },
          gate: view.gate,
          chapters: view.chapters.map((chapter) => ({
            id: chapter.id,
            title: chapter.title,
            content: chapter.content,
            scene: chapter.scene,
            dialogues: chapter.dialogues,
          })),
          assets: view.assets.map((asset) => ({
            id: asset.id,
            name: asset.name,
            type: asset.type,
            state: asset.state,
            isShared: asset.isShared,
            prompt: asset.prompt,
          })),
          shots: view.shots.map((shot) => ({
            id: shot.id,
            title: shot.title,
            status: shot.status,
            state: shot.state,
            continuityStatus: shot.continuityStatus,
          })),
          tasks: view.tasks.map((task) => ({
            id: task.id,
            title: task.title,
            status: task.status,
          })),
        };
      },
    }),
    generate_script_from_source: tool({
      description: '根据当前集数已导入的原文生成结构化章节和对白列表。',
      inputSchema: z.object({
        episodeId: z.string().optional(),
      }),
      execute: async ({ episodeId }) => {
        const resolvedEpisodeId = episodeId ?? context.episodeId;
        if (!resolvedEpisodeId) {
          return { ok: false, message: 'No episode context available' };
        }

        return studioRepository.dispatch({
          type: 'generateScriptFromSource',
          episodeId: resolvedEpisodeId,
        });
      },
    }),
    extract_assets_from_script: tool({
      description: '从当前集数的章节中提取角色、场景和道具主体。',
      inputSchema: z.object({
        episodeId: z.string().optional(),
      }),
      execute: async ({ episodeId }) => {
        const resolvedEpisodeId = episodeId ?? context.episodeId;
        if (!resolvedEpisodeId) {
          return { ok: false, message: 'No episode context available' };
        }

        return studioRepository.dispatch({
          type: 'extractAssetsFromScript',
          episodeId: resolvedEpisodeId,
        });
      },
    }),
    generate_asset_images: tool({
      description: '为当前集数的主体批量生成主版本图片并更新门禁状态。',
      inputSchema: z.object({
        episodeId: z.string().optional(),
      }),
      execute: async ({ episodeId }) => {
        const resolvedEpisodeId = episodeId ?? context.episodeId;
        if (!resolvedEpisodeId) {
          return { ok: false, message: 'No episode context available' };
        }

        return studioRepository.dispatch({
          type: 'generateAssetImages',
          episodeId: resolvedEpisodeId,
        });
      },
    }),
    generate_shot_images: tool({
      description: '为当前集数的镜头批量生成分镜主版本图片。',
      inputSchema: z.object({
        episodeId: z.string().optional(),
      }),
      execute: async ({ episodeId }) => {
        const resolvedEpisodeId = episodeId ?? context.episodeId;
        if (!resolvedEpisodeId) {
          return { ok: false, message: 'No episode context available' };
        }

        return studioRepository.dispatch({
          type: 'generateShotImages',
          episodeId: resolvedEpisodeId,
        });
      },
    }),
    generate_shots_from_chapters: tool({
      description: '根据当前章节文本为单集生成结构化镜头草案和故事板卡片。',
      inputSchema: z.object({
        episodeId: z.string().optional(),
      }),
      execute: async ({ episodeId }) => {
        const resolvedEpisodeId = episodeId ?? context.episodeId;
        if (!resolvedEpisodeId) {
          return { ok: false, message: 'No episode context available' };
        }

        return studioRepository.dispatch({
          type: 'generateShotsFromChapters',
          episodeId: resolvedEpisodeId,
        });
      },
    }),
    promote_asset_to_shared: tool({
      description: '将当前集中的高价值主体升级为系列共享主体。',
      inputSchema: z.object({
        assetId: z.string(),
      }),
      execute: async ({ assetId }) => {
        return studioRepository.dispatch({
          type: 'promoteAssetToShared',
          assetId,
        });
      },
    }),
    summarize_task_risks: tool({
      description: '总结当前上下文中失败或运行中的任务，并给出恢复顺序。',
      inputSchema: z.object({
        episodeId: z.string().optional(),
        seriesId: z.string().optional(),
      }),
      execute: async ({ episodeId, seriesId }) => {
        if (episodeId ?? context.episodeId) {
          const view = await studioRepository.getEpisodeWorkspaceView(episodeId ?? context.episodeId ?? '');
          return {
            ok: true,
            tasks:
              view?.tasks
                .filter((task) => task.status !== 'completed')
                .map((task) => ({
                  id: task.id,
                  title: task.title,
                  status: task.status,
                  error: task.error,
                })) ?? [],
          };
        }

        if (seriesId ?? context.seriesId) {
          const view = await studioRepository.getSeriesView(seriesId ?? context.seriesId ?? '');
          return {
            ok: true,
            tasks:
              view?.tasks
                .filter((task) => task.status !== 'completed')
                .map((task) => ({
                  id: task.id,
                  title: task.title,
                  status: task.status,
                  error: task.error,
                })) ?? [],
          };
        }

        return { ok: true, tasks: [] };
      },
    }),
    run_pipeline_analysis: tool({
      description:
        '运行专注于剧集生产管道的分析 SubAgent，深度评估当前进度瓶颈（门禁状态、失败任务、continuity 风险），给出优先行动建议。适合用户询问「下一步做什么」或「哪里卡住了」时调用。',
      inputSchema: z.object({
        episodeId: z.string(),
        question: z.string().optional().describe('用户的具体问题，不填则默认分析整体优先行动'),
      }),
      execute: async ({ episodeId, question }) => {
        if (!getModel) return { ok: false, message: 'Sub-agent model unavailable' };

        const view = await studioRepository.getEpisodeWorkspaceView(episodeId);
        if (!view) return { ok: false, message: `Episode ${episodeId} not found` };

        const stateSnapshot = JSON.stringify({
          episode: { id: view.episode.id, title: view.episode.title, currentStage: view.episode.currentStage, progress: view.episode.progress },
          gate: view.gate,
          chapters: view.chapters.length,
          assets: { total: view.assets.length, withImages: view.assets.filter((a) => a.state === 'ready').length },
          shots: { total: view.shots.length, continuityRisks: view.shots.filter((s) => s.continuityStatus !== 'clear').length },
          pendingTasks: view.tasks.filter((t) => t.status !== 'completed').map((t) => ({ title: t.title, status: t.status, error: t.error })),
        });

        const result = await generateText({
          model: getModel(),
          system:
            '你是专注于漫改/动画生产管道的分析 Agent。根据提供的剧集状态快照，分析当前生产瓶颈，给出具体、可操作的优先行动建议。只分析，不执行任何操作。用中文回答。',
          prompt: `剧集状态快照：\n${stateSnapshot}\n\n${question ?? '分析当前最优先需要解决的问题，并给出具体行动顺序。'}`,
        });

        return { ok: true, analysis: result.text };
      },
    }),
  };
}
