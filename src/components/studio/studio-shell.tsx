"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowSquareOut,
  ChartLine,
  CheckCircle,
  Circle,
  Clock,
  Gear,
  ListChecks,
  Plus,
  Question,
  Sparkle,
  Stack,
  Warning,
  X,
} from "@phosphor-icons/react/dist/ssr";

type NavKey = "workspace" | "queue" | "settings";

interface StudioShellProps {
  navKey: NavKey;
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
  aside?: ReactNode;
  actions?: ReactNode;
  compact?: boolean;
  defaultSidebarCollapsed?: boolean;
}

const navItems: Array<{ key: NavKey; label: string; href: string; icon: ReactNode }> = [
  {
    key: "workspace",
    label: "系列工作区",
    href: "/workspace",
    icon: <Stack size={16} weight="duotone" />,
  },
  {
    key: "queue",
    label: "任务中心",
    href: "/queue",
    icon: <ListChecks size={16} weight="duotone" />,
  },
  {
    key: "settings",
    label: "设置中心",
    href: "/settings",
    icon: <Gear size={16} weight="duotone" />,
  },
];

const recentLinks = [
  { label: "Project Mercruiser", href: "/series/glasshouse" },
  { label: "共享角色", href: "/series/glasshouse" },
  { label: "EP03 工作台", href: "/series/glasshouse/episodes/e04" },
];

const narrativeModes = {
  story: {
    label: "剧情模式",
    brief: "70% 以上为对话场景\n适合 AI短剧、情景喜剧、角色扮演",
  },
  narration: {
    label: "旁白解说模式",
    brief: "70% 以上内容为旁白解说\n适合小说推文、动态漫、纪录片、营销短片",
  },
} as const;

