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

  const { episode, sourceDocument, chapters, ownAssets, shots, storyboards, finalCut } = data;
  const hasBrokenAssetRefs = shots.some((shot) => shot.assetRefStatus === 'broken');
  const hasStaleAssetRefs = shots.some((shot) => shot.assetRefStatus === 'stale');
  const blockingUsageAlert = workspace.usageAlerts.find((alert) => alert.status === 'exceeded' && alert.notifyMethod === 'block');

  const scriptDirty = episode.stationStates.script === 'editing';
  const subjectsDirty = episode.stationStates.subjects === 'editing';
  const shotsDirty = episode.stationStates.shots === 'editing';
  const storyboardDirty = episode.stationStates.storyboard === 'editing';
  const finalCutDirty = episode.stationStates['final-cut'] === 'editing';
  const shotsBlocked = episode.stationStates.shots === 'blocked';
  const storyboardBlocked = episode.stationStates.storyboard === 'blocked';
  const finalCutBlocked = episode.stationStates['final-cut'] === 'blocked';

  const shotsReady = shots.length > 0 && !hasBrokenAssetRefs && !shotsBlocked;
  const shotImagesReady = shotsReady && shots.every((shot) => shot.images.some((image) => image.isSelected));
  const storyboardReady = shotImagesReady && storyboards.length > 0 && storyboards.every((item) => item.selectedTakeId !== null) && !storyboardBlocked;
  const finalCutReady = Boolean(finalCut?.tracks.some((track) => track.items.length > 0)) && !finalCutBlocked;

  let currentStage: GateSnapshot['currentStage'] = 'script_generation';
  if (chapters.length > 0 && !scriptDirty) currentStage = 'asset_extraction';
  if (ownAssets.length > 0 && !subjectsDirty) currentStage = 'shot_generation';
  if (shots.length > 0 && !shotsDirty && !shotsBlocked) currentStage = 'shot_rendering';
  if (shotImagesReady && !storyboardDirty && !storyboardBlocked) currentStage = 'storyboard';
  if (finalCutReady && !finalCutDirty) currentStage = 'final_cut';
  if (finalCutReady && !finalCutDirty && !blockingUsageAlert) currentStage = 'export';

  const blockedReasons: string[] = [];
  const requiredInputs: string[] = [];

  if (!sourceDocument) {
    requiredInputs.push('需要先导入小说原文');
  }
  if (!chapters.length) {
    requiredInputs.push('需要先生成章节剧本');
  }
  if (scriptDirty) {
    blockedReasons.push('剧本已修改，必须先重新确认下游主体与分镜');
  }
  if (chapters.length > 0 && !ownAssets.length) {
    requiredInputs.push('需要先提取本集主体');
  }
  if (subjectsDirty) {
    blockedReasons.push('主体已更新，必须先重新确认分镜引用与主版本');
  }
  if (ownAssets.length > 0 && !shots.length) {
    requiredInputs.push('可以触发分镜表生成');
  }
  if (shotsBlocked) {
    blockedReasons.push('分镜依赖的上游内容已变化，需要重新生成或修订分镜表');
  }
  if (shotsDirty) {
    blockedReasons.push('分镜已修改，必须先重新收敛故事板');
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
  if (storyboardBlocked) {
    blockedReasons.push('故事板依赖的上游内容已变化，需要重新选择镜头主版本');
  }
  if (storyboardDirty) {
    blockedReasons.push('故事板已修改，必须先重新装配成片');
  }
  if (finalCutBlocked) {
    blockedReasons.push('成片依赖的上游内容已变化，需要重新装配时间线');
  }
  if (finalCutDirty) {
    blockedReasons.push('成片时间线已修改，导出前请重新确认装配结果');
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
        reason: chapters.length === 0 ? '剧本尚未完成' : scriptDirty ? '剧本已修改，需要重新提取主体' : null,
      },
      {
        kind: 'generate_asset_images',
        enabled: ownAssets.length > 0,
        label: '批量生成资产图片',
        reason: ownAssets.length === 0 ? '还没有可生成的主体' : subjectsDirty ? '主体已修改，需要重新生成主版本' : null,
      },
      {
        kind: 'generate_shots',
        enabled: ownAssets.length > 0 && !subjectsDirty,
        label: '生成分镜表',
        reason: ownAssets.length === 0 ? '还没有可引用的主体' : subjectsDirty ? '主体已更新，需要重建分镜表' : null,
      },
      {
        kind: 'generate_shot_images',
        enabled: shots.length > 0 && !hasBrokenAssetRefs && !shotsBlocked,
        label: '生成分镜图片',
        reason:
          shots.length === 0
            ? '分镜表尚未生成'
            : shotsBlocked
              ? '分镜依赖的上游内容已变化'
              : hasBrokenAssetRefs
                ? '存在 broken 资产引用'
                : shotsDirty
                  ? '分镜已修改，需要重新生成图片'
                  : null,
      },
      {
        kind: 'open_storyboard',
        enabled: shotImagesReady && !storyboardBlocked,
        label: '进入故事板',
        reason: storyboardBlocked ? '故事板依赖的上游内容已变化' : shotImagesReady ? null : '分镜图片尚未收敛',
      },
      {
        kind: 'open_final_cut',
        enabled: storyboardReady && !finalCutBlocked,
        label: '进入成片',
        reason: finalCutBlocked ? '成片依赖的上游内容已变化' : storyboardReady ? null : '需要先完成故事板主版本选择',
      },
      {
        kind: 'export_episode',
        enabled: finalCutReady && !hasBrokenAssetRefs && !blockingUsageAlert && !finalCutDirty,
        label: '导出成片',
        reason: finalCutReady
          ? blockingUsageAlert
            ? 'API 用量超限，已阻止导出'
            : hasBrokenAssetRefs
              ? '存在 broken 资产引用'
              : finalCutDirty
                ? '成片时间线已修改，请先确认'
                : null
          : '成片工位尚未装配完成',
      },
    ],
    blockedReasons,
    requiredInputs,
    updatedAt: nowIso(),
  };
}
