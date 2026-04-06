'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Box, Download, Film, History, LayoutDashboard, Map, Search, Settings, Share2, Sparkles, User } from 'lucide-react';

import { cn } from '@/lib/utils';

type HeaderContext = {
  seriesName?: string;
  episodeTitle?: string;
  episodeIndex?: number;
};

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [headerContext, setHeaderContext] = useState<HeaderContext>({});

  useEffect(() => {
    const episodeMatch = pathname.match(/^\/series\/([^/]+)\/episodes\/([^/]+)/);
    const seriesMatch = pathname.match(/^\/series\/([^/]+)$/);

    async function load() {
      try {
        if (episodeMatch) {
          const [, , episodeId] = episodeMatch;
          const response = await fetch(`/api/studio?episodeId=${episodeId}`);
          const payload = await response.json();
          if (response.ok && payload.episodeView) {
            setHeaderContext({
              seriesName: payload.episodeView.series?.name,
              episodeTitle: payload.episodeView.episode.title,
              episodeIndex: payload.episodeView.episode.index,
            });
            return;
          }
        }

        if (seriesMatch) {
          const [, seriesId] = seriesMatch;
          const response = await fetch(`/api/studio?seriesId=${seriesId}`);
          const payload = await response.json();
          if (response.ok && payload.seriesView) {
            setHeaderContext({
              seriesName: payload.seriesView.series.name,
            });
            return;
          }
        }

        setHeaderContext({});
      } catch {
        setHeaderContext({});
      }
    }

    void load();
  }, [pathname]);

  const navItems = useMemo(
    () => [
      { href: '/', label: 'Dashboard', icon: <LayoutDashboard size={20} />, active: pathname === '/' },
      { href: headerContext.seriesName ? pathname.startsWith('/series') ? pathname : '/series' : '/series', label: 'Series', icon: <Film size={20} />, active: pathname.startsWith('/series'), disabled: !pathname.startsWith('/series') && !headerContext.seriesName },
      { href: '/tasks', label: 'Tasks', icon: <History size={20} />, active: pathname.startsWith('/tasks') },
    ],
    [headerContext.seriesName, pathname],
  );

  return (
    <div className="flex h-screen overflow-hidden bg-zinc-950 font-[var(--font-sans)]">
      <aside className="glass-panel z-20 flex w-64 flex-col border-r border-zinc-800">
        <div className="flex items-center gap-3 p-6">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500 shadow-lg shadow-brand-500/20">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <h1 className="text-xl font-bold tracking-tight">Mercruiser</h1>
        </div>

        <nav className="mt-4 flex-1 space-y-1 px-3">
          {navItems.map((item) => (
            <SidebarItem key={item.label} {...item} />
          ))}
          <div className="px-4 pb-2 pt-4 text-xs font-semibold uppercase tracking-wider text-zinc-500">Resources</div>
          <SidebarItem href="#" label="Characters" icon={<User size={20} />} />
          <SidebarItem href="#" label="Environments" icon={<Map size={20} />} />
          <SidebarItem href="#" label="Assets" icon={<Box size={20} />} />
        </nav>

        <div className="border-t border-zinc-800 p-4">
          <SidebarItem href="/settings" label="Settings" icon={<Settings size={20} />} active={pathname.startsWith('/settings')} />
          <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-900/50 p-3">
            <div className="mb-2 flex items-center gap-2">
              <div className="h-2 w-2 animate-pulse rounded-full bg-green-500" />
              <span className="text-xs font-medium text-zinc-400">Agent Online</span>
            </div>
            <p className="text-[10px] leading-relaxed text-zinc-500">Ready to assist with script breakdown and asset generation.</p>
          </div>
        </div>
      </aside>

      <main className="relative flex flex-1 flex-col overflow-hidden">
        <header className="glass-panel z-10 flex h-16 items-center justify-between border-b border-zinc-800 px-8">
          <div className="flex items-center gap-4">
            {pathname !== '/' && (
              <button className="rounded-lg p-2 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100">
                <ArrowLeft size={20} />
              </button>
            )}
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-zinc-500">
                  {pathname === '/'
                    ? 'Studio'
                    : pathname.startsWith('/tasks')
                      ? 'Tasks'
                      : pathname.startsWith('/settings')
                        ? 'Settings'
                        : headerContext.seriesName ?? 'Series'}
                </span>
                {headerContext.episodeTitle ? (
                  <>
                    <span className="text-zinc-600">/</span>
                    <span className="text-sm font-medium text-zinc-100">
                      EP {String(headerContext.episodeIndex ?? '').padStart(2, '0')}: {headerContext.episodeTitle}
                    </span>
                  </>
                ) : null}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={16} />
              <input
                type="text"
                placeholder="Search projects..."
                className="w-64 rounded-full border border-zinc-800 bg-zinc-900 py-1.5 pl-10 pr-4 text-sm transition-colors focus:border-brand-500 focus:outline-none"
              />
            </div>
            <button className="p-2 text-zinc-400 transition-colors hover:text-zinc-100">
              <Download size={20} />
            </button>
            <button className="p-2 text-zinc-400 transition-colors hover:text-zinc-100">
              <Share2 size={20} />
            </button>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-brand-400 to-brand-600 text-xs font-bold text-white shadow-lg">TW</div>
          </div>
        </header>

        <div className="custom-scrollbar flex-1 overflow-y-auto p-8">{children}</div>
      </main>
    </div>
  );
}

function SidebarItem({
  href,
  icon,
  label,
  active,
  disabled,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  disabled?: boolean;
}) {
  const content = (
    <span
      className={cn(
        'group flex w-full items-center gap-3 rounded-xl px-4 py-2.5 transition-all duration-200',
        active ? 'bg-brand-600/10 font-bold text-brand-400' : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100',
        disabled && 'cursor-not-allowed opacity-30',
      )}
    >
      <span className={cn('transition-transform group-hover:scale-110', active && 'text-brand-500')}>{icon}</span>
      <span className="text-sm">{label}</span>
      {active ? <span className="ml-auto h-1.5 w-1.5 rounded-full bg-brand-500 shadow-[0_0_8px_rgba(14,145,233,0.8)]" /> : null}
    </span>
  );

  if (disabled || href === '#') {
    return <div>{content}</div>;
  }

  return <Link href={href}>{content}</Link>;
}
