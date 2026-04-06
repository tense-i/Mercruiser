import { generateId, type UIMessage } from 'ai';

import { buildAgentSystemPrompt } from '@/lib/ai/prompts';
import { studioRepository } from '@/lib/server/repository/studio-repository';

export async function runFallbackAgent(input: {
  prompt: string;
  context: { seriesId?: string; episodeId?: string };
}) {
  const { prompt, context } = input;
  const lowerPrompt = prompt.toLowerCase();
  const episodeView = context.episodeId ? await studioRepository.getEpisodeWorkspaceView(context.episodeId) : null;
  const seriesView = context.seriesId ? await studioRepository.getSeriesView(context.seriesId) : null;

  let text = '';
  const toolCalls: Array<{ id: string; name: string; status: 'completed' | 'failed'; summary: string }> = [];

  if (episodeView && /(生成剧本|原文|script)/i.test(prompt)) {
    const result = (await studioRepository.dispatch({
      type: 'generateScriptFromSource',
      episodeId: episodeView.episode.id,
    })) as { chapterCount: number };
    text = `ScriptAgent 已经根据当前原文为《${episodeView.episode.title}》生成 ${String(result.chapterCount)} 个章节。下一步建议进入主体工位，触发主体提取。`;
    toolCalls.push({
      id: generateId(),
      name: 'generate_script_from_source',
      status: 'completed',
      summary: `generated ${String(result.chapterCount)} chapters`,
    });
  } else if (episodeView && /(提取主体|资产提取|asset)/i.test(prompt)) {
    const result = (await studioRepository.dispatch({
      type: 'extractAssetsFromScript',
      episodeId: episodeView.episode.id,
    })) as { assetCount: number };
    text = `AssetAgent 已完成主体提取，当前集数共有 ${String(result.assetCount)} 个主体。建议接着批量生成资产图并选定主版本，解锁分镜工位。`;
    toolCalls.push({
      id: generateId(),
      name: 'extract_assets_from_script',
      status: 'completed',
      summary: `extracted ${String(result.assetCount)} assets`,
    });
  } else if (episodeView && /(生成资产图|资产图片|render asset)/i.test(prompt)) {
    const result = (await studioRepository.dispatch({
      type: 'generateAssetImages',
      episodeId: episodeView.episode.id,
    })) as { renderedCount: number };
    text = `我已经为《${episodeView.episode.title}》完成 ${String(result.renderedCount)} 个主体的主版本图片。现在分镜工位的门禁应该已经放开，可以生成分镜表。`;
    toolCalls.push({
      id: generateId(),
      name: 'generate_asset_images',
      status: 'completed',
      summary: `rendered ${String(result.renderedCount)} assets`,
    });
  } else if (episodeView && /(生成分镜图|镜头图片|render shot)/i.test(prompt)) {
    const result = (await studioRepository.dispatch({
      type: 'generateShotImages',
      episodeId: episodeView.episode.id,
    })) as { renderedCount: number };
    text = `我已经为《${episodeView.episode.title}》完成 ${String(result.renderedCount)} 条分镜图的主版本生成。现在故事板与成片工位都可以继续向下推进。`;
    toolCalls.push({
      id: generateId(),
      name: 'generate_shot_images',
      status: 'completed',
      summary: `rendered ${String(result.renderedCount)} shot images`,
    });
  } else if (episodeView && /(分镜|镜头|shot|storyboard|拆解)/i.test(prompt)) {
    const result = (await studioRepository.dispatch({
      type: 'generateShotsFromChapters',
      episodeId: episodeView.episode.id,
    })) as { generatedCount: number };
    text = `ProductionAgent 已基于当前章节为《${episodeView.episode.title}》生成 ${String(result.generatedCount)} 条结构化镜头草案，并同步补齐了故事板卡片。接下来建议先检查 continuity，再锁定 selected take 进入成片。`;
    toolCalls.push({
      id: generateId(),
      name: 'generate_shots_from_chapters',
      status: 'completed',
      summary: `generated ${String(result.generatedCount)} shots`,
    });
  } else if (episodeView && /(共享资产|shared asset|升级主体)/i.test(lowerPrompt)) {
    const candidate = episodeView.assets.find((asset) => !asset.isShared) ?? episodeView.assets[0];
    if (candidate) {
      await studioRepository.dispatch({
        type: 'promoteAssetToShared',
        assetId: candidate.id,
      });
      text = `我已经把 ${candidate.name} 提升为系列共享主体。建议现在回到系列详情页确认它的主版本、状态命名和 voice 绑定是否适合作为后续集数继承基线。`;
      toolCalls.push({
        id: generateId(),
        name: 'promote_asset_to_shared',
        status: 'completed',
        summary: `promoted ${candidate.name}`,
      });
    }
  }

  if (!text) {
    const promptContext = buildAgentSystemPrompt({ episodeView, seriesView });
    if (episodeView) {
      const blockedTasks = episodeView.tasks.filter((task) => task.status !== 'completed');
      const riskyShot = episodeView.shots.find((shot) => shot.continuityStatus !== 'clear');
      text = [
        `基于当前工作区，《${episodeView.episode.title}》当前处于 ${episodeView.gate?.currentStage ?? episodeView.episode.currentStage} 阶段。`,
        episodeView.gate?.blockedReasons.length ? `当前门禁阻塞：${episodeView.gate.blockedReasons.join('；')}` : '当前没有硬门禁阻塞，可以继续推进下一阶段。',
        riskyShot ? `优先修复镜头《${riskyShot.title}》的连戏风险：${riskyShot.continuityIssues.map((issue) => issue.message).join('；')}` : '当前镜头没有严重的 continuity 错误，可以直接收敛 selected takes。',
        blockedTasks.length ? `任务中心里还有 ${blockedTasks.length} 个未完成任务，最该优先处理的是「${blockedTasks[0]?.title}」。` : '当前没有挂起的失败任务，可以把更多时间留给主体升级和成片装配。',
        `参考上下文：${promptContext.split('\n').slice(-3).join(' / ')}`,
      ].join('\n');
    } else if (seriesView) {
      text = `系列《${seriesView.series.name}》当前最值得推进的是共享主体与系列策略治理：你已经有 ${seriesView.sharedAssets.length} 个共享资产，但仍需要把最近一集沉淀出来的有效提示词和恢复策略写回系列规则。`;
    } else {
      const dashboard = await studioRepository.getDashboardView();
      text = `当前工作区有 ${dashboard.series.length} 个系列，其中 ${dashboard.stats[1]?.value} 个正在生产。建议先进入最近更新的系列，围绕原文导入 -> 剧本 -> 主体 -> 分镜 -> 故事板 -> 成片这条新版主线逐站推进。`;
    }
  }

  const scopeId = context.episodeId ?? context.seriesId ?? 'workspace';
  await studioRepository.appendAgentRun({
    scopeType: context.episodeId ? 'episode' : context.seriesId ? 'series' : 'workspace',
    scopeId,
    prompt,
    summary: text,
    status: 'completed',
    toolCalls,
    completedAt: new Date().toISOString(),
  });

  return { text, toolCalls };
}

export function extractLatestUserText(messages: UIMessage[]) {
  const latestMessage = [...messages].reverse().find((message) => message.role === 'user');
  if (!latestMessage) {
    return '请基于当前工作区给出下一步建议。';
  }

  return latestMessage.parts
    .map((part) => {
      if ('text' in part && typeof part.text === 'string') {
        return part.text;
      }
      return '';
    })
    .join('\n')
    .trim();
}
