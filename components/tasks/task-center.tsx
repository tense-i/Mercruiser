'use client';

import { startTransition, useState } from 'react';
import { ArrowUpRight, AlertTriangle } from 'lucide-react';

import type { TaskRecord } from '@/lib/domain/types';
import { formatDate } from '@/lib/utils';

export function TaskCenter({ initialTasks }: { initialTasks: TaskRecord[] }) {
  const [tasks, setTasks] = useState(initialTasks);
  const [filter, setFilter] = useState<'all' | 'running' | 'failed'>('all');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const refresh = async () => {
    const response = await fetch('/api/studio?view=tasks');
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error ?? '无法刷新任务列表');
    }
    setTasks(payload.tasks);
  };

  const retryTask = async (taskId: string) => {
    try {
      const response = await fetch(`/api/tasks/${taskId}/retry`, { method: 'POST' });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? '任务重试失败');
      }
      setErrorMessage(null);
      await refresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '任务重试失败');
    }
  };

  const visibleTasks = tasks.filter((task) => filter === 'all' || task.status === filter);

  return (
    <div className="space-y-5">
      <section className="rounded-3xl border border-white/10 bg-[#0f131a] shadow-[0_20px_80px_rgba(0,0,0,0.25)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/6 px-5 py-4">
          <div>
            <div className="text-sm font-medium tracking-wide text-white">任务中心</div>
            <div className="mt-1 text-xs text-white/45">查看失败原因、重试任务，并回溯到对应工位。</div>
          </div>
          <div className="flex items-center gap-2">
            {(['all', 'running', 'failed'] as const).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setFilter(item)}
                className={`rounded-2xl border px-4 py-2 text-sm font-medium transition ${
                  filter === item
                    ? 'border-[#f2dfbe]/30 bg-[#f2dfbe]/10 text-[#f5e7cf]'
                    : 'border-white/10 bg-white/[0.03] text-white/72 hover:bg-white/[0.06]'
                }`}
              >
                {item}
              </button>
            ))}
          </div>
        </div>

        <div className="p-5">
          {errorMessage ? (
            <div className="mb-4 rounded-2xl border border-rose-400/20 bg-rose-500/15 px-4 py-3 text-sm text-rose-100">{errorMessage}</div>
          ) : null}

          <div className="space-y-3">
            {visibleTasks.map((task) => (
              <div key={task.id} className="rounded-[28px] border border-white/8 bg-[#131922] p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.2em] text-white/35">
                      {task.kind} / {task.targetType}
                    </div>
                    <h3 className="mt-1 text-xl font-semibold text-white">{task.title}</h3>
                    <p className="mt-3 max-w-3xl text-sm leading-6 text-white/58">{task.description}</p>
                    {task.error ? (
                      <p className="mt-2 inline-flex items-center gap-2 rounded-full border border-rose-400/20 bg-rose-500/12 px-3 py-1 text-xs text-rose-100">
                        <AlertTriangle size={12} />
                        {task.error}
                      </p>
                    ) : null}
                    <p className="mt-3 text-xs text-white/40">回溯位置：{task.link}</p>
                  </div>

                  <div className="space-y-3 text-right">
                    <div className="rounded-full border border-white/8 px-3 py-1 text-xs text-white/60">{task.status}</div>
                    <p className="text-xs text-white/40">{formatDate(task.updatedAt)}</p>
                    {task.retryable ? (
                      <button
                        type="button"
                        onClick={() => {
                          startTransition(() => {
                            void retryTask(task.id);
                          });
                        }}
                        className="rounded-full bg-[#f2dfbe] px-4 py-2 text-sm font-medium text-[#111] transition hover:brightness-105"
                      >
                        重试任务
                      </button>
                    ) : null}
                  </div>
                </div>

                {task.logs.length > 0 ? (
                  <div className="mt-5 rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-white/35">Logs</div>
                    <div className="mt-3 space-y-2">
                      {task.logs.map((log) => (
                        <div key={log} className="flex items-start gap-2 text-sm text-white/72">
                          <ArrowUpRight size={14} className="mt-0.5 text-white/30" />
                          <span>{log}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
