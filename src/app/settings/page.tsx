"use client";

import { useEffect, useMemo, useState } from "react";
import { GearSix, HardDrives, Sparkle } from "@phosphor-icons/react/dist/ssr";
import { ButtonPill, OrchestratorPanel, SectionTitle, StudioShell } from "@/components/studio/studio-shell";

type VendorModel = {
  name: string;
  modelName: string;
  type: "text" | "image" | "video";
};

type VendorItem = {
  id: string;
  name: string;
  provider: string;
  baseUrl: string;
  enabled: boolean;
  models: VendorModel[];
  hasApiKey: boolean;
  apiKeyMasked: string;
};

type VendorsResponse = {
  vendors: VendorItem[];
  defaults: {
    textModelRef: string | null;
    imageModelRef: string | null;
    videoModelRef: string | null;
  };
};

type GovernanceDraft = {
  language: {
    locale: "zh-CN" | "en-US";
    fallbackLocale: "zh-CN" | "en-US";
    uiTone: "studio" | "minimal";
  };
  request: {
    timeoutMs: number;
    maxConcurrency: number;
    retryCount: number;
    autoFallback: boolean;
  };
  prompts: {
    stagePreset: "balanced" | "cinematic" | "fast";
    globalPolicy: string;
    safetyGuardrail: string;
  };
  skills: {
    enabledSkills: string;
    autoActivation: boolean;
    reviewBeforeApply: boolean;
  };
  memory: {
    retentionDays: number;
    summaryMode: "compact" | "full";
    scope: "series" | "episode";
  };
  agent: {
    plannerModel: string;
    executorMode: "manual" | "assisted" | "auto";
    autoRetryFailedTasks: boolean;
  };
  files: {
    workspaceRoot: string;
    exportFormat: "mp4+json" | "zip" | "markdown";
    autoArchiveDays: number;
  };
  data: {
    snapshotRetentionDays: number;
    autoBackup: boolean;
    cleanupOnStartup: boolean;
  };
  about: {
    channel: "stable" | "beta";
    lastCheckedAt: string;
    notes: string;
  };
};

const CURRENT_VERSION = "0.1.0";
const GOVERNANCE_STORAGE_KEY = "mercruiser.runtime-governance.v1";

const defaultGovernanceDraft: GovernanceDraft = {
  language: {
    locale: "zh-CN",
    fallbackLocale: "en-US",
    uiTone: "studio",
  },
  request: {
    timeoutMs: 30000,
    maxConcurrency: 3,
    retryCount: 2,
    autoFallback: true,
  },
  prompts: {
    stagePreset: "balanced",
    globalPolicy: "保持系列主线一致，优先复用系列设定与共享资产。",
    safetyGuardrail: "避免角色设定漂移，任何风格重写都要保留已锁定事实。",
  },
  skills: {
    enabledSkills: "series-bootstrap\nepisode-pipeline\nasset-review",
    autoActivation: true,
    reviewBeforeApply: true,
  },
  memory: {
    retentionDays: 14,
    summaryMode: "compact",
    scope: "series",
  },
  agent: {
    plannerModel: "deepseek-ai/DeepSeek-V3",
    executorMode: "assisted",
    autoRetryFailedTasks: false,
  },
  files: {
    workspaceRoot: "/workspace/mercruiser",
    exportFormat: "mp4+json",
    autoArchiveDays: 7,
  },
  data: {
    snapshotRetentionDays: 30,
    autoBackup: true,
    cleanupOnStartup: false,
  },
  about: {
    channel: "stable",
    lastCheckedAt: "",
    notes: "当前版本聚焦系列生产主链路与任务恢复。",
  },
};

function clamp(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, Math.round(value)));
}

