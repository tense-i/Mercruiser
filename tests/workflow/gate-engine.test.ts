import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { readWorkspace } from '@/lib/server/repository/file-store';
import { createStudioRepository } from '@/lib/server/repository/studio-repository';
import { buildGateSnapshot } from '@/lib/workflow/gate-engine';

async function createTempWorkspace() {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'mercruiser-gate-'));
  const targetPath = path.join(tempDir, 'studio.json');
  const seed = await readFile(path.join(process.cwd(), 'tests', 'fixtures', 'studio-seed.json'), 'utf8');
  await writeFile(targetPath, seed, 'utf8');
  return targetPath;
}

describe('gate engine', () => {
  const originalAiMode = process.env.MERCRUISER_AI_MODE;

  afterEach(() => {
    process.env.MERCRUISER_AI_MODE = originalAiMode;
  });
  it('blocks shot generation when assets are not fully rendered', async () => {
    const workspace = await readWorkspace(await createTempWorkspace());
    const gate = buildGateSnapshot(workspace, 'episode_03');

    expect(gate?.currentStage).toBe('script_generation');
    expect(gate?.availableActions.find((action) => action.kind === 'generate_shots')?.enabled).toBe(false);
  });

  it('keeps gate at asset rendering when no real asset image is produced', async () => {
    const dataPath = await createTempWorkspace();
    const repo = createStudioRepository({ dataPath });

    const workspaceBefore = await readWorkspace(dataPath);
    const episode = workspaceBefore.episodes.find((item) => item.id === 'episode_02');
    if (!episode) throw new Error('episode_02 missing');
    episode.shotIds = [];
    episode.storyboardIds = [];
    episode.stationStates.shots = 'idle';
    episode.stationStates.storyboard = 'idle';
    episode.stationStates['final-cut'] = 'idle';
    workspaceBefore.shots = [];
    workspaceBefore.storyboards = [];
    workspaceBefore.finalCuts = workspaceBefore.finalCuts.map((cut) => cut.id === episode.finalCutId ? {
      ...cut,
      tracks: cut.tracks.map((track) => ({ ...track, items: [] })),
    } : cut);
    workspaceBefore.assets = workspaceBefore.assets.map((asset) => asset.episodeId === 'episode_02'
      ? { ...asset, state: 'ready', images: [], versions: [] }
      : asset);
    await writeFile(dataPath, JSON.stringify(workspaceBefore, null, 2), 'utf8');

    await repo.dispatch({ type: 'generateAssetImages', episodeId: 'episode_02' });

    const workspace = await readWorkspace(dataPath);
    const gate = buildGateSnapshot(workspace, 'episode_02');

    expect(gate?.currentStage).toBe('shot_generation');
    expect(gate?.availableActions.find((action) => action.kind === 'generate_shots')?.enabled).toBe(true);
  });

  it('reaches export after shot images are generated for a fully prepared episode', async () => {
    const dataPath = await createTempWorkspace();
    const repo = createStudioRepository({ dataPath });

    await repo.dispatch({ type: 'generateShotImages', episodeId: 'episode_02' });

    const workspace = await readWorkspace(dataPath);
    const gate = buildGateSnapshot(workspace, 'episode_02');

    expect(gate?.currentStage).toBe('export');
    expect(gate?.availableActions.find((action) => action.kind === 'open_storyboard')?.enabled).toBe(true);
  });

  it('blocks downstream generation when a shot has broken asset references', async () => {
    const workspace = await readWorkspace(await createTempWorkspace());
    const shot = workspace.shots.find((item) => item.id === 'shot_03') as any;

    shot.assetRefStatus = 'broken';
    shot.brokenAssetRefs = [{ assetId: 'asset_agent', reason: 'no_image' }];

    const gate = buildGateSnapshot(workspace as any, 'episode_02');

    expect(gate?.blockedReasons.some((reason) => reason.includes('资产引用'))).toBe(true);
    expect(gate?.availableActions.find((action) => action.kind === 'generate_shot_images')?.enabled).toBe(false);
  });

  it('blocks export when usage alerts exceed a blocking threshold', async () => {
    const workspace = await readWorkspace(await createTempWorkspace());
    (workspace as any).usageAlerts = [
      {
        id: 'alert_block',
        type: 'single_task_limit',
        threshold: 5,
        currentValue: 8,
        status: 'exceeded',
        notifyMethod: 'block',
      },
    ];

    const gate = buildGateSnapshot(workspace as any, 'episode_01');

    expect(gate?.availableActions.find((action) => action.kind === 'export_episode')?.enabled).toBe(false);
    expect(gate?.blockedReasons.some((reason) => reason.includes('API'))).toBe(true);
  });
});
