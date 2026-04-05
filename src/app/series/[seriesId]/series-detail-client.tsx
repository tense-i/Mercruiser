"use client";

import Link from "next/link";
import Image from "next/image";
import { type ChangeEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, ShieldCheck } from "@phosphor-icons/react/dist/ssr";
import type { SeriesDetailView as SeriesDetail, SharedAssetView as SharedAsset } from "@/server/mvp/types";
import { stageLabels, statusLabels } from "@/lib/mvp-ui";
import {
  ButtonPill,
  EmptyHint,
  OrchestratorPanel,
  SectionTitle,
  StageDot,
  StudioShell,
} from "@/components/studio/studio-shell";

const tabs = [
  { id: "overview", label: "总览" },
  { id: "settings", label: "系列设定" },
  { id: "episodes", label: "集数管理" },
  { id: "script-reference", label: "剧本引用" },
  { id: "assets", label: "共享资产" },
  { id: "strategy", label: "策略配置" },
] as const;

type TabId = (typeof tabs)[number]["id"];
type AssetCategory = "characters" | "scenes" | "props";

const assetCategoryLabels: Record<AssetCategory, string> = {
  characters: "角色",
  scenes: "场景",
  props: "道具",
};

const assetCategories: Array<{ id: AssetCategory; label: string }> = [
  { id: "characters", label: "角色" },
  { id: "scenes", label: "场景" },
  { id: "props", label: "道具" },
];

interface AssetGenState {
  description: string;
  model: string;
  references: string[];
  lastGeneratedAt: string | null;
}

function createAssetGenState(asset: SharedAsset, defaultModel: string): AssetGenState {
  return {
    description: asset.note ?? asset.summary,
    model: defaultModel,
    references: [],
    lastGeneratedAt: null,
  };
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error(`读取文件失败: ${file.name}`));
    reader.readAsDataURL(file);
  });
}