function sanitizeGovernanceDraft(draft: GovernanceDraft): GovernanceDraft {
  return {
    language: {
      locale: draft.language.locale === "en-US" ? "en-US" : "zh-CN",
      fallbackLocale: draft.language.fallbackLocale === "zh-CN" ? "zh-CN" : "en-US",
      uiTone: draft.language.uiTone === "minimal" ? "minimal" : "studio",
    },
    request: {
      timeoutMs: clamp(draft.request.timeoutMs, 1000, 120000, defaultGovernanceDraft.request.timeoutMs),
      maxConcurrency: clamp(draft.request.maxConcurrency, 1, 12, defaultGovernanceDraft.request.maxConcurrency),
      retryCount: clamp(draft.request.retryCount, 0, 10, defaultGovernanceDraft.request.retryCount),
      autoFallback: Boolean(draft.request.autoFallback),
    },
    prompts: {
      stagePreset: draft.prompts.stagePreset === "cinematic" || draft.prompts.stagePreset === "fast" ? draft.prompts.stagePreset : "balanced",
      globalPolicy: draft.prompts.globalPolicy.trim(),
      safetyGuardrail: draft.prompts.safetyGuardrail.trim(),
    },
    skills: {
      enabledSkills: draft.skills.enabledSkills.trim(),
      autoActivation: Boolean(draft.skills.autoActivation),
      reviewBeforeApply: Boolean(draft.skills.reviewBeforeApply),
    },
    memory: {
      retentionDays: clamp(draft.memory.retentionDays, 1, 180, defaultGovernanceDraft.memory.retentionDays),
      summaryMode: draft.memory.summaryMode === "full" ? "full" : "compact",
      scope: draft.memory.scope === "episode" ? "episode" : "series",
    },
    agent: {
      plannerModel: draft.agent.plannerModel.trim() || defaultGovernanceDraft.agent.plannerModel,
      executorMode: draft.agent.executorMode === "manual" || draft.agent.executorMode === "auto" ? draft.agent.executorMode : "assisted",
      autoRetryFailedTasks: Boolean(draft.agent.autoRetryFailedTasks),
    },
    files: {
      workspaceRoot: draft.files.workspaceRoot.trim() || defaultGovernanceDraft.files.workspaceRoot,
      exportFormat: draft.files.exportFormat === "zip" || draft.files.exportFormat === "markdown" ? draft.files.exportFormat : "mp4+json",
      autoArchiveDays: clamp(draft.files.autoArchiveDays, 0, 90, defaultGovernanceDraft.files.autoArchiveDays),
    },
    data: {
      snapshotRetentionDays: clamp(draft.data.snapshotRetentionDays, 1, 365, defaultGovernanceDraft.data.snapshotRetentionDays),
      autoBackup: Boolean(draft.data.autoBackup),
      cleanupOnStartup: Boolean(draft.data.cleanupOnStartup),
    },
    about: {
      channel: draft.about.channel === "beta" ? "beta" : "stable",
      lastCheckedAt: draft.about.lastCheckedAt.trim(),
      notes: draft.about.notes.trim(),
    },
  };
}

function mergeGovernanceDraft(input: unknown): GovernanceDraft {
  const raw = (input ?? {}) as Partial<GovernanceDraft>;
  return sanitizeGovernanceDraft({
    ...defaultGovernanceDraft,
    ...raw,
    language: { ...defaultGovernanceDraft.language, ...raw.language },
    request: { ...defaultGovernanceDraft.request, ...raw.request },
    prompts: { ...defaultGovernanceDraft.prompts, ...raw.prompts },
    skills: { ...defaultGovernanceDraft.skills, ...raw.skills },
    memory: { ...defaultGovernanceDraft.memory, ...raw.memory },
    agent: { ...defaultGovernanceDraft.agent, ...raw.agent },
    files: { ...defaultGovernanceDraft.files, ...raw.files },
    data: { ...defaultGovernanceDraft.data, ...raw.data },
    about: { ...defaultGovernanceDraft.about, ...raw.about },
  });
}

function readGovernanceDraft(): GovernanceDraft {
  if (typeof window === "undefined") {
    return defaultGovernanceDraft;
  }

  try {
    const stored = window.localStorage.getItem(GOVERNANCE_STORAGE_KEY);
    return stored ? mergeGovernanceDraft(JSON.parse(stored)) : defaultGovernanceDraft;
  } catch {
    return defaultGovernanceDraft;
  }
}

function formatCheckedAt(iso: string): string {
  if (!iso) {
    return "尚未检查";
  }

  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }

  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")} ${String(
    date.getHours(),
  ).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

