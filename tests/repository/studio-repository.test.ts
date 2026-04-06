import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { createStudioRepository } from '@/lib/server/repository/studio-repository';
import type { StudioWorkspace } from '@/lib/domain/types';

async function createTempWorkspace(mutate?: (workspace: StudioWorkspace) => void) {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'mercruiser-repo-'));
  const targetPath = path.join(tempDir, 'studio.json');
  const seed = JSON.parse(await readFile(path.join(process.cwd(), 'tests', 'fixtures', 'studio-seed.json'), 'utf8')) as StudioWorkspace;
  mutate?.(seed);
  await writeFile(targetPath, JSON.stringify(seed, null, 2), 'utf8');
  return targetPath;
}

describe('studio repository', () => {
  it('loads dashboard data from the workspace', async () => {
    const repo = createStudioRepository({ dataPath: await createTempWorkspace() });
    const dashboard = await repo.getDashboardView();

    expect(dashboard.series).toHaveLength(2);
    expect(dashboard.stats[0]?.value).toBe('2');
  });

  it('creates manual and imported series shells for the dashboard', async () => {
    const dataPath = await createTempWorkspace();
    const repo = createStudioRepository({ dataPath });

    const manual = (await repo.dispatch({
      type: 'createSeries',
      name: '  Lunar Trial  ',
      description: 'New series shell',
    })) as {
      ok: boolean;
      series: { id: string; name: string; status: string; importMetadata: { source: string } };
    };

    const imported = (await repo.dispatch({
      type: 'importSeries',
      name: 'Archive Import',
      description: '',
      importType: 'file',
      sourceTitle: 'Pilot Manuscript',
      content: '第一段。第二段。',
      firstEpisodeTitle: 'Episode Alpha',
    })) as {
      ok: boolean;
      series: { id: string; description: string; importMetadata: { source: string; sourceLabel: string } };
      episode: { id: string; title: string; sourceDocumentId: string | null };
    };

    const dashboard = await repo.getDashboardView();

    expect(manual.ok).toBe(true);
    expect(manual.series.name).toBe('Lunar Trial');
    expect(manual.series.status).toBe('setting');
    expect(manual.series.importMetadata.source).toBe('manual');
    expect(imported.ok).toBe(true);
    expect(imported.series.importMetadata.source).toBe('file');
    expect(imported.series.importMetadata.sourceLabel).toBe('Pilot Manuscript');
    expect(imported.episode.title).toBe('Episode Alpha');
    expect(imported.episode.sourceDocumentId).toBeTruthy();
    expect(imported.series.description).toBe('');
    const importedView = await repo.getEpisodeWorkspaceView(imported.episode.id);
    expect(importedView?.chapters.length).toBeGreaterThan(0);
    expect(importedView?.gate?.currentStage).toBe('asset_extraction');
    expect(dashboard.series[0]?.id).toBe(imported.series.id);
    expect(dashboard.series.some((series) => series.id === manual.series.id)).toBe(true);
  });

  it('updates series settings and strategy, then creates inherited episodes', async () => {
    const dataPath = await createTempWorkspace();
    const repo = createStudioRepository({ dataPath });

    const settingsResult = (await repo.dispatch({
      type: 'updateSeriesSettings',
      seriesId: 'series_neon_relic',
      settings: {
        worldEra: 'Near future',
        worldDescription: 'A neon archive city',
        coreRules: ['Rule A', 'Rule B'],
        visualStylePreset: 'cyber-noir',
        visualStylePrompt: 'moody neon rain',
        defaultShotStrategy: 'close-first',
        defaultDurationStrategy: '3-5 seconds',
        cameraMotionPreference: 'slow push',
      },
    })) as {
      ok: boolean;
      series: { settings: { worldEra: string; coreRules: string[]; visualStylePrompt: string } };
    };

    const strategyResult = (await repo.dispatch({
      type: 'updateSeriesStrategy',
      seriesId: 'series_neon_relic',
      strategy: {
        model: 'siliconflow/Qwen/Qwen3.5-9B',
        stylePreference: 'graphic',
        aspectRatio: '9:16',
        creationMode: 'audio-first',
        promptGuidance: 'Prioritize continuity',
      },
    })) as {
      ok: boolean;
      series: { strategy: { model: string; creationMode: string; promptGuidance: string } };
    };

    const blankEpisode = (await repo.dispatch({
      type: 'createEpisode',
      seriesId: 'series_neon_relic',
      title: 'Episode Blank',
      logline: 'blank path',
    })) as {
      ok: boolean;
      episode: { id: string; assetIds: string[]; sourceDocumentId: string | null; directorPlanId: string | null };
    };

    const sourcedEpisode = (await repo.dispatch({
      type: 'createEpisodeFromSource',
      seriesId: 'series_neon_relic',
      title: 'Episode Source',
      logline: 'source path',
      sourceTitle: 'Source Draft',
      sourceContent: '第一幕。第二幕。',
    })) as {
      ok: boolean;
      episode: { id: string; assetIds: string[]; sourceDocumentId: string | null };
    };

    const seriesView = await repo.getSeriesView('series_neon_relic');
    const sharedAssetIds = new Set(seriesView?.sharedAssets.map((asset) => asset.id));

    expect(settingsResult.ok).toBe(true);
    expect(settingsResult.series.settings.worldEra).toBe('Near future');
    expect(settingsResult.series.settings.coreRules).toEqual(['Rule A', 'Rule B']);
    expect(settingsResult.series.settings.visualStylePrompt).toBe('moody neon rain');
    expect(strategyResult.ok).toBe(true);
    expect(strategyResult.series.strategy.model).toBe('siliconflow/Qwen/Qwen3.5-9B');
    expect(strategyResult.series.strategy.creationMode).toBe('audio-first');
    expect(strategyResult.series.strategy.promptGuidance).toBe('Prioritize continuity');
    expect(blankEpisode.ok).toBe(true);
    expect(blankEpisode.episode.sourceDocumentId).toBeNull();
    expect(blankEpisode.episode.directorPlanId).toBeTruthy();
    expect(blankEpisode.episode.assetIds.every((assetId) => sharedAssetIds.has(assetId))).toBe(true);
    expect(sourcedEpisode.ok).toBe(true);
    expect(sourcedEpisode.episode.sourceDocumentId).toBeTruthy();
    const sourcedEpisodeView = await repo.getEpisodeWorkspaceView(sourcedEpisode.episode.id);
    expect(sourcedEpisode.episode.assetIds.every((assetId) => sharedAssetIds.has(assetId))).toBe(true);
    expect(sourcedEpisodeView?.chapters.length).toBeGreaterThan(0);
    expect(sourcedEpisodeView?.gate?.currentStage).toBe('asset_extraction');
    expect(seriesView?.episodes.some((episode) => episode.id === blankEpisode.episode.id)).toBe(true);
    expect(seriesView?.episodes.some((episode) => episode.id === sourcedEpisode.episode.id)).toBe(true);
  });

  it('imports source documents and auto-analyzes them into chapters by default', async () => {
    const dataPath = await createTempWorkspace();
    const repo = createStudioRepository({ dataPath });

    const result = (await repo.dispatch({
      type: 'importSourceDocument',
      episodeId: 'episode_03',
      title: '新的第三集原文',
      content: '第一幕。第二幕。第三幕。',
      autoAnalyze: true,
    })) as { ok: boolean; sourceDocumentId: string };

    const episodeView = await repo.getEpisodeWorkspaceView('episode_03');

    expect(result.ok).toBe(true);
    expect(result.sourceDocumentId).toBeTruthy();
    expect(episodeView?.sourceDocument?.title).toBe('新的第三集原文');
    expect(episodeView?.chapters.length).toBeGreaterThan(0);
    expect(episodeView?.gate?.currentStage).toBe('asset_extraction');
  });

  it('updates chapter content and persists it', async () => {
    const dataPath = await createTempWorkspace();
    const repo = createStudioRepository({ dataPath });

    await repo.dispatch({
      type: 'updateChapter',
      chapterId: 'chapter_02_a',
      content: '新的章节内容',
    });

    const reloaded = createStudioRepository({ dataPath });
    const episodeView = await reloaded.getEpisodeWorkspaceView('episode_02');
    expect(episodeView?.chapters[0]?.content).toBe('新的章节内容');
  });

  it('updates asset workspace fields and persists them', async () => {
    const dataPath = await createTempWorkspace();
    const repo = createStudioRepository({ dataPath });

    await repo.dispatch({
      type: 'updateAsset',
      assetId: 'asset_agent',
      description: '新的主体描述',
      prompt: '新的主体提示词',
      voice: 'narrator-f1',
      isShared: true,
    });

    const episodeView = await repo.getEpisodeWorkspaceView('episode_02');
    const asset = episodeView?.assets.find((item) => item.id === 'asset_agent');

    expect(asset?.description).toBe('新的主体描述');
    expect(asset?.prompt).toBe('新的主体提示词');
    expect(asset?.voice).toBe('narrator-f1');
    expect(asset?.isShared).toBe(true);
  });

  it('updates shot fields and persists them', async () => {
    const dataPath = await createTempWorkspace();
    const repo = createStudioRepository({ dataPath });

    await repo.dispatch({
      type: 'updateShot',
      shotId: 'shot_03',
      prompt: '新的分镜提示词',
      scene: '夜市外环',
      composition: '近景',
      lighting: '霓虹背光',
      cameraMotion: '手持跟拍',
      dialogue: '台词更新',
      durationSeconds: 9,
    });

    const episodeView = await repo.getEpisodeWorkspaceView('episode_02');
    const shot = episodeView?.shots.find((item) => item.id === 'shot_03');

    expect(shot?.prompt).toBe('新的分镜提示词');
    expect(shot?.scene).toBe('夜市外环');
    expect(shot?.composition).toBe('近景');
    expect(shot?.lighting).toBe('霓虹背光');
    expect(shot?.cameraMotion).toBe('手持跟拍');
    expect(shot?.dialogue).toBe('台词更新');
    expect(shot?.durationSeconds).toBe(9);
  });

  it('selects a different shot take and syncs the storyboard selection', async () => {
    const dataPath = await createTempWorkspace();
    const repo = createStudioRepository({ dataPath });

    await repo.dispatch({
      type: 'selectTake',
      shotId: 'shot_03',
      takeId: 'take_03_b',
    });

    const episodeView = await repo.getEpisodeWorkspaceView('episode_02');
    const shot = episodeView?.shots.find((item) => item.id === 'shot_03');
    const storyboard = episodeView?.storyboards.find((item) => item.shotId === 'shot_03');

    expect(shot?.takes.find((take) => take.id === 'take_03_a')?.isSelected).toBe(false);
    expect(shot?.takes.find((take) => take.id === 'take_03_b')?.isSelected).toBe(true);
    expect(storyboard?.selectedTakeId).toBe('take_03_b');
  });

  it('retries failed storyboard rendering tasks and clears the failure state', async () => {
    const dataPath = await createTempWorkspace();
    const repo = createStudioRepository({ dataPath });

    const result = (await repo.dispatch({
      type: 'retryTask',
      taskId: 'task_failed_storyboard',
    })) as {
      ok: boolean;
      task: { status: string; error: string | null; logs: string[] };
      rerun: { renderedCount: number };
    };

    const episodeView = await repo.getEpisodeWorkspaceView('episode_02');
    const retriedTask = episodeView?.tasks.find((task) => task.id === 'task_failed_storyboard');
    const rerenderedShot = episodeView?.shots.find((shot) => shot.id === 'shot_03');

    expect(result.ok).toBe(true);
    expect(result.rerun.renderedCount).toBeGreaterThan(0);
    expect(result.task.status).toBe('completed');
    expect(result.task.error).toBeNull();
    expect(result.task.logs.at(-1)).toContain('retry executed: rendered');
    expect(retriedTask?.status).toBe('completed');
    expect(retriedTask?.error).toBeNull();
    expect(rerenderedShot?.images.some((image) => image.isSelected)).toBe(true);
    expect(rerenderedShot?.status).toBe('rendered');
  });

  it('selects a requested asset image and mirrors the selected state to versions', async () => {
    const dataPath = await createTempWorkspace((workspace) => {
      const asset = workspace.assets.find((item) => item.id === 'asset_agent');
      if (!asset || !asset.images[0]) {
        throw new Error('asset_agent seed asset is missing its primary image');
      }

      const alternate = {
        ...asset.images[0],
        id: 'asset_image_alt',
        label: '候选版本',
        imageUrl: '/generated/asset-agent-alt.jpg',
        isSelected: false,
      };

      asset.images = [asset.images[0], alternate];
      asset.versions = [asset.versions[0], alternate];
    });
    const repo = createStudioRepository({ dataPath });

    await repo.dispatch({
      type: 'selectAssetImage',
      assetId: 'asset_agent',
      imageId: 'asset_image_alt',
    });

    const episodeView = await repo.getEpisodeWorkspaceView('episode_02');
    const asset = episodeView?.assets.find((item) => item.id === 'asset_agent');

    expect(asset?.images.find((image) => image.id === 'asset_image_9a9e2465')?.isSelected).toBe(false);
    expect(asset?.images.find((image) => image.id === 'asset_image_alt')?.isSelected).toBe(true);
    expect(asset?.versions.find((image) => image.id === 'asset_image_alt')?.isSelected).toBe(true);
  });

  it('generates structured shots from chapters', async () => {
    const dataPath = await createTempWorkspace();
    const repo = createStudioRepository({ dataPath });

    await repo.dispatch({
      type: 'generateScriptFromSource',
      episodeId: 'episode_03',
    });
    await repo.dispatch({
      type: 'extractAssetsFromScript',
      episodeId: 'episode_03',
    });
    await repo.dispatch({
      type: 'generateAssetImages',
      episodeId: 'episode_03',
    });
    await repo.dispatch({
      type: 'generateShotsFromChapters',
      episodeId: 'episode_03',
    });

    const episodeView = await repo.getEpisodeWorkspaceView('episode_03');
    expect(episodeView?.shots.length).toBeGreaterThan(0);
    expect(episodeView?.shots.every((shot) => shot.takes.length === 0)).toBe(true);
    expect(episodeView?.storyboards.every((storyboard) => storyboard.selectedTakeId === null)).toBe(true);
    expect(episodeView?.tasks[0]?.kind).toBe('agent');
  });

  it('can render shot images after shot generation', async () => {
    const dataPath = await createTempWorkspace();
    const repo = createStudioRepository({ dataPath });

    await repo.dispatch({
      type: 'generateScriptFromSource',
      episodeId: 'episode_03',
    });
    await repo.dispatch({
      type: 'extractAssetsFromScript',
      episodeId: 'episode_03',
    });
    await repo.dispatch({
      type: 'generateAssetImages',
      episodeId: 'episode_03',
    });
    await repo.dispatch({
      type: 'generateShotsFromChapters',
      episodeId: 'episode_03',
    });
    await repo.dispatch({
      type: 'generateShotImages',
      episodeId: 'episode_03',
    });

    const episodeView = await repo.getEpisodeWorkspaceView('episode_03');
    expect(episodeView?.shots.every((shot) => shot.images.some((image) => image.isSelected))).toBe(true);
    expect(
      episodeView?.shots.every((shot) => {
        const selectedImage = shot.images.find((image) => image.isSelected);
        const selectedTake = shot.takes.find((take) => take.isSelected);
        return Boolean(selectedImage && selectedTake && selectedTake.url === selectedImage.imageUrl);
      }),
    ).toBe(true);
    expect(episodeView?.storyboards.every((storyboard) => storyboard.selectedTakeId !== null)).toBe(true);
    expect(episodeView?.gate?.currentStage).toBe('storyboard');
  });

  it('promotes an episode asset into the global library and imports it into another series', async () => {
    const dataPath = await createTempWorkspace();
    const repo = createStudioRepository({ dataPath });

    const promoteResult = (await repo.dispatch({
      type: 'promoteAssetToGlobal',
      assetId: 'asset_agent',
    } as any)) as {
      ok: boolean;
      globalAsset: { id: string; name: string };
      asset: { globalAssetId: string | null; syncSource: string };
    };

    const importResult = (await repo.dispatch({
      type: 'importGlobalAssetToSeries',
      globalAssetId: promoteResult.globalAsset.id,
      seriesId: 'series_jade_archive',
      mode: 'linked',
    } as any)) as {
      ok: boolean;
      asset: { id: string; globalAssetId: string | null; syncSource: string; isShared: boolean; seriesId: string };
    };

    const jadeSeries = await repo.getSeriesView('series_jade_archive');
    const importedAsset = jadeSeries?.sharedAssets.find((item) => item.id === importResult.asset.id) as any;

    expect(promoteResult.ok).toBe(true);
    expect(promoteResult.asset.globalAssetId).toBe(promoteResult.globalAsset.id);
    expect(promoteResult.asset.syncSource).toBe('linked');
    expect(importResult.asset.seriesId).toBe('series_jade_archive');
    expect(importResult.asset.globalAssetId).toBe(promoteResult.globalAsset.id);
    expect(importResult.asset.syncSource).toBe('linked');
    expect(importResult.asset.isShared).toBe(true);
    expect(importedAsset?.globalAssetId).toBe(promoteResult.globalAsset.id);
  });

  it('marks downstream shots as stale after an upstream asset edit', async () => {
    const dataPath = await createTempWorkspace();
    const repo = createStudioRepository({ dataPath });

    await repo.dispatch({
      type: 'updateAsset',
      assetId: 'asset_agent',
      description: '新的主体描述，触发引用过期',
      expectedRevision: 1,
    } as any);

    const episodeView = await repo.getEpisodeWorkspaceView('episode_02');
    const shot = episodeView?.shots.find((item) => item.id === 'shot_04') as any;

    expect(shot?.assetRefStatus).toBe('stale');
    expect(Array.isArray(shot?.brokenAssetRefs)).toBe(true);
  });

  it('rejects stale expected revisions and reports an optimistic-lock conflict', async () => {
    const dataPath = await createTempWorkspace();
    const repo = createStudioRepository({ dataPath });

    await repo.dispatch({
      type: 'updateAsset',
      assetId: 'asset_agent',
      description: '第一次修改',
      expectedRevision: 1,
    } as any);

    await expect(
      repo.dispatch({
        type: 'updateAsset',
        assetId: 'asset_agent',
        description: '第二次修改',
        expectedRevision: 1,
      } as any),
    ).rejects.toMatchObject({
      name: 'StudioCommandConflictError',
      statusCode: 409,
      code: 'REVISION_CONFLICT',
    });
  });

  it('applies generation presets and records API usage alerts for expensive operations', async () => {
    const dataPath = await createTempWorkspace((workspace) => {
      (workspace as any).settings.usage = {
        currency: 'USD',
        singleTaskLimit: 0.1,
        dailyLimit: 0.5,
        monthlyLimit: 1,
        notifyMethod: 'block',
        defaultImageCost: 0.2,
        defaultVideoSecondCost: 0.4,
        defaultTextCost: 0.05,
      };
    });
    const repo = createStudioRepository({ dataPath });

    const presetResult = (await repo.dispatch({
      type: 'applyGenerationPreset',
      presetId: 'preset_series_storyboard',
      targetType: 'shot',
      targetId: 'shot_03',
    } as any)) as { ok: boolean; shot: { appliedPresetId: string | null; prompt: string } };

    await repo.dispatch({
      type: 'generateAssetImages',
      episodeId: 'episode_02',
      assetSnapshots: [
        { assetId: 'asset_lan', revision: 1 },
        { assetId: 'asset_market', revision: 1 },
        { assetId: 'asset_relic', revision: 1 },
        { assetId: 'asset_agent', revision: 1 },
      ],
    } as any);

    const workspace = JSON.parse(await readFile(dataPath, 'utf8')) as any;
    const singleTaskAlert = workspace.usageAlerts.find((alert: any) => alert.type === 'single_task_limit');

    expect(presetResult.ok).toBe(true);
    expect(presetResult.shot.appliedPresetId).toBe('preset_series_storyboard');
    expect(presetResult.shot.prompt).toContain('Preset');
    expect(workspace.apiUsageRecords.length).toBeGreaterThan(0);
    expect(singleTaskAlert?.status).toBe('exceeded');
  });

  it('skips batch image generation items whose snapshot revisions are stale', async () => {
    const dataPath = await createTempWorkspace();
    const repo = createStudioRepository({ dataPath });

    const result = (await repo.dispatch({
      type: 'generateAssetImages',
      episodeId: 'episode_02',
      assetSnapshots: [
        { assetId: 'asset_lan', revision: 1 },
        { assetId: 'asset_market', revision: 999 },
        { assetId: 'asset_relic', revision: 1 },
        { assetId: 'asset_agent', revision: 1 },
      ],
    } as any)) as {
      ok: boolean;
      renderedCount: number;
      skippedCount: number;
      skippedAssetIds: string[];
    };

    expect(result.ok).toBe(true);
    expect(result.skippedCount).toBe(1);
    expect(result.skippedAssetIds).toContain('asset_market');
    expect(result.renderedCount).toBeGreaterThan(0);
  });
});
