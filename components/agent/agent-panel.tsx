'use client';

import { DefaultChatTransport } from 'ai';
import { useChat } from '@ai-sdk/react';
import { Bot, RefreshCcw, SendHorizonal } from 'lucide-react';
import { useState } from 'react';

import { cn, formatDate } from '@/lib/utils';

interface AgentPanelProps {
  seriesId?: string;
  episodeId?: string;
  onSync: () => void;
}

export function AgentPanel({ seriesId, episodeId, onSync }: AgentPanelProps) {
  const [draft, setDraft] = useState('');
  const chat = useChat({
    transport: new DefaultChatTransport({
      api: '/api/agent',
    }),
  });

  const sendPrompt = async () => {
    const input = draft.trim();
    if (!input) {
      return;
    }

    setDraft('');
    await chat.sendMessage(
      { text: input },
      {
        body: {
          context: {
            seriesId,
            episodeId,
          },
        },
      },
    );
  };

  return (
    <section className="panel flex h-full flex-col rounded-[28px] p-5">
      <div className="flex items-center justify-between gap-3 border-b border-white/6 pb-4">
        <div className="flex items-center gap-2 text-sm text-white">
          <Bot className="h-4 w-4 text-orange-300" />
          <span>Production Agent</span>
        </div>
        <button
          type="button"
          onClick={onSync}
          className="rounded-full border border-white/8 px-3 py-1 text-xs text-slate-400 transition hover:border-white/15 hover:text-white"
        >
          <span className="inline-flex items-center gap-1">
            <RefreshCcw className="h-3.5 w-3.5" />
            同步工作区
          </span>
        </button>
      </div>

      <div className="mt-4 flex-1 space-y-3 overflow-y-auto pr-1">
        {chat.messages.length === 0 ? (
          <div className="rounded-[24px] border border-dashed border-white/10 bg-white/[0.03] px-4 py-5 text-sm leading-6 text-slate-400">
            可以直接问：
            <br />
            “第二集下一步先做什么？”
            <br />
            “根据当前章节拆分分镜”
            <br />
            “把可复用主体升级成共享资产”
          </div>
        ) : (
          chat.messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                'rounded-[24px] px-4 py-3 text-sm leading-6',
                message.role === 'user' ? 'bg-orange-500/12 text-orange-50' : 'bg-white/[0.04] text-slate-200',
              )}
            >
              <div className="mb-2 flex items-center justify-between gap-3">
                <span className="text-xs uppercase tracking-[0.18em] text-slate-500">{message.role}</span>
                <span className="text-[11px] text-slate-500">{formatDate(new Date().toISOString())}</span>
              </div>
              <div className="space-y-2">
                {message.parts.map((part, index) => {
                  if ('text' in part && typeof part.text === 'string') {
                    return (
                      <p key={`${message.id}-${index}`} className="whitespace-pre-wrap">
                        {part.text}
                      </p>
                    );
                  }

                  return (
                    <pre
                      key={`${message.id}-${index}`}
                      className="overflow-x-auto rounded-2xl border border-white/6 bg-black/20 p-3 text-xs text-slate-300"
                    >
                      {JSON.stringify(part, null, 2)}
                    </pre>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>

      <div className="mt-4 space-y-3">
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          rows={4}
          placeholder="告诉 Agent 你想推进的工位或动作..."
          className="w-full rounded-[24px] border border-white/8 bg-black/10 px-4 py-3 text-sm leading-6 text-white outline-none transition placeholder:text-slate-500 focus:border-orange-300/30"
        />
        <button
          type="button"
          onClick={() => {
            void sendPrompt();
          }}
          disabled={!draft.trim() || chat.status === 'streaming' || chat.status === 'submitted'}
          className="flex w-full items-center justify-center gap-2 rounded-[20px] bg-orange-500 px-4 py-3 text-sm font-medium text-white transition hover:bg-orange-400 disabled:cursor-not-allowed disabled:bg-orange-500/40"
        >
          <SendHorizonal className="h-4 w-4" />
          {chat.status === 'streaming' || chat.status === 'submitted' ? 'Agent 正在处理...' : '发送给 Agent'}
        </button>
      </div>
    </section>
  );
}
