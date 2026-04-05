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

export default function SettingsPage() {
  const [activeSection, setActiveSection] = useState("vendors");
  const [vendorsData, setVendorsData] = useState<VendorsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [testingModelRef, setTestingModelRef] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<string | null>(null);

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
    void loadVendors();
  }, []);

  const sections = useMemo(
    () => [
      { id: "vendors", title: "供应商", description: "管理大模型供应商与凭据" },
      { id: "models", title: "默认模型", description: "系列默认 text/image/video 模型" },
      { id: "prompts", title: "Prompt", description: "阶段提示词策略（下一阶段完善）" },
      { id: "skills", title: "Skill", description: "技能治理（下一阶段完善）" },
      { id: "memory", title: "Memory", description: "记忆治理（下一阶段完善）" },
      { id: "agent", title: "Agent", description: "Agent 配置（下一阶段完善）" },
      { id: "files", title: "文件", description: "文件治理（下一阶段完善）" },
      { id: "data", title: "数据", description: "数据治理（下一阶段完善）" },
    ],
    [],
  );

  const current = sections.find((section) => section.id === activeSection) ?? sections[0];

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
          completion={vendorsData ? 78 : 24}
          blocking={error ?? "当前无阻塞"}
          nextStep="检查供应商配置并执行模型连通性测试"
          recommendations={["检查供应商凭据", "运行模型测试", "更新默认模型映射"]}
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
          description="设置中心承接运行时治理能力，当前优先接通供应商与默认模型配置。"
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
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="inline-flex items-center gap-2 rounded-full border border-[var(--mc-stroke)] bg-[var(--mc-soft)] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--mc-muted)]">
                  <HardDrives size={12} />
                  {current.id}
                </p>
                <h3 className="mt-2 text-2xl font-bold leading-tight text-[var(--mc-ink)]">{current.title}</h3>
                <p className="mt-2 text-sm leading-7 text-[var(--mc-muted)]">{current.description}</p>
              </div>
            </div>

            {loading ? <p className="mt-4 text-sm text-[var(--mc-muted)]">加载中...</p> : null}
            {error ? <p className="mt-4 text-sm text-[var(--mc-danger)]">{error}</p> : null}
            {testResult ? <p className="mt-4 text-sm text-[var(--mc-ink)]">{testResult}</p> : null}

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
                              <ButtonPill
                                tone="quiet"
                                onClick={() => void testModel(modelRef, model.type)}
                                disabled={testingModelRef === modelRef}
                              >
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

            {activeSection !== "vendors" && activeSection !== "models" ? (
              <div className="mt-4 rounded-xl border border-[var(--mc-stroke)] bg-[var(--mc-soft)] p-3 text-sm text-[var(--mc-muted)]">
                该分组本轮先完成结构占位与入口对齐，具体能力将在下一阶段按 PRD 继续落地。
              </div>
            ) : null}
          </article>
        </div>
      </section>
    </StudioShell>
  );
}
