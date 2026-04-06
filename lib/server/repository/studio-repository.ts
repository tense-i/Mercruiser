import { mutateWorkspaceAtomically, readWorkspace } from '@/lib/server/repository/file-store';
import { buildDashboardView, buildEpisodeWorkspaceView, buildSeriesView } from '@/lib/view-models/studio';
import { StudioCommandSchema, type StudioCommand } from '@/lib/domain/commands';
import type { AgentRun, Shot, StudioWorkspace, TaskRecord } from '@/lib/domain/types';
import { syncEpisodeWorkflow } from '@/lib/workflow/workflow-engine';

function nowIso() {
  return new Date().toISOString();
}

function id(prefix: string) {
  return `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
}

function computeEpisodeProgress(workspace: StudioWorkspace, episodeId: string) {
  const episode = workspace.episodes.find((item) => item.id === episodeId);
  if (!episode) {
    return 0;
  }

  const checkpoints = [
    episode.chapterIds.length > 0,
    workspace.assets.some((asset) => asset.episodeId === episodeId || (asset.isShared && asset.seriesId === episode.seriesId)),
    episode.shotIds.length > 0,
    episode.storyboardIds.length > 0,
    workspace.finalCuts.some((finalCut) => finalCut.id === episode.finalCutId),
  ];

  return Math.round((checkpoints.filter(Boolean).length / checkpoints.length) * 100);
}

function upsertWorkflowRun(
  workspace: StudioWorkspace,
  input: {
    episodeId: string;
    stage: StudioWorkspace['gateSnapshots'][number]['currentStage'];
    agent: 'script' | 'asset' | 'production' | 'recovery';
    status: 'idle' | 'running' | 'completed' | 'failed';
    summary: string;
    taskId?: string | null;
  },
) {
  const run = {
    id: id('workflow'),
    episodeId: input.episodeId,
    stage: input.stage,
    agent: input.agent,
    status: input.status,
    summary: input.summary,
    taskId: input.taskId ?? null,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  } as StudioWorkspace['workflowRuns'][number];
  workspace.workflowRuns.unshift(run);
  return run;
}

function createTask(
  workspace: StudioWorkspace,
  input: Omit<TaskRecord, 'id' | 'createdAt' | 'updatedAt'>,
) {
  const task: TaskRecord = {
    id: id('task'),
    createdAt: nowIso(),
    updatedAt: nowIso(),
    ...input,
  };
  workspace.tasks.unshift(task);
  return task;
}

export class StudioRepository {
  constructor(private readonly dataPath?: string) {}

  async getWorkspace() {
    return readWorkspace(this.dataPath);
  }

  async getDashboardView() {
    return buildDashboardView(await this.getWorkspace());
  }

  async getSeriesView(seriesId: string) {
    return buildSeriesView(await this.getWorkspace(), seriesId);
  }

  async getEpisodeWorkspaceView(episodeId: string) {
    return buildEpisodeWorkspaceView(await this.getWorkspace(), episodeId);
  }

  async dispatch(commandInput: unknown) {
    const command = StudioCommandSchema.parse(commandInput);
    return mutateWorkspaceAtomically((workspace) => {
      const result = executeCommand(workspace, command);
      workspace.meta.updatedAt = nowIso();
      return result;
    }, this.dataPath);
  }

  async appendAgentRun(run: Omit<AgentRun, 'id' | 'createdAt'>) {
    return mutateWorkspaceAtomically((workspace) => {
      const agentRun: AgentRun = {
        id: id('run'),
        createdAt: nowIso(),
        ...run,
      };
      workspace.agentRuns.unshift(agentRun);
      workspace.meta.updatedAt = nowIso();
      return agentRun;
    }, this.dataPath);
  }
}

export function createStudioRepository(options?: { dataPath?: string }) {
  return new StudioRepository(options?.dataPath);
}

export const studioRepository = new StudioRepository();

function executeCommand(workspace: StudioWorkspace, command: StudioCommand): unknown {
  switch (command.type) {
    case 'updateChapter': {
      const chapter = workspace.chapters.find((item) => item.id === command.chapterId);
      if (!chapter) {
        throw new Error(`Chapter ${command.chapterId} not found`);
      }
      chapter.content = command.content;
      chapter.updatedAt = nowIso();
      const episode = workspace.episodes.find((item) => item.id === chapter.episodeId);
      if (episode) {
        episode.progress = computeEpisodeProgress(workspace, episode.id);
        episode.updatedAt = nowIso();
      }
      createTask(workspace, {
        kind: 'script',
        targetType: 'chapter',
        targetId: chapter.id,
        title: `更新章节《${chapter.title}》`,
        description: '脚本工位内容已保存到本地工作区。',
        status: 'completed',
        retryable: false,
        link: `/series/${episode?.seriesId}/episodes/${chapter.episodeId}`,
        error: null,
        logs: ['chapter content updated'],
      });
      return { ok: true, chapter };
    }
    case 'generateScriptFromSource': {
      const episode = workspace.episodes.find((item) => item.id === command.episodeId);
      if (!episode) throw new Error(`Episode ${command.episodeId} not found`);
      const source = workspace.sourceDocuments.find((item) => item.id === episode.sourceDocumentId);
      if (!source) throw new Error(`Episode ${command.episodeId} has no source document`);

      const parts = source.content
        .split(/[。！？\n]/)
        .map((part) => part.trim())
        .filter(Boolean)
        .slice(0, 4);

      const createdChapterIds: string[] = [];
      if (!episode.chapterIds.length) {
        parts.forEach((part, index) => {
          const chapterId = id('chapter');
          workspace.chapters.push({
            id: chapterId,
            episodeId: episode.id,
            index: index + 1,
            title: `段落 ${index + 1}`,
            content: part,
            scene: index % 2 === 0 ? '主场景' : '转折场景',
            dialogues: index === 0 ? [{ speaker: '旁白', content: part.slice(0, 18) }] : [],
            audioStatus: 'ready',
            estimatedDurationSeconds: Math.min(35, Math.max(18, part.length)),
            createdAt: nowIso(),
            updatedAt: nowIso(),
          });
          createdChapterIds.push(chapterId);
        });
        episode.chapterIds = createdChapterIds;
      }
      episode.stationStates.script = 'completed';
      episode.progress = computeEpisodeProgress(workspace, episode.id);
      episode.updatedAt = nowIso();
      syncEpisodeWorkflow(workspace, episode.id);
      const task = createTask(workspace, {
        kind: 'script',
        targetType: 'episode',
        targetId: episode.id,
        title: `为 ${episode.title} 生成剧本章节`,
        description: `ScriptAgent 根据原文生成 ${episode.chapterIds.length} 个章节。`,
        status: 'completed',
        retryable: true,
        link: `/series/${episode.seriesId}/episodes/${episode.id}`,
        error: null,
        logs: ['source document parsed', `chapters: ${episode.chapterIds.length}`],
      });
      upsertWorkflowRun(workspace, {
        episodeId: episode.id,
        stage: 'script_generation',
        agent: 'script',
        status: 'completed',
        summary: `生成 ${episode.chapterIds.length} 个章节`,
        taskId: task.id,
      });
      return { ok: true, chapterCount: episode.chapterIds.length };
    }
    case 'importSourceDocument': {
      const episode = workspace.episodes.find((item) => item.id === command.episodeId);
      if (!episode) throw new Error(`Episode ${command.episodeId} not found`);

      let source = workspace.sourceDocuments.find((item) => item.id === episode.sourceDocumentId);
      if (!source) {
        source = {
          id: id('source'),
          episodeId: episode.id,
          title: command.title,
          content: command.content,
          importedAt: nowIso(),
        };
        workspace.sourceDocuments.push(source);
        episode.sourceDocumentId = source.id;
      } else {
        source.title = command.title;
        source.content = command.content;
        source.importedAt = nowIso();
      }

      episode.updatedAt = nowIso();
      syncEpisodeWorkflow(workspace, episode.id);
      createTask(workspace, {
        kind: 'script',
        targetType: 'episode',
        targetId: episode.id,
        title: `导入 ${episode.title} 原文`,
        description: '原文输入已保存，可用于 ScriptAgent 生成剧本。',
        status: 'completed',
        retryable: false,
        link: `/series/${episode.seriesId}/episodes/${episode.id}`,
        error: null,
        logs: ['source document imported'],
      });
      return { ok: true, sourceDocumentId: source.id };
    }
    case 'extractAssetsFromScript': {
      const episode = workspace.episodes.find((item) => item.id === command.episodeId);
      if (!episode) throw new Error(`Episode ${command.episodeId} not found`);
      const chapters = workspace.chapters.filter((chapter) => chapter.episodeId === episode.id);
      if (!chapters.length) throw new Error('Script must be generated before asset extraction');

      if (!workspace.assets.some((asset) => asset.episodeId === episode.id && !asset.isShared)) {
        const extracted = [
          {
            name: '地下摊主',
            type: 'character',
            description: '交易场景中的关键角色，面部褶皱明显，眼神精明而克制。',
            prompt: 'A shrewd underground market trader, cinematic portrait, layered neon light, detailed costume.',
          },
          {
            name: '地下摊位',
            type: 'scene',
            description: '被旧显示器和铁皮包围的狭窄摊位，暖色台灯与外部冷色霓虹形成反差。',
            prompt: 'A cramped underground stall, layered props, warm desk lamp against blue neon haze.',
          },
        ] as const;

        extracted.forEach((item) => {
          const assetId = id('asset');
          workspace.assets.push({
            id: assetId,
            seriesId: episode.seriesId,
            episodeId: episode.id,
            name: item.name,
            type: item.type,
            description: item.description,
            prompt: item.prompt,
            chapterIds: chapters.map((chapter) => chapter.id),
            tags: ['agent-extracted'],
            isShared: false,
            isFaceLocked: item.type === 'character',
            voice: '',
            state: 'ready',
            states: [{ id: id('state'), name: '默认态', notes: 'Agent 初始提取状态' }],
            selectedStateId: null,
            versions: [],
            images: [],
            parentAssetId: null,
            variantName: null,
            createdAt: nowIso(),
            updatedAt: nowIso(),
          });
          episode.assetIds.push(assetId);
        });
      }

      episode.stationStates.subjects = 'ready';
      episode.progress = computeEpisodeProgress(workspace, episode.id);
      episode.updatedAt = nowIso();
      syncEpisodeWorkflow(workspace, episode.id);
      const task = createTask(workspace, {
        kind: 'asset',
        targetType: 'episode',
        targetId: episode.id,
        title: `为 ${episode.title} 提取主体`,
        description: 'AssetAgent 已根据章节抽取角色、场景和道具主体。',
        status: 'completed',
        retryable: true,
        link: `/series/${episode.seriesId}/episodes/${episode.id}`,
        error: null,
        logs: ['asset extraction completed'],
      });
      upsertWorkflowRun(workspace, {
        episodeId: episode.id,
        stage: 'asset_extraction',
        agent: 'asset',
        status: 'completed',
        summary: '主体抽取完成',
        taskId: task.id,
      });
      return { ok: true, assetCount: episode.assetIds.length };
    }
    case 'generateAssetImages': {
      const episode = workspace.episodes.find((item) => item.id === command.episodeId);
      if (!episode) throw new Error(`Episode ${command.episodeId} not found`);
      const ownAssets = workspace.assets.filter((asset) => asset.episodeId === episode.id);
      ownAssets.forEach((asset) => {
        if (!asset.images.length) {
          const imageId = id('asset_image');
          asset.images = [
            {
              id: imageId,
              label: '主版本',
              imageUrl: `/generated/${asset.id}-${imageId}.jpg`,
              createdAt: nowIso(),
              isSelected: true,
            },
          ];
        }
        asset.versions = asset.images;
        asset.state = 'completed';
        asset.updatedAt = nowIso();
      });
      episode.stationStates.subjects = 'completed';
      episode.progress = computeEpisodeProgress(workspace, episode.id);
      episode.updatedAt = nowIso();
      syncEpisodeWorkflow(workspace, episode.id);
      const task = createTask(workspace, {
        kind: 'asset',
        targetType: 'episode',
        targetId: episode.id,
        title: `为 ${episode.title} 批量生成资产图`,
        description: `共完成 ${ownAssets.length} 个主体的主版本图片。`,
        status: 'completed',
        retryable: true,
        link: `/series/${episode.seriesId}/episodes/${episode.id}`,
        error: null,
        logs: ownAssets.map((asset) => `asset rendered: ${asset.name}`),
      });
      upsertWorkflowRun(workspace, {
        episodeId: episode.id,
        stage: 'asset_rendering',
        agent: 'asset',
        status: 'completed',
        summary: `完成 ${ownAssets.length} 个资产主版本`,
        taskId: task.id,
      });
      return { ok: true, renderedCount: ownAssets.length };
    }
    case 'updateAsset': {
      const asset = workspace.assets.find((item) => item.id === command.assetId);
      if (!asset) {
        throw new Error(`Asset ${command.assetId} not found`);
      }
      asset.description = command.description;
      if (command.voice !== undefined) {
        asset.voice = command.voice;
      }
      if (command.isShared !== undefined) {
        asset.isShared = command.isShared;
      }
      asset.updatedAt = nowIso();
      createTask(workspace, {
        kind: 'asset',
        targetType: 'asset',
        targetId: asset.id,
        title: `更新主体 ${asset.name}`,
        description: '主体工位信息已写回本地仓储。',
        status: 'completed',
        retryable: false,
        link: `/series/${asset.seriesId}`,
        error: null,
        logs: ['asset updated'],
      });
      return { ok: true, asset };
    }
    case 'selectAssetImage': {
      const asset = workspace.assets.find((item) => item.id === command.assetId);
      if (!asset) throw new Error(`Asset ${command.assetId} not found`);
      asset.images = (asset.images.length ? asset.images : asset.versions).map((image) => ({
        ...image,
        isSelected: image.id === command.imageId,
      }));
      asset.versions = asset.images;
      asset.updatedAt = nowIso();
      syncEpisodeWorkflow(workspace, asset.episodeId ?? '');
      return { ok: true, asset };
    }
    case 'promoteAssetToShared': {
      const asset = workspace.assets.find((item) => item.id === command.assetId);
      if (!asset) {
        throw new Error(`Asset ${command.assetId} not found`);
      }
      asset.isShared = true;
      asset.updatedAt = nowIso();
      createTask(workspace, {
        kind: 'asset',
        targetType: 'asset',
        targetId: asset.id,
        title: `提升 ${asset.name} 为共享主体`,
        description: '共享主体资产已加入系列治理层。',
        status: 'completed',
        retryable: false,
        link: `/series/${asset.seriesId}`,
        error: null,
        logs: ['asset promoted to shared'],
      });
      return { ok: true, asset };
    }
    case 'updateShot': {
      const shot = workspace.shots.find((item) => item.id === command.shotId);
      if (!shot) {
        throw new Error(`Shot ${command.shotId} not found`);
      }
      shot.prompt = command.prompt;
      shot.scene = command.scene;
      shot.composition = command.composition;
      shot.lighting = command.lighting;
      shot.cameraMotion = command.cameraMotion;
      shot.dialogue = command.dialogue;
      shot.durationSeconds = command.durationSeconds;
      shot.updatedAt = nowIso();
      createTask(workspace, {
        kind: 'shot',
        targetType: 'shot',
        targetId: shot.id,
        title: `更新镜头 ${shot.index}`,
        description: '分镜工位的结构化字段已保存。',
        status: 'completed',
        retryable: false,
        link: `/series/${workspace.episodes.find((episode) => episode.id === shot.episodeId)?.seriesId}/episodes/${shot.episodeId}`,
        error: null,
        logs: ['shot updated'],
      });
      return { ok: true, shot };
    }
    case 'selectTake': {
      const shot = workspace.shots.find((item) => item.id === command.shotId);
      if (!shot) {
        throw new Error(`Shot ${command.shotId} not found`);
      }
      let selectedLabel = '';
      shot.takes = shot.takes.map((take) => {
        const isSelected = take.id === command.takeId;
        if (isSelected) {
          selectedLabel = take.label;
        }
        return { ...take, isSelected };
      });
      shot.updatedAt = nowIso();
      const storyboard = workspace.storyboards.find((item) => item.shotId === shot.id);
      if (storyboard) {
        storyboard.selectedTakeId = command.takeId;
        storyboard.updatedAt = nowIso();
      }
      createTask(workspace, {
        kind: 'storyboard',
        targetType: 'shot',
        targetId: shot.id,
        title: `选定镜头 ${shot.index} 的主版本`,
        description: `已选用 ${selectedLabel || '候选版本'} 进入下游故事板。`,
        status: 'completed',
        retryable: false,
        link: `/series/${workspace.episodes.find((episode) => episode.id === shot.episodeId)?.seriesId}/episodes/${shot.episodeId}`,
        error: null,
        logs: ['take selected'],
      });
      return { ok: true, shot };
    }
    case 'updateTimelineItem': {
      const finalCut = workspace.finalCuts.find((item) => item.id === command.finalCutId);
      if (!finalCut) {
        throw new Error(`Final cut ${command.finalCutId} not found`);
      }
      const track = finalCut.tracks.find((item) => item.id === command.trackId);
      const item = track?.items.find((entry) => entry.id === command.itemId);
      if (!track || !item) {
        throw new Error(`Timeline item ${command.itemId} not found`);
      }
      item.label = command.label;
      item.locked = command.locked;
      finalCut.updatedAt = nowIso();
      createTask(workspace, {
        kind: 'final_cut',
        targetType: 'episode',
        targetId: finalCut.episodeId,
        title: '更新成片时间线',
        description: '成片工位轨道信息已同步。',
        status: 'completed',
        retryable: false,
        link: `/series/${workspace.episodes.find((episode) => episode.id === finalCut.episodeId)?.seriesId}/episodes/${finalCut.episodeId}`,
        error: null,
        logs: ['timeline updated'],
      });
      return { ok: true, finalCut };
    }
    case 'updateSettings': {
      workspace.settings = {
        ...workspace.settings,
        ...command.settings,
        ai: { ...workspace.settings.ai, ...command.settings.ai },
        workspace: { ...workspace.settings.workspace, ...command.settings.workspace },
        governance: { ...workspace.settings.governance, ...command.settings.governance },
      };
      createTask(workspace, {
        kind: 'settings',
        targetType: 'settings',
        targetId: 'workspace-settings',
        title: '更新设置中心',
        description: '治理和 AI 配置已保存。',
        status: 'completed',
        retryable: false,
        link: '/settings',
        error: null,
        logs: ['settings updated'],
      });
      return { ok: true, settings: workspace.settings };
    }
    case 'generateShotsFromChapters': {
      const episode = workspace.episodes.find((item) => item.id === command.episodeId);
      if (!episode) {
        throw new Error(`Episode ${command.episodeId} not found`);
      }
      const ownAssets = workspace.assets.filter((asset) => asset.episodeId === episode.id);
      const assetsReady = ownAssets.length > 0 && ownAssets.every((asset) => {
        const images = asset.images.length ? asset.images : asset.versions;
        return asset.state === 'completed' && images.some((image) => image.isSelected);
      });
      if (!assetsReady) {
        throw new Error('All assets must be completed with selected versions before shot generation');
      }
      const chapters = workspace.chapters.filter((chapter) => chapter.episodeId === episode.id).sort((left, right) => left.index - right.index);
      let directorPlanId = episode.directorPlanId;
      if (!directorPlanId) {
        directorPlanId = id('director_plan');
        workspace.directorPlans.push({
          id: directorPlanId,
          episodeId: episode.id,
          theme: '在压迫环境中维持主动性',
          visualStyle: '冷暖交错的赛博东方画面，强调空间压缩与人物轮廓光',
          narrativeStructure: '前段追逐建立压迫，中段交易制造选择，尾段留下钩子',
          sceneIntent: '每场戏都明确角色处境变化与镜头意图',
          soundDirection: '雨声、电流声、广播噪声形成持续底噪',
          transitionStrategy: '以空间遮挡和光影跳变作为转场主轴',
          createdAt: nowIso(),
          updatedAt: nowIso(),
        });
        episode.directorPlanId = directorPlanId;
      }
      const generated: Shot[] = chapters.flatMap((chapter) => {
        const nextIndex = workspace.shots.filter((shot) => shot.episodeId === episode.id).length + 1;
        const existingShot = workspace.shots.find((shot) => shot.chapterId === chapter.id);
        if (existingShot) {
          return [];
        }
        const baseId = id('shot');
        const shot: Shot = {
          id: baseId,
          episodeId: episode.id,
          chapterId: chapter.id,
          index: nextIndex,
          title: `${chapter.title} 开场`,
          description: chapter.content.slice(0, 90),
          scene: chapter.scene,
          associatedAssetIds: ownAssets.slice(0, 2).map((asset) => asset.id),
          associatedAssetNames: ownAssets.slice(0, 2).map((asset) => asset.name),
          duration: Math.min(8, Math.max(3, Math.round(chapter.estimatedDurationSeconds / 8))),
          shotSize: '中景',
          cameraMove: '缓推',
          action: '角色推进当前场面动作',
          emotion: '警觉',
          sound: '环境底噪与关键动作音',
          composition: '中景',
          lighting: '叙事主光 + 辅助轮廓光',
          cameraMotion: '缓推',
          prompt: `根据章节《${chapter.title}》生成高一致性叙事镜头，突出关键动作与场景层次。`,
          videoDesc: `${chapter.scene}，中景，角色动作围绕章节核心冲突展开。`,
          dialogue: '',
          sfx: '环境音待补充',
          durationSeconds: chapter.estimatedDurationSeconds,
          status: 'ready',
          continuityStatus: 'clear',
          continuityIssues: [],
          referenceAssetIds: ownAssets.slice(0, 2).map((asset) => asset.id),
          takes: [
            {
              id: id('take'),
              kind: 'image',
              label: '主版本',
              url: '/placeholder-shot-a.jpg',
              durationSeconds: null,
              isSelected: true,
            },
          ],
          images: [],
          state: 'ready',
          track: 'default',
          trackId: 'track_default',
          createdAt: nowIso(),
          updatedAt: nowIso(),
        };
        workspace.shots.push(shot);
        episode.shotIds.push(shot.id);
        const storyboardId = id('story');
        workspace.storyboards.push({
          id: storyboardId,
          episodeId: episode.id,
          shotId: shot.id,
          subtitle: '',
          notes: 'Agent 生成的初始故事板卡片。',
          selectedTakeId: shot.takes[0]?.id ?? null,
          referenceAssetIds: shot.referenceAssetIds,
          updatedAt: nowIso(),
        });
        episode.storyboardIds.push(storyboardId);
        return [shot];
      });

      episode.stationStates.shots = generated.length ? 'ready' : episode.stationStates.shots;
      episode.progress = computeEpisodeProgress(workspace, episode.id);
      episode.updatedAt = nowIso();
      syncEpisodeWorkflow(workspace, episode.id);
      createTask(workspace, {
        kind: 'agent',
        targetType: 'episode',
        targetId: episode.id,
        title: `为 ${episode.title} 生成分镜草案`,
        description: `基于章节文本创建了 ${generated.length} 条结构化镜头。`,
        status: 'completed',
        retryable: false,
        link: `/series/${episode.seriesId}/episodes/${episode.id}`,
        error: null,
        logs: generated.map((shot) => `generated ${shot.id}`),
      });
      upsertWorkflowRun(workspace, {
        episodeId: episode.id,
        stage: 'shot_generation',
        agent: 'production',
        status: 'completed',
        summary: `生成 ${generated.length} 条分镜`,
      });
      return { ok: true, generatedCount: generated.length };
    }
    case 'generateShotImages': {
      const episode = workspace.episodes.find((item) => item.id === command.episodeId);
      if (!episode) throw new Error(`Episode ${command.episodeId} not found`);
      const shots = workspace.shots.filter((shot) => shot.episodeId === episode.id);
      if (!shots.length) throw new Error('Shot list must exist before rendering shot images');

      shots.forEach((shot) => {
        if (!shot.images.length) {
          const imageId = id('shot_image');
          shot.images = [
            {
              id: imageId,
              label: '主版本',
              imageUrl: `/generated/${shot.id}-${imageId}.jpg`,
              createdAt: nowIso(),
              isSelected: true,
            },
          ];
        }
        shot.state = 'completed';
        shot.status = 'rendered';
        if (!shot.takes.length) {
          shot.takes = [
            {
              id: id('take'),
              kind: 'image',
              label: '主版本',
              url: shot.images[0].imageUrl,
              durationSeconds: null,
              isSelected: true,
            },
          ];
        }
        shot.updatedAt = nowIso();
      });

      episode.stationStates.storyboard = 'ready';
      episode.progress = computeEpisodeProgress(workspace, episode.id);
      episode.updatedAt = nowIso();
      syncEpisodeWorkflow(workspace, episode.id);
      const task = createTask(workspace, {
        kind: 'storyboard',
        targetType: 'episode',
        targetId: episode.id,
        title: `为 ${episode.title} 批量生成分镜图`,
        description: `共完成 ${shots.length} 个镜头的分镜主版本图片。`,
        status: 'completed',
        retryable: true,
        link: `/series/${episode.seriesId}/episodes/${episode.id}`,
        error: null,
        logs: shots.map((shot) => `shot rendered: ${shot.title}`),
      });
      upsertWorkflowRun(workspace, {
        episodeId: episode.id,
        stage: 'shot_rendering',
        agent: 'production',
        status: 'completed',
        summary: `完成 ${shots.length} 条分镜图`,
        taskId: task.id,
      });
      return { ok: true, renderedCount: shots.length };
    }
    case 'retryTask': {
      const task = workspace.tasks.find((item) => item.id === command.taskId);
      if (!task) {
        throw new Error(`Task ${command.taskId} not found`);
      }

      if (task.kind === 'script' && task.targetType === 'episode') {
        const rerun = executeCommand(workspace, {
          type: 'generateScriptFromSource',
          episodeId: task.targetId,
        }) as { chapterCount: number };
        task.status = 'completed';
        task.updatedAt = nowIso();
        task.error = null;
        task.logs = [...task.logs, `retry executed: regenerated ${String(rerun.chapterCount)} chapters`];
        upsertWorkflowRun(workspace, {
          episodeId: task.targetId,
          stage: 'script_generation',
          agent: 'recovery',
          status: 'completed',
          summary: '恢复 Agent 重新执行了剧本生成',
          taskId: task.id,
        });
        return { ok: true, task, rerun };
      }

      if (task.kind === 'asset' && task.targetType === 'episode') {
        const rerun = executeCommand(workspace, {
          type: 'generateAssetImages',
          episodeId: task.targetId,
        }) as { renderedCount: number };
        task.status = 'completed';
        task.updatedAt = nowIso();
        task.error = null;
        task.logs = [...task.logs, `retry executed: rendered ${String(rerun.renderedCount)} assets`];
        upsertWorkflowRun(workspace, {
          episodeId: task.targetId,
          stage: 'asset_rendering',
          agent: 'recovery',
          status: 'completed',
          summary: '恢复 Agent 重新执行了资产图片生成',
          taskId: task.id,
        });
        return { ok: true, task, rerun };
      }

      if (task.kind === 'storyboard' && task.targetType === 'episode') {
        const rerun = executeCommand(workspace, {
          type: 'generateShotImages',
          episodeId: task.targetId,
        }) as { renderedCount: number };
        task.status = 'completed';
        task.updatedAt = nowIso();
        task.error = null;
        task.logs = [...task.logs, `retry executed: rendered ${String(rerun.renderedCount)} shot images`];
        upsertWorkflowRun(workspace, {
          episodeId: task.targetId,
          stage: 'shot_rendering',
          agent: 'recovery',
          status: 'completed',
          summary: '恢复 Agent 重新执行了分镜图生成',
          taskId: task.id,
        });
        return { ok: true, task, rerun };
      }

      if (task.kind === 'agent' && task.targetType === 'episode') {
        const rerun = executeCommand(workspace, {
          type: 'generateShotsFromChapters',
          episodeId: task.targetId,
        }) as { generatedCount: number };
        task.status = 'completed';
        task.updatedAt = nowIso();
        task.error = null;
        task.logs = [...task.logs, `retry executed: regenerated ${String(rerun.generatedCount)} shots`];
        upsertWorkflowRun(workspace, {
          episodeId: task.targetId,
          stage: 'shot_generation',
          agent: 'recovery',
          status: 'completed',
          summary: '恢复 Agent 重新执行了分镜生成',
          taskId: task.id,
        });
        return { ok: true, task, rerun };
      }

      task.status = 'running';
      task.updatedAt = nowIso();
      task.error = null;
      task.logs = [...task.logs, 'retry executed with no specialized handler; task marked running'];
      return { ok: true, task };
    }
  }
}
