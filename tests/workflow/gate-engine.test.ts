import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { readWorkspace } from '@/lib/server/repository/file-store';
import { createStudioRepository } from '@/lib/server/repository/studio-repository';
import { buildGateSnapshot } from '@/lib/workflow/gate-engine';

async function createTempWorkspace() {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'mercruiser-gate-'));
  const targetPath = path.join(tempDir, 'studio.json');
  const seed = await readFile(path.join(process.cwd(), 'data', 'studio.json'), 'utf8');
  await writeFile(targetPath, seed, 'utf8');
  return targetPath;
}

describe('gate engine', () => {
  it('blocks shot generation when assets are not fully rendered', async () => {
    const workspace = await readWorkspace(await createTempWorkspace());
    const gate = buildGateSnapshot(workspace, 'episode_03');

    expect(gate?.currentStage).toBe('script_generation');
    expect(gate?.availableActions.find((action) => action.kind === 'generate_shots')?.enabled).toBe(false);
  });

  it('unlocks storyboard after shot images are generated', async () => {
    const dataPath = await createTempWorkspace();
    const repo = createStudioRepository({ dataPath });

    await repo.dispatch({ type: 'generateScriptFromSource', episodeId: 'episode_03' });
    await repo.dispatch({ type: 'extractAssetsFromScript', episodeId: 'episode_03' });
    await repo.dispatch({ type: 'generateAssetImages', episodeId: 'episode_03' });
    await repo.dispatch({ type: 'generateShotsFromChapters', episodeId: 'episode_03' });
    await repo.dispatch({ type: 'generateShotImages', episodeId: 'episode_03' });

    const workspace = await readWorkspace(dataPath);
    const gate = buildGateSnapshot(workspace, 'episode_03');

    expect(gate?.currentStage).toBe('storyboard');
    expect(gate?.availableActions.find((action) => action.kind === 'open_storyboard')?.enabled).toBe(true);
  });
});