export default function SettingsPage() {
  const [activeSection, setActiveSection] = useState("language");
  const [vendorsData, setVendorsData] = useState<VendorsResponse | null>(null);
  const [governanceDraft, setGovernanceDraft] = useState<GovernanceDraft>(defaultGovernanceDraft);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [testingModelRef, setTestingModelRef] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [opsNotice, setOpsNotice] = useState<string | null>(null);

  const loadVendors = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/v1/vendors", { cache: "no-store" });
      const json = (await response.json()) as { ok: boolean; data?: VendorsResponse; error?: string };
      if (!response.ok || !json.ok || !json.data) {
        throw new Error(json.error ?? "加载配置失败");
      }
      setVendorsData(json.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载配置失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setGovernanceDraft(readGovernanceDraft());
    void loadVendors();
  }, []);

  const sections = useMemo(
    () => [
      { id: "language", title: "语言", description: "界面语言、回退语言与展示风格" },
      { id: "vendors", title: "供应商", description: "管理大模型供应商与凭据" },
      { id: "models", title: "默认模型", description: "系列默认 text/image/video 模型" },
      { id: "request", title: "请求", description: "超时、并发、重试与回退策略" },
      { id: "prompts", title: "Prompt", description: "阶段提示词策略与全局约束" },
      { id: "skills", title: "Skill", description: "技能白名单与自动触发治理" },
      { id: "memory", title: "Memory", description: "记忆保留周期与汇总策略" },
      { id: "agent", title: "Agent", description: "Agent 执行模式与失败恢复策略" },
      { id: "files", title: "文件", description: "工作区根目录、归档与导出偏好" },
      { id: "data", title: "数据", description: "快照保留、备份与清理规则" },
      { id: "about", title: "关于与更新", description: "版本通道、文档指引与更新检查" },
    ],
    [],
  );

  const current = sections.find((section) => section.id === activeSection) ?? sections[0];
  const isGovernanceSection = !["vendors", "models"].includes(activeSection);

  const updateDraft = <K extends keyof GovernanceDraft,>(section: K, patch: Partial<GovernanceDraft[K]>) => {
    setGovernanceDraft((prev) => ({
      ...prev,
      [section]: {
        ...prev[section],
        ...patch,
      },
    }));
  };

  const persistGovernanceDraft = (message: string) => {
    const sanitized = sanitizeGovernanceDraft(governanceDraft);
    setGovernanceDraft(sanitized);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(GOVERNANCE_STORAGE_KEY, JSON.stringify(sanitized));
    }
    setOpsNotice(message);
  };

  const cleanInvalidData = () => {
    const cleaned = sanitizeGovernanceDraft(governanceDraft);
    setGovernanceDraft(cleaned);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(GOVERNANCE_STORAGE_KEY, JSON.stringify(cleaned));
    }
    setOpsNotice("已清理无效配置并重写为可用值。");
  };

  const checkUpdates = () => {
    const now = new Date().toISOString();
    setGovernanceDraft((prev) => {
      const next = {
        ...prev,
        about: {
          ...prev.about,
          lastCheckedAt: now,
        },
      };
      if (typeof window !== "undefined") {
        window.localStorage.setItem(GOVERNANCE_STORAGE_KEY, JSON.stringify(sanitizeGovernanceDraft(next)));
      }
      return next;
    });
    setOpsNotice(`已检查更新：当前 ${CURRENT_VERSION} 为最新稳定版本。`);
  };

  const testModel = async (modelRef: string, type: "text" | "image" | "video") => {
    setTestingModelRef(modelRef);
    setTestResult(null);
    try {
      const response = await fetch("/api/v1/vendors/test", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ modelRef, type }),
      });
      const json = (await response.json()) as { ok: boolean; data?: { status?: string }; error?: string };
      if (!response.ok || !json.ok) {
        throw new Error(json.error ?? "模型测试失败");
      }
      setTestResult(`${modelRef} 测试结果：${json.data?.status ?? "ok"}`);
    } catch (e) {
      setTestResult(e instanceof Error ? e.message : "模型测试失败");
    } finally {
      setTestingModelRef(null);
    }
  };

  const renderGovernanceSection = () => {
    if (activeSection === "language") {
      return (
        <div className="mt-4 grid gap-3 xl:grid-cols-2">
          <div className="rounded-xl border border-[var(--mc-stroke)] bg-[var(--mc-soft)] p-4">
            <label className="block text-sm font-semibold text-[var(--mc-ink)]">
              界面语言
              <select className="mt-2" value={governanceDraft.language.locale} onChange={(event) => updateDraft("language", { locale: event.target.value as "zh-CN" | "en-US" })}>
                <option value="zh-CN">简体中文</option>
                <option value="en-US">English</option>
              </select>
            </label>
            <label className="mt-3 block text-sm font-semibold text-[var(--mc-ink)]">
              回退语言
              <select className="mt-2" value={governanceDraft.language.fallbackLocale} onChange={(event) => updateDraft("language", { fallbackLocale: event.target.value as "zh-CN" | "en-US" })}>
                <option value="zh-CN">简体中文</option>
                <option value="en-US">English</option>
              </select>
            </label>
            <label className="mt-3 block text-sm font-semibold text-[var(--mc-ink)]">
              界面风格
              <select className="mt-2" value={governanceDraft.language.uiTone} onChange={(event) => updateDraft("language", { uiTone: event.target.value as "studio" | "minimal" })}>
                <option value="studio">Studio</option>
                <option value="minimal">Minimal</option>
              </select>
            </label>
          </div>
          <div className="rounded-xl border border-[var(--mc-stroke)] bg-white p-4">
            <p className="text-[11px] uppercase tracking-[0.22em] text-[var(--mc-muted)]">Preview</p>
            <p className="mt-2 text-lg font-semibold text-[var(--mc-ink)]">{governanceDraft.language.locale === "zh-CN" ? "当前工作区已按中文优先显示。" : "Workspace is now configured for English-first display."}</p>
            <p className="mt-2 text-sm leading-7 text-[var(--mc-muted)]">
              回退语言：{governanceDraft.language.fallbackLocale} · 风格：{governanceDraft.language.uiTone}
            </p>
          </div>
        </div>
      );
    }

    if (activeSection === "request") {
      return (
        <div className="mt-4 grid gap-3 xl:grid-cols-2">
          <div className="rounded-xl border border-[var(--mc-stroke)] bg-[var(--mc-soft)] p-4">
            <label className="block text-sm font-semibold text-[var(--mc-ink)]">
              超时时间（ms）
              <input className="mt-2" type="number" value={governanceDraft.request.timeoutMs} onChange={(event) => updateDraft("request", { timeoutMs: Number(event.target.value) })} />
            </label>
            <label className="mt-3 block text-sm font-semibold text-[var(--mc-ink)]">
              最大并发
              <input className="mt-2" type="number" value={governanceDraft.request.maxConcurrency} onChange={(event) => updateDraft("request", { maxConcurrency: Number(event.target.value) })} />
            </label>
            <label className="mt-3 block text-sm font-semibold text-[var(--mc-ink)]">
              重试次数
              <input className="mt-2" type="number" value={governanceDraft.request.retryCount} onChange={(event) => updateDraft("request", { retryCount: Number(event.target.value) })} />
            </label>
            <label className="mt-3 flex items-center gap-2 text-sm text-[var(--mc-ink)]">
              <input type="checkbox" checked={governanceDraft.request.autoFallback} onChange={(event) => updateDraft("request", { autoFallback: event.target.checked })} />
              失败时自动回退到备用供应商
            </label>
          </div>
          <div className="rounded-xl border border-[var(--mc-stroke)] bg-white p-4 text-sm text-[var(--mc-muted)]">
            <p className="font-semibold text-[var(--mc-ink)]">Request Budget</p>
            <ul className="mt-3 space-y-2 leading-7">
              <li>超时：{governanceDraft.request.timeoutMs} ms</li>
              <li>并发：{governanceDraft.request.maxConcurrency} 路</li>
              <li>失败重试：{governanceDraft.request.retryCount} 次</li>
              <li>自动回退：{governanceDraft.request.autoFallback ? "开启" : "关闭"}</li>
            </ul>
          </div>
        </div>
      );
    }

    if (activeSection === "prompts") {
      return (
        <div className="mt-4 grid gap-3 xl:grid-cols-2">
          <div className="rounded-xl border border-[var(--mc-stroke)] bg-[var(--mc-soft)] p-4">
            <label className="block text-sm font-semibold text-[var(--mc-ink)]">
              阶段预设
              <select className="mt-2" value={governanceDraft.prompts.stagePreset} onChange={(event) => updateDraft("prompts", { stagePreset: event.target.value as "balanced" | "cinematic" | "fast" })}>
                <option value="balanced">Balanced</option>
                <option value="cinematic">Cinematic</option>
                <option value="fast">Fast Turnaround</option>
              </select>
            </label>
            <label className="mt-3 block text-sm font-semibold text-[var(--mc-ink)]">
              全局提示词策略
              <textarea className="mt-2 min-h-[120px]" value={governanceDraft.prompts.globalPolicy} onChange={(event) => updateDraft("prompts", { globalPolicy: event.target.value })} />
            </label>
          </div>
          <div className="rounded-xl border border-[var(--mc-stroke)] bg-white p-4">
            <label className="block text-sm font-semibold text-[var(--mc-ink)]">
              安全与一致性约束
              <textarea className="mt-2 min-h-[120px]" value={governanceDraft.prompts.safetyGuardrail} onChange={(event) => updateDraft("prompts", { safetyGuardrail: event.target.value })} />
            </label>
            <p className="mt-3 text-sm leading-7 text-[var(--mc-muted)]">用于约束系列事实、角色设定与锁定资产，避免后续阶段发生漂移。</p>
          </div>
        </div>
      );
    }

    if (activeSection === "skills") {
      return (
        <div className="mt-4 grid gap-3 xl:grid-cols-2">
          <div className="rounded-xl border border-[var(--mc-stroke)] bg-[var(--mc-soft)] p-4">
            <label className="block text-sm font-semibold text-[var(--mc-ink)]">
              启用技能列表（每行一个）
              <textarea className="mt-2 min-h-[160px]" value={governanceDraft.skills.enabledSkills} onChange={(event) => updateDraft("skills", { enabledSkills: event.target.value })} />
            </label>
          </div>
          <div className="rounded-xl border border-[var(--mc-stroke)] bg-white p-4 text-sm text-[var(--mc-ink)]">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={governanceDraft.skills.autoActivation} onChange={(event) => updateDraft("skills", { autoActivation: event.target.checked })} />
              满足关键字时自动触发技能
            </label>
            <label className="mt-3 flex items-center gap-2">
              <input type="checkbox" checked={governanceDraft.skills.reviewBeforeApply} onChange={(event) => updateDraft("skills", { reviewBeforeApply: event.target.checked })} />
              高风险技能在执行前要求复核
            </label>
            <p className="mt-4 text-sm leading-7 text-[var(--mc-muted)]">用于治理 Prompt / Skill / Memory / Agent 等跨阶段自动化行为。</p>
          </div>
        </div>
      );
    }

    if (activeSection === "memory") {
      return (
        <div className="mt-4 grid gap-3 xl:grid-cols-2">
          <div className="rounded-xl border border-[var(--mc-stroke)] bg-[var(--mc-soft)] p-4">
            <label className="block text-sm font-semibold text-[var(--mc-ink)]">
              记忆保留天数
              <input className="mt-2" type="number" value={governanceDraft.memory.retentionDays} onChange={(event) => updateDraft("memory", { retentionDays: Number(event.target.value) })} />
            </label>
            <label className="mt-3 block text-sm font-semibold text-[var(--mc-ink)]">
              汇总方式
              <select className="mt-2" value={governanceDraft.memory.summaryMode} onChange={(event) => updateDraft("memory", { summaryMode: event.target.value as "compact" | "full" })}>
                <option value="compact">Compact</option>
                <option value="full">Full</option>
              </select>
            </label>
            <label className="mt-3 block text-sm font-semibold text-[var(--mc-ink)]">
              作用范围
              <select className="mt-2" value={governanceDraft.memory.scope} onChange={(event) => updateDraft("memory", { scope: event.target.value as "series" | "episode" })}>
                <option value="series">系列级</option>
                <option value="episode">集级</option>
              </select>
            </label>
          </div>
          <div className="rounded-xl border border-[var(--mc-stroke)] bg-white p-4 text-sm leading-7 text-[var(--mc-muted)]">
            <p>当前策略会在 {governanceDraft.memory.retentionDays} 天内保留 {governanceDraft.memory.scope === "series" ? "系列共享" : "单集临时"} 记忆。</p>
            <p className="mt-2">汇总模式：{governanceDraft.memory.summaryMode === "compact" ? "压缩摘要" : "完整摘要"}</p>
          </div>
        </div>
      );
    }

    if (activeSection === "agent") {
      return (
        <div className="mt-4 grid gap-3 xl:grid-cols-2">
          <div className="rounded-xl border border-[var(--mc-stroke)] bg-[var(--mc-soft)] p-4">
            <label className="block text-sm font-semibold text-[var(--mc-ink)]">
              Planner 模型
              <input className="mt-2" value={governanceDraft.agent.plannerModel} onChange={(event) => updateDraft("agent", { plannerModel: event.target.value })} />
            </label>
            <label className="mt-3 block text-sm font-semibold text-[var(--mc-ink)]">
              执行模式
              <select className="mt-2" value={governanceDraft.agent.executorMode} onChange={(event) => updateDraft("agent", { executorMode: event.target.value as "manual" | "assisted" | "auto" })}>
                <option value="manual">Manual</option>
                <option value="assisted">Assisted</option>
                <option value="auto">Auto</option>
              </select>
            </label>
            <label className="mt-3 flex items-center gap-2 text-sm text-[var(--mc-ink)]">
              <input type="checkbox" checked={governanceDraft.agent.autoRetryFailedTasks} onChange={(event) => updateDraft("agent", { autoRetryFailedTasks: event.target.checked })} />
              失败任务自动重试一次
            </label>
          </div>
          <div className="rounded-xl border border-[var(--mc-stroke)] bg-white p-4 text-sm text-[var(--mc-muted)]">
            <p className="font-semibold text-[var(--mc-ink)]">Agent Governance</p>
            <p className="mt-3 leading-7">当前主执行模式：{governanceDraft.agent.executorMode}。可与任务中心恢复策略联动，保证失败后仍有人工接管空间。</p>
          </div>
        </div>
      );
    }

    if (activeSection === "files") {
      return (
        <div className="mt-4 grid gap-3 xl:grid-cols-2">
          <div className="rounded-xl border border-[var(--mc-stroke)] bg-[var(--mc-soft)] p-4">
            <label className="block text-sm font-semibold text-[var(--mc-ink)]">
              工作区根目录
              <input className="mt-2" value={governanceDraft.files.workspaceRoot} onChange={(event) => updateDraft("files", { workspaceRoot: event.target.value })} />
            </label>
            <label className="mt-3 block text-sm font-semibold text-[var(--mc-ink)]">
              默认导出格式
              <select className="mt-2" value={governanceDraft.files.exportFormat} onChange={(event) => updateDraft("files", { exportFormat: event.target.value as "mp4+json" | "zip" | "markdown" })}>
                <option value="mp4+json">mp4 + json</option>
                <option value="zip">zip 包</option>
                <option value="markdown">markdown 记录</option>
              </select>
            </label>
            <label className="mt-3 block text-sm font-semibold text-[var(--mc-ink)]">
              自动归档天数
              <input className="mt-2" type="number" value={governanceDraft.files.autoArchiveDays} onChange={(event) => updateDraft("files", { autoArchiveDays: Number(event.target.value) })} />
            </label>
          </div>
          <div className="rounded-xl border border-[var(--mc-stroke)] bg-white p-4 text-sm leading-7 text-[var(--mc-muted)]">
            <p>导出格式：{governanceDraft.files.exportFormat}</p>
            <p className="mt-2">归档策略：{governanceDraft.files.autoArchiveDays === 0 ? "仅手动归档" : `${governanceDraft.files.autoArchiveDays} 天后自动归档`}</p>
          </div>
        </div>
      );
    }

    if (activeSection === "data") {
      return (
        <div className="mt-4 grid gap-3 xl:grid-cols-2">
          <div className="rounded-xl border border-[var(--mc-stroke)] bg-[var(--mc-soft)] p-4">
            <label className="block text-sm font-semibold text-[var(--mc-ink)]">
              快照保留天数
              <input className="mt-2" type="number" value={governanceDraft.data.snapshotRetentionDays} onChange={(event) => updateDraft("data", { snapshotRetentionDays: Number(event.target.value) })} />
            </label>
            <label className="mt-3 flex items-center gap-2 text-sm text-[var(--mc-ink)]">
              <input type="checkbox" checked={governanceDraft.data.autoBackup} onChange={(event) => updateDraft("data", { autoBackup: event.target.checked })} />
              自动备份关键项目数据
            </label>
            <label className="mt-3 flex items-center gap-2 text-sm text-[var(--mc-ink)]">
              <input type="checkbox" checked={governanceDraft.data.cleanupOnStartup} onChange={(event) => updateDraft("data", { cleanupOnStartup: event.target.checked })} />
              启动时执行失效数据清理
            </label>
          </div>
          <div className="rounded-xl border border-[var(--mc-stroke)] bg-white p-4 text-sm leading-7 text-[var(--mc-muted)]">
            <p>数据快照保留 {governanceDraft.data.snapshotRetentionDays} 天。</p>
            <p className="mt-2">自动备份：{governanceDraft.data.autoBackup ? "开启" : "关闭"}</p>
            <p className="mt-2">启动清理：{governanceDraft.data.cleanupOnStartup ? "开启" : "关闭"}</p>
          </div>
        </div>
      );
    }

    if (activeSection === "about") {
      return (
        <div className="mt-4 grid gap-3 xl:grid-cols-2">
          <div className="rounded-xl border border-[var(--mc-stroke)] bg-[var(--mc-soft)] p-4">
            <p className="text-[11px] uppercase tracking-[0.22em] text-[var(--mc-muted)]">Version</p>
            <p className="mt-2 text-2xl font-bold text-[var(--mc-ink)]">Mercruiser Web {CURRENT_VERSION}</p>
            <label className="mt-3 block text-sm font-semibold text-[var(--mc-ink)]">
              更新通道
              <select className="mt-2" value={governanceDraft.about.channel} onChange={(event) => updateDraft("about", { channel: event.target.value as "stable" | "beta" })}>
                <option value="stable">Stable</option>
                <option value="beta">Beta</option>
              </select>
            </label>
            <p className="mt-3 text-sm text-[var(--mc-muted)]">上次检查：{formatCheckedAt(governanceDraft.about.lastCheckedAt)}</p>
          </div>
          <div className="rounded-xl border border-[var(--mc-stroke)] bg-white p-4">
            <p className="text-sm font-semibold text-[var(--mc-ink)]">文档索引</p>
            <ul className="mt-3 space-y-2 text-sm text-[var(--mc-muted)]">
              <li>业务 PRD</li>
              <li>用户交互文档</li>
              <li>Use Cases 文档</li>
            </ul>
            <label className="mt-4 block text-sm font-semibold text-[var(--mc-ink)]">
              发布说明备注
              <textarea className="mt-2 min-h-[110px]" value={governanceDraft.about.notes} onChange={(event) => updateDraft("about", { notes: event.target.value })} />
            </label>
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <StudioShell
      navKey="settings"
      eyebrow="Studio Settings"
      title="Runtime Governance"
      description="UC-16 / UC-17: 统一维护 Prompt、Skill、Memory、Agent 和运行配置，确保 Studio 长期可用。"
      actions={
        <>
          <ButtonPill tone="quiet" onClick={() => void loadVendors()}>
            <Sparkle size={14} />
            刷新配置
          </ButtonPill>
        </>
      }
      aside={
        <OrchestratorPanel
          title="Ops Console"
          focus="运行时配置巡检"
          completion={vendorsData ? 82 : 28}
          blocking={error ?? "当前无阻塞"}
          nextStep={isGovernanceSection ? "保存当前治理配置并检查更新状态" : "检查供应商配置并执行模型连通性测试"}
          recommendations={["保存配置", "检查更新", "清理无效数据"]}
          queuePreview={
            (vendorsData?.vendors ?? []).slice(0, 3).map((vendor) => ({
              id: vendor.id,
              title: `${vendor.name} / ${vendor.provider}`,
              status: vendor.enabled ? "enabled" : "disabled",
            }))
          }
        />
      }
    >
      <section className="mc-soft-panel rounded-[1.4rem] p-4">
        <SectionTitle
          kicker="Control Surface"
          title="System-level configuration"
          description="设置中心承接运行时治理能力，当前覆盖语言、请求、Prompt、Skill、Memory、Agent、文件、数据与版本巡检。"
        />

        <div className="mt-4 grid gap-3 xl:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="rounded-2xl border border-[var(--mc-stroke)] bg-white/80 p-3">
            {sections.map((section) => (
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
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="inline-flex items-center gap-2 rounded-full border border-[var(--mc-stroke)] bg-[var(--mc-soft)] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--mc-muted)]">
                  <HardDrives size={12} />
                  {current.id}
                </p>
                <h3 className="mt-2 text-2xl font-bold leading-tight text-[var(--mc-ink)]">{current.title}</h3>
                <p className="mt-2 text-sm leading-7 text-[var(--mc-muted)]">{current.description}</p>
              </div>

              {isGovernanceSection ? (
                <div className="flex flex-wrap gap-2">
                  <ButtonPill tone="quiet" onClick={cleanInvalidData}>
                    清理无效数据
                  </ButtonPill>
                  <ButtonPill tone="quiet" onClick={checkUpdates}>
                    检查更新
                  </ButtonPill>
                  <ButtonPill tone="primary" onClick={() => persistGovernanceDraft(`已保存 ${current.title} 配置。`)}>
                    保存配置
                  </ButtonPill>
                </div>
              ) : null}
            </div>

            {loading ? <p className="mt-4 text-sm text-[var(--mc-muted)]">加载中...</p> : null}
            {error ? <p className="mt-4 text-sm text-[var(--mc-danger)]">{error}</p> : null}
            {testResult ? <p className="mt-4 text-sm text-[var(--mc-ink)]">{testResult}</p> : null}
            {opsNotice ? <p className="mt-4 text-sm text-[var(--mc-ink)]">{opsNotice}</p> : null}

            {activeSection === "vendors" ? (
              <div className="mt-4 space-y-3">
                {(vendorsData?.vendors ?? []).map((vendor) => (
                  <div key={vendor.id} className="rounded-xl border border-[var(--mc-stroke)] bg-[var(--mc-soft)] p-3">
                    <p className="text-sm font-semibold text-[var(--mc-ink)]">{vendor.name}</p>
                    <p className="text-xs text-[var(--mc-muted)]">{vendor.id} · {vendor.provider}</p>
                    <p className="mt-1 text-xs text-[var(--mc-muted)]">{vendor.baseUrl}</p>
                    <p className="mt-1 text-xs text-[var(--mc-muted)]">
                      API Key: {vendor.hasApiKey ? vendor.apiKeyMasked || "已配置" : "未配置"}
                    </p>
                    <div className="mt-3 grid gap-2 md:grid-cols-2">
                      {vendor.models.map((model) => {
                        const modelRef = `${vendor.id}:${model.modelName}`;
                        return (
                          <div key={modelRef} className="rounded-lg border border-[var(--mc-stroke)] bg-white p-2">
                            <p className="text-xs font-semibold text-[var(--mc-ink)]">{model.name}</p>
                            <p className="text-[11px] text-[var(--mc-muted)]">{model.modelName}</p>
                            <div className="mt-2">
                              <ButtonPill tone="quiet" onClick={() => void testModel(modelRef, model.type)} disabled={testingModelRef === modelRef}>
                                {testingModelRef === modelRef ? "测试中..." : `测试 ${model.type}`}
                              </ButtonPill>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}

            {activeSection === "models" ? (
              <div className="mt-4 space-y-2">
                <div className="rounded-xl border border-[var(--mc-stroke)] bg-[var(--mc-soft)] p-3 text-sm text-[var(--mc-ink)]">
                  默认文本模型：{vendorsData?.defaults.textModelRef ?? "未配置"}
                </div>
                <div className="rounded-xl border border-[var(--mc-stroke)] bg-[var(--mc-soft)] p-3 text-sm text-[var(--mc-ink)]">
                  默认图片模型：{vendorsData?.defaults.imageModelRef ?? "未配置"}
                </div>
                <div className="rounded-xl border border-[var(--mc-stroke)] bg-[var(--mc-soft)] p-3 text-sm text-[var(--mc-ink)]">
                  默认视频模型：{vendorsData?.defaults.videoModelRef ?? "未配置"}
                </div>
              </div>
            ) : null}

            {isGovernanceSection ? renderGovernanceSection() : null}
          </article>
        </div>
      </section>
    </StudioShell>
  );
}
