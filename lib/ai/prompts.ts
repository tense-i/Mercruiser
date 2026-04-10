import type { EpisodeWorkspaceView, SeriesView } from '@/lib/view-models/studio';

const STATION_LABELS: Record<string, string> = {
  idle: '未开始',
  pending: '待处理',
  ready: '已完成',
  editing: '编辑中',
  processing: '生成中',
  failed: '失败',
};

function stationLabel(state: string) {
  return STATION_LABELS[state] ?? state;
}

export function buildAgentSystemPrompt(input: {
  seriesView?: SeriesView | null;
  episodeView?: EpisodeWorkspaceView | null;
}) {
  const { seriesView, episodeView } = input;

  const contextLines = [
    '你是 Mercruiser Studio 的本地生产协调 Agent。',
    '目标：根据当前 PRD 和工作区状态，帮助用户推进系列治理与单集工业化生产线。',
    '规则：',
    '1. 优先使用工具读取或更新本地工作区，不要编造当前状态。',
    '2. 回答要具体到当前工位、当前阻塞和下一步行动。',
    '3. 如果执行了写操作，要说明影响了哪些对象。',
    '4. 语言保持简洁、专业、可执行。',
  ];

  if (seriesView) {
    contextLines.push('', `## 系列：${seriesView.series.name}`);
    contextLines.push(`- 状态：${seriesView.series.status}，共 ${seriesView.episodes.length} 集`);
    if (seriesView.sharedAssets.length) {
      contextLines.push(`- 系列共享主体（${seriesView.sharedAssets.length} 个）：`);
      for (const asset of seriesView.sharedAssets.slice(0, 6)) {
        const anchors = (asset as { consistencyAnchors?: string[] }).consistencyAnchors;
        const anchorNote = anchors?.length ? `（锚点：${anchors.join(' / ')}）` : '';
        contextLines.push(`  · ${asset.name}（${asset.type}）${anchorNote}`);
      }
      if (seriesView.sharedAssets.length > 6) {
        contextLines.push(`  · …另有 ${seriesView.sharedAssets.length - 6} 个`);
      }
    }
  }

  if (episodeView) {
    const s = episodeView.episode.stationStates as Record<string, string>;
    const stage = episodeView.gate?.currentStage ?? episodeView.episode.currentStage;
    contextLines.push('', `## 当前集：第 ${episodeView.episode.index} 集《${episodeView.episode.title}》`);
    contextLines.push(`- 当前阶段：${stage}`);
    contextLines.push('- 生产线工位：');
    contextLines.push(`  · 剧本：${stationLabel(s.script ?? '')}（${episodeView.chapters.length} 章节）`);
    contextLines.push(`  · 主体：${stationLabel(s.subjects ?? '')}（${episodeView.assets.length} 个主体）`);
    contextLines.push(`  · 分镜：${stationLabel(s.shots ?? '')}（${episodeView.shots.length} 条镜头）`);
    if (s.storyboard) contextLines.push(`  · 故事板：${stationLabel(s.storyboard)}`);
    if (s.finalCut) contextLines.push(`  · 成片：${stationLabel(s.finalCut)}`);

    if (episodeView.gate?.blockedReasons.length) {
      contextLines.push(`- ⚠️ 门禁阻塞：${episodeView.gate.blockedReasons.join('；')}`);
    }

    const pendingTasks = episodeView.tasks.filter((t) => t.status !== 'completed');
    if (pendingTasks.length) {
      contextLines.push(`- 待处理任务（${pendingTasks.length} 个）：`);
      for (const task of pendingTasks.slice(0, 3)) {
        contextLines.push(`  · [${task.status}] ${task.title}`);
      }
    }

    const riskyShots = episodeView.shots.filter((sh) => sh.continuityStatus !== 'clear');
    if (riskyShots.length) {
      contextLines.push(`- ⚠️ Continuity 风险镜头（${riskyShots.length} 条）：${riskyShots.slice(0, 3).map((sh) => sh.title).join('、')}`);
    }
  }

  return contextLines.join('\n');
}
