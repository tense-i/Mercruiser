import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

let previousPath = process.env.MERCRUISER_DATA_PATH;

async function prepareWorkspace() {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'mercruiser-api-'));
  const targetPath = path.join(tempDir, 'studio.json');
  const seed = await readFile(path.join(process.cwd(), 'data', 'studio.json'), 'utf8');
  await writeFile(targetPath, seed, 'utf8');
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
});
