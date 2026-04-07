'use client';

import { useRef, useState, useEffect } from 'react';
import { Send, Bot, User, Loader2, AlertCircle, RefreshCw } from 'lucide-react';

import { cn } from '@/lib/utils';
import type { EpisodeWorkspaceView } from '@/lib/view-models/studio';
import type { Proposal } from './canvas-nodes';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  isLoading?: boolean;
}

interface CanvasChatProps {
  view: EpisodeWorkspaceView;
  selectedNodeId?: string | null;
  onProposals?: (proposals: Proposal[]) => void;
}

export function CanvasChat({ view, selectedNodeId, onProposals }: CanvasChatProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: `你好！我是画布 AI 助手。我已加载了本集「${view.episode.title}」的所有内容（${view.chapters.length} 章节、${view.assets.length} 个主体、${view.shots.length} 个分镜）。\n\n你可以问我关于任何内容，或者直接让我帮你修改。`,
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);
    setError(null);

    const assistantId = crypto.randomUUID();
    setMessages((prev) => [
      ...prev,
      { id: assistantId, role: 'assistant', content: '', isLoading: true },
    ]);

    try {
      const apiMessages = messages
        .filter((m) => m.id !== 'welcome')
        .concat(userMsg)
        .map((m) => ({ role: m.role, content: m.content }));

      const res = await fetch('/api/canvas-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          episodeId: view.episode.id,
          messages: apiMessages,
          workspace: { settings: { ai: { mode: '', model: '' } } },
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }

      const data = await res.json() as { reply: string; proposals: Proposal[] };

      setMessages((prev) =>
        prev.map((m) => m.id === assistantId ? { ...m, content: data.reply, isLoading: false } : m),
      );

      if (data.proposals.length > 0) {
        onProposals?.(data.proposals);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : '请求失败';
      setError(msg);
      setMessages((prev) => prev.filter((m) => m.id !== assistantId));
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void sendMessage();
    }
  };

  return (
    <div className="flex h-full flex-col" style={{ background: 'rgba(12,12,16,0.97)' }}>
      {/* header */}
      <div
        className="flex shrink-0 items-center gap-2.5 px-4 py-3"
        style={{ borderBottom: '1px solid rgba(63,63,70,0.45)' }}
      >
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-600/20">
          <Bot size={14} className="text-brand-400" />
        </div>
        <div>
          <p className="text-[13px] font-bold text-zinc-100">画布助手</p>
          <p className="text-[10px] text-zinc-600">
            {view.chapters.length}章 · {view.assets.length}主体 · {view.shots.length}镜
          </p>
        </div>
        {isLoading && <Loader2 size={13} className="ml-auto animate-spin text-brand-400" />}
      </div>

      {/* context hint for selected node */}
      {selectedNodeId && (
        <div className="mx-3 mt-3 shrink-0 rounded-lg bg-brand-500/10 px-3 py-2 text-[11px] text-brand-300">
          已选中节点 <span className="font-mono text-brand-200">{selectedNodeId}</span>，可针对它提问
        </div>
      )}

      {/* messages */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={cn('flex gap-2.5', msg.role === 'user' ? 'flex-row-reverse' : 'flex-row')}
          >
            <div
              className={cn(
                'flex h-6 w-6 shrink-0 items-center justify-center rounded-full mt-0.5',
                msg.role === 'user' ? 'bg-zinc-700' : 'bg-brand-600/30',
              )}
            >
              {msg.role === 'user' ? (
                <User size={11} className="text-zinc-300" />
              ) : (
                <Bot size={11} className="text-brand-400" />
              )}
            </div>
            <div
              className={cn(
                'max-w-[82%] rounded-2xl px-3 py-2 text-[12px] leading-relaxed',
                msg.role === 'user'
                  ? 'rounded-tr-sm bg-brand-600/25 text-zinc-100'
                  : 'rounded-tl-sm bg-zinc-800/80 text-zinc-200',
              )}
            >
              {msg.isLoading ? (
                <Loader2 size={12} className="animate-spin text-zinc-500" />
              ) : (
                msg.content
              )}
            </div>
          </div>
        ))}

        {error && (
          <div className="flex items-start gap-2 rounded-xl bg-red-900/20 p-3 text-[11px] text-red-400">
            <AlertCircle size={12} className="mt-0.5 shrink-0" />
            <span>{error}</span>
            <button
              onClick={() => setError(null)}
              className="ml-auto shrink-0 hover:text-red-300"
            >
              <RefreshCw size={10} />
            </button>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* input */}
      <div
        className="shrink-0 p-3"
        style={{ borderTop: '1px solid rgba(63,63,70,0.35)' }}
      >
        <div className="flex items-end gap-2 rounded-xl border border-zinc-700 bg-zinc-800/60 px-3 py-2 focus-within:border-brand-600/60">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="问我任何关于本集的问题，或让我帮你修改内容..."
            rows={1}
            className="flex-1 resize-none bg-transparent text-[12px] text-zinc-100 placeholder-zinc-600 focus:outline-none"
            style={{ maxHeight: '80px', overflowY: 'auto' }}
          />
          <button
            onClick={() => void sendMessage()}
            disabled={isLoading || !input.trim()}
            className={cn(
              'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors',
              input.trim() && !isLoading
                ? 'bg-brand-600 text-white hover:bg-brand-500'
                : 'bg-zinc-700 text-zinc-600',
            )}
          >
            <Send size={12} />
          </button>
        </div>
        <p className="mt-1.5 text-center text-[9px] text-zinc-700">
          Enter 发送 · Shift+Enter 换行
        </p>
      </div>
    </div>
  );
}
