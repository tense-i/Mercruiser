'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { ChevronRight, Film, History, LayoutDashboard, Settings, Sparkles, Zap } from 'lucide-react';

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
      { href: '/', label: 'Dashboard', icon: <LayoutDashboard size={18} />, active: pathname === '/' },
      {
        href: pathname.startsWith('/series') ? pathname : '/series',
        label: 'Series',
        icon: <Film size={18} />,
        active: pathname.startsWith('/series'),
        disabled: !pathname.startsWith('/series') && !headerContext.seriesName,
      },
      { href: '/tasks', label: 'Tasks', icon: <History size={18} />, active: pathname.startsWith('/tasks') },
    ],
    [headerContext.seriesName, pathname],
  );

  const breadcrumbs = useMemo(() => {
    const crumbs: { label: string; dim?: boolean }[] = [];
    if (pathname === '/') crumbs.push({ label: 'Studio' });
    else if (pathname.startsWith('/tasks')) crumbs.push({ label: 'Tasks' });
    else if (pathname.startsWith('/settings')) crumbs.push({ label: 'Settings' });
    else if (headerContext.seriesName) {
      crumbs.push({ label: headerContext.seriesName });
      if (headerContext.episodeTitle) {
        crumbs.push({ label: `EP ${String(headerContext.episodeIndex ?? '').padStart(2, '0')}`, dim: true });
        crumbs.push({ label: headerContext.episodeTitle });
      }
    } else {
      crumbs.push({ label: 'Series' });
    }
    return crumbs;
  }, [pathname, headerContext]);

  return (
    <div className="flex h-screen overflow-hidden bg-zinc-950 font-[var(--font-sans)]">
      {/* ── Sidebar ── */}
      <aside
        className="relative z-20 flex w-60 flex-col overflow-hidden"
        style={{
          background: 'linear-gradient(180deg, rgba(18,18,22,0.98) 0%, rgba(14,14,18,0.99) 100%)',
          borderRight: '1px solid rgba(63,63,70,0.45)',
        }}
      >
        {/* Ambient brand glow at top */}
        <div
          className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2"
          style={{
            width: '180px',
            height: '120px',
            background: 'radial-gradient(ellipse at 50% 0%, rgba(14,145,233,0.12) 0%, transparent 70%)',
          }}
        />

        {/* Logo */}
        <div className="relative flex items-center gap-3 px-5 py-5">
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl"
            style={{
              background: 'linear-gradient(135deg, #0273c7 0%, #0e91e9 100%)',
              boxShadow: '0 0 16px rgba(14,145,233,0.4), inset 0 1px 0 rgba(255,255,255,0.15)',
            }}
          >
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <div>
            <h1 className="text-[15px] font-bold tracking-tight text-zinc-100">Mercruiser</h1>
            <p className="text-[10px] text-zinc-600">Studio</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-0.5 px-3 pb-3">
          {navItems.map((item) => (
            <SidebarItem key={item.label} {...item} />
          ))}
        </nav>

        {/* Bottom */}
        <div
          className="space-y-2 px-3 pb-4 pt-3"
          style={{ borderTop: '1px solid rgba(63,63,70,0.35)' }}
        >
          <SidebarItem href="/settings" label="Settings" icon={<Settings size={18} />} active={pathname.startsWith('/settings')} />

          {/* Agent status */}
          <div
            className="mx-1 mt-1 rounded-xl p-3"
            style={{
              background: 'rgba(34,197,94,0.06)',
              border: '1px solid rgba(34,197,94,0.15)',
            }}
          >
            <div className="mb-1.5 flex items-center gap-2">
              <div className="status-dot-pulse" />
              <span className="text-[11px] font-semibold text-green-400">Agent Online</span>
              <Zap size={10} className="ml-auto text-green-500/60" />
            </div>
            <p className="text-[10px] leading-[1.5] text-zinc-500">Ready for script, asset &amp; shot generation.</p>
          </div>
        </div>
      </aside>

      {/* ── Main content ── */}
      <main className="relative flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <header
          className="z-10 flex h-14 shrink-0 items-center justify-between px-7"
          style={{
            background: 'rgba(14,14,18,0.85)',
            backdropFilter: 'blur(12px)',
            borderBottom: '1px solid rgba(63,63,70,0.35)',
          }}
        >
          {/* Breadcrumb */}
          <nav className="flex items-center gap-1.5">
            {breadcrumbs.map((crumb, i) => (
              <span key={i} className="flex items-center gap-1.5">
                {i > 0 && <ChevronRight size={12} className="text-zinc-600" />}
                <span
                  className={cn(
                    'text-sm font-medium',
                    i === breadcrumbs.length - 1 ? 'text-zinc-100' : 'text-zinc-500',
                    crumb.dim && 'text-zinc-600',
                  )}
                >
                  {crumb.label}
                </span>
              </span>
            ))}
          </nav>

          {/* Right side badge */}
          <div
            className="flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-medium text-zinc-500"
            style={{ border: '1px solid rgba(63,63,70,0.4)', background: 'rgba(24,24,27,0.5)' }}
          >
            <span
              className="h-1.5 w-1.5 rounded-full bg-brand-500"
              style={{ boxShadow: '0 0 6px rgba(14,145,233,0.6)' }}
            />
            Studio workspace
          </div>
        </header>

        <div className="custom-scrollbar flex-1 overflow-y-auto p-7 animate-fade-in">{children}</div>
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
        'group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all duration-150',
        active
          ? 'font-semibold text-brand-300'
          : 'text-zinc-500 hover:bg-zinc-900/60 hover:text-zinc-200',
        disabled && 'cursor-not-allowed opacity-25',
        active && 'sidebar-item-active',
      )}
    >
      <span
        className={cn(
          'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-all duration-150',
          active
            ? 'bg-brand-500/15 text-brand-400'
            : 'text-zinc-500 group-hover:bg-zinc-800/60 group-hover:text-zinc-300',
        )}
      >
        {icon}
      </span>
      <span>{label}</span>
      {active ? (
        <span
          className="ml-auto h-1.5 w-1.5 rounded-full bg-brand-400"
          style={{ boxShadow: '0 0 6px rgba(56,171,247,0.7)' }}
        />
      ) : null}
    </span>
  );

  if (disabled || href === '#') {
    return <div>{content}</div>;
  }

  return <Link href={href}>{content}</Link>;
}
