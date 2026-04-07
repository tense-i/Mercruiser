'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Activity, Film, FolderInput, Layers, PlusCircle, TrendingUp, Upload } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';

import { readSourceFile } from '@/lib/source-file';
import type { DashboardView } from '@/lib/view-models/studio';
import { cn } from '@/lib/utils';
import { Dialog, DialogField, DialogFooter, DialogButton, DialogDivider } from '@/components/ui/dialog';

export function DashboardHome({ dashboard }: { dashboard: DashboardView }) {
  const router = useRouter();
  const [pending, setPending] = useState<'createSeries' | 'importSeries' | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState<'create' | 'import' | null>(null);
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
    if (!name) {
      setErrorMessage('系列名称不能为空');
      return;
    }
    const payload = await dispatch({ type: 'createSeries', name, description: createDraft.description });
    const seriesId = payload?.result?.series?.id as string | undefined;
    if (seriesId) {
      setDialogOpen(null);
      router.push(`/series/${seriesId}`);
    }
  }

  async function handleImportSeries() {
    const name = importDraft.name.trim();
    const sourceTitle = importDraft.sourceTitle.trim();
    const firstEpisodeTitle = importDraft.firstEpisodeTitle.trim();
    const content = importDraft.content.trim();
    if (!name || !sourceTitle || !content || !firstEpisodeTitle) {
      setErrorMessage('请填写系列名称、原文标题、首集标题和原文内容');
      return;
    }
    const payload = await dispatch({
      type: 'importSeries',
      name,
      description: importDraft.description,
      importType: importDraft.importType,
      sourceTitle,
      firstEpisodeTitle,
      content,
    });
    const seriesId = payload?.result?.series?.id as string | undefined;
    if (seriesId) {
      setDialogOpen(null);
      router.push(`/series/${seriesId}`);
    }
  }

  async function handleImportFile(file: File | null) {
    if (!file) return;
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
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '读取上传文件失败');
    }
  }

  function openCreateDialog() {
    setCreateDraft({ name: '', description: '' });
    setErrorMessage(null);
    setDialogOpen('create');
  }

  function openImportDialog() {
    setImportDraft({ name: '', description: '', sourceTitle: '', firstEpisodeTitle: '', content: '', importType: 'text', fileName: '' });
    setErrorMessage(null);
    setDialogOpen('import');
  }

  const activeAlerts = dashboard.usageSummary.alerts.filter((a) => a.status !== 'normal').length;

  return (
    <div className="mx-auto max-w-7xl space-y-7">
      {errorMessage && dialogOpen === null ? (
        <div className="rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{errorMessage}</div>
      ) : null}

      {/* ── Hero ── */}
      <div
        className="relative overflow-hidden rounded-3xl"
        style={{
          background: 'linear-gradient(160deg, rgba(20,20,26,0.95) 0%, rgba(14,14,18,0.98) 100%)',
          border: '1px solid rgba(63,63,70,0.45)',
        }}
      >
        {/* Ambient glow blobs */}
        <div
          className="pointer-events-none absolute -top-12 left-1/3"
          style={{ width: 320, height: 220, background: 'radial-gradient(ellipse, rgba(2,115,199,0.09) 0%, transparent 70%)', filter: 'blur(2px)' }}
        />
        <div
          className="pointer-events-none absolute -bottom-8 right-1/4"
          style={{ width: 240, height: 160, background: 'radial-gradient(ellipse, rgba(14,145,233,0.06) 0%, transparent 70%)' }}
        />

        <div className="relative p-8">
          <div className="mb-7 flex flex-wrap items-start justify-between gap-5">
            <div>
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-500">Production Studio</p>
              <h2 className="mb-2 text-[28px] font-bold tracking-tight text-zinc-50">Series Control Center</h2>
              <p className="max-w-xl text-sm leading-relaxed text-zinc-500">
                Launch a new series, import an existing draft, or continue your latest production.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={openImportDialog}
                className="flex cursor-pointer items-center gap-2 rounded-xl border border-zinc-700/80 bg-zinc-900/80 px-4 py-2.5 text-sm font-medium text-zinc-200 transition-all duration-150 hover:border-zinc-600 hover:bg-zinc-800"
              >
                <FolderInput size={15} />
                导入创建
              </button>
              <button
                type="button"
                onClick={openCreateDialog}
                className="flex cursor-pointer items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-white transition-all duration-150 hover:brightness-110"
                style={{
                  background: 'linear-gradient(135deg, #0273c7 0%, #0e91e9 100%)',
                  boxShadow: '0 0 20px rgba(14,145,233,0.3), 0 4px 12px rgba(0,0,0,0.3)',
                }}
              >
                <PlusCircle size={15} />
                新建系列
              </button>
              {primarySeries ? (
                <Link
                  href={`/series/${primarySeries.id}`}
                  className="flex cursor-pointer items-center gap-2 rounded-xl border border-brand-500/25 bg-brand-500/8 px-4 py-2.5 text-sm font-medium text-brand-300 transition-all duration-150 hover:border-brand-500/40 hover:bg-brand-500/12"
                >
                  Continue Series →
                </Link>
              ) : null}
            </div>
          </div>

          {/* Stats row */}
          <div className="grid gap-3 sm:grid-cols-4">
            {dashboard.stats.map((stat, i) => (
              <StatCard key={stat.label} label={stat.label} value={stat.value} index={i} />
            ))}
          </div>
        </div>
      </div>

      {/* ── Recent Series ── */}
      {recentSeries.length > 0 ? (
        <div>
          <div className="mb-3 flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">Recent</span>
            <div className="h-px flex-1 bg-zinc-800/60" />
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {recentSeries.map((series) => (
              <Link
                key={series.id}
                href={`/series/${series.id}`}
                className="group cursor-pointer rounded-2xl p-4 transition-all duration-200 hover:border-brand-500/30"
                style={{
                  background: 'rgba(22,22,26,0.7)',
                  border: '1px solid rgba(63,63,70,0.4)',
                  backdropFilter: 'blur(8px)',
                }}
              >
                <div className="mb-3 flex items-center justify-between">
                  <StatusBadge status={series.status} />
                  <span className="font-mono text-[10px] text-zinc-600">{series.episodeIds.length} EP{series.episodeIds.length !== 1 ? 's' : ''}</span>
                </div>
                <p className="mb-1 font-semibold text-zinc-100 transition-colors duration-150 group-hover:text-brand-300">{series.name}</p>
                <p className="line-clamp-1 text-xs text-zinc-600">{series.description}</p>
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      {/* ── All Series Grid ── */}
      {dashboard.series.length > 0 ? (
        <div>
          <div className="mb-3 flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">All Series</span>
            <div className="h-px flex-1 bg-zinc-800/60" />
            <span className="text-xs text-zinc-600">{dashboard.series.length} total</span>
          </div>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            {dashboard.series.map((series) => (
              <Link
                key={series.id}
                href={`/series/${series.id}`}
                className="group card-hover cursor-pointer overflow-hidden rounded-2xl"
                style={{
                  background: 'rgba(18,18,22,0.8)',
                  border: '1px solid rgba(63,63,70,0.4)',
                }}
              >
                {/* Thumbnail */}
                <div className="relative h-36 overflow-hidden">
                  <div
                    className="h-full w-full"
                    style={{ background: seriesGradient(series.status) }}
                  />
                  <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(12,12,16,0.92) 0%, rgba(12,12,16,0.2) 60%, transparent 100%)' }} />
                  <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between">
                    <StatusBadge status={series.status} />
                    <div
                      className="flex items-center gap-1 rounded-lg px-2 py-1"
                      style={{ background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.08)', backdropFilter: 'blur(8px)' }}
                    >
                      <Film size={10} className="text-zinc-400" />
                      <span className="font-mono text-[10px] font-bold text-white">{series.episodeIds.length}</span>
                    </div>
                  </div>
                </div>

                {/* Content */}
                <div className="p-5">
                  <h3 className="mb-1.5 text-[15px] font-bold text-zinc-100 transition-colors duration-150 group-hover:text-brand-300">
                    {series.name}
                  </h3>
                  <p className="mb-5 line-clamp-2 text-xs leading-relaxed text-zinc-500">{series.description}</p>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-zinc-500">Production Progress</span>
                      <span
                        className="font-bold"
                        style={{ color: series.progress === 100 ? '#4ade80' : series.progress > 50 ? '#38abf7' : '#71717a' }}
                      >
                        {series.progress}%
                      </span>
                    </div>
                    <div className="progress-track">
                      <div className="progress-fill" style={{ width: `${series.progress}%` }} />
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      {/* ── Footer stats ── */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div
          className="rounded-2xl p-5"
          style={{ background: 'rgba(14,145,233,0.05)', border: '1px solid rgba(14,145,233,0.12)' }}
        >
          <div className="mb-1 flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-400" style={{ boxShadow: '0 0 6px rgba(56,171,247,0.6)' }} />
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-400/70">Usage</span>
          </div>
          <p className="text-2xl font-bold text-zinc-100">
            {dashboard.usageSummary.currency} {dashboard.usageSummary.totalCost.toFixed(2)}
          </p>
          <p className="mt-1 text-xs text-zinc-600">across {dashboard.usageSummary.requestCount} tracked API calls</p>
        </div>

        <div
          className="rounded-2xl p-5"
          style={{
            background: activeAlerts > 0 ? 'rgba(245,158,11,0.05)' : 'rgba(34,197,94,0.05)',
            border: activeAlerts > 0 ? '1px solid rgba(245,158,11,0.15)' : '1px solid rgba(34,197,94,0.12)',
          }}
        >
          <div className="mb-1 flex items-center gap-2">
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{
                background: activeAlerts > 0 ? '#f59e0b' : '#4ade80',
                boxShadow: activeAlerts > 0 ? '0 0 6px rgba(245,158,11,0.6)' : '0 0 6px rgba(74,222,128,0.5)',
              }}
            />
            <span
              className="text-xs font-semibold uppercase tracking-[0.18em]"
              style={{ color: activeAlerts > 0 ? 'rgba(251,191,36,0.7)' : 'rgba(74,222,128,0.7)' }}
            >
              Alerts
            </span>
          </div>
          <p className="text-2xl font-bold text-zinc-100">{activeAlerts}</p>
          <p className="mt-1 text-xs text-zinc-600">{activeAlerts === 0 ? 'All systems normal' : `${activeAlerts} active usage alert${activeAlerts !== 1 ? 's' : ''}`}</p>
        </div>
      </div>

      <Dialog
        open={dialogOpen === 'create'}
        onClose={() => setDialogOpen(null)}
        title="新建系列"
        description="填写基本信息，创建后进入系列详情页配置世界观与策略。"
        size="md"
      >
        {errorMessage ? (
          <div className="mb-4 rounded-xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{errorMessage}</div>
        ) : null}
        <div className="space-y-4">
          <DialogField label="系列名称" hint="不超过 50 字，同一工作区内不可重复">
            <input
              autoFocus
              maxLength={50}
              value={createDraft.name}
              onChange={(e) => setCreateDraft((d) => ({ ...d, name: e.target.value }))}
              onKeyDown={(e) => { if (e.key === 'Enter') void handleCreateSeries(); }}
              placeholder="例如：长安十二时辰"
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2.5 text-sm text-zinc-100 focus:border-brand-500 focus:outline-none"
            />
          </DialogField>
          <DialogField label="系列简介" hint="可选，帮助记忆系列定位">
            <textarea
              value={createDraft.description}
              onChange={(e) => setCreateDraft((d) => ({ ...d, description: e.target.value }))}
              placeholder="系列定位、目标风格等（可选）"
              rows={3}
              className="w-full resize-none rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-sm text-zinc-200 focus:border-brand-500 focus:outline-none"
            />
          </DialogField>
        </div>
        <DialogFooter>
          <DialogButton variant="ghost" onClick={() => setDialogOpen(null)}>取消</DialogButton>
          <DialogButton
            variant="primary"
            loading={pending === 'createSeries'}
            disabled={!createDraft.name.trim()}
            onClick={() => void handleCreateSeries()}
          >
            创建系列
          </DialogButton>
        </DialogFooter>
      </Dialog>

      <Dialog
        open={dialogOpen === 'import'}
        onClose={() => setDialogOpen(null)}
        title="从原文导入创建系列"
        description="上传或粘贴原文，Agent 将自动分析并生成首集剧本章节。"
        size="lg"
      >
        {errorMessage ? (
          <div className="mb-4 rounded-xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{errorMessage}</div>
        ) : null}
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <DialogField label="系列名称">
              <input
                autoFocus
                maxLength={50}
                value={importDraft.name}
                onChange={(e) => setImportDraft((d) => ({ ...d, name: e.target.value, importType: 'text' }))}
                placeholder="例如：长安十二时辰"
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2.5 text-sm text-zinc-100 focus:border-brand-500 focus:outline-none"
              />
            </DialogField>
            <DialogField label="原文标题">
              <input
                value={importDraft.sourceTitle}
                onChange={(e) => setImportDraft((d) => ({ ...d, sourceTitle: e.target.value, importType: 'text' }))}
                placeholder="小说/原著名称"
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2.5 text-sm text-zinc-100 focus:border-brand-500 focus:outline-none"
              />
            </DialogField>
          </div>
          <DialogField label="首集标题">
            <input
              value={importDraft.firstEpisodeTitle}
              onChange={(e) => setImportDraft((d) => ({ ...d, firstEpisodeTitle: e.target.value }))}
              placeholder="例如：第一集"
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2.5 text-sm text-zinc-100 focus:border-brand-500 focus:outline-none"
            />
          </DialogField>
          <DialogField label="系列简介" hint="可选">
            <textarea
              value={importDraft.description}
              onChange={(e) => setImportDraft((d) => ({ ...d, description: e.target.value }))}
              placeholder="可选"
              rows={2}
              className="w-full resize-none rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-sm text-zinc-200 focus:border-brand-500 focus:outline-none"
            />
          </DialogField>
          <DialogDivider />
          <DialogField label="原文内容" hint="支持粘贴文本，或点击下方按钮上传文件">
            <textarea
              value={importDraft.content}
              onChange={(e) => setImportDraft((d) => ({ ...d, content: e.target.value, importType: 'text' }))}
              placeholder="在此粘贴原文内容…"
              rows={6}
              className="w-full resize-none rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-sm text-zinc-200 focus:border-brand-500 focus:outline-none"
            />
            <input
              ref={importFileRef}
              type="file"
              accept=".txt,.md,text/plain,text/markdown"
              className="hidden"
              onChange={(e) => {
                void handleImportFile(e.target.files?.[0] ?? null);
                e.currentTarget.value = '';
              }}
            />
            <button
              type="button"
              onClick={() => importFileRef.current?.click()}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-700 bg-zinc-900/50 py-3 text-sm font-medium text-zinc-400 transition-colors hover:border-brand-500/50 hover:text-zinc-200"
            >
              <Upload size={15} />
              {importDraft.fileName ? `已选：${importDraft.fileName}` : '上传 .txt / .md 原文文件'}
            </button>
            {importDraft.content ? (
              <p className="mt-1.5 text-xs text-zinc-500">已输入 {importDraft.content.length.toLocaleString()} 字</p>
            ) : null}
          </DialogField>
        </div>
        <DialogFooter>
          <DialogButton variant="ghost" onClick={() => setDialogOpen(null)}>取消</DialogButton>
          <DialogButton
            variant="primary"
            loading={pending === 'importSeries'}
            disabled={!importDraft.name.trim() || !importDraft.sourceTitle.trim() || !importDraft.firstEpisodeTitle.trim() || !importDraft.content.trim()}
            onClick={() => void handleImportSeries()}
          >
            导入并创建系列
          </DialogButton>
        </DialogFooter>
      </Dialog>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config = {
    initialized: { dot: '#60a5fa', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20', label: 'INIT' },
    producing:   { dot: '#0e91e9', color: 'bg-brand-500/10 text-brand-400 border-brand-500/20', label: 'PRODUCING' },
    partial_done:{ dot: '#f59e0b', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20', label: 'PARTIAL' },
    done:        { dot: '#4ade80', color: 'bg-green-500/10 text-green-400 border-green-500/20', label: 'DONE' },
    paused:      { dot: '#71717a', color: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20', label: 'PAUSED' },
    setting:     { dot: '#71717a', color: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20', label: 'SETTING' },
  } as const;

  const item = config[status as keyof typeof config] ?? config.initialized;

  return (
    <span className={cn('flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest', item.color)}>
      <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: item.dot }} />
      {item.label}
    </span>
  );
}

const STAT_ICONS = [
  <Film key="film" size={18} className="text-brand-400" />,
  <TrendingUp key="trend" size={18} className="text-amber-400" />,
  <Activity key="activity" size={18} className="text-rose-400" />,
  <Layers key="layers" size={18} className="text-purple-400" />,
];

function StatCard({ label, value, index }: { label: string; value: string | number; index: number }) {
  return (
    <div
      className="rounded-2xl p-4"
      style={{
        background: 'rgba(24,24,28,0.7)',
        border: '1px solid rgba(63,63,70,0.4)',
      }}
    >
      <div className="mb-3 flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">{label}</span>
        {STAT_ICONS[index % STAT_ICONS.length]}
      </div>
      <div className="text-[28px] font-bold leading-none text-zinc-100">{value}</div>
    </div>
  );
}

function seriesGradient(status: string): string {
  const map: Record<string, string> = {
    producing:    'linear-gradient(135deg, #0c2340 0%, #062949 40%, #0e304a 100%)',
    done:         'linear-gradient(135deg, #052010 0%, #062915 40%, #063316 100%)',
    partial_done: 'linear-gradient(135deg, #2a1800 0%, #321c00 40%, #3a2005 100%)',
    paused:       'linear-gradient(135deg, #1a1a1e 0%, #1e1e22 100%)',
    setting:      'linear-gradient(135deg, #16161c 0%, #1c1c24 100%)',
    initialized:  'linear-gradient(135deg, #0e1624 0%, #0f1a2c 100%)',
  };
  return map[status] ?? map.initialized;
}
