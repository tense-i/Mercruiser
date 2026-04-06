import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { StudioWorkspace } from '@/lib/domain/types';

let previousPath = process.env.MERCRUISER_DATA_PATH;

async function prepareWorkspace(mutate?: (workspace: StudioWorkspace) => void) {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'mercruiser-api-'));
  const targetPath = path.join(tempDir, 'studio.json');
  const seed = JSON.parse(await readFile(path.join(process.cwd(), 'data', 'studio.json'), 'utf8')) as StudioWorkspace;
  mutate?.(seed);
  await writeFile(targetPath, JSON.stringify(seed, null, 2), 'utf8');
  process.env.MERCRUISER_DATA_PATH = targetPath;
}

describe('studio api route', () => {
  beforeEach(async () => {
    await prepareWorkspace();
  });

  afterEach(() => {
    process.env.MERCRUISER_DATA_PATH = previousPath;
  });

  it('returns episode view from GET', async () => {
    const { GET } = await import('@/app/api/studio/route');
    const response = await GET(new Request('http://localhost/api/studio?episodeId=episode_02'));
    const payload = await response.json();

    expect(payload.ok).toBe(true);
    expect(payload.episodeView.episode.id).toBe('episode_02');
  });

  it('dispatches commands and returns refreshed episode view', async () => {
    const { POST } = await import('@/app/api/studio/route');
    const response = await POST(
      new Request('http://localhost/api/studio', {
        method: 'POST',
        body: JSON.stringify({
          command: {
            type: 'updateAsset',
            assetId: 'asset_agent',
            description: '更新后的描述',
            prompt: '更新后的主体提示词',
            voice: 'voice-02',
          },
          context: {
            episodeId: 'episode_02',
          },
        }),
      }),
    );
    const payload = await response.json();

    expect(payload.ok).toBe(true);
    const asset = payload.episodeView.assets.find((item: { id: string }) => item.id === 'asset_agent');
    expect(asset.description).toBe('更新后的描述');
    expect(asset.prompt).toBe('更新后的主体提示词');
    expect(asset.voice).toBe('voice-02');
  });

  it('formats validation issues for importSeries payloads', async () => {
    const { POST } = await import('@/app/api/studio/route');
    const response = await POST(
      new Request('http://localhost/api/studio', {
        method: 'POST',
        body: JSON.stringify({
          command: {
            type: 'importSeries',
            name: '',
            description: '',
            sourceTitle: '',
            firstEpisodeTitle: '',
            content: '',
          },
        }),
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.ok).toBe(false);
    expect(payload.error).toContain('name 不能为空');
    expect(payload.error).toContain('sourceTitle 不能为空');
    expect(payload.error).toContain('firstEpisodeTitle 不能为空');
    expect(payload.error).toContain('content 不能为空');
    expect(Array.isArray(payload.issues)).toBe(true);
  });

  it('creates episodes from source and returns refreshed series view', async () => {
    const { POST } = await import('@/app/api/studio/route');
    const response = await POST(
      new Request('http://localhost/api/studio', {
        method: 'POST',
        body: JSON.stringify({
          command: {
            type: 'createEpisodeFromSource',
            seriesId: 'series_neon_relic',
            title: 'API Episode',
            logline: 'api lane',
            sourceTitle: 'API Source',
            sourceContent: '第一幕。第二幕。',
          },
          context: {
            seriesId: 'series_neon_relic',
          },
        }),
      }),
    );
    const payload = await response.json();

    expect(payload.ok).toBe(true);
    expect(payload.result.episode.title).toBe('API Episode');
    expect(payload.result.episode.sourceDocumentId).toBeTruthy();
    expect(payload.seriesView.episodes.some((episode: { id: string }) => episode.id === payload.result.episode.id)).toBe(true);
  });

  it('saves series settings and strategy through the api', async () => {
    const { POST } = await import('@/app/api/studio/route');
    const settingsResponse = await POST(
      new Request('http://localhost/api/studio', {
        method: 'POST',
        body: JSON.stringify({
          command: {
            type: 'updateSeriesSettings',
            seriesId: 'series_neon_relic',
            settings: {
              worldEra: 'API era',
              coreRules: ['No retcon'],
              visualStylePrompt: 'API style',
            },
          },
          context: {
            seriesId: 'series_neon_relic',
          },
        }),
      }),
    );
    const settingsPayload = await settingsResponse.json();

    const strategyResponse = await POST(
      new Request('http://localhost/api/studio', {
        method: 'POST',
        body: JSON.stringify({
          command: {
            type: 'updateSeriesStrategy',
            seriesId: 'series_neon_relic',
            strategy: {
              model: 'siliconflow/Qwen/Qwen3.5-9B',
              creationMode: 'audio-first',
              promptGuidance: 'Keep continuity',
            },
          },
          context: {
            seriesId: 'series_neon_relic',
          },
        }),
      }),
    );
    const strategyPayload = await strategyResponse.json();

    expect(settingsPayload.ok).toBe(true);
    expect(settingsPayload.seriesView.series.settings.worldEra).toBe('API era');
    expect(settingsPayload.seriesView.series.settings.coreRules).toEqual(['No retcon']);
    expect(settingsPayload.seriesView.series.settings.visualStylePrompt).toBe('API style');
    expect(strategyPayload.ok).toBe(true);
    expect(strategyPayload.seriesView.series.strategy.model).toBe('siliconflow/Qwen/Qwen3.5-9B');
    expect(strategyPayload.seriesView.series.strategy.creationMode).toBe('audio-first');
    expect(strategyPayload.seriesView.series.strategy.promptGuidance).toBe('Keep continuity');
  });

  it('rejects remote write attempts by default', async () => {
    const { POST } = await import('@/app/api/studio/route');
    const response = await POST(
      new Request('https://example.com/api/studio', {
        method: 'POST',
        body: JSON.stringify({
          command: {
            type: 'updateAsset',
            assetId: 'asset_agent',
            description: '远程写入',
          },
        }),
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload.ok).toBe(false);
    expect(payload.error).toContain('Remote writes are disabled');
  });

  it('updates structured shot fields through the api', async () => {
    const { POST } = await import('@/app/api/studio/route');
    const response = await POST(
      new Request('http://localhost/api/studio', {
        method: 'POST',
        body: JSON.stringify({
          command: {
            type: 'updateShot',
            shotId: 'shot_03',
            prompt: '新的分镜提示词',
            scene: '夜市核心区',
            composition: '近景',
            lighting: '顶部聚光',
            cameraMotion: '摇镜',
            dialogue: '新的台词',
            durationSeconds: 7,
          },
          context: {
            episodeId: 'episode_02',
          },
        }),
      }),
    );
    const payload = await response.json();

    expect(payload.ok).toBe(true);
    const shot = payload.episodeView.shots.find((item: { id: string }) => item.id === 'shot_03');
    expect(shot.prompt).toBe('新的分镜提示词');
    expect(shot.scene).toBe('夜市核心区');
    expect(shot.cameraMotion).toBe('摇镜');
    expect(shot.durationSeconds).toBe(7);
  });

  it('selects a requested take through the api and syncs storyboard state', async () => {
    const { POST } = await import('@/app/api/studio/route');
    const response = await POST(
      new Request('http://localhost/api/studio', {
        method: 'POST',
        body: JSON.stringify({
          command: {
            type: 'selectTake',
            shotId: 'shot_03',
            takeId: 'take_03_b',
          },
          context: {
            episodeId: 'episode_02',
          },
        }),
      }),
    );
    const payload = await response.json();

    expect(payload.ok).toBe(true);
    const shot = payload.episodeView.shots.find((item: { id: string }) => item.id === 'shot_03');
    const storyboard = payload.episodeView.storyboards.find((item: { shotId: string }) => item.shotId === 'shot_03');
    expect(shot.takes.find((take: { id: string }) => take.id === 'take_03_a').isSelected).toBe(false);
    expect(shot.takes.find((take: { id: string }) => take.id === 'take_03_b').isSelected).toBe(true);
    expect(storyboard.selectedTakeId).toBe('take_03_b');
  });

  it('selects an asset image through the api and mirrors the selection to versions', async () => {
    await prepareWorkspace((workspace) => {
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

    const { POST } = await import('@/app/api/studio/route');
    const response = await POST(
      new Request('http://localhost/api/studio', {
        method: 'POST',
        body: JSON.stringify({
          command: {
            type: 'selectAssetImage',
            assetId: 'asset_agent',
            imageId: 'asset_image_alt',
          },
          context: {
            episodeId: 'episode_02',
          },
        }),
      }),
    );
    const payload = await response.json();

    expect(payload.ok).toBe(true);
    const asset = payload.episodeView.assets.find((item: { id: string }) => item.id === 'asset_agent');
    expect(asset.images.find((image: { id: string }) => image.id === 'asset_image_9a9e2465').isSelected).toBe(false);
    expect(asset.images.find((image: { id: string }) => image.id === 'asset_image_alt').isSelected).toBe(true);
    expect(asset.versions.find((image: { id: string }) => image.id === 'asset_image_alt').isSelected).toBe(true);
  });

  it('imports source documents through the api', async () => {
    const { POST } = await import('@/app/api/studio/route');
    const response = await POST(
      new Request('http://localhost/api/studio', {
        method: 'POST',
        body: JSON.stringify({
          command: {
            type: 'importSourceDocument',
            episodeId: 'episode_03',
            title: '新的第三集原文',
            content: '新的原文内容',
          },
          context: {
            episodeId: 'episode_03',
          },
        }),
      }),
    );
    const payload = await response.json();

    expect(payload.ok).toBe(true);
    expect(payload.episodeView.sourceDocument.title).toBe('新的第三集原文');
  });

  it('accepts siliconflow mode in persisted settings updates', async () => {
    const { POST } = await import('@/app/api/studio/route');
    const response = await POST(
      new Request('http://localhost/api/studio', {
        method: 'POST',
        body: JSON.stringify({
          command: {
            type: 'updateSettings',
            settings: {
              ai: {
                mode: 'siliconflow',
                model: 'siliconflow/Qwen/Qwen3.5-9B',
              },
            },
          },
          context: {
            refreshSettings: true,
          },
        }),
      }),
    );
    const payload = await response.json();

    expect(payload.ok).toBe(true);
    expect(payload.settings.ai.mode).toBe('siliconflow');
    expect(payload.settings.ai.model).toBe('siliconflow/Qwen/Qwen3.5-9B');
  });

  it('returns 409 for optimistic-lock conflicts', async () => {
    const { POST } = await import('@/app/api/studio/route');

    const first = await POST(
      new Request('http://localhost/api/studio', {
        method: 'POST',
        body: JSON.stringify({
          command: {
            type: 'updateAsset',
            assetId: 'asset_agent',
            description: '第一次修改',
            expectedRevision: 1,
          },
          context: {
            episodeId: 'episode_02',
          },
        }),
      }),
    );

    expect(first.status).toBe(200);

    const conflict = await POST(
      new Request('http://localhost/api/studio', {
        method: 'POST',
        body: JSON.stringify({
          command: {
            type: 'updateAsset',
            assetId: 'asset_agent',
            description: '冲突修改',
            expectedRevision: 1,
          },
          context: {
            episodeId: 'episode_02',
          },
        }),
      }),
    );
    const payload = await conflict.json();

    expect(conflict.status).toBe(409);
    expect(payload.ok).toBe(false);
    expect(payload.code).toBe('REVISION_CONFLICT');
  });

  it('promotes a local asset into the global library through the api', async () => {
    const { POST } = await import('@/app/api/studio/route');
    const response = await POST(
      new Request('http://localhost/api/studio', {
        method: 'POST',
        body: JSON.stringify({
          command: {
            type: 'promoteAssetToGlobal',
            assetId: 'asset_agent',
          },
          context: {
            seriesId: 'series_neon_relic',
            episodeId: 'episode_02',
          },
        }),
      }),
    );
    const payload = await response.json();

    expect(payload.ok).toBe(true);
    expect(payload.result.globalAsset.id).toBeTruthy();
    const asset = payload.episodeView.assets.find((item: { id: string }) => item.id === 'asset_agent');
    expect(asset.globalAssetId).toBe(payload.result.globalAsset.id);
    expect(payload.seriesView.globalAssets.some((item: { id: string }) => item.id === payload.result.globalAsset.id)).toBe(true);
  });

  it('retries failed tasks through the dedicated retry route', async () => {
    const { POST } = await import('@/app/api/tasks/[taskId]/retry/route');
    const response = await POST(new Request('http://localhost/api/tasks/task_failed_storyboard/retry', { method: 'POST' }), {
      params: Promise.resolve({ taskId: 'task_failed_storyboard' }),
    });
    const payload = await response.json();

    expect(payload.ok).toBe(true);
    expect(payload.result.task.status).toBe('completed');
    expect(payload.result.task.error).toBeNull();
    const retriedTask = payload.tasks.find((task: { id: string }) => task.id === 'task_failed_storyboard');
    expect(retriedTask.status).toBe('completed');
    expect(retriedTask.error).toBeNull();
  });

  it('rejects remote retry attempts by default', async () => {
    const { POST } = await import('@/app/api/tasks/[taskId]/retry/route');
    const response = await POST(new Request('https://example.com/api/tasks/task_failed_storyboard/retry', { method: 'POST' }), {
      params: Promise.resolve({ taskId: 'task_failed_storyboard' }),
    });
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload.ok).toBe(false);
    expect(payload.error).toContain('Remote writes are disabled');
  });
});
