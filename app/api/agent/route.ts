import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  generateId,
  stepCountIs,
  streamText,
  type UIMessage,
} from 'ai';

import { getConfiguredAiMode, getStudioModel, hasRealCredentials } from '@/lib/ai/provider';
import { buildAgentSystemPrompt } from '@/lib/ai/prompts';
import { createStudioTools } from '@/lib/ai/tools';
import { extractLatestUserText } from '@/lib/ai/agent-service';
import { assertLocalMutationRequest } from '@/lib/server/request-guard';
import { readConfig, getEffectiveApiKey } from '@/lib/server/config-store';
import { studioRepository } from '@/lib/server/repository/studio-repository';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request: Request) {
  const guard = assertLocalMutationRequest(request);
  if (guard) {
    return guard;
  }
  const { messages, context }: { messages: UIMessage[]; context?: { seriesId?: string; episodeId?: string } } = await request.json();
  const safeContext = context ?? {};

  const [workspace, config] = await Promise.all([
    studioRepository.getWorkspace(),
    readConfig(),
  ]);
  const aiSettings = workspace.settings.ai;

  // Resolve active provider: workspace settings override, then config.toml default
  const resolvedMode = aiSettings.mode || config.defaultProviderId;
  const resolvedModel = aiSettings.model || config.defaultModel;
  const configProvider = config.providers.find((p) => p.id === resolvedMode && p.enabled);
  // getEffectiveApiKey checks entry.apiKey first, then env vars — covers both sources
  const resolvedApiKey = configProvider ? getEffectiveApiKey(configProvider) : undefined;

  const modelInput = {
    settingsMode: resolvedMode,
    settingsModel: resolvedModel,
    apiKey: resolvedApiKey,
    // Only pass baseUrl/providerType for custom (non-built-in) providers
    baseUrl: configProvider?.isCustom ? configProvider.baseUrl : null,
    providerType: configProvider?.isCustom ? configProvider.type : null,
  };

  const episodeView = safeContext.episodeId ? await studioRepository.getEpisodeWorkspaceView(safeContext.episodeId) : null;
  const seriesView = safeContext.seriesId ? await studioRepository.getSeriesView(safeContext.seriesId) : null;

  const stream = createUIMessageStream({
    originalMessages: messages,
    async execute({ writer }) {
      const latestPrompt = extractLatestUserText(messages);
      const mode = getConfiguredAiMode({ settingsMode: resolvedMode });

      // Graceful no-credentials path: inform user instead of running a fake agent
      if (mode === 'mock' || !hasRealCredentials(mode, resolvedApiKey)) {
        const blockId = generateId();
        writer.write({ type: 'text-start', id: blockId });
        writer.write({
          type: 'text-delta',
          id: blockId,
          delta: '尚未配置有效的 AI 供应商凭证。请前往设置页面配置 API Key，然后再使用 Agent。',
        });
        writer.write({ type: 'text-end', id: blockId });
        return;
      }

      const model = getStudioModel(modelInput);
      const systemPrompt = [aiSettings.systemPrompt, aiSettings.skillPrompt, buildAgentSystemPrompt({ episodeView, seriesView })]
        .map((part) => part.trim())
        .filter(Boolean)
        .join('\n\n');

      const toolCallsLog: Array<{ id: string; name: string; status: 'pending' | 'completed' | 'failed'; summary: string }> = [];

      const result = streamText({
        model,
        system: systemPrompt,
        messages: await convertToModelMessages(messages),
        tools: createStudioTools(safeContext, { getModel: () => model }),
        stopWhen: stepCountIs(8),
        onStepFinish: ({ toolCalls, toolResults }) => {
          toolCalls.forEach((call, index) => {
            toolCallsLog.push({
              id: call.toolCallId,
              name: call.toolName,
              status: 'completed',
              summary: JSON.stringify(toolResults[index]?.output ?? {}),
            });
          });
        },
      });

      writer.merge(result.toUIMessageStream());

      const final = await result;
      await studioRepository.appendAgentRun({
        scopeType: safeContext.episodeId ? 'episode' : safeContext.seriesId ? 'series' : 'workspace',
        scopeId: safeContext.episodeId ?? safeContext.seriesId ?? 'workspace',
        prompt: latestPrompt,
        summary: await final.text,
        status: 'completed',
        toolCalls: toolCallsLog,
        completedAt: new Date().toISOString(),
      });
    },
    onError: () => 'Agent error',
  });

  return createUIMessageStreamResponse({ stream });
}
