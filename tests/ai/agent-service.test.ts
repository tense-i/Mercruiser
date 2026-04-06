import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

let previousPath = process.env.MERCRUISER_DATA_PATH;

async function prepareWorkspace() {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'mercruiser-ai-'));
  const targetPath = path.join(tempDir, 'studio.json');
  const seed = await readFile(path.join(process.cwd(), 'data', 'studio.json'), 'utf8');
  await writeFile(targetPath, seed, 'utf8');
  process.env.MERCRUISER_DATA_PATH = targetPath;
}

describe('fallback agent service', () => {
  beforeEach(async () => {
    await prepareWorkspace();
  });

  afterEach(() => {
    process.env.MERCRUISER_DATA_PATH = previousPath;
  });

  it('returns actionable next-step guidance without credentials', async () => {
    const { runFallbackAgent } = await import('@/lib/ai/agent-service');
    const result = await runFallbackAgent({
      prompt: '下一步应该做什么？',
      context: { episodeId: 'episode_02' },
    });

    expect(result.text).toContain('夜市回响');
  });

  it('can trigger shot generation heuristically', async () => {
    const { runFallbackAgent } = await import('@/lib/ai/agent-service');
    const { studioRepository } = await import('@/lib/server/repository/studio-repository');
    await studioRepository.dispatch({
      type: 'generateScriptFromSource',
      episodeId: 'episode_03',
    });
    await studioRepository.dispatch({
      type: 'extractAssetsFromScript',
      episodeId: 'episode_03',
    });
    await studioRepository.dispatch({
      type: 'generateAssetImages',
      episodeId: 'episode_03',
    });
    const result = await runFallbackAgent({
      prompt: '请根据当前章节拆分分镜',
      context: { episodeId: 'episode_03' },
    });

    expect(result.toolCalls[0]?.name).toBe('generate_shots_from_chapters');
  });
});