export function SeriesDetailClient({ series }: { series: SeriesDetail }) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [assetCategory, setAssetCategory] = useState<AssetCategory>("characters");
  const [settingsForm, setSettingsForm] = useState({
    title: series.title,
    summary: series.subtitle,
    worldview: series.worldview,
    visualGuide: series.visualGuide,
    directorGuide: series.directorGuide,
    genre: "AI 短剧",
  });
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [settingsNotice, setSettingsNotice] = useState<string | null>(null);
  const defaultImageModel = series.strategy.models.image;
  const imageModelOptions = useMemo(
    () =>
      Array.from(
        new Set([
          defaultImageModel,
          "imagen-cinematic-v2",
          "gpt-image-1",
          "flux-cinematic-lite",
          "seedream-5.0-lite",
        ]),
      ),
    [defaultImageModel],
  );
  const allAssetsById = useMemo(
    () => Object.fromEntries(series.sharedAssets.map((asset) => [asset.id, asset])),
    [series.sharedAssets],
  );
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(
    series.sharedAssets.find((asset) => asset.category === "characters")?.id ?? series.sharedAssets[0]?.id ?? null,
  );
  const [assetGenMap, setAssetGenMap] = useState<Record<string, AssetGenState>>(() =>
    Object.fromEntries(
      series.sharedAssets.map((asset) => [asset.id, createAssetGenState(asset, defaultImageModel)]),
    ),
  );

  const filteredAssets = useMemo(
    () => series.sharedAssets.filter((asset) => asset.category === assetCategory),
    [assetCategory, series.sharedAssets],
  );
  const effectiveSelectedAssetId = useMemo(
    () =>
      filteredAssets.some((asset) => asset.id === selectedAssetId)
        ? selectedAssetId
        : (filteredAssets[0]?.id ?? null),
    [filteredAssets, selectedAssetId],
  );
  const selectedAsset = useMemo(
    () => filteredAssets.find((asset) => asset.id === effectiveSelectedAssetId) ?? null,
    [filteredAssets, effectiveSelectedAssetId],
  );
  const selectedAssetGen = useMemo(() => {
    if (!selectedAsset) {
      return null;
    }
    return assetGenMap[selectedAsset.id] ?? createAssetGenState(selectedAsset, defaultImageModel);
  }, [assetGenMap, defaultImageModel, selectedAsset]);

  const patchSelectedAssetGen = (patch: Partial<AssetGenState>) => {
    if (!selectedAsset) {
      return;
    }
    setAssetGenMap((prev) => {
      const sourceAsset = allAssetsById[selectedAsset.id] ?? selectedAsset;
      const current = prev[selectedAsset.id] ?? createAssetGenState(sourceAsset, defaultImageModel);
      return {
        ...prev,
        [selectedAsset.id]: {
          ...current,
          ...patch,
        },
      };
    });
  };

  const saveSettings = async () => {
    if (settingsSaving) {
      return;
    }
    setSettingsSaving(true);
    setSettingsError(null);
    setSettingsNotice(null);
    try {
      const response = await fetch(`/api/v1/series/${series.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: settingsForm.title.trim(),
          summary: settingsForm.summary.trim(),
          worldview: settingsForm.worldview.trim(),
          visualGuide: settingsForm.visualGuide.trim(),
          directorGuide: settingsForm.directorGuide.trim(),
          genre: settingsForm.genre.trim(),
        }),
      });
      const json = (await response.json()) as { ok: boolean; error?: string };
      if (!response.ok || !json.ok) {
        throw new Error(json.error ?? "保存失败");
      }
      setSettingsNotice("系列设定已保存。");
      router.refresh();
    } catch (error) {
      setSettingsError(error instanceof Error ? error.message : "保存失败");
    } finally {
      setSettingsSaving(false);
    }
  };

  const deleteSeries = async () => {
    if (!window.confirm("确认删除该系列吗？此操作不可恢复。")) {
      return;
    }
    setSettingsError(null);
    try {
      const response = await fetch(`/api/v1/series/${series.id}`, {
        method: "DELETE",
      });
      const json = (await response.json()) as { ok: boolean; error?: string };
      if (!response.ok || !json.ok) {
        throw new Error(json.error ?? "删除失败");
      }
      router.push("/workspace");
    } catch (error) {
      setSettingsError(error instanceof Error ? error.message : "删除失败");
    }
  };

  return (
    <StudioShell
      navKey="workspace"
      eyebrow="Series Detail"
      title={series.title}
      description={series.subtitle}
      defaultSidebarCollapsed
      actions={
        <>
          <Link
            href="/workspace"
            className="inline-flex rounded-full border border-[var(--mc-stroke)] bg-white px-4 py-2 text-sm font-semibold text-[var(--mc-ink)]"
          >
            Back to workspace
          </Link>
          <Link
            href={`/series/${series.id}/episodes/new`}
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--mc-accent)] bg-[var(--mc-accent)] px-3 py-1.5 text-sm font-medium text-white"
          >
            <Plus size={14} />
            新增集数
          </Link>
        </>
      }
      aside={
        activeTab === "assets" ? (
          <AssetDetailAside
            asset={selectedAsset}
            genState={selectedAssetGen}
            modelOptions={imageModelOptions}
            onChangeDescription={(description) => patchSelectedAssetGen({ description })}
            onChangeModel={(model) => patchSelectedAssetGen({ model })}
            onAddReferences={(references) => {
              if (!selectedAssetGen) {
                return;
              }
              patchSelectedAssetGen({ references: [...selectedAssetGen.references, ...references].slice(0, 8) });
            }}
            onRemoveReference={(index) => {
              if (!selectedAssetGen) {
                return;
              }
              patchSelectedAssetGen({
                references: selectedAssetGen.references.filter((_, referenceIndex) => referenceIndex !== index),
              });
            }}
            onGenerate={() =>
              patchSelectedAssetGen({
                lastGeneratedAt: new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }),
              })
            }
          />
        ) : (
          <OrchestratorPanel
            title="Series Orchestrator"
            focus={series.orchestrator.focus}
            completion={series.orchestrator.completion}
            blocking={series.orchestrator.blocking}
            nextStep={series.orchestrator.nextStep}
            recommendations={series.orchestrator.recommendations}
            queuePreview={series.orchestrator.queuePreview}
          />
        )
      }
    >
      <section className="mc-soft-panel rounded-[1.4rem] p-4">
        <div className="flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${activeTab === tab.id
                  ? "border-[var(--mc-accent)] bg-white text-[var(--mc-ink)]"
                  : "border-[var(--mc-stroke)] bg-transparent text-[var(--mc-muted)]"
                }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </section>

      {activeTab === "overview" ? (
        <section className="mt-4 mc-soft-panel rounded-[1.4rem] p-4 md:p-5">
          <SectionTitle
            kicker="Overview"
            title="Series status at a glance"
            description="UC-07: 掌握系列阶段分布、风险和任务健康度，并能直接跳到集级执行。"
          />
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {series.stats.map((stat) => (
              <article key={stat.label} className="rounded-2xl border border-[var(--mc-stroke)] bg-white/80 p-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--mc-muted)]">{stat.label}</p>
                <p className="mt-1 text-3xl font-bold leading-none text-[var(--mc-ink)]">{stat.value}</p>
                <p className="mt-2 text-sm text-[var(--mc-muted)]">{stat.note}</p>
              </article>
            ))}
          </div>

          <div className="mt-4 grid gap-3 xl:grid-cols-2">
            <article className="rounded-2xl border border-[var(--mc-stroke)] bg-white/80 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--mc-muted)]">世界观</p>
              <p className="mt-2 text-sm leading-7 text-[var(--mc-ink)]">{series.worldview}</p>
            </article>
            <article className="rounded-2xl border border-[var(--mc-stroke)] bg-white/80 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--mc-muted)]">导演规则</p>
              <p className="mt-2 text-sm leading-7 text-[var(--mc-ink)]">{series.directorGuide}</p>
            </article>
          </div>
        </section>
      ) : null}

      {activeTab === "settings" ? (
        <section className="mt-4 grid gap-3 xl:grid-cols-2">
          <article className="rounded-3xl border border-[var(--mc-stroke)] bg-white/80 p-4">
            <SectionTitle
              kicker="UC-02"
              title="系列设定中心"
              description="维护题材、世界观、视觉和导演规则，作为后续集数统一创作基线。"
            />
            <form
              className="mt-4 grid gap-3"
              onSubmit={(event) => {
                event.preventDefault();
                void saveSettings();
              }}
            >
              <label className="grid gap-1 text-sm">
                系列标题
                <input value={settingsForm.title} onChange={(event) => setSettingsForm((prev) => ({ ...prev, title: event.target.value }))} />
              </label>
              <label className="grid gap-1 text-sm">
                系列简介
                <textarea value={settingsForm.summary} onChange={(event) => setSettingsForm((prev) => ({ ...prev, summary: event.target.value }))} />
              </label>
              <label className="grid gap-1 text-sm">
                题材与定位
                <input value={settingsForm.genre} onChange={(event) => setSettingsForm((prev) => ({ ...prev, genre: event.target.value }))} />
              </label>
              <label className="grid gap-1 text-sm">
                世界观
                <textarea value={settingsForm.worldview} onChange={(event) => setSettingsForm((prev) => ({ ...prev, worldview: event.target.value }))} />
              </label>
              <label className="grid gap-1 text-sm">
                视觉规则
                <textarea value={settingsForm.visualGuide} onChange={(event) => setSettingsForm((prev) => ({ ...prev, visualGuide: event.target.value }))} />
              </label>
              <label className="grid gap-1 text-sm">
                导演规则
                <textarea value={settingsForm.directorGuide} onChange={(event) => setSettingsForm((prev) => ({ ...prev, directorGuide: event.target.value }))} />
              </label>
              {settingsError ? (
                <p className="text-sm text-[var(--mc-danger)]">{settingsError}</p>
              ) : null}
              {settingsNotice ? (
                <p className="text-sm text-[var(--mc-good)]">{settingsNotice}</p>
              ) : null}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <ButtonPill tone="danger" onClick={() => void deleteSeries()}>删除系列</ButtonPill>
                <div className="flex flex-wrap gap-2">
                  <ButtonPill tone="quiet">Agent 建议优化</ButtonPill>
                  <ButtonPill tone="primary" disabled={settingsSaving}>
                    {settingsSaving ? "保存中..." : "保存设定"}
                  </ButtonPill>
                </div>
              </div>
            </form>
          </article>
          <article className="mc-soft-panel rounded-[1.4rem] p-4">
            <p className="inline-flex rounded-full border border-[var(--mc-stroke)] bg-white px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--mc-muted)]">
              Setting Diff
            </p>
            <ul className="mt-4 space-y-2 text-sm text-[var(--mc-ink)]">
              <li className="rounded-2xl border border-[var(--mc-stroke)] bg-white/80 p-3">
                视觉规则 v7 → v8: 增加“门口逆光镜头优先级”
              </li>
              <li className="rounded-2xl border border-[var(--mc-stroke)] bg-white/80 p-3">
                导演规则 v3 → v4: 冲突场景增加静默帧
              </li>
              <li className="rounded-2xl border border-[var(--mc-stroke)] bg-white/80 p-3">
                角色关系表：补充母女冲突时间线
              </li>
            </ul>
          </article>
        </section>
      ) : null}

      {activeTab === "episodes" ? (
        <section className="mt-4 mc-soft-panel rounded-[1.4rem] p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <SectionTitle
              kicker="UC-04 / UC-08"
              title="Episode pipeline board"
              description="在系列层查看每集状态，直接进入执行工作台，并定位卡点。"
            />
            <div className="flex flex-wrap gap-2">
              <Link
                href={`/series/${series.id}/episodes/new`}
                className="inline-flex items-center gap-2 rounded-lg border border-[var(--mc-accent)] bg-[var(--mc-accent)] px-3 py-1.5 text-sm font-medium text-white"
              >
                <Plus size={14} />
                新增集数
              </Link>
              <Link
                href={`/series/${series.id}/episodes/import`}
                className="inline-flex rounded-lg border border-[var(--mc-stroke)] bg-white px-3 py-1.5 text-sm font-medium text-[var(--mc-ink)]"
              >
                批量导入集数
              </Link>
            </div>
          </div>
          <div className="mt-4 overflow-auto rounded-2xl border border-[var(--mc-stroke)] bg-white/80">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--mc-stroke)] text-left text-[11px] uppercase tracking-[0.2em] text-[var(--mc-muted)]">
                  <th className="px-3 py-2">集数</th>
                  <th className="px-3 py-2">概要</th>
                  <th className="px-3 py-2">阶段</th>
                  <th className="px-3 py-2">状态</th>
                  <th className="px-3 py-2">进度</th>
                  <th className="px-3 py-2">阻塞</th>
                  <th className="px-3 py-2">操作</th>
                </tr>
              </thead>
              <tbody>
                {series.episodes.map((episode) => (
                  <tr key={episode.id} className="border-b border-[var(--mc-stroke)] align-top last:border-b-0">
                    <td className="px-3 py-3 font-semibold text-[var(--mc-ink)]">{episode.code}</td>
                    <td className="px-3 py-3">
                      <p className="font-semibold text-[var(--mc-ink)]">{episode.title}</p>
                      <p className="text-xs text-[var(--mc-muted)]">{episode.synopsis}</p>
                    </td>
                    <td className="px-3 py-3 text-[var(--mc-ink)]">{stageLabels[episode.stage]}</td>
                    <td className="px-3 py-3">
                      <span className="inline-flex items-center gap-1 rounded-full border border-[var(--mc-stroke)] px-2 py-1 text-xs">
                        <StageDot status={episode.status} />
                        {statusLabels[episode.status]}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-[var(--mc-ink)]">{episode.progress}%</td>
                    <td className="px-3 py-3 text-xs text-[var(--mc-muted)]">
                      {episode.blockers.length > 0 ? episode.blockers.join("；") : "无"}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-2">
                        <Link
                          href={`/series/${series.id}/episodes/${episode.id}`}
                          className="inline-flex rounded-full border border-[var(--mc-stroke)] bg-white px-3 py-1 text-xs font-semibold text-[var(--mc-ink)] transition hover:border-[var(--mc-accent)]"
                        >
                          进入工作台
                        </Link>
                        <Link
                          href={`/series/${series.id}/episodes/${episode.id}/canvas`}
                          className="inline-flex rounded-full border border-[var(--mc-stroke)] bg-white px-3 py-1 text-xs font-semibold text-[var(--mc-ink)] transition hover:border-[var(--mc-accent)]"
                        >
                          打开画布
                        </Link>
                        <Link
                          href={`/series/${series.id}/episodes/${episode.id}/script`}
                          className="inline-flex rounded-full border border-[var(--mc-stroke)] bg-white px-3 py-1 text-xs font-semibold text-[var(--mc-ink)] transition hover:border-[var(--mc-accent)]"
                        >
                          剧本页
                        </Link>
                        <Link
                          href={`/series/${series.id}/episodes/${episode.id}/edit`}
                          className="inline-flex rounded-full border border-[var(--mc-stroke)] bg-white px-3 py-1 text-xs font-semibold text-[var(--mc-ink)] transition hover:border-[var(--mc-accent)]"
                        >
                          编辑信息
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {activeTab === "assets" ? (
        <section className="mt-4 mc-soft-panel rounded-[1.4rem] p-4">
          <SectionTitle
            kicker="UC-06"
            title="Shared Assets"
            description="角色、场景、道具的主版本管理区，支持主版本选择、锁定和回流。"
          />
          <div className="mt-4 flex flex-wrap gap-2">
            {assetCategories.map((category) => (
              <button
                key={category.id}
                onClick={() => setAssetCategory(category.id)}
                className={`rounded-full border px-4 py-2 text-sm font-semibold ${assetCategory === category.id
                    ? "border-[var(--mc-accent)] bg-white text-[var(--mc-ink)]"
                    : "border-[var(--mc-stroke)] text-[var(--mc-muted)]"
                  }`}
              >
                {category.label}
              </button>
            ))}
          </div>

          {filteredAssets.length === 0 ? (
            <div className="mt-4">
              <EmptyHint
                title="该分类暂无资产"
                description="先从集级资产中提升高价值资产到系列层，形成可复用主版本。"
              />
            </div>
          ) : (
            <div className="mt-4 grid gap-3 xl:grid-cols-2">
              {filteredAssets.map((asset) => (
                <article
                  key={asset.id}
                  onClick={() => setSelectedAssetId(asset.id)}
                  className={`rounded-2xl border bg-white/80 p-4 transition ${effectiveSelectedAssetId === asset.id
                      ? "border-[var(--mc-accent)] ring-1 ring-[color-mix(in_oklch,var(--mc-accent)_28%,transparent)]"
                      : "border-[var(--mc-stroke)] hover:border-[var(--mc-accent)]"
                    }`}
                >
                  <div className="rounded-[1.15rem] border border-[var(--mc-stroke)] bg-[color-mix(in_oklch,var(--mc-ink)_8%,white)] p-2">
                    <div className="flex aspect-[4/3] items-end rounded-[0.85rem] bg-gradient-to-br from-[#2a313d] via-[#1d2330] to-[#10141b] p-3">
                      <span className="rounded-full border border-white/15 bg-black/20 px-2 py-1 text-[10px] font-semibold tracking-[0.18em] text-white/70">
                        {assetCategoryLabels[asset.category]}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-lg font-semibold text-[var(--mc-ink)]">{asset.name}</p>
                      <p className="text-sm text-[var(--mc-muted)]">{asset.summary}</p>
                    </div>
                    {asset.locked ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-[var(--mc-good)] bg-[color-mix(in_oklch,var(--mc-good)_15%,white)] px-3 py-1 text-xs font-semibold text-[var(--mc-good)]">
                        <ShieldCheck size={13} /> 已锁定
                      </span>
                    ) : (
                      <span className="rounded-full border border-[var(--mc-stroke)] px-3 py-1 text-xs text-[var(--mc-muted)]">未锁定</span>
                    )}
                  </div>
                  <p className="mt-3 text-xs text-[var(--mc-muted)]">主版本：{asset.mainVersion}</p>
                  <div className="mt-3 grid gap-2">
                    {asset.variants.map((variant, index) => (
                      <div key={variant.id} className="rounded-xl border border-[var(--mc-stroke)] bg-[var(--mc-soft)] p-3">
                        <div className="grid gap-3 sm:grid-cols-[120px_minmax(0,1fr)]">
                          <div className="flex aspect-[4/3] items-end rounded-[0.8rem] bg-gradient-to-br from-[#2a313d] via-[#1d2330] to-[#10141b] p-2">
                            <span className="rounded-full border border-white/20 bg-black/25 px-2 py-0.5 text-[10px] font-semibold tracking-[0.18em] text-white/70">
                              V{index + 1}
                            </span>
                          </div>
                          <div>
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-sm font-semibold text-[var(--mc-ink)]">{variant.label}</p>
                              <span className="text-xs text-[var(--mc-muted)]">
                                {variant.selected ? "主版本" : "候选"}
                                {variant.locked ? " · 已锁定" : ""}
                              </span>
                            </div>
                            <p className="mt-2 text-xs text-[var(--mc-muted)]">{variant.prompt}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <ButtonPill tone="quiet" onClick={() => setSelectedAssetId(asset.id)}>
                      查看右侧详情
                    </ButtonPill>
                    <ButtonPill tone="quiet">选择主版本</ButtonPill>
                    <ButtonPill tone="quiet">锁定资产</ButtonPill>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      ) : null}

      {activeTab === "script-reference" ? (
        <section className="mt-4 mc-soft-panel rounded-[1.4rem] p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <SectionTitle
              kicker="Script Reference"
              title="剧本引用面板"
              description="集中查看每集剧本页入口与当前阶段，便于从系列层快速跳转并引用到后续分镜流程。"
            />
            <div className="flex flex-wrap gap-2">
              <ButtonPill tone="quiet">刷新引用状态</ButtonPill>
              <ButtonPill tone="primary">批量打开剧本页</ButtonPill>
            </div>
          </div>

          <div className="mt-4 overflow-auto rounded-2xl border border-[var(--mc-stroke)] bg-white/80">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--mc-stroke)] text-left text-[11px] uppercase tracking-[0.2em] text-[var(--mc-muted)]">
                  <th className="px-3 py-2">集数</th>
                  <th className="px-3 py-2">标题</th>
                  <th className="px-3 py-2">当前阶段</th>
                  <th className="px-3 py-2">进度</th>
                  <th className="px-3 py-2">剧本引用状态</th>
                  <th className="px-3 py-2">操作</th>
                </tr>
              </thead>
              <tbody>
                {series.episodes.map((episode) => {
                  const referenceStatus =
                    episode.stage === "planning" || episode.stage === "script"
                      ? "草稿阶段，可直接引用"
                      : episode.stage === "assets" || episode.stage === "storyboard"
                        ? "已被下游流程引用"
                        : "已归档，可回溯引用";

                  return (
                    <tr key={episode.id} className="border-b border-[var(--mc-stroke)] align-top last:border-b-0">
                      <td className="px-3 py-3 font-semibold text-[var(--mc-ink)]">{episode.code}</td>
                      <td className="px-3 py-3">
                        <p className="font-semibold text-[var(--mc-ink)]">{episode.title}</p>
                        <p className="text-xs text-[var(--mc-muted)]">{episode.synopsis}</p>
                      </td>
                      <td className="px-3 py-3 text-[var(--mc-ink)]">{stageLabels[episode.stage]}</td>
                      <td className="px-3 py-3 text-[var(--mc-ink)]">{episode.progress}%</td>
                      <td className="px-3 py-3 text-xs text-[var(--mc-muted)]">{referenceStatus}</td>
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap gap-2">
                          <Link
                            href={`/series/${series.id}/episodes/${episode.id}/script`}
                            className="inline-flex rounded-full border border-[var(--mc-stroke)] bg-white px-3 py-1 text-xs font-semibold text-[var(--mc-ink)] transition hover:border-[var(--mc-accent)]"
                          >
                            打开剧本页
                          </Link>
                          <Link
                            href={`/series/${series.id}/episodes/${episode.id}/canvas`}
                            className="inline-flex rounded-full border border-[var(--mc-stroke)] bg-white px-3 py-1 text-xs font-semibold text-[var(--mc-ink)] transition hover:border-[var(--mc-accent)]"
                          >
                            查看引用去向
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {activeTab === "strategy" ? (
        <section className="mt-4 grid gap-3 xl:grid-cols-2">
          <article className="rounded-3xl border border-[var(--mc-stroke)] bg-white/80 p-4">
            <SectionTitle
              kicker="UC-05"
              title="Series strategy stack"
              description="统一模型、Prompt 和 Agent 偏好策略，跨集继承。"
            />
            <div className="mt-4 grid gap-3">
              <label className="grid gap-1 text-sm">
                默认文本模型
                <input defaultValue={series.strategy.models.text} />
              </label>
              <label className="grid gap-1 text-sm">
                默认图像模型
                <input defaultValue={series.strategy.models.image} />
              </label>
              <label className="grid gap-1 text-sm">
                默认视频模型
                <input defaultValue={series.strategy.models.video} />
              </label>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <ButtonPill tone="quiet">恢复默认</ButtonPill>
              <ButtonPill tone="primary">保存策略</ButtonPill>
            </div>
          </article>
          <article className="mc-soft-panel rounded-[1.4rem] p-4">
            <p className="inline-flex rounded-full border border-[var(--mc-stroke)] bg-white px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--mc-muted)]">
              Prompt / Agent policies
            </p>
            <div className="mt-4 space-y-3">
              {series.strategy.promptPolicies.map((policy) => (
                <div key={policy.stage} className="rounded-2xl border border-[var(--mc-stroke)] bg-white/80 p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--mc-muted)]">{policy.stage}</p>
                  <p className="mt-1 text-sm text-[var(--mc-ink)]">{policy.policy}</p>
                </div>
              ))}
              {series.strategy.agentPolicies.map((policy) => (
                <div key={policy.name} className="rounded-2xl border border-[var(--mc-stroke)] bg-white/80 p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--mc-muted)]">{policy.name}</p>
                  <p className="mt-1 text-sm text-[var(--mc-ink)]">{policy.value}</p>
                </div>
              ))}
            </div>
          </article>
        </section>
      ) : null}
    </StudioShell>
  );
}

function AssetDetailAside({
  asset,
  genState,
  modelOptions,
  onChangeDescription,
  onChangeModel,
  onAddReferences,
  onRemoveReference,
  onGenerate,
}: {
  asset: SharedAsset | null;
  genState: AssetGenState | null;
  modelOptions: string[];
  onChangeDescription: (description: string) => void;
  onChangeModel: (model: string) => void;
  onAddReferences: (references: string[]) => void;
  onRemoveReference: (index: number) => void;
  onGenerate: () => void;
}) {
  if (!asset || !genState) {
    return (
      <section className="rounded-3xl border border-dashed border-white/12 bg-white/[0.02] p-6 text-center">
        <p className="text-sm font-semibold text-white">资产详情</p>
        <p className="mt-2 text-xs text-white/55">选择左侧资产卡片后，可在这里查看主版本信息和操作入口。</p>
      </section>
    );
  }

  const selectedVariant = asset.variants.find((variant) => variant.selected);
  const statusText = asset.locked ? "已锁定" : "未锁定";
  const episodeText = asset.episodeRefs && asset.episodeRefs.length > 0 ? asset.episodeRefs.join(" · ") : "暂无";
  const ownerText = asset.owner ?? "系列共享";

  const handleReferenceUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []).slice(0, 8);
    if (files.length === 0) {
      return;
    }
    const encoded = (await Promise.all(files.map((file) => fileToDataUrl(file)))).filter(Boolean);
    onAddReferences(encoded);
    event.target.value = "";
  };

  return (
    <div className="space-y-3">
      <section className="rounded-3xl border border-white/8 bg-white/[0.03] p-4">
        <p className="text-[11px] uppercase tracking-[0.2em] text-white/35">资产详情</p>
        <div className="mt-3 rounded-[1.25rem] bg-gradient-to-br from-[#1a212b] via-[#141a23] to-[#10151d] p-3">
          <div className="flex aspect-[5/4] items-end rounded-[1rem] bg-black/15 p-3">
            <span className="rounded-full border border-white/12 bg-black/25 px-2 py-1 text-[10px] font-semibold tracking-[0.2em] text-white/70">
              {assetCategoryLabels[asset.category]}
            </span>
          </div>
        </div>

        <div className="mt-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-lg font-semibold text-white">{asset.name}</p>
            <p className="mt-1 text-xs text-white/50">{asset.note ?? asset.summary}</p>
          </div>
          <span
            className={`inline-flex rounded-full border px-2.5 py-1 text-xs ${asset.locked
                ? "border-emerald-300/30 bg-emerald-400/10 text-emerald-200"
                : "border-white/12 bg-white/[0.02] text-white/60"
              }`}
          >
            {statusText}
          </span>
        </div>

        <div className="mt-4 space-y-2 text-sm">
          <DetailRow label="主版本" value={selectedVariant?.label ?? asset.mainVersion} />
          <DetailRow label="最近使用集数" value={episodeText} />
          <DetailRow label="资产归属" value={ownerText} />
          <DetailRow label="视觉变体数" value={`${asset.variants.length}`} />
        </div>
      </section>

      <section className="rounded-3xl border border-white/8 bg-white/[0.03] p-4">
        <p className="text-[11px] uppercase tracking-[0.2em] text-white/35">生成主体图</p>
        <div className="mt-2 inline-flex rounded-xl border border-[#8edb64]/35 bg-[#8edb64]/15 px-2.5 py-1 text-xs font-semibold text-[#b6ee8f]">
          {asset.name}
        </div>

        <label className="mt-4 grid gap-1 text-sm">
          主体描述
          <textarea
            value={genState.description}
            onChange={(event) => onChangeDescription(event.target.value)}
            placeholder="输入主体形象、服饰、镜头、光线、构图约束。"
            className="min-h-[180px]"
            maxLength={5000}
          />
          <span className="text-right text-xs text-white/45">{genState.description.length} / 5000</span>
        </label>

        <div className="mt-3 grid grid-cols-[minmax(0,1fr)_132px] gap-2">
          <label className="grid gap-1 text-xs text-white/62">
            选模型
            <select value={genState.model} onChange={(event) => onChangeModel(event.target.value)}>
              {modelOptions.map((model) => (
                <option key={model} value={model}>
                  {model}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={onGenerate}
            className="self-end rounded-2xl bg-[#70db57] px-3 py-2 text-sm font-semibold text-[#0f1710] transition hover:brightness-105"
          >
            图片生成 ⚡
          </button>
        </div>
        {genState.lastGeneratedAt ? (
          <p className="mt-2 text-xs text-white/50">最近生成：{genState.lastGeneratedAt}</p>
        ) : null}

        <div className="mt-4">
          <p className="text-sm font-semibold text-white/92">参考图片</p>
          <label className="mt-2 flex h-16 cursor-pointer items-center justify-center rounded-2xl border border-dashed border-white/18 bg-white/[0.02] text-sm text-white/62 transition hover:bg-white/[0.05]">
            + 图片
            <input type="file" accept="image/*" multiple className="hidden" onChange={handleReferenceUpload} />
          </label>
          {genState.references.length > 0 ? (
            <div className="mt-3 grid grid-cols-3 gap-2">
              {genState.references.map((src, index) => (
                <div key={src + index} className="group relative overflow-hidden rounded-xl border border-white/10 bg-black/20">
                  <Image
                    src={src}
                    alt={`参考图 ${index + 1}`}
                    width={160}
                    height={96}
                    unoptimized
                    className="h-20 w-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => onRemoveReference(index)}
                    className="absolute right-1 top-1 rounded-md bg-black/55 px-1.5 py-0.5 text-[10px] text-white opacity-0 transition group-hover:opacity-100"
                  >
                    删除
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-xs text-white/45">暂未添加参考图片</p>
          )}
        </div>
      </section>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2">
      <span className="text-white/58">{label}</span>
      <span className="text-right text-white/90">{value}</span>
    </div>
  );
}
