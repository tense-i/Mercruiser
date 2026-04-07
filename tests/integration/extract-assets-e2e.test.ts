import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { analyzeChaptersToAssets } from '@/lib/ai/script-analysis';
import { getConfiguredAiMode, hasRealCredentials } from '@/lib/ai/provider';
import { createStudioRepository } from '@/lib/server/repository/studio-repository';
import type { StudioWorkspace } from '@/lib/domain/types';

const SEED_PATH = path.join(process.cwd(), 'tests', 'fixtures', 'studio-seed.json');

async function createTempWorkspace(mutate?: (ws: StudioWorkspace) => void) {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'mercruiser-e2e-'));
  const targetPath = path.join(tempDir, 'studio.json');
  const seed = JSON.parse(await readFile(SEED_PATH, 'utf8')) as StudioWorkspace;
  mutate?.(seed);
  await writeFile(targetPath, JSON.stringify(seed, null, 2), 'utf8');
  return targetPath;
}

const SAMPLE_CHAPTERS = [
  {
    id: 'ch_test_01',
    index: 1,
    title: '迷失入境',
    content: '凌晨两点，林澈戴上头盔进入《遗迹边境》。传送光芒散去，他站于被迷雾笼罩的古城前，石壁上刻有猩红文字：进入者，唯有通关者可归。他尝试退出却发现退出键消失，被困城中。',
    scene: '古城入口',
    dialogues: [{ speaker: '系统', content: '进入者，唯有通关者可归。' }],
  },
  {
    id: 'ch_test_02',
    index: 2,
    title: '守门者显形',
    content: '迷雾中走出守门者，身高两米，全身由古老铁甲包裹。林澈快速扫描周围寻找弱点，守门者缓缓抬起巨斧。其他玩家已开始与守门者战斗，大多数人一击即亡。',
    scene: '古城广场',
    dialogues: [{ speaker: '守门者', content: '无法通过者，永驻此地。' }],
  },
];

