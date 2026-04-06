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
          },
          context: {
            episodeId: 'episode_02',
          },
        }),
      }),
    );
    const payload = await response.json();

    expect(payload.ok).toBe(true);
    expect(payload.episodeView.assets.find((asset: { id: string }) => asset.id === 'asset_agent').description).toBe('更新后的描述');
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
});