export function StudioShell({
  navKey,
  eyebrow,
  title,
  description,
  children,
  aside,
  actions,
  compact,
  defaultSidebarCollapsed = false,
}: StudioShellProps) {
  const router = useRouter();
  const hasAside = Boolean(aside);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(defaultSidebarCollapsed);
  const [showCreateSeriesModal, setShowCreateSeriesModal] = useState(false);
  const [seriesName, setSeriesName] = useState("");
  const [narrativeMode, setNarrativeMode] = useState<keyof typeof narrativeModes>("story");
  const [scriptInput, setScriptInput] = useState("");
  const [helpMode, setHelpMode] = useState<keyof typeof narrativeModes | null>(null);
  const sidebarGridClass = sidebarCollapsed
    ? "lg:grid-cols-[88px_minmax(0,1fr)]"
    : "lg:grid-cols-[220px_minmax(0,1fr)]";

  useEffect(() => {
    if (!showCreateSeriesModal) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShowCreateSeriesModal(false);
        setHelpMode(null);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [showCreateSeriesModal]);

  const resetCreateModal = () => {
    setShowCreateSeriesModal(false);
    setSeriesName("");
    setScriptInput("");
    setNarrativeMode("story");
    setHelpMode(null);
  };

  const handleCreateSeries = () => {
    if (!seriesName.trim()) {
      return;
    }

    const query = new URLSearchParams({
      name: seriesName.trim(),
      mode: narrativeMode,
    });

    router.push(`/series/new?${query.toString()}`);
    resetCreateModal();
  };

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(242,223,190,0.1),transparent_30%),radial-gradient(circle_at_left,rgba(88,117,164,0.1),transparent_25%)]" />
      <div className={`relative mx-auto grid min-h-screen max-w-[1860px] gap-3 p-2 ${sidebarGridClass} lg:p-3`}>
        <aside
          className={`mc-panel flex flex-col rounded-[1.7rem] border-white/6 bg-[#0a0d12]/95 backdrop-blur-xl ${
            sidebarCollapsed ? "items-center p-3" : "p-4"
          }`}
        >
          <div className={`mb-1 flex w-full items-center ${sidebarCollapsed ? "justify-center" : "justify-between gap-2"} pb-4`}>
            <div className={`flex items-center ${sidebarCollapsed ? "" : "gap-3"} px-1`}>
              <div className="rounded-2xl border border-[#f2dfbe]/20 bg-[#f2dfbe]/10 p-2 text-[#f2dfbe]">
                <Sparkle size={16} />
              </div>
              {!sidebarCollapsed ? (
                <div>
                  <p className="text-sm font-semibold text-white">Mercruiser</p>
                  <p className="text-[11px] uppercase tracking-[0.18em] text-white/35">Studio Console</p>
                </div>
              ) : null}
            </div>
            {!sidebarCollapsed ? (
              <button
                type="button"
                onClick={() => setSidebarCollapsed(true)}
                className="rounded-xl border border-white/10 bg-white/[0.03] px-2 py-1 text-xs text-white/70 transition hover:bg-white/[0.08]"
                aria-label="收起侧边栏"
                title="收起侧边栏"
              >
                {"<<"}
              </button>
            ) : null}
          </div>

          {sidebarCollapsed ? (
            <button
              type="button"
              onClick={() => setSidebarCollapsed(false)}
              className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] text-sm font-semibold text-white/70 transition hover:bg-white/[0.08]"
              aria-label="展开侧边栏"
              title="展开侧边栏"
            >
              {">>"}
            </button>
          ) : null}

          <button
            type="button"
            onClick={() => {
              setShowCreateSeriesModal(true);
              setSeriesName("");
              setScriptInput("");
              setNarrativeMode("story");
              setHelpMode(null);
            }}
            className={`mb-4 inline-flex items-center justify-center rounded-2xl bg-[#f2dfbe] text-sm font-medium text-[#111] ${
              sidebarCollapsed ? "h-10 w-10" : "w-full gap-2 px-4 py-3"
            }`}
            title="新建系列"
            aria-label="新建系列"
          >
            <Plus size={15} />
            {!sidebarCollapsed ? "新建系列" : null}
          </button>

          <nav className={`space-y-1 ${sidebarCollapsed ? "w-full" : ""}`}>
            {navItems.map((item) => {
              const active = item.key === navKey;
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  className={`group flex rounded-2xl text-left text-sm transition ${
                    active
                      ? "bg-[#f2dfbe] text-[#111]"
                      : "text-white/72 hover:bg-white/[0.04] hover:text-white"
                  } ${sidebarCollapsed ? "items-center justify-center px-2 py-2.5" : "items-center justify-between px-3 py-2.5"}`}
                  title={item.label}
                  aria-label={item.label}
                >
                  <span className={`flex items-center ${sidebarCollapsed ? "" : "gap-2.5"}`}>
                    {item.icon}
                    {!sidebarCollapsed ? <span className="font-medium">{item.label}</span> : null}
                  </span>
                  {!sidebarCollapsed ? (
                    <ArrowSquareOut size={13} className={active ? "text-[#111]/70" : "text-white/35"} />
                  ) : null}
                </Link>
              );
            })}
          </nav>

          {!sidebarCollapsed ? (
            <div className="mt-6 border-t border-white/6 pt-5">
              <p className="px-1 text-[11px] uppercase tracking-[0.22em] text-white/28">最近访问</p>
              <div className="mt-3 space-y-1">
                {recentLinks.map((item) => (
                  <Link
                    key={item.label}
                    href={item.href}
                    className="flex items-center gap-2 rounded-2xl px-3 py-2.5 text-sm text-white/68 transition hover:bg-white/[0.04] hover:text-white"
                  >
                    <Circle size={12} />
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>
          ) : null}

          <div className="mt-auto pt-6">
            {!sidebarCollapsed ? (
              <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-3">
                <p className="text-sm font-semibold text-white">Mira Zhou</p>
                <p className="mt-1 text-xs text-white/45">Series Producer</p>
              </div>
            ) : (
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] text-white/65">
                <Circle size={14} />
              </div>
            )}
          </div>
        </aside>

        <div className={hasAside ? "grid gap-3 xl:grid-cols-[minmax(0,1fr)_340px]" : "grid gap-3"}>
          <main className="mc-panel rounded-[1.7rem]">
            <header className={`border-b border-white/6 px-5 py-4 sm:px-6 ${compact ? "mb-3" : "mb-4"}`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.24em] text-white/35">{eyebrow}</p>
                  <h1 className="mt-1 text-2xl font-semibold text-white sm:text-3xl">{title}</h1>
                  <p className="mt-1 text-sm text-white/50">{description}</p>
                </div>
                {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
              </div>
            </header>
            <div className="px-5 pb-5 sm:px-6 sm:pb-6">{children}</div>
          </main>

          {hasAside ? (
            <aside className="mc-panel rounded-[1.7rem] p-3 sm:p-4 xl:sticky xl:top-3 xl:h-[calc(100vh-1.5rem)] xl:overflow-auto">
              {aside}
            </aside>
          ) : null}
        </div>
      </div>

      {showCreateSeriesModal ? (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/65 p-3 sm:p-6"
          onClick={resetCreateModal}
        >
          <div
            className="w-full max-w-4xl rounded-[2rem] border border-white/10 bg-[#1b1d22] px-5 py-5 shadow-[0_30px_140px_rgba(0,0,0,0.55)] sm:px-8 sm:py-7"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-3xl font-semibold text-white">创建项目</h2>
              <button
                type="button"
                onClick={resetCreateModal}
                className="rounded-2xl border border-white/12 bg-white/[0.02] p-2 text-white/62 transition hover:bg-white/[0.08] hover:text-white"
                aria-label="关闭创建弹窗"
              >
                <X size={22} />
              </button>
            </div>

            <div className="mt-6 space-y-5">
              <label className="block">
                <span className="text-[2rem] font-semibold tracking-tight text-white">项目名称</span>
                <input
                  value={seriesName}
                  onChange={(event) => setSeriesName(event.target.value)}
                  placeholder="请输入短剧项目名称"
                  className="mt-3 h-14 rounded-2xl border-white/8 bg-[#2a2d34] text-lg placeholder:text-white/32"
                />
              </label>

              <div>
                <p className="text-[2rem] font-semibold tracking-tight text-white">叙事模式</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {(Object.entries(narrativeModes) as Array<
                    [keyof typeof narrativeModes, (typeof narrativeModes)[keyof typeof narrativeModes]]
                  >).map(([key, mode]) => {
                    const selected = narrativeMode === key;
                    const showHelp = helpMode === key;

                    return (
                      <div
                        key={key}
                        className={`rounded-2xl border p-3 transition ${
                          selected
                            ? "border-[#f2dfbe]/45 bg-[#15120f]"
                            : "border-white/10 bg-white/[0.03] hover:border-white/18"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setNarrativeMode(key)}
                            className="flex-1 rounded-xl px-1 py-1 text-left"
                          >
                            <p className={`text-3xl font-semibold ${selected ? "text-[#f2dfbe]" : "text-white/88"}`}>{mode.label}</p>
                          </button>
                          <button
                            type="button"
                            onClick={() => setHelpMode((prev) => (prev === key ? null : key))}
                            className="rounded-full border border-white/14 bg-white/[0.03] p-1.5 text-white/65 transition hover:bg-white/[0.08] hover:text-white"
                            aria-label={`${mode.label}说明`}
                          >
                            <Question size={16} />
                          </button>
                        </div>
                        {showHelp ? (
                          <p className="mt-2 whitespace-pre-line rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm leading-6 text-white/76">
                            {mode.brief}
                          </p>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-[2rem] font-semibold tracking-tight text-white">剧本导入（选填）</p>
                </div>
                <textarea
                  value={scriptInput}
                  onChange={(event) => setScriptInput(event.target.value)}
                  maxLength={50000}
                  placeholder="请导入剧本，将为你自动分集（文本请用“第 n 章/集”分割）"
                  className="min-h-[180px] rounded-2xl border-white/8 bg-[#2a2d34] text-base placeholder:text-white/32"
                />
                <p className="mt-2 text-right text-sm text-white/52">{scriptInput.length} / 50000</p>
              </div>
            </div>

            <div className="mt-7 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={resetCreateModal}
                className="rounded-full border border-white/12 bg-white/[0.03] px-7 py-3 text-xl font-medium text-white/86 transition hover:bg-white/[0.08]"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleCreateSeries}
                disabled={!seriesName.trim()}
                className={`rounded-full px-7 py-3 text-xl font-semibold transition ${
                  seriesName.trim()
                    ? "bg-[#f2dfbe] text-[#111] hover:brightness-105"
                    : "cursor-not-allowed bg-white/10 text-white/36"
                }`}
              >
                立即创建
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function ButtonPill({
  children,
  tone = "default",
  onClick,
  type,
  disabled,
}: {
  children: ReactNode;
  tone?: "default" | "primary" | "quiet" | "danger";
  onClick?: () => void;
  type?: "button" | "submit";
  disabled?: boolean;
}) {
  const toneClass = {
    default: "border-white/10 bg-white/[0.03] text-white/80 hover:bg-white/[0.06]",
    primary: "border-[#f2dfbe]/40 bg-[#f2dfbe] text-[#111] hover:brightness-105",
    quiet: "border-white/10 bg-[#131922] text-white/72 hover:bg-white/[0.05]",
    danger: "border-rose-400/30 bg-rose-500/20 text-rose-100 hover:bg-rose-500/28",
  }[tone];

  return (
    <button
      type={type ?? "button"}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-2 rounded-2xl border px-3 py-1.5 text-sm font-medium transition ${toneClass} ${
        disabled ? "cursor-not-allowed opacity-60" : ""
      }`}
    >
      {children}
    </button>
  );
}

export function ToneBadge({
  children,
  tone,
}: {
  children: ReactNode;
  tone: "warning" | "good" | "active";
}) {
  const toneClass = {
    warning: "border-rose-400/20 bg-rose-500/15 text-rose-200",
    good: "border-emerald-400/20 bg-emerald-500/15 text-emerald-200",
    active: "border-[#f2dfbe]/30 bg-[#f2dfbe]/10 text-[#f5e7cf]",
  }[tone];

  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-medium ${toneClass}`}>{children}</span>;
}

export function StageDot({ status }: { status: "not_started" | "in_progress" | "blocked" | "ready" | "done" }) {
  if (status === "done") {
    return <CheckCircle size={14} className="text-emerald-300" weight="duotone" />;
  }
  if (status === "blocked") {
    return <Warning size={14} className="text-rose-300" weight="duotone" />;
  }
  if (status === "in_progress") {
    return <Clock size={14} className="text-amber-200" weight="duotone" />;
  }
  if (status === "ready") {
    return <ChartLine size={14} className="text-sky-200" weight="duotone" />;
  }
  return <Circle size={14} className="text-white/35" />;
}

interface OrchestratorProps {
  title: string;
  focus: string;
  completion: number;
  blocking: string;
  nextStep: string;
  recommendations: string[];
  queuePreview: Array<{ id: string; title: string; status: string }>;
}

export function OrchestratorPanel({
  title,
  focus,
  completion,
  blocking,
  nextStep,
  recommendations,
  queuePreview,
}: OrchestratorProps) {
  return (
    <div className="space-y-3">
      <section className="rounded-3xl border border-white/8 bg-white/[0.03] p-4">
        <p className="text-[11px] uppercase tracking-[0.2em] text-white/35">Orchestrator</p>
        <h2 className="mt-1 text-xl font-semibold text-white">{title}</h2>
        <div className="mt-3 rounded-2xl border border-white/8 bg-[#0c1016] p-3">
          <p className="text-[11px] text-white/42">Current Focus</p>
          <p className="mt-1 text-sm font-medium text-white">{focus}</p>
          <div className="mt-2 h-1.5 rounded-full bg-white/8">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#d0a15f] via-[#f0d6a8] to-[#fff4e2]"
              style={{ width: `${completion}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-white/42">Completion {completion}%</p>
          <p className="mt-1 text-xs text-white/68">{blocking}</p>
        </div>
      </section>

      <section className="rounded-3xl border border-white/8 bg-white/[0.03] p-4">
        <p className="text-[11px] uppercase tracking-[0.2em] text-white/35">Recommended Next Step</p>
        <p className="mt-1 text-sm font-medium text-white/85">{nextStep}</p>
        <div className="mt-2 space-y-1.5">
          {recommendations.map((recommendation) => (
            <button
              key={recommendation}
              className="w-full rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2 text-left text-xs text-white/72 hover:bg-white/[0.06]"
            >
              {recommendation}
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-3xl border border-white/8 bg-white/[0.03] p-4">
        <p className="text-[11px] uppercase tracking-[0.2em] text-white/35">Queued Tasks</p>
        <div className="mt-2 space-y-1.5">
          {queuePreview.length === 0 ? (
            <div className="rounded-xl border border-dashed border-white/12 bg-white/[0.02] p-2 text-xs text-white/45">当前没有排队任务</div>
          ) : (
            queuePreview.map((task) => (
              <div key={task.id} className="rounded-xl border border-white/8 bg-white/[0.03] p-2">
                <p className="text-xs font-medium text-white/85">{task.title}</p>
                <p className="mt-0.5 text-[11px] text-white/42">
                  {task.id} · {task.status}
                </p>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

export function StatCard({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note: string;
}) {
  return (
    <article className="rounded-3xl border border-white/8 bg-white/[0.03] p-4">
      <p className="text-sm text-white/40">{label}</p>
      <p className="mt-2 text-3xl font-semibold text-white">{value}</p>
      <p className="mt-1 text-xs text-white/42">{note}</p>
    </article>
  );
}

export function SectionTitle({
  kicker,
  title,
  description,
}: {
  kicker: string;
  title: string;
  description: string;
}) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-[0.2em] text-white/35">{kicker}</p>
      <h3 className="mt-1 text-[26px] font-semibold leading-tight text-white">{title}</h3>
      <p className="mt-2 text-sm text-white/55">{description}</p>
    </div>
  );
}

export function EmptyHint({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-white/12 bg-white/[0.02] p-6 text-center">
      <Sparkle size={18} className="mx-auto text-[#f2dfbe]" />
      <p className="mt-2 text-base font-semibold text-white">{title}</p>
      <p className="mt-1 text-sm text-white/55">{description}</p>
    </div>
  );
}
