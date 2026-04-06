import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { createStudioRepository } from '@/lib/server/repository/studio-repository';

async function createTempWorkspace() {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'mercruiser-repo-'));
  const targetPath = path.join(tempDir, 'studio.json');
  const seed = await readFile(path.join(process.cwd(), 'data', 'studio.json'), 'utf8');
  await writeFile(targetPath, seed, 'utf8');
  return targetPath;
}

describe('studio repository', () => {
  it('loads dashboard data from the workspace', async () => {
    const repo = createStudioRepository({ dataPath: await createTempWorkspace() });
    const dashboard = await repo.getDashboardView();

    expect(dashboard.series).toHaveLength(2);
    expect(dashboard.stats[0]?.value).toBe('2');
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
    expect(episodeView?.gate?.currentStage).toBe('storyboard');
  });
});
