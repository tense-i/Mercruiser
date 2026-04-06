'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Film, FolderInput, PlusCircle } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';

import { readSourceFile } from '@/lib/source-file';
import type { DashboardView } from '@/lib/view-models/studio';
import { cn } from '@/lib/utils';

export function DashboardHome({ dashboard }: { dashboard: DashboardView }) {
  const router = useRouter();
  const [pending, setPending] = useState<'createSeries' | 'importSeries' | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [createDraft, setCreateDraft] = useState({ name: '', description: '' });
  const [importDraft, setImportDraft] = useState({
    name: '',
    description: '',
    sourceTitle: '',
    firstEpisodeTitle: '',
    content: '',
    importType: 'text' as 'text' | 'file',
    fileName: '',
  });
  const importFileRef = useRef<HTMLInputElement | null>(null);
  const primarySeries = dashboard.series[0] ?? null;
  const recentSeries = useMemo(
    () => [...dashboard.series].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)).slice(0, 3),
    [dashboard.series],
  );

  async function dispatch(command: Record<string, unknown>) {
    setPending(String(command.type) as 'createSeries' | 'importSeries');
    try {
      const response = await fetch('/api/studio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.result) {
        throw new Error(payload.error ?? '操作失败');
      }
      setErrorMessage(null);
      return payload;
    } catch (error) {
      const message = error instanceof Error ? error.message : '操作失败';
      setErrorMessage(message);
      return null;
    } finally {
      setPending(null);
    }
  }

  async function handleCreateSeries() {
    const name = createDraft.name.trim();
    const description = createDraft.description;

    if (!name) {
      setErrorMessage('系列名称不能为空');
      return;
    }

    const payload = await dispatch({ type: 'createSeries', name, description });
    const seriesId = payload?.result?.series?.id as string | undefined;
    if (seriesId) {
      router.push(`/series/${seriesId}`);
    }
  }

  async function handleImportSeries() {
    const name = importDraft.name.trim();
    const description = importDraft.description;
    const sourceTitle = importDraft.sourceTitle.trim();
    const firstEpisodeTitle = importDraft.firstEpisodeTitle.trim();
    const content = importDraft.content.trim();

    if (!name || !sourceTitle || !content || !firstEpisodeTitle) {
      setErrorMessage('导入创建需要填写系列名称、原文标题、首集标题和原文内容');
      return;
    }

    const payload = await dispatch({
      type: 'importSeries',
      name,
      description,
      importType: importDraft.importType,
      sourceTitle,
      firstEpisodeTitle,
      content,
    });
    const seriesId = payload?.result?.series?.id as string | undefined;
    if (seriesId) {
      router.push(`/series/${seriesId}`);
    }
  }

  async function handleImportFile(file: File | null) {
    if (!file) {
      return;
    }

    try {
      const parsed = await readSourceFile(file);
      setImportDraft((current) => ({
        ...current,
        importType: 'file',
        fileName: parsed.fileName,
        sourceTitle: parsed.title,
        firstEpisodeTitle: current.firstEpisodeTitle || parsed.title,
        name: current.name || parsed.title,
        content: parsed.content,
      }));
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '读取上传文件失败');
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      {errorMessage ? (
        <div className="rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{errorMessage}</div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1.3fr_0.9fr]">
        <div className="glass-panel rounded-3xl p-8">
          <div className="mb-8 flex items-start justify-between gap-6">
            <div>
              <h2 className="mb-1 text-3xl font-bold tracking-tight">Series control center</h2>
              <p className="max-w-2xl text-zinc-400">Launch a new series, import an existing draft into a fresh series shell, or jump back into the latest production lane.</p>
            </div>
            <Link
              href={primarySeries ? `/series/${primarySeries.id}` : '/tasks'}
              className="flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2 font-medium text-white shadow-lg shadow-brand-600/20 transition-all hover:scale-105 hover:bg-brand-500 active:scale-95"
            >
              {primarySeries ? 'Continue Series' : 'Open Task Center'}
            </Link>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            {dashboard.stats.map((stat) => (
              <div key={stat.label} className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
                <div className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-500">{stat.label}</div>
                <div className="mt-3 text-3xl font-bold text-zinc-100">{stat.value}</div>
              </div>
            ))}
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {recentSeries.map((series) => (
              <Link
                key={series.id}
                href={`/series/${series.id}`}
                className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4 transition-colors hover:border-brand-500/40"
              >
                <div className="flex items-center justify-between">
                  <StatusBadge status={series.status} />
                  <span className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">{series.episodeIds.length} EPs</span>
                </div>
                <div className="mt-4 text-lg font-bold text-zinc-100">{series.name}</div>
                <p className="mt-2 line-clamp-2 text-sm text-zinc-500">{series.description}</p>
              </Link>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <ActionCard
            icon={<PlusCircle size={18} className="text-brand-300" />}
            title="新建系列"
            description="首页 P0 入口：名称必填、名称不重复、创建后进入系列详情并保持 setting 初始状态。"
            actionLabel={pending === 'createSeries' ? 'Creating…' : 'Create Series'}
            onAction={() => void handleCreateSeries()}
            disabled={pending !== null}
          >
            <input
              id="series-name"
              maxLength={50}
              value={createDraft.name}
              onChange={(event) => setCreateDraft((current) => ({ ...current, name: event.target.value }))}
              placeholder="Series name"
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-brand-500 focus:outline-none"
            />
            <textarea
              id="series-description"
              value={createDraft.description}
              onChange={(event) => setCreateDraft((current) => ({ ...current, description: event.target.value }))}
              placeholder="Series summary (optional)"
              className="mt-3 h-24 w-full resize-none rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-sm text-zinc-200 focus:border-brand-500 focus:outline-none"
            />
          </ActionCard>

          <ActionCard
            icon={<FolderInput size={18} className="text-brand-300" />}
            title="导入创建"
            description="支持粘贴原文或直接上传 .txt / .md，导入后自动触发 Agent 分析全文并生成首集剧本。"
            actionLabel={pending === 'importSeries' ? 'Importing…' : 'Import as Series'}
            onAction={() => void handleImportSeries()}
            disabled={pending !== null}
          >
            <input
              id="import-series-name"
              maxLength={50}
              value={importDraft.name}
              onChange={(event) => setImportDraft((current) => ({ ...current, name: event.target.value, importType: 'text' }))}
              placeholder="Imported series name"
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-brand-500 focus:outline-none"
            />
            <textarea
              id="import-series-description"
              value={importDraft.description}
              onChange={(event) => setImportDraft((current) => ({ ...current, description: event.target.value }))}
              placeholder="Imported series summary (optional)"
              className="mt-3 h-20 w-full resize-none rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-sm text-zinc-200 focus:border-brand-500 focus:outline-none"
            />
            <input
              id="import-source-title"
              value={importDraft.sourceTitle}
              onChange={(event) => setImportDraft((current) => ({ ...current, sourceTitle: event.target.value, importType: 'text' }))}
              placeholder="Source title"
              className="mt-3 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-brand-500 focus:outline-none"
            />
            <input
              id="import-episode-title"
              value={importDraft.firstEpisodeTitle}
              onChange={(event) => setImportDraft((current) => ({ ...current, firstEpisodeTitle: event.target.value }))}
              placeholder="Initial episode title"
              className="mt-3 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-brand-500 focus:outline-none"
            />
            <textarea
              id="import-source-content"
              value={importDraft.content}
              onChange={(event) => setImportDraft((current) => ({ ...current, content: event.target.value, importType: 'text' }))}
              placeholder="Paste the imported text here"
              className="mt-3 h-28 w-full resize-none rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-sm text-zinc-200 focus:border-brand-500 focus:outline-none"
            />
            <input
              ref={importFileRef}
              type="file"
              accept=".txt,.md,text/plain,text/markdown"
              className="hidden"
              onChange={(event) => {
                void handleImportFile(event.target.files?.[0] ?? null);
                event.currentTarget.value = '';
              }}
            />
            <button
              type="button"
              onClick={() => importFileRef.current?.click()}
              className="mt-3 w-full rounded-lg border border-zinc-700 bg-zinc-900 py-2 text-sm font-medium text-zinc-100 transition-colors hover:border-brand-500/40 hover:bg-zinc-800"
            >
              {importDraft.fileName ? `已选择文件：${importDraft.fileName}` : '上传 .txt / .md 原文文件'}
            </button>
          </ActionCard>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {dashboard.series.map((series) => (
          <Link
            key={series.id}
            href={`/series/${series.id}`}
            className="group glass-panel overflow-hidden rounded-3xl transition-all hover:border-brand-500/50 hover:shadow-2xl hover:shadow-brand-500/10"
          >
            <div className="relative aspect-video overflow-hidden">
              <div className="h-full w-full bg-gradient-to-br from-zinc-800 via-zinc-900 to-zinc-950" />
              <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/20 to-transparent" />
              <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between">
                <StatusBadge status={series.status} />
                <div className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-black/40 px-2 py-1 backdrop-blur-md">
                  <Film size={12} className="text-zinc-400" />
                  <span className="text-[10px] font-bold text-white">{series.episodeIds.length} EPs</span>
                </div>
              </div>
            </div>
            <div className="p-6">
              <h3 className="mb-2 text-xl font-bold transition-colors group-hover:text-brand-400">{series.name}</h3>
              <p className="mb-6 line-clamp-2 text-sm leading-relaxed text-zinc-500">{series.description}</p>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-zinc-400">Production Progress</span>
                  <span className="font-bold text-zinc-100">{series.progress}%</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
                  <div className="h-full rounded-full bg-gradient-to-r from-brand-600 to-brand-400" style={{ width: `${series.progress}%` }} />
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="glass-panel rounded-3xl p-6">
          <h3 className="text-sm font-bold text-zinc-100">Usage Summary</h3>
          <p className="mt-3 text-sm text-zinc-400">
            {dashboard.usageSummary.currency} {dashboard.usageSummary.totalCost.toFixed(2)} across {dashboard.usageSummary.requestCount} tracked calls.
          </p>
        </div>
        <div className="glass-panel rounded-3xl p-6">
          <h3 className="text-sm font-bold text-zinc-100">Alert State</h3>
          <p className="mt-3 text-sm text-zinc-400">
            {dashboard.usageSummary.alerts.filter((alert) => alert.status !== 'normal').length} active usage alerts in the local workspace.
          </p>
        </div>
      </div>
    </div>
  );
}

function ActionCard({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  disabled,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
  disabled: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="glass-panel rounded-3xl p-6">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500/10">{icon}</div>
        <div>
          <h3 className="font-bold text-zinc-100">{title}</h3>
          <p className="text-xs text-zinc-500">{description}</p>
        </div>
      </div>
      {children}
      <button
        type="button"
        onClick={onAction}
        disabled={disabled}
        className="mt-4 w-full rounded-xl bg-brand-600 py-3 text-sm font-bold text-white shadow-lg shadow-brand-600/20 transition-colors hover:bg-brand-500 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500"
      >
        {actionLabel}
      </button>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config = {
    initialized: { color: 'bg-blue-500/10 text-blue-400 border-blue-500/20', label: 'Initialized' },
    producing: { color: 'bg-brand-500/10 text-brand-400 border-brand-500/20', label: 'Producing' },
    partial_done: { color: 'bg-amber-500/10 text-amber-400 border-amber-500/20', label: 'Partial' },
    done: { color: 'bg-green-500/10 text-green-400 border-green-500/20', label: 'Completed' },
    paused: { color: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20', label: 'Paused' },
    setting: { color: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20', label: 'Setting' },
  } as const;

  const item = config[status as keyof typeof config] ?? config.initialized;

  return <span className={cn('rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest', item.color)}>{item.label}</span>;
}
