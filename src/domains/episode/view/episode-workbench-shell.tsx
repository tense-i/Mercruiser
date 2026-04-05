"use client";

import type { ReactNode } from "react";
import { StudioShell } from "@/components/studio/studio-shell";

export interface EpisodeWorkbenchNavItem {
  id: string;
  label: string;
  meta?: string;
  icon?: ReactNode;
}

export function EpisodeWorkbenchShell({
  eyebrow,
  title,
  description,
  actions,
  aside,
  navigatorTitle = "Workbench",
  navItems,
  activeNavId,
  onSelectNav,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
  aside?: ReactNode;
  navigatorTitle?: string;
  navItems: EpisodeWorkbenchNavItem[];
  activeNavId: string;
  onSelectNav: (id: string) => void;
  children: ReactNode;
}) {
  return (
    <StudioShell
      navKey="workspace"
      eyebrow={eyebrow}
      title={title}
      description={description}
      actions={actions}
      aside={aside}
      compact
    >
      <div className="grid gap-3 lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="mc-soft-panel rounded-[1.4rem] p-3">
          <p className="px-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-[var(--mc-muted)]">
            {navigatorTitle}
          </p>
          <div className="mt-2 space-y-1">
            {navItems.map((item) => {
              const active = item.id === activeNavId;
              return (
                <button
                  key={item.id}
                  onClick={() => onSelectNav(item.id)}
                  className={`w-full rounded-2xl border px-3 py-2 text-left transition ${
                    active
                      ? "border-[var(--mc-accent)] bg-white"
                      : "border-transparent hover:border-[var(--mc-stroke)] hover:bg-white/70"
                  }`}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--mc-ink)]">
                      {item.icon}
                      {item.label}
                    </span>
                    {item.meta ? <span className="text-xs text-[var(--mc-muted)]">{item.meta}</span> : null}
                  </span>
                </button>
              );
            })}
          </div>
        </aside>

        <section className="mc-soft-panel rounded-[1.4rem] p-4">{children}</section>
      </div>
    </StudioShell>
  );
}
