import { describe, expect, it } from 'vitest';
import type { UIMessage } from 'ai';

import { extractLatestUserText } from '@/lib/ai/agent-service';

function makeUserMessage(text: string): UIMessage {
  return { id: '1', role: 'user', parts: [{ type: 'text', text }] };
}

function makeAssistantMessage(text: string): UIMessage {
  return { id: '2', role: 'assistant', parts: [{ type: 'text', text }] };
}

describe('extractLatestUserText', () => {
  it('returns the text from the latest user message', () => {
    const messages: UIMessage[] = [
      makeUserMessage('第一条消息'),
      makeAssistantMessage('助手回复'),
      makeUserMessage('最新用户消息'),
    ];
    expect(extractLatestUserText(messages)).toBe('最新用户消息');
  });

  it('returns default prompt when no user message exists', () => {
    const messages: UIMessage[] = [makeAssistantMessage('仅助手消息')];
    expect(extractLatestUserText(messages)).toBe('请基于当前工作区给出下一步建议。');
  });

  it('returns default prompt for empty message list', () => {
    expect(extractLatestUserText([])).toBe('请基于当前工作区给出下一步建议。');
  });

  it('concatenates multiple text parts in the latest user message', () => {
    const message: UIMessage = {
      id: '1',
      role: 'user',
      parts: [
        { type: 'text', text: '第一段' },
        { type: 'text', text: '第二段' },
      ],
    };
    expect(extractLatestUserText([message])).toBe('第一段\n第二段');
  });
});
