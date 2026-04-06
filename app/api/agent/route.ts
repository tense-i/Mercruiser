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
import { extractLatestUserText, runFallbackAgent } from '@/lib/ai/agent-service';
import { assertLocalMutationRequest } from '@/lib/server/request-guard';
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
  const episodeView = safeContext.episodeId ? await studioRepository.getEpisodeWorkspaceView(safeContext.episodeId) : null;
  const seriesView = safeContext.seriesId ? await studioRepository.getSeriesView(safeContext.seriesId) : null;

  const stream = createUIMessageStream({
    originalMessages: messages,
    async execute({ writer }) {
      const latestPrompt = extractLatestUserText(messages);
      const mode = getConfiguredAiMode();

      if (mode === 'mock' || !hasRealCredentials()) {
        const fallback = await runFallbackAgent({
          prompt: latestPrompt,
          context: safeContext,
        });
        const blockId = generateId();
        writer.write({ type: 'text-start', id: blockId });
        writer.write({ type: 'text-delta', id: blockId, delta: fallback.text });
        writer.write({ type: 'text-end', id: blockId });
        return;
      }

      const toolCallsLog: Array<{ id: string; name: string; status: 'pending' | 'completed' | 'failed'; summary: string }> = [];
      const result = streamText({
        model: getStudioModel(),
        system: buildAgentSystemPrompt({ episodeView, seriesView }),
        messages: await convertToModelMessages(messages),
        tools: createStudioTools(safeContext),
        stopWhen: stepCountIs(6),
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
