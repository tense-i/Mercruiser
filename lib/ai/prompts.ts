import type { EpisodeWorkspaceView, SeriesView } from '@/lib/view-models/studio';

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
    contextLines.push(
      '',
      `当前系列：${seriesView.series.name}`,
      `系列状态：${seriesView.series.status}`,
      `共享主体数：${seriesView.sharedAssets.length}`,
      `集数：${seriesView.episodes.length}`,
    );
  }

  if (episodeView) {
    contextLines.push(
      '',
      `当前集数：第 ${episodeView.episode.index} 集《${episodeView.episode.title}》`,
      `当前阶段：${episodeView.gate?.currentStage ?? episodeView.episode.currentStage}`,
      `工位进度：${JSON.stringify(episodeView.episode.stationStates)}`,
      `章节数：${episodeView.chapters.length}`,
      `主体数：${episodeView.assets.length}`,
      `镜头数：${episodeView.shots.length}`,
      `任务数：${episodeView.tasks.length}`,
    );
    if (episodeView.gate?.blockedReasons.length) {
      contextLines.push(`当前门禁阻塞：${episodeView.gate.blockedReasons.join('；')}`);
    }
  }

  return contextLines.join('\n');
}
