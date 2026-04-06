import type { GateSnapshot, StudioWorkspace } from '@/lib/domain/types';
import { getEpisodeDependencies } from '@/lib/workflow/stage-definitions';

function nowIso() {
  return new Date().toISOString();
}

export function buildGateSnapshot(workspace: StudioWorkspace, episodeId: string): GateSnapshot | null {
  const data = getEpisodeDependencies(workspace, episodeId);
  if (!data) {
    return null;
  }

  const { episode, sourceDocument, chapters, ownAssets, shots } = data;
  const assetsReady = ownAssets.length > 0 && ownAssets.every((asset) => {
    const images = asset.images.length ? asset.images : asset.versions;
    return asset.state === 'completed' && images.some((image) => image.isSelected);
  });
  const shotsReady = shots.length > 0;
  const shotImagesReady = shotsReady && shots.every((shot) => {
    const images = shot.images.length ? shot.images : [];
    return images.some((image) => image.isSelected);
  });

  let currentStage: GateSnapshot['currentStage'] = 'script_generation';
  if (chapters.length > 0) currentStage = 'asset_extraction';
  if (ownAssets.length > 0) currentStage = 'asset_rendering';
  if (assetsReady) currentStage = 'shot_generation';
  if (shotsReady) currentStage = 'shot_rendering';
  if (shotImagesReady) currentStage = 'storyboard';
  if (data.storyboards.length > 0 && data.finalCut?.tracks.length) currentStage = 'final_cut';

  const blockedReasons: string[] = [];
  const requiredInputs: string[] = [];

  if (!sourceDocument) {
    requiredInputs.push('需要先导入小说原文');
  }
  if (!chapters.length) {
    requiredInputs.push('需要先生成章节剧本');
  }
  if (chapters.length > 0 && !ownAssets.length) {
    requiredInputs.push('需要先提取本集主体');
  }
  if (ownAssets.length > 0 && !assetsReady) {
    blockedReasons.push('仍有主体未完成图片生成或未选定主版本');
  }
  if (assetsReady && !shotsReady) {
    requiredInputs.push('可以触发分镜表生成');
  }
  if (shotsReady && !shotImagesReady) {
    blockedReasons.push('仍有分镜未完成图片生成或未选定主版本');
  }

  return {
    episodeId,
    currentStage,
    availableActions: [
      {
        kind: 'generate_script',
        enabled: Boolean(sourceDocument),
        label: '从原文生成剧本',
        reason: sourceDocument ? null : '缺少原文输入',
      },
      {
        kind: 'extract_assets',
        enabled: chapters.length > 0,
        label: '提取本集主体',
        reason: chapters.length > 0 ? null : '剧本尚未完成',
      },
      {
        kind: 'generate_asset_images',
        enabled: ownAssets.length > 0,
        label: '批量生成资产图片',
        reason: ownAssets.length > 0 ? null : '还没有可生成的主体',
      },
      {
        kind: 'generate_shots',
        enabled: assetsReady,
        label: '生成分镜表',
        reason: assetsReady ? null : '所有资产必须完成并选定主版本',
      },
      {
        kind: 'generate_shot_images',
        enabled: shotsReady,
        label: '生成分镜图片',
        reason: shotsReady ? null : '分镜表尚未生成',
      },
      {
        kind: 'open_storyboard',
        enabled: shotImagesReady,
        label: '进入故事板',
        reason: shotImagesReady ? null : '分镜图片尚未收敛',
      },
      {
        kind: 'open_final_cut',
        enabled: shotImagesReady,
        label: '进入成片',
        reason: shotImagesReady ? null : '需要先完成故事板主版本选择',
      },
      {
        kind: 'export_episode',
        enabled: Boolean(data.finalCut?.tracks.length),
        label: '导出成片',
        reason: data.finalCut?.tracks.length ? null : '成片工位尚未装配完成',
      },
    ],
    blockedReasons,
    requiredInputs,
    updatedAt: nowIso(),
  };
}
