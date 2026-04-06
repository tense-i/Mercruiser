import { mutateWorkspaceAtomically, readWorkspace } from '@/lib/server/repository/file-store';
import { analyzeSourceTextToChapters } from '@/lib/ai/script-analysis';
import { buildDashboardView, buildEpisodeWorkspaceView, buildSeriesView } from '@/lib/view-models/studio';
import { StudioCommandSchema, type StudioCommand } from '@/lib/domain/commands';
import type {
  AgentRun,
  APIUsageRecord,
  Asset,
  FinalCut,
  GenerationPreset,
  GlobalAsset,
  Shot,
  ShotAssetSnapshot,
  StudioWorkspace,
  TaskRecord,
  UsageAlert,
} from '@/lib/domain/types';
import { syncEpisodeWorkflow } from '@/lib/workflow/workflow-engine';

type TaskBatchItem = NonNullable<TaskRecord['batch']>['items'][number];

function nowIso() {
  return new Date().toISOString();
}

function id(prefix: string) {
  return `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
}

export class StudioCommandConflictError extends Error {
  statusCode = 409;
  code = 'REVISION_CONFLICT' as const;

  constructor(
    public readonly entityType: string,
    public readonly entityId: string,
    public readonly expectedRevision: number,
    public readonly actualRevision: number,
  ) {
    super(`${entityType}:${entityId} revision conflict (expected ${String(expectedRevision)}, got ${String(actualRevision)})`);
    this.name = 'StudioCommandConflictError';
  }
}

function computeEpisodeProgress(workspace: StudioWorkspace, episodeId: string) {
  const episode = workspace.episodes.find((item) => item.id === episodeId);
  if (!episode) {
    return 0;
  }

  const hasFinalCutContent = workspace.finalCuts.some(
    (finalCut) => finalCut.id === episode.finalCutId && finalCut.tracks.some((track) => track.items.length > 0),
  );

  const checkpoints = [
    episode.chapterIds.length > 0,
    workspace.assets.some((asset) => asset.episodeId === episodeId || (asset.isShared && asset.seriesId === episode.seriesId)),
    episode.shotIds.length > 0,
    episode.storyboardIds.length > 0,
    hasFinalCutContent,
  ];

  return Math.round((checkpoints.filter(Boolean).length / checkpoints.length) * 100);
}

function normalizeName(value: string) {
  return value.trim().replace(/\s+/g, ' ');
}

function normalizeTextLines(value: string) {
  return value
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean);
}

function ensureUniqueSeriesName(workspace: StudioWorkspace, name: string, currentSeriesId?: string) {
  const normalized = normalizeName(name).toLocaleLowerCase();
  const duplicate = workspace.series.find((series) => series.id !== currentSeriesId && normalizeName(series.name).toLocaleLowerCase() === normalized);
  if (duplicate) {
    throw new Error(`Series name "${name}" already exists`);
  }
}

function buildSeriesSettingsPatch(
  current: StudioWorkspace['series'][number]['settings'],
  input: Partial<StudioWorkspace['series'][number]['settings']>,
) {
  return {
    ...current,
    ...input,
    coreRules: input.coreRules ?? current.coreRules,
    referenceImages: input.referenceImages ?? current.referenceImages,
  };
}

function buildSeriesStrategyPatch(
  current: StudioWorkspace['series'][number]['strategy'],
  input: Partial<StudioWorkspace['series'][number]['strategy']>,
) {
  return {
    ...current,
    ...input,
  };
}

function createDefaultStationStates(hasSource = false) {
  return {
    overview: 'completed',
    script: hasSource ? 'ready' : 'editing',
    subjects: 'idle',
    shots: 'idle',
    storyboard: 'idle',
    'final-cut': 'idle',
  } as const;
}

function createDefaultFinalCut(episodeId: string): FinalCut {
  return {
    id: id('final'),
    episodeId,
    resolution: '1080p',
    fps: 24,
    exportStatus: 'draft',
    notes: '',
    tracks: [
      { id: id('track'), type: 'video', name: 'Video', items: [] },
      { id: id('track'), type: 'dialogue', name: 'Dialogue', items: [] },
      { id: id('track'), type: 'audio', name: 'Audio', items: [] },
    ],
    revision: 1,
    updatedAt: nowIso(),
  };
}

function createInheritedDirectorPlan(workspace: StudioWorkspace, series: StudioWorkspace['series'][number], episodeId: string) {
  const planId = id('director_plan');
  workspace.directorPlans.push({
    id: planId,
    episodeId,
    theme: series.settings.worldDescription || series.description || `${series.name} default theme`,
    visualStyle: [series.settings.visualStylePreset, series.settings.visualStylePrompt || series.style].filter(Boolean).join(' · ') || 'Follow series baseline',
    narrativeStructure: series.strategy.creationMode || 'Series default creation flow',
    sceneIntent: series.settings.defaultShotStrategy || 'Carry series-level directing intent into this episode',
    soundDirection: series.strategy.promptGuidance || 'Respect series-level prompt guidance and pacing',
    transitionStrategy: series.settings.cameraMotionPreference || 'Use smooth transitions aligned with the series camera preference',
    createdAt: nowIso(),
    updatedAt: nowIso(),
  });
  return planId;
}

function createEpisodeScaffold(
  workspace: StudioWorkspace,
  series: StudioWorkspace['series'][number],
  input: {
    title: string;
    logline: string;
    sourceTitle?: string;
    sourceContent?: string;
  },
) {
  const episodeId = id('episode');
  const finalCut = createDefaultFinalCut(episodeId);
  workspace.finalCuts.push(finalCut);

  const inheritedSharedAssetIds = workspace.assets
    .filter((asset) => asset.seriesId === series.id && asset.isShared)
    .map((asset) => asset.id);

  const episode: StudioWorkspace['episodes'][number] = {
    id: episodeId,
    seriesId: series.id,
    index: series.episodeIds.length + 1,
    title: normalizeName(input.title),
    logline: input.logline.trim(),
    status: 'not_started' as const,
    progress: 0,
    stationStates: createDefaultStationStates(Boolean(input.sourceContent)),
    sourceDocumentId: null,
    currentStage: 'script_generation' as const,
    chapterIds: [],
    assetIds: inheritedSharedAssetIds,
    shotIds: [],
    storyboardIds: [],
    directorPlanId: createInheritedDirectorPlan(workspace, series, episodeId),
    finalCutId: finalCut.id,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };

  if (input.sourceContent) {
    const sourceId = id('source');
    workspace.sourceDocuments.push({
      id: sourceId,
      episodeId,
      title: input.sourceTitle?.trim() || `${episode.title} Source`,
      content: input.sourceContent,
      importedAt: nowIso(),
      revision: 1,
    });
    episode.sourceDocumentId = sourceId;
  }

  workspace.episodes.push(episode);
  series.episodeIds.push(episode.id);
  series.updatedAt = nowIso();
  return episode;
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

function touchRevision(entity: { revision?: number; updatedAt: string }) {
  entity.revision = (entity.revision ?? 0) + 1;
  entity.updatedAt = nowIso();
}

function assertExpectedRevision(
  entityType: string,
  entity: { id: string; revision?: number },
  expectedRevision?: number,
) {
  if (expectedRevision === undefined) {
    return;
  }

  const actualRevision = entity.revision ?? 1;
  if (actualRevision !== expectedRevision) {
    throw new StudioCommandConflictError(entityType, entity.id, expectedRevision, actualRevision);
  }
}

function getSelectedAssetImageId(asset: Asset) {
  const images = asset.images.length ? asset.images : asset.versions;
  return images.find((image) => image.isSelected)?.id ?? null;
}

function buildAssetSnapshots(workspace: StudioWorkspace, assetIds: string[]): ShotAssetSnapshot[] {
  return assetIds.flatMap((assetId) => {
    const asset = workspace.assets.find((item) => item.id === assetId);
    if (!asset) {
      return [];
    }

    return [
      {
        assetId: asset.id,
        assetName: asset.name,
        revision: asset.revision ?? 1,
        selectedImageId: getSelectedAssetImageId(asset),
      },
    ];
  });
}

function recomputeShotAssetState(workspace: StudioWorkspace, shot: Shot) {
  const brokenAssetRefs: Shot['brokenAssetRefs'] = [];
  let stale = false;

  for (const snapshot of shot.assetSnapshots) {
    const asset = workspace.assets.find((item) => item.id === snapshot.assetId);
    if (!asset) {
      brokenAssetRefs.push({ assetId: snapshot.assetId, reason: 'deleted' });
      continue;
    }

    const selectedImageId = getSelectedAssetImageId(asset);
    if (!selectedImageId) {
      brokenAssetRefs.push({ assetId: snapshot.assetId, reason: 'no_image' });
      continue;
    }

    if (snapshot.revision !== (asset.revision ?? 1) || snapshot.selectedImageId !== selectedImageId) {
      stale = true;
    }
  }

  shot.brokenAssetRefs = brokenAssetRefs;
  shot.assetRefStatus = brokenAssetRefs.length ? 'broken' : stale ? 'stale' : 'valid';
}

function syncShotImageTakes(shot: Shot) {
  const selectedImageId = shot.images.find((image) => image.isSelected)?.id ?? shot.images[0]?.id ?? null;
  const existingVideoTakes = shot.takes.filter((take) => take.kind === 'video');

  const imageTakes = shot.images.map((image) => ({
    id: `take_${image.id}`,
    kind: 'image' as const,
    label: image.label,
    url: image.imageUrl,
    durationSeconds: null,
    isSelected: image.id === selectedImageId,
  }));

  shot.takes = [...imageTakes, ...existingVideoTakes.map((take) => ({ ...take, isSelected: false }))];
  return shot.takes.find((take) => take.kind === 'image' && take.isSelected)?.id ?? null;
}

function syncEpisodeReferenceState(workspace: StudioWorkspace, episodeId: string) {
  const shots = workspace.shots.filter((item) => item.episodeId === episodeId);
  shots.forEach((shot) => recomputeShotAssetState(workspace, shot));
}

function syncEpisode(workspace: StudioWorkspace, episodeId: string) {
  const episode = workspace.episodes.find((item) => item.id === episodeId);
  if (!episode) {
    return;
  }

  syncEpisodeReferenceState(workspace, episodeId);
  episode.progress = computeEpisodeProgress(workspace, episodeId);
  episode.updatedAt = nowIso();
  syncEpisodeWorkflow(workspace, episodeId);
}

function syncSeriesEpisodes(workspace: StudioWorkspace, seriesId: string) {
  workspace.episodes.filter((episode) => episode.seriesId === seriesId).forEach((episode) => syncEpisode(workspace, episode.id));
}

function resetEpisodeDerivedOutputs(workspace: StudioWorkspace, episode: StudioWorkspace['episodes'][number]) {
  const oldAssetIds = [...episode.assetIds];
  const oldShotIds = [...episode.shotIds];
  const oldStoryboardIds = [...episode.storyboardIds];
  const sharedAssetIds = workspace.assets
    .filter((asset) => asset.seriesId === episode.seriesId && asset.isShared)
    .map((asset) => asset.id);

  workspace.assets = workspace.assets.filter((asset) => asset.episodeId !== episode.id);
  workspace.shots = workspace.shots.filter((shot) => shot.episodeId !== episode.id);
  workspace.storyboards = workspace.storyboards.filter((storyboard) => storyboard.episodeId !== episode.id);
  workspace.tasks = workspace.tasks.filter(
    (task) =>
      task.targetId !== episode.id &&
      !episode.chapterIds.includes(task.targetId) &&
      !oldAssetIds.includes(task.targetId) &&
      !oldShotIds.includes(task.targetId) &&
      !oldStoryboardIds.includes(task.targetId),
  );

  const finalCut = workspace.finalCuts.find((item) => item.id === episode.finalCutId);
  if (finalCut) {
    finalCut.tracks = finalCut.tracks.map((track) => ({ ...track, items: [] }));
    finalCut.updatedAt = nowIso();
  }

  episode.assetIds = sharedAssetIds;
  episode.shotIds = [];
  episode.storyboardIds = [];
  episode.stationStates = createDefaultStationStates(Boolean(episode.sourceDocumentId));
}

function recordApiUsage(
  workspace: StudioWorkspace,
  input: Omit<APIUsageRecord, 'id' | 'createdAt' | 'currency'> & { currency?: APIUsageRecord['currency'] },
) {
  const record: APIUsageRecord = {
    id: id('usage'),
    currency: input.currency ?? workspace.settings.usage.currency,
    createdAt: nowIso(),
    ...input,
  };
  workspace.apiUsageRecords.unshift(record);
  refreshUsageAlerts(workspace, record.estimatedCost ?? 0);
  return record;
}

function refreshUsageAlerts(workspace: StudioWorkspace, latestCost: number) {
  const usage = workspace.settings.usage;
  const now = new Date();
  const dailySum = workspace.apiUsageRecords
    .filter((record) => new Date(record.createdAt).toDateString() === now.toDateString())
    .reduce((sum, record) => sum + (record.estimatedCost ?? 0), 0);
  const monthKey = `${String(now.getUTCFullYear())}-${String(now.getUTCMonth())}`;
  const monthlySum = workspace.apiUsageRecords
    .filter((record) => {
      const date = new Date(record.createdAt);
      return `${String(date.getUTCFullYear())}-${String(date.getUTCMonth())}` === monthKey;
    })
    .reduce((sum, record) => sum + (record.estimatedCost ?? 0), 0);

  const nextAlerts: UsageAlert[] = [
    {
      id: 'usage_single_task',
      type: 'single_task_limit',
      threshold: usage.singleTaskLimit,
      currentValue: latestCost,
      status: latestCost > usage.singleTaskLimit ? 'exceeded' : latestCost >= usage.singleTaskLimit * 0.7 ? 'warning' : 'normal',
      notifyMethod: usage.notifyMethod,
    },
    {
      id: 'usage_daily',
      type: 'daily_limit',
      threshold: usage.dailyLimit,
      currentValue: dailySum,
      status: dailySum > usage.dailyLimit ? 'exceeded' : dailySum >= usage.dailyLimit * 0.7 ? 'warning' : 'normal',
      notifyMethod: usage.notifyMethod,
    },
    {
      id: 'usage_monthly',
      type: 'monthly_limit',
      threshold: usage.monthlyLimit,
      currentValue: monthlySum,
      status: monthlySum > usage.monthlyLimit ? 'exceeded' : monthlySum >= usage.monthlyLimit * 0.7 ? 'warning' : 'normal',
      notifyMethod: usage.notifyMethod,
    },
  ];

  workspace.usageAlerts = nextAlerts;
}

function buildBatchSummary(items: TaskBatchItem[]) {
  return {
    total: items.length,
    processed: items.filter((item) => item.status === 'completed').length,
    skipped: items.filter((item) => item.status === 'skipped').length,
    items,
  };
}

function makeCascadeWarning(message: string) {
  return message;
}

function applyPresetText(basePrompt: string, preset: GenerationPreset) {
  const presetText = [preset.name, preset.imageConfig?.style, preset.imageConfig?.negativePrompt].filter(Boolean).join(' | ');
  return `${basePrompt}${basePrompt ? '\n' : ''}[Preset: ${presetText}]`;
}

function resolveAssetBatch(
  assets: Asset[],
  snapshots?: Array<{ assetId?: string; revision: number }>,
) {
  const snapshotMap = new Map(
    (snapshots ?? [])
      .filter((item): item is { assetId: string; revision: number } => Boolean(item.assetId))
      .map((item) => [item.assetId, item.revision]),
  );

  const batchItems: TaskBatchItem[] = [];
  const selectedAssets: Asset[] = [];
  const skippedAssetIds: string[] = [];

  for (const asset of assets) {
    const expectedRevision = snapshotMap.get(asset.id);
    if (expectedRevision !== undefined && expectedRevision !== (asset.revision ?? 1)) {
      skippedAssetIds.push(asset.id);
      batchItems.push({
        targetId: asset.id,
        snapshotRevision: expectedRevision,
        status: 'skipped',
        skipReason: `revision mismatch: expected ${String(expectedRevision)}, got ${String(asset.revision ?? 1)}`,
      });
      continue;
    }

    selectedAssets.push(asset);
    batchItems.push({
      targetId: asset.id,
      snapshotRevision: expectedRevision ?? (asset.revision ?? 1),
      status: 'completed',
      skipReason: null,
    });
  }

  return { selectedAssets, batchItems, skippedAssetIds };
}

function resolveShotBatch(
  shots: Shot[],
  snapshots?: Array<{ shotId?: string; revision: number }>,
) {
  const snapshotMap = new Map(
    (snapshots ?? [])
      .filter((item): item is { shotId: string; revision: number } => Boolean(item.shotId))
      .map((item) => [item.shotId, item.revision]),
  );

  const batchItems: TaskBatchItem[] = [];
  const selectedShots: Shot[] = [];
  const skippedShotIds: string[] = [];

  for (const shot of shots) {
    const expectedRevision = snapshotMap.get(shot.id);
    if (expectedRevision !== undefined && expectedRevision !== (shot.revision ?? 1)) {
      skippedShotIds.push(shot.id);
      batchItems.push({
        targetId: shot.id,
        snapshotRevision: expectedRevision,
        status: 'skipped',
        skipReason: `revision mismatch: expected ${String(expectedRevision)}, got ${String(shot.revision ?? 1)}`,
      });
      continue;
    }

    selectedShots.push(shot);
    batchItems.push({
      targetId: shot.id,
      snapshotRevision: expectedRevision ?? (shot.revision ?? 1),
      status: 'completed',
      skipReason: null,
    });
  }

  return { selectedShots, batchItems, skippedShotIds };
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
    return mutateWorkspaceAtomically(async (workspace) => {
      const result = await executeCommand(workspace, command);
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

async function executeCommand(workspace: StudioWorkspace, command: StudioCommand): Promise<unknown> {
  switch (command.type) {
    case 'createSeries': {
      const name = normalizeName(command.name);
      if (!name) {
        throw new Error('Series name is required');
      }
      ensureUniqueSeriesName(workspace, name);

      const series = {
        id: id('series'),
        name,
        description: command.description.trim(),
        status: 'setting' as const,
        coverUrl: command.coverUrl ?? '/generated/series-placeholder.jpg',
        genre: '待补充',
        style: workspace.settings.workspace.defaultStyle || 'Series default',
        worldRules: [],
        episodeIds: [],
        progress: 0,
        settings: {
          worldEra: '',
          worldDescription: '',
          coreRules: [],
          visualStylePreset: workspace.settings.workspace.defaultStyle || '',
          visualStylePrompt: '',
          referenceImages: [],
          defaultShotStrategy: '',
          defaultDurationStrategy: '',
          cameraMotionPreference: '',
          inheritToEpisodes: true,
        },
        strategy: {
          model: workspace.settings.ai.model,
          stylePreference: workspace.settings.workspace.defaultStyle || '',
          aspectRatio: workspace.settings.workspace.aspectRatio,
          creationMode: workspace.settings.workspace.creationMode,
          promptGuidance: '',
          inheritToEpisodes: true,
          priorityNote: 'Episode overrides > Series strategy > Global settings',
        },
        importMetadata: {
          source: 'manual' as const,
          importedAt: null,
          sourceLabel: '',
        },
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };

      workspace.series.unshift(series);
      createTask(workspace, {
        kind: 'settings',
        targetType: 'series',
        targetId: series.id,
        title: `创建系列 ${series.name}`,
        description: '系列已建立，可继续完善系列设定、策略与共享资产。',
        status: 'completed',
        retryable: false,
        link: `/series/${series.id}`,
        error: null,
        logs: ['series created'],
        batch: null,
      });
      return { ok: true, series };
    }
    case 'importSeries': {
      const name = normalizeName(command.name);
      if (!name) {
        throw new Error('Series name is required');
      }
      ensureUniqueSeriesName(workspace, name);

      const series = {
        id: id('series'),
        name,
        description: command.description.trim(),
        status: 'setting' as const,
        coverUrl: '/generated/series-imported.jpg',
        genre: '导入项目',
        style: workspace.settings.workspace.defaultStyle || 'Imported baseline',
        worldRules: [],
        episodeIds: [],
        progress: 0,
        settings: {
          worldEra: '',
          worldDescription: '',
          coreRules: [],
          visualStylePreset: workspace.settings.workspace.defaultStyle || '',
          visualStylePrompt: '',
          referenceImages: [],
          defaultShotStrategy: '',
          defaultDurationStrategy: '',
          cameraMotionPreference: '',
          inheritToEpisodes: true,
        },
        strategy: {
          model: workspace.settings.ai.model,
          stylePreference: workspace.settings.workspace.defaultStyle || '',
          aspectRatio: workspace.settings.workspace.aspectRatio,
          creationMode: workspace.settings.workspace.creationMode,
          promptGuidance: 'Imported series baseline',
          inheritToEpisodes: true,
          priorityNote: 'Episode overrides > Series strategy > Global settings',
        },
        importMetadata: {
          source: command.importType,
          importedAt: nowIso(),
          sourceLabel: command.sourceTitle.trim(),
        },
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };
      workspace.series.unshift(series);

      const episode = createEpisodeScaffold(workspace, series, {
        title: command.firstEpisodeTitle,
        logline: `Imported from ${command.sourceTitle.trim()}`,
        sourceTitle: command.sourceTitle,
        sourceContent: command.content,
      });
      await executeCommand(workspace, {
        type: 'generateScriptFromSource',
        episodeId: episode.id,
        forceRegenerate: true,
      });

      createTask(workspace, {
        kind: 'settings',
        targetType: 'series',
        targetId: series.id,
        title: `导入创建 ${series.name}`,
        description: '文本导入已生成系列、首集原文骨架，并自动完成剧本拆解。',
        status: 'completed',
        retryable: false,
        link: `/series/${series.id}`,
        error: null,
        logs: ['series imported', `episode created: ${episode.id}`, 'script auto-generated'],
        batch: null,
      });
      return { ok: true, series, episode };
    }
    case 'updateSeriesSettings': {
      const series = workspace.series.find((item) => item.id === command.seriesId);
      if (!series) {
        throw new Error(`Series ${command.seriesId} not found`);
      }
      series.settings = buildSeriesSettingsPatch(series.settings, {
        ...command.settings,
        coreRules: command.settings.coreRules?.map((item) => item.trim()).filter(Boolean),
        referenceImages: command.settings.referenceImages?.map((item) => item.trim()).filter(Boolean),
      });
      if (command.settings.visualStylePrompt !== undefined && command.settings.visualStylePrompt.trim()) {
        series.style = command.settings.visualStylePrompt.trim();
      }
      if (command.settings.coreRules !== undefined) {
        series.worldRules = command.settings.coreRules.map((item) => item.trim()).filter(Boolean);
      }
      series.updatedAt = nowIso();
      createTask(workspace, {
        kind: 'settings',
        targetType: 'series',
        targetId: series.id,
        title: `保存 ${series.name} 系列设定`,
        description: '世界观、视觉风格与导演规则已保存。',
        status: 'completed',
        retryable: false,
        link: `/series/${series.id}`,
        error: null,
        logs: ['series settings updated'],
        batch: null,
      });
      return { ok: true, series };
    }
    case 'updateSeriesStrategy': {
      const series = workspace.series.find((item) => item.id === command.seriesId);
      if (!series) {
        throw new Error(`Series ${command.seriesId} not found`);
      }
      series.strategy = buildSeriesStrategyPatch(series.strategy, command.strategy);
      series.updatedAt = nowIso();
      createTask(workspace, {
        kind: 'settings',
        targetType: 'series',
        targetId: series.id,
        title: `保存 ${series.name} 系列策略`,
        description: '系列级生成与创作策略已保存，后续集数默认继承。',
        status: 'completed',
        retryable: false,
        link: `/series/${series.id}`,
        error: null,
        logs: ['series strategy updated', series.strategy.priorityNote],
        batch: null,
      });
      return { ok: true, series };
    }
    case 'createEpisode': {
      const series = workspace.series.find((item) => item.id === command.seriesId);
      if (!series) {
        throw new Error(`Series ${command.seriesId} not found`);
      }
      const title = normalizeName(command.title);
      if (!title) {
        throw new Error('Episode title is required');
      }
      const episode = createEpisodeScaffold(workspace, series, {
        title,
        logline: command.logline.trim(),
      });
      syncSeriesEpisodes(workspace, series.id);
      createTask(workspace, {
        kind: 'script',
        targetType: 'episode',
        targetId: episode.id,
        title: `创建集数 ${episode.title}`,
        description: '空白集数已创建，可继续补原文或直接编写。',
        status: 'completed',
        retryable: false,
        link: `/series/${series.id}/episodes/${episode.id}`,
        error: null,
        logs: [`shared assets inherited: ${episode.assetIds.length}`],
        batch: null,
      });
      return { ok: true, episode, series };
    }
    case 'createEpisodeFromSource': {
      const series = workspace.series.find((item) => item.id === command.seriesId);
      if (!series) {
        throw new Error(`Series ${command.seriesId} not found`);
      }
      const title = normalizeName(command.title);
      if (!title) {
        throw new Error('Episode title is required');
      }
      const episode = createEpisodeScaffold(workspace, series, {
        title,
        logline: command.logline.trim(),
        sourceTitle: command.sourceTitle,
        sourceContent: command.sourceContent,
      });
      await executeCommand(workspace, {
        type: 'generateScriptFromSource',
        episodeId: episode.id,
        forceRegenerate: true,
      });
      syncSeriesEpisodes(workspace, series.id);
      createTask(workspace, {
        kind: 'script',
        targetType: 'episode',
        targetId: episode.id,
        title: `从原文创建 ${episode.title}`,
        description: '已创建集数、写入原文并自动生成章节剧本。',
        status: 'completed',
        retryable: false,
        link: `/series/${series.id}/episodes/${episode.id}`,
        error: null,
        logs: [`source document: ${command.sourceTitle.trim()}`, `shared assets inherited: ${episode.assetIds.length}`, 'script auto-generated'],
        batch: null,
      });
      return { ok: true, episode, series };
    }
    case 'updateChapter': {
      const chapter = workspace.chapters.find((item) => item.id === command.chapterId);
      if (!chapter) {
        throw new Error(`Chapter ${command.chapterId} not found`);
      }

      assertExpectedRevision('chapter', chapter, command.expectedRevision);
      chapter.content = command.content;
      touchRevision(chapter);
      const episode = workspace.episodes.find((item) => item.id === chapter.episodeId);
      if (episode) {
        episode.stationStates.script = 'editing';
        syncEpisode(workspace, episode.id);
      }

      const cascadeWarnings = workspace.shots
        .filter((shot) => shot.chapterId === chapter.id)
        .map((shot) => makeCascadeWarning(`章节版本已更新，镜头 ${shot.title} 建议重新校对。`));

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
        logs: ['chapter content updated', ...cascadeWarnings],
        batch: null,
      });
      return { ok: true, chapter, cascadeWarnings };
    }
    case 'generateScriptFromSource': {
      const episode = workspace.episodes.find((item) => item.id === command.episodeId);
      if (!episode) throw new Error(`Episode ${command.episodeId} not found`);
      const source = workspace.sourceDocuments.find((item) => item.id === episode.sourceDocumentId);
      if (!source) throw new Error(`Episode ${command.episodeId} has no source document`);

      const forceRegenerate = command.forceRegenerate ?? false;
      if (episode.chapterIds.length && !forceRegenerate) {
        return { ok: true, chapterCount: episode.chapterIds.length, skipped: true };
      }

      if (forceRegenerate && episode.chapterIds.length) {
        const chapterIdSet = new Set(episode.chapterIds);
        workspace.chapters = workspace.chapters.filter((chapter) => !chapterIdSet.has(chapter.id));
        resetEpisodeDerivedOutputs(workspace, episode);
        episode.chapterIds = [];
      }

      const series = workspace.series.find((item) => item.id === episode.seriesId);
      const analysis = await analyzeSourceTextToChapters({
        workspace,
        seriesName: series?.name ?? episode.seriesId,
        episodeTitle: episode.title,
        sourceTitle: source.title,
        sourceContent: source.content,
      });

      const createdChapterIds: string[] = [];
      analysis.chapters.forEach((part, index) => {
        const chapterId = id('chapter');
        workspace.chapters.push({
          id: chapterId,
          episodeId: episode.id,
          index: index + 1,
          title: part.title,
          content: part.content,
          scene: part.scene,
          dialogues: part.dialogues,
          audioStatus: 'ready',
          estimatedDurationSeconds: part.estimatedDurationSeconds,
          revision: 1,
          createdAt: nowIso(),
          updatedAt: nowIso(),
        });
        createdChapterIds.push(chapterId);
      });
      episode.chapterIds = createdChapterIds;
      episode.stationStates.script = 'completed';
      syncEpisode(workspace, episode.id);
      const task = createTask(workspace, {
        kind: 'script',
        targetType: 'episode',
        targetId: episode.id,
        title: `为 ${episode.title} 生成剧本章节`,
        description: `ScriptAgent 基于完整原文分析生成 ${episode.chapterIds.length} 个章节。`,
        status: 'completed',
        retryable: true,
        link: `/series/${episode.seriesId}/episodes/${episode.id}`,
        error: null,
        logs: ['source document parsed', `chapters: ${episode.chapterIds.length}`, `analysis mode: ${analysis.mode}${analysis.reason ? ` (${analysis.reason})` : ''}`],
        batch: null,
      });
      upsertWorkflowRun(workspace, {
        episodeId: episode.id,
        stage: 'script_generation',
        agent: 'script',
        status: 'completed',
        summary: `基于完整原文生成 ${episode.chapterIds.length} 个章节`,
        taskId: task.id,
      });
      recordApiUsage(workspace, {
        provider: workspace.settings.ai.mode === 'mock' ? 'mock' : 'siliconflow',
        model: workspace.settings.ai.model,
        endpoint: 'script_generation',
        inputTokens: source.content.length,
        outputTokens: episode.chapterIds.length * 120,
        estimatedCost: workspace.settings.usage.defaultTextCost * Math.max(1, episode.chapterIds.length),
        seriesId: episode.seriesId,
        episodeId: episode.id,
        taskType: 'script',
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
          revision: 1,
        };
        workspace.sourceDocuments.push(source);
        episode.sourceDocumentId = source.id;
      } else {
        source.title = command.title;
        source.content = command.content;
        source.importedAt = nowIso();
        source.revision = (source.revision ?? 0) + 1;
      }

      if (command.autoAnalyze ?? true) {
        await executeCommand(workspace, {
          type: 'generateScriptFromSource',
          episodeId: episode.id,
          forceRegenerate: episode.chapterIds.length > 0,
        });
      } else {
        syncEpisode(workspace, episode.id);
      }
      createTask(workspace, {
        kind: 'script',
        targetType: 'episode',
        targetId: episode.id,
        title: `导入 ${episode.title} 原文`,
        description: command.autoAnalyze ?? true ? '原文输入已保存，并自动完成 ScriptAgent 全文分析与剧本生成。' : '原文输入已保存，可用于 ScriptAgent 生成剧本。',
        status: 'completed',
        retryable: false,
        link: `/series/${episode.seriesId}/episodes/${episode.id}`,
        error: null,
        logs: ['source document imported', `autoAnalyze: ${String(command.autoAnalyze ?? true)}`],
        batch: null,
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
            revision: 1,
            globalAssetId: null,
            syncSource: 'local',
            appliedPresetId: null,
            consistencyConfig: { referenceStrength: 0.7, styleKeywords: ['series-default'] },
            createdAt: nowIso(),
            updatedAt: nowIso(),
          });
          episode.assetIds.push(assetId);
        });
      }

      episode.stationStates.subjects = 'ready';
      syncEpisode(workspace, episode.id);
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
        batch: null,
      });
      upsertWorkflowRun(workspace, {
        episodeId: episode.id,
        stage: 'asset_extraction',
        agent: 'asset',
        status: 'completed',
        summary: '主体抽取完成',
        taskId: task.id,
      });
      recordApiUsage(workspace, {
        provider: workspace.settings.ai.mode === 'mock' ? 'mock' : 'siliconflow',
        model: workspace.settings.ai.model,
        endpoint: 'asset_extraction',
        estimatedCost: workspace.settings.usage.defaultTextCost,
        seriesId: episode.seriesId,
        episodeId: episode.id,
        taskType: 'asset_extract',
        taskId: task.id,
      });
      return { ok: true, assetCount: episode.assetIds.length };
    }
    case 'generateAssetImages': {
      const episode = workspace.episodes.find((item) => item.id === command.episodeId);
      if (!episode) throw new Error(`Episode ${command.episodeId} not found`);
      const ownAssets = workspace.assets.filter((asset) => asset.episodeId === episode.id);
      const { selectedAssets, batchItems, skippedAssetIds } = resolveAssetBatch(ownAssets, command.assetSnapshots);

      selectedAssets.forEach((asset) => {
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
        touchRevision(asset);
      });

      episode.stationStates.subjects = 'completed';
      syncEpisode(workspace, episode.id);
      const batch = buildBatchSummary(batchItems);
      const task = createTask(workspace, {
        kind: 'asset',
        targetType: 'episode',
        targetId: episode.id,
        title: `为 ${episode.title} 批量生成资产图`,
        description: `共完成 ${selectedAssets.length} 个主体的主版本图片。`,
        status: 'completed',
        retryable: true,
        link: `/series/${episode.seriesId}/episodes/${episode.id}`,
        error: null,
        logs: [
          ...selectedAssets.map((asset) => `asset rendered: ${asset.name}`),
          ...skippedAssetIds.map((assetId) => `asset skipped by snapshot conflict: ${assetId}`),
        ],
        batch,
      });
      upsertWorkflowRun(workspace, {
        episodeId: episode.id,
        stage: 'asset_rendering',
        agent: 'asset',
        status: 'completed',
        summary: `完成 ${selectedAssets.length} 个资产主版本`,
        taskId: task.id,
      });
      recordApiUsage(workspace, {
        provider: workspace.settings.ai.mode === 'mock' ? 'mock' : 'siliconflow',
        model: workspace.settings.ai.model,
        endpoint: 'asset_generation',
        imageCount: selectedAssets.length,
        estimatedCost: selectedAssets.length * workspace.settings.usage.defaultImageCost,
        seriesId: episode.seriesId,
        episodeId: episode.id,
        taskType: 'asset_generate',
        taskId: task.id,
      });
      return { ok: true, renderedCount: selectedAssets.length, skippedCount: skippedAssetIds.length, skippedAssetIds, batch };
    }
    case 'updateAsset': {
      const asset = workspace.assets.find((item) => item.id === command.assetId);
      if (!asset) {
        throw new Error(`Asset ${command.assetId} not found`);
      }

      assertExpectedRevision('asset', asset, command.expectedRevision);
      asset.description = command.description;
      if (command.prompt !== undefined) {
        asset.prompt = command.prompt;
      }
      if (command.voice !== undefined) {
        asset.voice = command.voice;
      }
      if (command.isShared !== undefined) {
        asset.isShared = command.isShared;
      }
      touchRevision(asset);

      const globalAsset = asset.globalAssetId ? workspace.globalAssets.find((item) => item.id === asset.globalAssetId) : null;
      if (globalAsset && asset.syncSource === 'linked') {
        globalAsset.description = asset.description;
        globalAsset.prompt = asset.prompt;
        globalAsset.voiceId = asset.voice || null;
        globalAsset.selectedImageId = getSelectedAssetImageId(asset);
        globalAsset.referenceImages = (asset.images.length ? asset.images : asset.versions).map((image) => image.imageUrl);
        touchRevision(globalAsset);
      }

      if (asset.isShared || !asset.episodeId) {
        syncSeriesEpisodes(workspace, asset.seriesId);
      } else if (asset.episodeId) {
        syncEpisode(workspace, asset.episodeId);
      }

      const cascadeWarnings = workspace.shots
        .filter((shot) => shot.associatedAssetIds.includes(asset.id))
        .map((shot) => makeCascadeWarning(`镜头 ${shot.title} 引用了已更新资产 ${asset.name}，建议重新生成。`));

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
        logs: ['asset updated', ...cascadeWarnings],
        batch: null,
      });
      return { ok: true, asset, cascadeWarnings };
    }
    case 'selectAssetImage': {
      const asset = workspace.assets.find((item) => item.id === command.assetId);
      if (!asset) throw new Error(`Asset ${command.assetId} not found`);
      assertExpectedRevision('asset', asset, command.expectedRevision);
      asset.images = (asset.images.length ? asset.images : asset.versions).map((image) => ({
        ...image,
        isSelected: image.id === command.imageId,
      }));
      asset.versions = asset.images;
      touchRevision(asset);

      if (asset.globalAssetId && asset.syncSource === 'linked') {
        const globalAsset = workspace.globalAssets.find((item) => item.id === asset.globalAssetId);
        if (globalAsset) {
          globalAsset.selectedImageId = command.imageId;
          globalAsset.referenceImages = asset.images.map((image) => image.imageUrl);
          touchRevision(globalAsset);
        }
      }

      if (asset.isShared || !asset.episodeId) {
        syncSeriesEpisodes(workspace, asset.seriesId);
      } else if (asset.episodeId) {
        syncEpisode(workspace, asset.episodeId);
      }
      return { ok: true, asset };
    }
    case 'promoteAssetToShared': {
      const asset = workspace.assets.find((item) => item.id === command.assetId);
      if (!asset) {
        throw new Error(`Asset ${command.assetId} not found`);
      }
      asset.isShared = true;
      asset.episodeId = null;
      workspace.episodes
        .filter((episode) => episode.seriesId === asset.seriesId)
        .forEach((episode) => {
          if (!episode.assetIds.includes(asset.id)) {
            episode.assetIds.push(asset.id);
          }
        });
      touchRevision(asset);
      syncSeriesEpisodes(workspace, asset.seriesId);
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
        batch: null,
      });
      return { ok: true, asset };
    }
    case 'promoteAssetToGlobal': {
      const asset = workspace.assets.find((item) => item.id === command.assetId);
      if (!asset) {
        throw new Error(`Asset ${command.assetId} not found`);
      }

      let globalAsset = asset.globalAssetId ? workspace.globalAssets.find((item) => item.id === asset.globalAssetId) : undefined;
      if (!globalAsset) {
        globalAsset = {
          id: id('global_asset'),
          name: asset.name,
          type: asset.type,
          ownerId: 'workspace-owner',
          description: asset.description,
          prompt: asset.prompt,
          referenceImages: (asset.images.length ? asset.images : asset.versions).map((image) => image.imageUrl),
          selectedImageId: getSelectedAssetImageId(asset),
          voiceId: asset.voice || null,
          faceLocked: asset.isFaceLocked,
          consistencyConfig: asset.consistencyConfig,
          usedInSeries: [],
          tags: asset.tags,
          revision: 1,
          createdAt: nowIso(),
          updatedAt: nowIso(),
        } satisfies GlobalAsset;
        workspace.globalAssets.unshift(globalAsset);
      }

      if (!globalAsset.usedInSeries.some((item) => item.linkedAssetId === asset.id)) {
        const series = workspace.series.find((item) => item.id === asset.seriesId);
        globalAsset.usedInSeries.push({
          seriesId: asset.seriesId,
          seriesName: series?.name ?? asset.seriesId,
          linkedAssetId: asset.id,
        });
      }

      asset.globalAssetId = globalAsset.id;
      asset.syncSource = 'linked';
      asset.isShared = true;
      touchRevision(asset);
      touchRevision(globalAsset);
      syncSeriesEpisodes(workspace, asset.seriesId);
      return { ok: true, asset, globalAsset };
    }
    case 'importGlobalAssetToSeries': {
      const globalAsset = workspace.globalAssets.find((item) => item.id === command.globalAssetId);
      if (!globalAsset) {
        throw new Error(`Global asset ${command.globalAssetId} not found`);
      }
      const series = workspace.series.find((item) => item.id === command.seriesId);
      if (!series) {
        throw new Error(`Series ${command.seriesId} not found`);
      }

      const asset: Asset = {
        id: id('asset'),
        seriesId: series.id,
        episodeId: null,
        name: globalAsset.name,
        type: globalAsset.type,
        description: globalAsset.description,
        prompt: globalAsset.prompt,
        chapterIds: [],
        tags: [...globalAsset.tags, 'imported-global'],
        isShared: true,
        isFaceLocked: globalAsset.faceLocked,
        voice: globalAsset.voiceId ?? '',
        state: globalAsset.selectedImageId ? 'completed' : 'ready',
        states: [{ id: id('state'), name: '默认态', notes: '从全局资产导入' }],
        selectedStateId: null,
        versions: globalAsset.referenceImages.map((imageUrl, index) => ({
          id: `${globalAsset.id}_image_${String(index + 1)}`,
          label: index === 0 ? '主版本' : `候选版本 ${String(index + 1)}`,
          imageUrl,
          createdAt: nowIso(),
          isSelected: globalAsset.selectedImageId === `${globalAsset.id}_image_${String(index + 1)}` || (index === 0 && !globalAsset.selectedImageId),
        })),
        images: globalAsset.referenceImages.map((imageUrl, index) => ({
          id: `${globalAsset.id}_image_${String(index + 1)}`,
          label: index === 0 ? '主版本' : `候选版本 ${String(index + 1)}`,
          imageUrl,
          createdAt: nowIso(),
          isSelected: globalAsset.selectedImageId === `${globalAsset.id}_image_${String(index + 1)}` || (index === 0 && !globalAsset.selectedImageId),
        })),
        parentAssetId: null,
        variantName: null,
        revision: 1,
        globalAssetId: globalAsset.id,
        syncSource: command.mode,
        appliedPresetId: null,
        consistencyConfig: globalAsset.consistencyConfig,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };
      workspace.assets.unshift(asset);
      workspace.episodes
        .filter((episode) => episode.seriesId === series.id)
        .forEach((episode) => {
          if (!episode.assetIds.includes(asset.id)) {
            episode.assetIds.push(asset.id);
          }
        });
      if (!globalAsset.usedInSeries.some((item) => item.linkedAssetId === asset.id)) {
        globalAsset.usedInSeries.push({
          seriesId: series.id,
          seriesName: series.name,
          linkedAssetId: asset.id,
        });
      }
      touchRevision(globalAsset);
      syncSeriesEpisodes(workspace, series.id);
      return { ok: true, asset, globalAsset };
    }
    case 'updateShot': {
      const shot = workspace.shots.find((item) => item.id === command.shotId);
      if (!shot) {
        throw new Error(`Shot ${command.shotId} not found`);
      }
      assertExpectedRevision('shot', shot, command.expectedRevision);
      shot.prompt = command.prompt;
      shot.scene = command.scene;
      shot.composition = command.composition;
      shot.lighting = command.lighting;
      shot.cameraMotion = command.cameraMotion;
      shot.dialogue = command.dialogue;
      shot.durationSeconds = command.durationSeconds;
      touchRevision(shot);
      syncEpisode(workspace, shot.episodeId);
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
        batch: null,
      });
      return { ok: true, shot };
    }
    case 'selectTake': {
      const shot = workspace.shots.find((item) => item.id === command.shotId);
      if (!shot) {
        throw new Error(`Shot ${command.shotId} not found`);
      }
      assertExpectedRevision('shot', shot, command.expectedRevision);
      let selectedLabel = '';
      let selectedTakeKind: 'image' | 'video' | null = null;
      let selectedTakeUrl: string | null = null;
      shot.takes = shot.takes.map((take) => {
        const isSelected = take.id === command.takeId;
        if (isSelected) {
          selectedLabel = take.label;
          selectedTakeKind = take.kind;
          selectedTakeUrl = take.url;
        }
        return { ...take, isSelected };
      });
      if (selectedTakeKind === 'image') {
        shot.images = shot.images.map((image) => ({
          ...image,
          isSelected: image.imageUrl === selectedTakeUrl,
        }));
      }
      touchRevision(shot);
      const storyboard = workspace.storyboards.find((item) => item.shotId === shot.id);
      if (storyboard) {
        storyboard.selectedTakeId = command.takeId;
        touchRevision(storyboard);
      }
      syncEpisode(workspace, shot.episodeId);
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
        batch: null,
      });
      return { ok: true, shot };
    }
    case 'applyGenerationPreset': {
      const preset = workspace.generationPresets.find((item) => item.id === command.presetId);
      if (!preset) {
        throw new Error(`Preset ${command.presetId} not found`);
      }

      preset.usageCount += 1;
      preset.updatedAt = nowIso();
      if (command.targetType === 'asset') {
        const asset = workspace.assets.find((item) => item.id === command.targetId);
        if (!asset) {
          throw new Error(`Asset ${command.targetId} not found`);
        }
        asset.appliedPresetId = preset.id;
        asset.prompt = applyPresetText(asset.prompt, preset);
        touchRevision(asset);
        if (asset.episodeId) {
          syncEpisode(workspace, asset.episodeId);
        } else {
          syncSeriesEpisodes(workspace, asset.seriesId);
        }
        return { ok: true, asset, preset };
      }

      const shot = workspace.shots.find((item) => item.id === command.targetId);
      if (!shot) {
        throw new Error(`Shot ${command.targetId} not found`);
      }
      shot.appliedPresetId = preset.id;
      shot.prompt = applyPresetText(shot.prompt, preset);
      touchRevision(shot);
      syncEpisode(workspace, shot.episodeId);
      return { ok: true, shot, preset };
    }
    case 'updateTimelineItem': {
      const finalCut = workspace.finalCuts.find((item) => item.id === command.finalCutId);
      if (!finalCut) {
        throw new Error(`Final cut ${command.finalCutId} not found`);
      }
      assertExpectedRevision('final_cut', finalCut, command.expectedRevision);
      const track = finalCut.tracks.find((item) => item.id === command.trackId);
      const item = track?.items.find((entry) => entry.id === command.itemId);
      if (!track || !item) {
        throw new Error(`Timeline item ${command.itemId} not found`);
      }
      item.label = command.label;
      item.locked = command.locked;
      touchRevision(finalCut);
      syncEpisode(workspace, finalCut.episodeId);
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
        batch: null,
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
        usage: { ...workspace.settings.usage, ...command.settings.usage },
      };
      refreshUsageAlerts(workspace, 0);
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
        batch: null,
      });
      return { ok: true, settings: workspace.settings };
    }
    case 'generateShotsFromChapters': {
      const episode = workspace.episodes.find((item) => item.id === command.episodeId);
      if (!episode) {
        throw new Error(`Episode ${command.episodeId} not found`);
      }
      const episodeAssets = workspace.assets.filter((asset) => episode.assetIds.includes(asset.id));
      const assetsReady = episodeAssets.length > 0 && episodeAssets.every((asset) => {
        const images = asset.images.length ? asset.images : asset.versions;
        return asset.state === 'completed' && images.some((image) => image.isSelected);
      });
      if (!assetsReady) {
        throw new Error('All assets must be completed with selected versions before shot generation');
      }

      const { selectedAssets, skippedAssetIds } = resolveAssetBatch(episodeAssets, command.assetSnapshots);
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
        const assetIds = selectedAssets.slice(0, 2).map((asset) => asset.id);
        const shot: Shot = {
          id: baseId,
          episodeId: episode.id,
          chapterId: chapter.id,
          index: nextIndex,
          title: `${chapter.title} 开场`,
          description: chapter.content.slice(0, 90),
          scene: chapter.scene,
          associatedAssetIds: assetIds,
          associatedAssetNames: selectedAssets.slice(0, 2).map((asset) => asset.name),
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
          dialogue: chapter.dialogues.map((line) => `${line.speaker}: ${line.content}`).join('\n'),
          sfx: '环境音待补充',
          durationSeconds: chapter.estimatedDurationSeconds,
          status: 'ready',
          continuityStatus: 'clear',
          continuityIssues: [],
          referenceAssetIds: assetIds,
          takes: [],
          images: [],
          state: 'ready',
          track: 'default',
          trackId: 'track_default',
          revision: 1,
          assetSnapshots: buildAssetSnapshots(workspace, assetIds),
          assetRefStatus: 'valid',
          brokenAssetRefs: [],
          appliedPresetId: null,
          dialogueTrack: {
            shotId: baseId,
            audioFile: null,
            duration: chapter.estimatedDurationSeconds * 1000,
            transcript: chapter.dialogues.map((line) => line.content).join(' '),
            characterId: null,
            voiceId: null,
            lipSyncEnabled: workspace.settings.workspace.creationMode.toLowerCase().includes('audio'),
          },
          multimodalInputs: [{ id: id('mm'), kind: 'text', title: '章节文本', url: null, notes: chapter.content.slice(0, 40) }],
          createdAt: nowIso(),
          updatedAt: nowIso(),
        };
        recomputeShotAssetState(workspace, shot);
        workspace.shots.push(shot);
        episode.shotIds.push(shot.id);
        const storyboardId = id('story');
        workspace.storyboards.push({
          id: storyboardId,
          episodeId: episode.id,
          shotId: shot.id,
          subtitle: '',
          notes: 'Agent 生成的初始故事板卡片。',
          selectedTakeId: null,
          referenceAssetIds: shot.referenceAssetIds,
          revision: 1,
          updatedAt: nowIso(),
        });
        episode.storyboardIds.push(storyboardId);
        return [shot];
      });

      episode.stationStates.shots = generated.length ? 'ready' : episode.stationStates.shots;
      syncEpisode(workspace, episode.id);
      const task = createTask(workspace, {
        kind: 'agent',
        targetType: 'episode',
        targetId: episode.id,
        title: `为 ${episode.title} 生成分镜草案`,
        description: `基于章节文本创建了 ${generated.length} 条结构化镜头。`,
        status: 'completed',
        retryable: false,
        link: `/series/${episode.seriesId}/episodes/${episode.id}`,
        error: null,
        logs: [
          ...generated.map((shot) => `generated ${shot.id}`),
          ...skippedAssetIds.map((assetId) => `asset snapshot skipped: ${assetId}`),
        ],
        batch: null,
      });
      upsertWorkflowRun(workspace, {
        episodeId: episode.id,
        stage: 'shot_generation',
        agent: 'production',
        status: 'completed',
        summary: `生成 ${generated.length} 条分镜`,
        taskId: task.id,
      });
      recordApiUsage(workspace, {
        provider: workspace.settings.ai.mode === 'mock' ? 'mock' : 'siliconflow',
        model: workspace.settings.ai.model,
        endpoint: 'shot_generation',
        inputTokens: chapters.reduce((sum, chapter) => sum + chapter.content.length, 0),
        outputTokens: generated.length * 160,
        estimatedCost: Math.max(1, generated.length) * workspace.settings.usage.defaultTextCost,
        seriesId: episode.seriesId,
        episodeId: episode.id,
        taskType: 'shot_generate',
        taskId: task.id,
      });
      return { ok: true, generatedCount: generated.length, skippedAssetIds };
    }
    case 'generateShotImages': {
      const episode = workspace.episodes.find((item) => item.id === command.episodeId);
      if (!episode) throw new Error(`Episode ${command.episodeId} not found`);
      const shots = workspace.shots.filter((shot) => shot.episodeId === episode.id);
      if (!shots.length) throw new Error('Shot list must exist before rendering shot images');

      const { selectedShots, batchItems, skippedShotIds } = resolveShotBatch(shots, command.shotSnapshots);

      selectedShots.forEach((shot) => {
        recomputeShotAssetState(workspace, shot);
        if (shot.assetRefStatus === 'broken') {
          const item = batchItems.find((batchItem: TaskBatchItem) => batchItem.targetId === shot.id);
          if (item) {
            item.status = 'skipped';
            item.skipReason = 'broken asset reference';
          }
          skippedShotIds.push(shot.id);
          return;
        }

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

        const selectedTakeId = syncShotImageTakes(shot);
        const storyboard = workspace.storyboards.find((item) => item.shotId === shot.id);
        if (storyboard) {
          storyboard.selectedTakeId = selectedTakeId;
          touchRevision(storyboard);
        }

        shot.state = 'completed';
        shot.status = 'rendered';
        touchRevision(shot);
      });

      episode.stationStates.storyboard = 'ready';
      syncEpisode(workspace, episode.id);
      const batch = buildBatchSummary(batchItems);
      const processedShots = selectedShots.filter((shot) => !skippedShotIds.includes(shot.id));
      const task = createTask(workspace, {
        kind: 'storyboard',
        targetType: 'episode',
        targetId: episode.id,
        title: `为 ${episode.title} 批量生成分镜图`,
        description: `共完成 ${processedShots.length} 个镜头的分镜主版本图片。`,
        status: 'completed',
        retryable: true,
        link: `/series/${episode.seriesId}/episodes/${episode.id}`,
        error: null,
        logs: [
          ...processedShots.map((shot) => `shot rendered: ${shot.title}`),
          ...skippedShotIds.map((shotId) => `shot skipped by snapshot conflict: ${shotId}`),
        ],
        batch,
      });
      upsertWorkflowRun(workspace, {
        episodeId: episode.id,
        stage: 'shot_rendering',
        agent: 'production',
        status: 'completed',
        summary: `完成 ${processedShots.length} 条分镜图`,
        taskId: task.id,
      });
      recordApiUsage(workspace, {
        provider: workspace.settings.ai.mode === 'mock' ? 'mock' : 'siliconflow',
        model: workspace.settings.ai.model,
        endpoint: 'shot_image_generation',
        imageCount: processedShots.length,
        estimatedCost: processedShots.length * workspace.settings.usage.defaultImageCost,
        seriesId: episode.seriesId,
        episodeId: episode.id,
        taskType: 'asset_generate',
        taskId: task.id,
      });
      return { ok: true, renderedCount: processedShots.length, skippedCount: skippedShotIds.length, skippedShotIds, batch };
    }
    case 'retryTask': {
      const task = workspace.tasks.find((item) => item.id === command.taskId);
      if (!task) {
        throw new Error(`Task ${command.taskId} not found`);
      }

      if (task.kind === 'script' && task.targetType === 'episode') {
        const rerun = await executeCommand(workspace, {
          type: 'generateScriptFromSource',
          episodeId: task.targetId,
          forceRegenerate: true,
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
        const rerun = await executeCommand(workspace, {
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
        const rerun = await executeCommand(workspace, {
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
        const rerun = await executeCommand(workspace, {
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
