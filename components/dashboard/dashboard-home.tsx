import Link from 'next/link';
import { Film } from 'lucide-react';

import type { DashboardView } from '@/lib/view-models/studio';
import { cn } from '@/lib/utils';

export function DashboardHome({ dashboard }: { dashboard: DashboardView }) {
  const primarySeries = dashboard.series[0] ?? null;

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h2 className="mb-1 text-3xl font-bold tracking-tight">Welcome back, Producer</h2>
          <p className="text-zinc-500">Manage your series and continue your production journey.</p>
        </div>
        <Link
          href={primarySeries ? `/series/${primarySeries.id}` : '/tasks'}
          className="flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2 font-medium text-white shadow-lg shadow-brand-600/20 transition-all hover:scale-105 hover:bg-brand-500 active:scale-95"
        >
          {primarySeries ? 'Continue Series' : 'Open Task Center'}
        </Link>
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
