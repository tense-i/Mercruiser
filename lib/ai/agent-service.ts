import type { UIMessage } from 'ai';

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
