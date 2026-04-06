import { tool } from 'ai';
import { z } from 'zod';

import { studioRepository } from '@/lib/server/repository/studio-repository';

export function createStudioTools(context: { seriesId?: string; episodeId?: string }) {
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
  };
}
