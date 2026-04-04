"use client";

import { useMemo, useState } from "react";
import { GearSix, HardDrives, Sparkle } from "@phosphor-icons/react/dist/ssr";
import { runtimeSettings } from "@/lib/mock-data";
import { ButtonPill, OrchestratorPanel, SectionTitle, StudioShell } from "@/components/studio/studio-shell";

export default function SettingsPage() {
  const [activeSection, setActiveSection] = useState(runtimeSettings[0]?.id ?? "language");

  const current = useMemo(
    () => runtimeSettings.find((section) => section.id === activeSection) ?? runtimeSettings[0],
    [activeSection],
  );

  return (
    <StudioShell
      navKey="settings"
      eyebrow="Studio Settings"
      title="Runtime Governance"
      description="UC-16 / UC-17: 统一维护 Prompt、Skill、Memory、Agent 和运行配置，确保 Studio 长期可用。"
      actions={
        <>
          <ButtonPill tone="quiet">
            <Sparkle size={14} />
            检查配置健康度
          </ButtonPill>
          <ButtonPill tone="primary">保存全部设置</ButtonPill>
        </>
      }
      aside={
        <OrchestratorPanel
          title="Ops Console"
          focus="配置漂移巡检"
          completion={81}
          blocking="Video Vendor 备选凭据将在 5 天后过期"
          nextStep="更新凭据并触发一次全链路配置校验。"
          recommendations={[
            "检查供应商凭据",
            "运行配置体检",
            "清理无效数据",
          ]}
          queuePreview={[
            { id: "OPS-31", title: "每日索引体检", status: "success" },
            { id: "OPS-32", title: "孤立任务清理", status: "running" },
            { id: "OPS-33", title: "凭据到期预警", status: "queued" },
          ]}
        />
      }
    >
      <section className="mc-soft-panel rounded-[1.4rem] p-4">
        <SectionTitle
          kicker="Control Surface"
          title="System-level configuration"
          description="设置中心承接 Toonflow 的治理深度，但在信息层级和可读性上做了重新设计。"
        />

        <div className="mt-4 grid gap-3 xl:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="rounded-2xl border border-[var(--mc-stroke)] bg-white/80 p-3">
            {runtimeSettings.map((section) => (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={`mb-1 w-full rounded-xl border px-3 py-2 text-left text-sm transition ${
                  activeSection === section.id
                    ? "border-[var(--mc-accent)] bg-[var(--mc-soft)] text-[var(--mc-ink)]"
                    : "border-transparent text-[var(--mc-muted)] hover:border-[var(--mc-stroke)] hover:bg-[var(--mc-soft)]"
                }`}
              >
                <span className="inline-flex items-center gap-2">
                  <GearSix size={14} />
                  {section.title}
                </span>
              </button>
            ))}
          </aside>

          <article className="rounded-2xl border border-[var(--mc-stroke)] bg-white/80 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="inline-flex items-center gap-2 rounded-full border border-[var(--mc-stroke)] bg-[var(--mc-soft)] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--mc-muted)]">
                  <HardDrives size={12} />
                  {current?.id}
                </p>
                <h3 className="mt-2 text-2xl font-bold leading-tight text-[var(--mc-ink)]">{current?.title}</h3>
                <p className="mt-2 text-sm leading-7 text-[var(--mc-muted)]">{current?.description}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <ButtonPill tone="quiet">恢复默认</ButtonPill>
                <ButtonPill tone="primary">保存此分组</ButtonPill>
              </div>
            </div>

            <div className="mt-4 space-y-2">
              {current?.entries.map((entry) => (
                <div key={entry.key} className="rounded-xl border border-[var(--mc-stroke)] bg-[var(--mc-soft)] p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--mc-muted)]">{entry.key}</p>
                  <p className="mt-1 text-sm font-semibold text-[var(--mc-ink)]">{entry.value}</p>
                  {entry.note ? <p className="mt-1 text-xs text-[var(--mc-muted)]">{entry.note}</p> : null}
                </div>
              ))}
            </div>
          </article>
        </div>
      </section>
    </StudioShell>
  );
}