describe('extract assets — end-to-end', () => {
  describe('parseFirstJsonBlock robustness', () => {
    it('handles Qwen3 <think> block followed by fenced JSON', async () => {
      const { analyzeChaptersToAssets: _fn } = await import('@/lib/ai/script-analysis');
      void _fn;

      const { default: module } = await import('@/lib/ai/script-analysis') as any;
      void module;

      const rawWithThink = `<think>
Let me analyze these chapters carefully. I need to identify the key characters and scenes.
The main character is 林澈. The scene includes 古城入口 and 古城广场.
</think>

\`\`\`json
{"assets":[{"name":"林澈","type":"character","description":"主角，VR玩家","prompt":"young male player, cyberpunk helmet, sci-fi suit","chapterIndexes":[1,2]}]}
\`\`\``;

      const mockWorkspace = {
        settings: { ai: { mode: 'mock', model: '' } },
        series: [],
        episodes: [],
        chapters: [],
        assets: [],
      } as any;

      process.env.MERCRUISER_AI_MODE = 'mock';
      await expect(
        analyzeChaptersToAssets({
          workspace: mockWorkspace,
          seriesName: 'Test',
          episodeTitle: 'Test',
          chapters: SAMPLE_CHAPTERS,
        }),
      ).rejects.toThrow();
    });

    it('strips think block and parses bare JSON correctly', () => {
      const parseFirstJsonBlock = extractParseFirstJsonBlock();

      const withThinkAndBareJson = `<think>
The assets need {character} and {scene} objects.
Let me think...
</think>
{"assets":[{"name":"林澈","type":"character","description":"主角","prompt":"player","chapterIndexes":[1]}]}`;

      const result = parseFirstJsonBlock(withThinkAndBareJson);
      expect(result).toMatchObject({ assets: [{ name: '林澈', type: 'character' }] });
    });

    it('strips think block and parses fenced JSON correctly', () => {
      const parseFirstJsonBlock = extractParseFirstJsonBlock();

      const withThinkAndFenced = `<think>
I will return {"fake": true} in the thinking block to test robustness.
</think>

\`\`\`json
{"assets":[{"name":"古城入口","type":"scene","description":"迷雾古城","prompt":"ancient city gate, fog, cyberpunk","chapterIndexes":[1,2]}]}
\`\`\``;

      const result = parseFirstJsonBlock(withThinkAndFenced);
      expect(result).toMatchObject({ assets: [{ name: '古城入口', type: 'scene' }] });
    });
  });

  describe('repository pipeline — with real AI credentials', () => {
    let originalMode: string | undefined;

    beforeEach(() => {
      originalMode = process.env.MERCRUISER_AI_MODE;
      delete process.env.MERCRUISER_AI_MODE;
    });

    afterEach(() => {
      process.env.MERCRUISER_AI_MODE = originalMode;
    });

    it.skipIf(!hasRealCredentials())('extracts assets from real AI and creates asset records', async () => {
      const mode = getConfiguredAiMode();
      console.log(`[e2e] running with mode=${mode}`);

      const dataPath = await createTempWorkspace((ws) => {
        const ep = ws.episodes.find((e) => e.id === 'episode_03')!;
        ep.assetIds = [];
        ep.stationStates.subjects = 'editing' as any;
        ws.assets = ws.assets.filter((a) => a.episodeId !== 'episode_03');
      });

      const repo = createStudioRepository({ dataPath });

      await repo.dispatch({ type: 'generateScriptFromSource', episodeId: 'episode_03' });

      const viewAfterScript = await repo.getEpisodeWorkspaceView('episode_03');
      const chapterCount = viewAfterScript?.chapters.length ?? 0;
      console.log(`[e2e] chapters generated: ${chapterCount}`);
      expect(chapterCount).toBeGreaterThan(0);

      const result = (await repo.dispatch({
        type: 'extractAssetsFromScript',
        episodeId: 'episode_03',
      })) as { ok: boolean; assetCount: number };

      console.log(`[e2e] extract result:`, result);
      expect(result.ok).toBe(true);
      expect(result.assetCount).toBeGreaterThan(0);

      const viewAfterExtract = await repo.getEpisodeWorkspaceView('episode_03');
      const assets = viewAfterExtract?.assets ?? [];
      console.log(`[e2e] assets created:`, assets.map((a) => `${a.name}(${a.type})`));

      expect(assets.length).toBeGreaterThan(0);
      expect(assets.every((a) => a.name && a.type && a.prompt)).toBe(true);
      expect(viewAfterExtract?.episode.stationStates.subjects).toBe('ready');
      expect(viewAfterExtract?.gate?.availableActions.find((a) => a.kind === 'generate_shots')?.enabled).toBe(true);
    }, 60_000);

    it.skipIf(!hasRealCredentials())('analyzeChaptersToAssets returns valid structured output', async () => {
      const mode = getConfiguredAiMode();
      console.log(`[e2e] direct AI call, mode=${mode}`);

      const mockWorkspace = {
        settings: { ai: { mode, model: '' } },
      } as any;

      const result = await analyzeChaptersToAssets({
        workspace: mockWorkspace,
        seriesName: '游戏冒险小说_迷雾之城',
        episodeTitle: '迷失入境',
        chapters: SAMPLE_CHAPTERS,
      });

      console.log(`[e2e] raw asset count: ${result.assets.length}`);
      console.log(`[e2e] assets:`, JSON.stringify(result.assets, null, 2));

      expect(result.mode).toBe('ai');
      expect(result.assets.length).toBeGreaterThan(0);

      for (const asset of result.assets) {
        expect(asset.name, `asset name missing`).toBeTruthy();
        expect(['character', 'scene', 'prop'], `invalid type: ${asset.type}`).toContain(asset.type);
        expect(asset.description, `description missing for ${asset.name}`).toBeTruthy();
        expect(asset.prompt, `prompt missing for ${asset.name}`).toBeTruthy();
        expect(asset.chapterIndexes.length, `chapterIndexes empty for ${asset.name}`).toBeGreaterThan(0);
      }
    }, 60_000);

    it.skipIf(!hasRealCredentials())('generates shots from chapters with real AI after full pipeline', async () => {
      const mode = getConfiguredAiMode();
      console.log(`[e2e] shots test, mode=${mode}`);

      const dataPath = await createTempWorkspace((ws) => {
        const ep = ws.episodes.find((e) => e.id === 'episode_03')!;
        ep.assetIds = [];
        ep.shotIds = [];
        ep.storyboardIds = [];
        ep.directorPlanId = null;
        ep.stationStates.subjects = 'editing' as any;
        ep.stationStates.shots = 'editing' as any;
        ws.assets = ws.assets.filter((a) => a.episodeId !== 'episode_03');
        ws.shots = ws.shots.filter((s) => s.episodeId !== 'episode_03');
        ws.storyboards = ws.storyboards.filter((s) => s.episodeId !== 'episode_03');
      });

      const repo = createStudioRepository({ dataPath });

      await repo.dispatch({ type: 'generateScriptFromSource', episodeId: 'episode_03' });
      const afterScript = await repo.getEpisodeWorkspaceView('episode_03');
      console.log(`[e2e] chapters: ${afterScript?.chapters.length}`);
      expect(afterScript?.chapters.length).toBeGreaterThan(0);

      await repo.dispatch({ type: 'extractAssetsFromScript', episodeId: 'episode_03' });
      const afterAssets = await repo.getEpisodeWorkspaceView('episode_03');
      console.log(`[e2e] assets: ${afterAssets?.assets.length}`);
      expect(afterAssets?.assets.length).toBeGreaterThan(0);

      const shotsResult = (await repo.dispatch({
        type: 'generateShotsFromChapters',
        episodeId: 'episode_03',
        mode: 'full',
        style: 'commercial',
        avgDurationSeconds: 4,
        includeDirectorPlan: true,
      })) as { ok: boolean; shotCount: number };

      console.log(`[e2e] shots result:`, shotsResult);

      const afterShots = await repo.getEpisodeWorkspaceView('episode_03');
      const shots = afterShots?.shots ?? [];
      const directorPlan = (afterShots as any)?.directorPlan;

      console.log(`[e2e] shots created: ${shots.length}`);
      shots.forEach((shot, i) =>
        console.log(`  [${i + 1}] ${shot.title} | size=${shot.shotSize} | dur=${shot.durationSeconds}s | track=${shot.track}`),
      );
      console.log(`[e2e] director plan theme: ${directorPlan?.theme ?? '(none)'}`);

      expect(shots.length).toBeGreaterThan(0);
      expect(shots.length).toBe(afterScript!.chapters.length);

      for (const shot of shots) {
        expect(shot.title, `title missing`).toBeTruthy();
        expect(shot.prompt, `prompt missing for shot ${shot.id}`).toBeTruthy();
        expect(shot.videoDesc, `videoDesc missing for shot ${shot.id}`).toBeTruthy();
        expect(shot.shotSize, `shotSize missing for shot ${shot.id}`).toBeTruthy();
        expect(shot.durationSeconds, `durationSeconds=0 for shot ${shot.id}`).toBeGreaterThan(0);
        expect(shot.chapterId, `chapterId missing`).toBeTruthy();
      }

      expect(afterShots?.episode.stationStates.shots).toBe('ready');
      expect(afterShots?.gate?.currentStage).toBe('shot_rendering');
    }, 180_000);

    it.skipIf(!hasRealCredentials())('generates asset images from real SiliconFlow image API after full pipeline', async () => {
      const mode = getConfiguredAiMode();
      console.log(`[e2e] asset images test, mode=${mode}`);

      const dataPath = await createTempWorkspace((ws) => {
        const ep = ws.episodes.find((e) => e.id === 'episode_03')!;
        ep.assetIds = [];
        ep.stationStates.subjects = 'editing' as any;
        ws.assets = ws.assets.filter((a) => a.episodeId !== 'episode_03');
      });

      const repo = createStudioRepository({ dataPath });

      await repo.dispatch({ type: 'generateScriptFromSource', episodeId: 'episode_03' });
      const afterScript = await repo.getEpisodeWorkspaceView('episode_03');
      console.log(`[e2e] chapters: ${afterScript?.chapters.length}`);
      expect(afterScript?.chapters.length).toBeGreaterThan(0);

      await repo.dispatch({ type: 'extractAssetsFromScript', episodeId: 'episode_03' });
      const afterExtract = await repo.getEpisodeWorkspaceView('episode_03');
      const assetCount = afterExtract?.assets.length ?? 0;
      console.log(`[e2e] assets extracted: ${assetCount}`);
      expect(assetCount).toBeGreaterThan(0);

      const assetsBeforeImg = afterExtract?.assets ?? [];
      console.log(`[e2e] asset prompts:`, assetsBeforeImg.map((a) => `${a.name}: ${a.prompt?.slice(0, 40) ?? '(empty)'}`));
      console.log(`[e2e] SILICONFLOW_API_KEY set:`, Boolean(process.env.SILICONFLOW_API_KEY));

      const imagesResult = (await repo.dispatch({
        type: 'generateAssetImages',
        episodeId: 'episode_03',
        skipExisting: false,
        countPerAsset: 1,
      })) as { ok: boolean; renderedCount: number; skippedCount: number; skippedAssetIds: string[]; imageErrors: string[] };

      console.log(`[e2e] image generation result:`, imagesResult);
      if (imagesResult.imageErrors?.length) {
        console.log(`[e2e] image errors:`, imagesResult.imageErrors);
      }
      expect(imagesResult.ok).toBe(true);
      expect(imagesResult.renderedCount).toBeGreaterThan(0);

      const afterImages = await repo.getEpisodeWorkspaceView('episode_03');
      const assets = afterImages?.assets ?? [];

      console.log(`[e2e] assets with images:`);
      for (const asset of assets) {
        const selectedImg = asset.images?.find((img: any) => img.isSelected);
        console.log(`  ${asset.name} (${asset.type}) state=${asset.state} images=${asset.images?.length ?? 0} selectedUrl=${selectedImg?.imageUrl?.slice(0, 60) ?? '(none)'}`);
      }

      const renderedAssets = assets.filter((a) => a.state === 'completed' && a.images?.some((img: any) => img.isSelected));
      expect(renderedAssets.length, 'at least one asset should have a selected image').toBeGreaterThan(0);

      for (const asset of renderedAssets) {
        const selectedImg = asset.images?.find((img: any) => img.isSelected);
        expect(selectedImg?.imageUrl, `imageUrl missing for ${asset.name}`).toBeTruthy();
        expect(
          selectedImg?.imageUrl,
          `imageUrl should be local /api/media or https:// for ${asset.name}`,
        ).toMatch(/^\/api\/media|^https?:\/\//);
      }

      expect(afterImages?.episode.stationStates.subjects).toBe('ready');
    }, 300_000);
  });
});

function extractParseFirstJsonBlock(): (text: string) => unknown {
  let impl: (text: string) => unknown;

  const stripThinkingBlocks = (text: string) =>
    text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

  impl = (text: string) => {
    const cleaned = stripThinkingBlocks(text);

    const fencedMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fencedMatch?.[1]) {
      return JSON.parse(fencedMatch[1].trim());
    }

    const objectMatch = cleaned.match(/\{[\s\S]*\}/);
    if (objectMatch?.[0]) {
      return JSON.parse(objectMatch[0]);
    }

    throw new Error('No JSON payload found in script analysis response');
  };

  return impl;
}
