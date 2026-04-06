import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { createStudioRepository } from '@/lib/server/repository/studio-repository';
import type { StudioWorkspace } from '@/lib/domain/types';

async function createTempWorkspace(mutate?: (workspace: StudioWorkspace) => void) {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'mercruiser-repo-'));
  const targetPath = path.join(tempDir, 'studio.json');
  const seed = JSON.parse(await readFile(path.join(process.cwd(), 'data', 'studio.json'), 'utf8')) as StudioWorkspace;
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
});
