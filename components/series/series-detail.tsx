import Link from 'next/link';
import { Box, CheckCircle2, ChevronRight, Clock, Film, MoreVertical, Plus, Sparkles } from 'lucide-react';

import type { SeriesView } from '@/lib/view-models/studio';
import { cn } from '@/lib/utils';

export function SeriesDetail({ view }: { view: SeriesView }) {
  return (
    <div className="mx-auto max-w-7xl">
      <div className="flex flex-col gap-8 lg:flex-row">
        <div className="flex-1">
          <div className="mb-6 flex items-start justify-between">
            <div>
              <div className="mb-2 flex items-center gap-3">
                <StatusBadge status={view.series.status} />
                <span className="font-mono text-xs text-zinc-500">ID: {view.series.id}</span>
              </div>
              <h2 className="mb-3 text-4xl font-bold tracking-tight">{view.series.name}</h2>
              <p className="max-w-2xl leading-relaxed text-zinc-400">{view.series.description}</p>
            </div>
            <button className="rounded-xl p-2 transition-colors hover:bg-zinc-800">
              <MoreVertical size={24} />
            </button>
          </div>

          <div className="mb-10 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatBox label="Total Episodes" value={view.episodes.length.toString()} icon={<Film size={16} />} />
            <StatBox label="Overall Progress" value={`${view.series.progress}%`} icon={<CheckCircle2 size={16} />} />
            <StatBox label="Created At" value={view.series.createdAt.slice(0, 10)} icon={<Clock size={16} />} />
          </div>

          <div className="mb-8">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-xl font-bold">Episodes</h3>
              <button className="flex items-center gap-1 text-sm font-medium text-brand-400 transition-colors hover:text-brand-300">
                <Plus size={16} /> Add Episode
              </button>
            </div>
            <div className="space-y-3">
              {view.episodes.map((episode) => (
                <Link
                  key={episode.id}
                  href={`/series/${episode.seriesId}/episodes/${episode.id}`}
                  className="group flex w-full items-center gap-4 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4 transition-all hover:border-brand-500/30 hover:bg-zinc-900"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-800 text-sm font-bold text-zinc-400 transition-colors group-hover:bg-brand-600/20 group-hover:text-brand-400">
                    {episode.index.toString().padStart(2, '0')}
                  </div>
                  <div className="flex-1 text-left">
                    <h4 className="font-bold text-zinc-100">{episode.title}</h4>
                    <div className="mt-1 flex items-center gap-3">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-brand-400">{episode.currentStage}</span>
                      <div className="h-1 w-1 rounded-full bg-zinc-700" />
                      <span className="text-[10px] font-medium text-zinc-500">{episode.progress}% Complete</span>
                    </div>
                    {episode.gate?.blockedReasons?.[0] ? <p className="mt-2 text-xs text-amber-300">{episode.gate.blockedReasons[0]}</p> : null}
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="hidden h-1.5 w-32 overflow-hidden rounded-full bg-zinc-800 sm:block">
                      <div className="h-full rounded-full bg-brand-500" style={{ width: `${episode.progress}%` }} />
                    </div>
                    <ChevronRight size={20} className="text-zinc-600 transition-colors group-hover:text-brand-400" />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>

        <div className="w-full space-y-6 lg:w-80">
          <div className="glass-panel rounded-2xl p-6">
            <h3 className="mb-4 flex items-center gap-2 font-bold">
              <Box size={18} className="text-brand-400" />
              Shared Assets
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {view.sharedAssets.map((asset) => (
                <div key={asset.id} className="group relative aspect-square overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950">
                  <div className="h-full w-full bg-gradient-to-br from-zinc-800 via-zinc-900 to-zinc-950" />
                  <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/80 via-transparent to-transparent p-2 opacity-0 transition-opacity group-hover:opacity-100">
                    <span className="truncate text-[10px] font-bold">{asset.name}</span>
                  </div>
                </div>
              ))}
              <button className="flex aspect-square flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-700 text-zinc-500 transition-all hover:border-zinc-500 hover:text-zinc-300">
                <Plus size={20} />
                <span className="text-[10px] font-medium">New Asset</span>
              </button>
            </div>
          </div>

          <div className="glass-panel rounded-2xl p-6">
            <h3 className="mb-4 flex items-center gap-2 font-bold">
              <Sparkles size={18} className="text-brand-400" />
              Agent Strategy
            </h3>
            <div className="space-y-3">
              <StrategyItem label="Visual Style" value={view.series.style} />
              <StrategyItem label="Shared Assets" value={String(view.sharedAssets.length)} />
              <StrategyItem label="Open Tasks" value={String(view.tasks.filter((task) => task.status !== 'completed').length)} />
            </div>
          </div>
        </div>
      </div>
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

function StatBox({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="glass-panel rounded-2xl p-5">
      <div className="mb-2 flex items-center gap-2 text-sm text-zinc-500">{icon}{label}</div>
      <p className="text-2xl font-bold text-zinc-100">{value}</p>
    </div>
  );
}

function StrategyItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-3">
      <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">{label}</p>
      <p className="mt-2 text-sm font-medium text-zinc-200">{value}</p>
    </div>
  );
}
