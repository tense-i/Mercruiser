"use client";

import Link from "next/link";
import { ArrowRight, CaretRight, MagnifyingGlass, Plus } from "@phosphor-icons/react/dist/ssr";
import { seriesCards } from "@/lib/mock-data";
import { StudioShell, ToneBadge } from "@/components/studio/studio-shell";

export default function WorkspacePage() {
  return (
    <StudioShell
      navKey="workspace"
      eyebrow="Mercruiser Studio"
      title="系列工作区"
      description="用传统后台首页承载系列列表、风险提示和系列级建议。"
      actions={
        <>
          <div className="hidden items-center gap-2 rounded-2xl border border-white/8 bg-white/[0.03] px-3 py-2 text-sm text-white/50 md:flex">
            <MagnifyingGlass size={14} />
            搜索系列 / 集数 / 资产
          </div>
          <button className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-white/72">
            当前系列
            <CaretRight size={14} />
            Project Mercruiser
          </button>
        </>
      }
    >
      <section className="rounded-3xl border border-white/10 bg-[#0f131a] shadow-[0_20px_80px_rgba(0,0,0,0.25)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/6 px-5 py-4">
          <div>
            <div className="text-sm font-medium tracking-wide text-white">系列工作区</div>
            <div className="mt-1 text-xs text-white/45">传统后台首页，保留 Studio 感与高优先级信息概览</div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/series/import"
              className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-2 text-sm font-medium text-white/72 transition hover:bg-white/[0.06]"
            >
              导入长文本
            </Link>
            <Link
              href="/series/new"
              className="inline-flex items-center gap-2 rounded-2xl bg-[#f2dfbe] px-4 py-2 text-sm font-medium text-[#121212] transition hover:translate-y-[-1px]"
            >
              <Plus size={14} />
              新建系列
            </Link>
          </div>
        </div>

        <div className="p-5">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {seriesCards.map((series) => (
              <Link
                key={series.id}
                href={`/series/${series.id}`}
                className="group rounded-[28px] border border-white/8 bg-[#131922] p-5 text-left transition hover:border-[#f2dfbe]/30 hover:bg-[#171e29]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm text-[#f2dfbe]">{series.genre}</div>
                    <div className="mt-1 text-xl font-semibold text-white">{series.title}</div>
                  </div>
                  <ToneBadge tone={series.statusTone}>{series.statusLabel}</ToneBadge>
                </div>

                <p className="mt-3 min-h-[48px] text-sm leading-6 text-white/58">{series.subtitle}</p>

                <div className="mt-5 grid grid-cols-3 gap-3 text-sm">
                  <div className="rounded-2xl bg-white/[0.03] p-3">
                    <div className="text-white/38">集数</div>
                    <div className="mt-2 text-lg font-semibold text-white">{series.episodesTotal}</div>
                  </div>
                  <div className="rounded-2xl bg-white/[0.03] p-3">
                    <div className="text-white/38">完成</div>
                    <div className="mt-2 text-lg font-semibold text-white">{series.episodesDone}</div>
                  </div>
                  <div className="rounded-2xl bg-white/[0.03] p-3">
                    <div className="text-white/38">更新</div>
                    <div className="mt-2 text-sm font-medium text-white">{series.updatedAt}</div>
                  </div>
                </div>

                <div className="mt-5 space-y-2">
                  <div className="flex items-center justify-between text-xs text-white/42">
                    <span>当前进度</span>
                    <span>{series.progress}%</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-white/6">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[#d0a15f] via-[#f0d6a8] to-[#fff4e2]"
                      style={{ width: `${series.progress}%` }}
                    />
                  </div>
                </div>

                <div className="mt-5 flex items-center justify-between text-sm text-white/48">
                  <span>{series.riskSummary}</span>
                  <span className="inline-flex items-center gap-1 text-[#f2dfbe]">
                    打开系列
                    <ArrowRight size={14} />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </StudioShell>
  );
}