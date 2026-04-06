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

  const { sourceDocument, chapters, ownAssets, shots, storyboards, finalCut } = data;
  const hasBrokenAssetRefs = shots.some((shot) => shot.assetRefStatus === 'broken');
  const hasStaleAssetRefs = shots.some((shot) => shot.assetRefStatus === 'stale');
  const blockingUsageAlert = workspace.usageAlerts.find((alert) => alert.status === 'exceeded' && alert.notifyMethod === 'block');

  const assetsReady = ownAssets.length > 0 && ownAssets.every((asset) => {
    const images = asset.images.length ? asset.images : asset.versions;
    return asset.state === 'completed' && images.some((image) => image.isSelected);
  });
  const shotsReady = shots.length > 0 && !hasBrokenAssetRefs;
  const shotImagesReady = shotsReady && shots.every((shot) => shot.images.some((image) => image.isSelected));
  const storyboardReady = shotImagesReady && storyboards.length > 0 && storyboards.every((item) => item.selectedTakeId !== null);

  let currentStage: GateSnapshot['currentStage'] = 'script_generation';
  if (chapters.length > 0) currentStage = 'asset_extraction';
  if (ownAssets.length > 0) currentStage = 'asset_rendering';
  if (assetsReady) currentStage = 'shot_generation';
  if (shots.length > 0) currentStage = 'shot_rendering';
  if (shotImagesReady) currentStage = 'storyboard';
  if (finalCut?.tracks.length) currentStage = 'final_cut';

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
  if (assetsReady && !shots.length) {
    requiredInputs.push('可以触发分镜表生成');
  }
  if (hasBrokenAssetRefs) {
    blockedReasons.push('存在资产引用异常，必须先修复 broken 资产引用');
  }
  if (hasStaleAssetRefs) {
    blockedReasons.push('存在资产引用过期，建议重新生成相关分镜图');
  }
  if (shots.length > 0 && !shotImagesReady) {
    blockedReasons.push('仍有分镜未完成图片生成或未选定主版本');
  }
  if (blockingUsageAlert) {
    blockedReasons.push(`API 用量预警已超限：${blockingUsageAlert.type}`);
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
        enabled: shots.length > 0 && !hasBrokenAssetRefs,
        label: '生成分镜图片',
        reason: shots.length === 0 ? '分镜表尚未生成' : hasBrokenAssetRefs ? '存在 broken 资产引用' : null,
      },
      {
        kind: 'open_storyboard',
        enabled: shotImagesReady,
        label: '进入故事板',
        reason: shotImagesReady ? null : '分镜图片尚未收敛',
      },
      {
        kind: 'open_final_cut',
        enabled: storyboardReady,
        label: '进入成片',
        reason: storyboardReady ? null : '需要先完成故事板主版本选择',
      },
      {
        kind: 'export_episode',
        enabled: Boolean(finalCut?.tracks.length) && !hasBrokenAssetRefs && !blockingUsageAlert,
        label: '导出成片',
        reason: finalCut?.tracks.length ? blockingUsageAlert ? 'API 用量超限，已阻止导出' : hasBrokenAssetRefs ? '存在 broken 资产引用' : null : '成片工位尚未装配完成',
      },
    ],
    blockedReasons,
    requiredInputs,
    updatedAt: nowIso(),
  };
}
