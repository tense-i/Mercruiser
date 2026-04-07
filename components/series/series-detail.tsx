'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Box, CheckCircle2, ChevronRight, Clock, Film, FolderInput, Globe2, PlusCircle, Sparkles, Upload, Wand2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

import { readSourceFile } from '@/lib/source-file';
import type { SeriesView } from '@/lib/view-models/studio';
import { cn } from '@/lib/utils';
import { Dialog, DialogField, DialogFooter, DialogButton, DialogDivider } from '@/components/ui/dialog';

function toLines(value: string) {
  return value
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function SeriesDetail({ view: initialView }: { view: SeriesView }) {
  const router = useRouter();
  const [view, setView] = useState(initialView);
  const [pending, setPending] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [settingsDraft, setSettingsDraft] = useState(() => ({
    worldEra: initialView.series.settings.worldEra,
    worldDescription: initialView.series.settings.worldDescription,
    coreRules: initialView.series.settings.coreRules.join('\n'),
    visualStylePreset: initialView.series.settings.visualStylePreset,
    visualStylePrompt: initialView.series.settings.visualStylePrompt,
    referenceImages: initialView.series.settings.referenceImages.join('\n'),
    defaultShotStrategy: initialView.series.settings.defaultShotStrategy,
    defaultDurationStrategy: initialView.series.settings.defaultDurationStrategy,
    cameraMotionPreference: initialView.series.settings.cameraMotionPreference,
  }));
  const [strategyDraft, setStrategyDraft] = useState(() => ({
    model: initialView.series.strategy.model,
    stylePreference: initialView.series.strategy.stylePreference,
    aspectRatio: initialView.series.strategy.aspectRatio,
    creationMode: initialView.series.strategy.creationMode,
    promptGuidance: initialView.series.strategy.promptGuidance,
    priorityNote: initialView.series.strategy.priorityNote,
  }));
  const [episodeDialogOpen, setEpisodeDialogOpen] = useState<'blank' | 'source' | null>(null);
  const [episodeDraft, setEpisodeDraft] = useState({
    title: '',
    logline: '',
    sourceTitle: '',
    sourceContent: '',
    fileName: '',
  });
  const episodeSourceFileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setSettingsDraft({
      worldEra: view.series.settings.worldEra,
      worldDescription: view.series.settings.worldDescription,
      coreRules: view.series.settings.coreRules.join('\n'),
      visualStylePreset: view.series.settings.visualStylePreset,
      visualStylePrompt: view.series.settings.visualStylePrompt,
      referenceImages: view.series.settings.referenceImages.join('\n'),
      defaultShotStrategy: view.series.settings.defaultShotStrategy,
      defaultDurationStrategy: view.series.settings.defaultDurationStrategy,
      cameraMotionPreference: view.series.settings.cameraMotionPreference,
    });
    setStrategyDraft({
      model: view.series.strategy.model,
      stylePreference: view.series.strategy.stylePreference,
      aspectRatio: view.series.strategy.aspectRatio,
      creationMode: view.series.strategy.creationMode,
      promptGuidance: view.series.strategy.promptGuidance,
      priorityNote: view.series.strategy.priorityNote,
    });
  }, [view]);

  const focusEpisode = view.episodes.find((episode) => episode.status !== 'done') ?? view.episodes[0] ?? null;
  const linkedGlobalAssetIds = new Set(view.globalAssets.map((asset) => asset.id));
  const importableGlobalAssets = useMemo(
    () => view.availableGlobalAssets.filter((asset) => !linkedGlobalAssetIds.has(asset.id)),
    [linkedGlobalAssetIds, view.availableGlobalAssets],
  );

  async function dispatch(command: Record<string, unknown>) {
    try {
      setPending(String(command.type));
      const response = await fetch('/api/studio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          command,
          context: {
            seriesId: view.series.id,
          },
        }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.result) {
        throw new Error(payload.error ?? '保存失败');
      }
      setErrorMessage(null);
      if (payload.seriesView) {
        setView(payload.seriesView as SeriesView);
      }
      return payload;
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '保存失败');
      return null;
    } finally {
      setPending(null);
    }
  }

  async function handleSaveSettings() {
    await dispatch({
      type: 'updateSeriesSettings',
      seriesId: view.series.id,
      settings: {
        worldEra: settingsDraft.worldEra,
        worldDescription: settingsDraft.worldDescription,
        coreRules: toLines(settingsDraft.coreRules),
        visualStylePreset: settingsDraft.visualStylePreset,
        visualStylePrompt: settingsDraft.visualStylePrompt,
        referenceImages: toLines(settingsDraft.referenceImages),
        defaultShotStrategy: settingsDraft.defaultShotStrategy,
        defaultDurationStrategy: settingsDraft.defaultDurationStrategy,
        cameraMotionPreference: settingsDraft.cameraMotionPreference,
      },
    });
  }

  async function handleSaveStrategy() {
    await dispatch({
      type: 'updateSeriesStrategy',
      seriesId: view.series.id,
      strategy: {
        model: strategyDraft.model,
        stylePreference: strategyDraft.stylePreference,
        aspectRatio: strategyDraft.aspectRatio,
        creationMode: strategyDraft.creationMode,
        promptGuidance: strategyDraft.promptGuidance,
        priorityNote: strategyDraft.priorityNote,
      },
    });
  }

  function openEpisodeDialog(mode: 'blank' | 'source') {
    setEpisodeDraft({ title: '', logline: '', sourceTitle: '', sourceContent: '', fileName: '' });
    setErrorMessage(null);
    setEpisodeDialogOpen(mode);
  }

  async function handleCreateEpisode(mode: 'blank' | 'source') {
    const payload =
      mode === 'blank'
        ? await dispatch({
            type: 'createEpisode',
            seriesId: view.series.id,
            title: episodeDraft.title,
            logline: episodeDraft.logline,
          })
        : await dispatch({
            type: 'createEpisodeFromSource',
            seriesId: view.series.id,
            title: episodeDraft.title,
            logline: episodeDraft.logline,
            sourceTitle: episodeDraft.sourceTitle,
            sourceContent: episodeDraft.sourceContent,
          });

    const episodeId = payload?.result?.episode?.id as string | undefined;
    if (episodeId) {
      setEpisodeDialogOpen(null);
      setEpisodeDraft({ title: '', logline: '', sourceTitle: '', sourceContent: '', fileName: '' });
      router.push(`/series/${view.series.id}/episodes/${episodeId}`);
    }
  }

  async function handleImportGlobalAsset(globalAssetId: string, mode: 'linked' | 'detached') {
    await dispatch({
      type: 'importGlobalAssetToSeries',
      globalAssetId,
      seriesId: view.series.id,
      mode,
    });
  }

  async function handleEpisodeSourceFile(file: File | null) {
    if (!file) {
      return;
    }

    try {
      const parsed = await readSourceFile(file);
      setEpisodeDraft((current) => ({
        ...current,
        sourceTitle: current.sourceTitle || parsed.title,
        sourceContent: parsed.content,
        fileName: parsed.fileName,
        title: current.title || parsed.title,
      }));
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '读取原文文件失败');
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-7">
      {errorMessage ? (
        <div className="rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{errorMessage}</div>
      ) : null}

      {/* ── Hero ── */}
      <div
        className="relative overflow-hidden rounded-3xl"
        style={{
          background: 'linear-gradient(160deg, rgba(20,20,26,0.97) 0%, rgba(14,14,18,0.99) 100%)',
          border: '1px solid rgba(63,63,70,0.45)',
        }}
      >
        <div
          className="pointer-events-none absolute -top-10 left-1/4"
          style={{ width: 280, height: 180, background: 'radial-gradient(ellipse, rgba(2,115,199,0.08) 0%, transparent 70%)' }}
        />
        <div className="relative flex flex-col gap-5 p-7 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="mb-2.5 flex items-center gap-3">
              <StatusBadge status={view.series.status} />
              <span className="font-mono text-[10px] text-zinc-600">ID: {view.series.id.slice(0, 8)}…</span>
            </div>
            <h2 className="mb-2 text-[28px] font-bold tracking-tight text-zinc-50">{view.series.name}</h2>
            <p className="max-w-2xl text-sm leading-relaxed text-zinc-500">{view.series.description}</p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2.5">
            {focusEpisode ? (
              <Link
                href={`/series/${view.series.id}/episodes/${focusEpisode.id}`}
                className="cursor-pointer rounded-xl border border-brand-500/25 bg-brand-500/8 px-4 py-2.5 text-sm font-medium text-brand-300 transition-all duration-150 hover:border-brand-500/40 hover:bg-brand-500/12"
              >
                Continue Episode →
              </Link>
            ) : null}
            <button
              type="button"
              onClick={() => openEpisodeDialog('source')}
              className="flex cursor-pointer items-center gap-2 rounded-xl border border-zinc-700/80 bg-zinc-900/80 px-4 py-2.5 text-sm font-medium text-zinc-200 transition-all duration-150 hover:border-zinc-600 hover:bg-zinc-800"
            >
              <FolderInput size={15} />
              从原文创建
            </button>
            <button
              type="button"
              onClick={() => openEpisodeDialog('blank')}
              className="flex cursor-pointer items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-white transition-all duration-150 hover:brightness-110"
              style={{
                background: 'linear-gradient(135deg, #0273c7 0%, #0e91e9 100%)',
                boxShadow: '0 0 20px rgba(14,145,233,0.25), 0 4px 12px rgba(0,0,0,0.3)',
              }}
            >
              <PlusCircle size={15} />
              新建集数
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <StatBox label="Total Episodes" value={view.episodes.length.toString()} icon={<Film size={16} />} />
        <StatBox label="Overall Progress" value={`${view.series.progress}%`} icon={<CheckCircle2 size={16} />} />
        <StatBox label="Global Assets" value={view.globalAssets.length.toString()} icon={<Globe2 size={16} />} />
        <StatBox label="Created At" value={view.series.createdAt.slice(0, 10)} icon={<Clock size={16} />} />
      </div>

      <div className="grid gap-8 lg:grid-cols-[1.35fr_0.95fr]">
        <div className="space-y-8">
          <Panel title="集数管理" icon={<PlusCircle size={18} className="text-brand-300" />}>
            <div className="flex items-center justify-between">
              <p className="text-sm text-zinc-400">管理当前系列下的所有集数，或新建集数开始生产流程。</p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => openEpisodeDialog('source')}
                  className="flex items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm font-medium text-zinc-100 transition-colors hover:border-zinc-600 hover:bg-zinc-800"
                >
                  <FolderInput size={14} />
                  从原文创建
                </button>
                <button
                  type="button"
                  onClick={() => openEpisodeDialog('blank')}
                  className="flex items-center gap-2 rounded-xl bg-brand-600 px-3 py-2 text-sm font-bold text-white shadow-lg shadow-brand-600/20 transition-colors hover:bg-brand-500"
                >
                  <PlusCircle size={14} />
                  新建集数
                </button>
              </div>
            </div>

            <div className="mt-5 space-y-2">
              {view.episodes.map((episode) => (
                <Link
                  key={episode.id}
                  href={`/series/${episode.seriesId}/episodes/${episode.id}`}
                  className="group card-hover flex w-full items-center gap-4 overflow-hidden rounded-2xl p-4 text-left transition-all"
                  style={{ background: 'rgba(20,20,24,0.8)', border: '1px solid rgba(63,63,70,0.4)' }}
                >
                  <div
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl font-mono text-sm font-bold transition-all duration-150"
                    style={{
                      background: episode.progress === 100
                        ? 'rgba(34,197,94,0.15)'
                        : episode.progress > 0
                          ? 'rgba(14,145,233,0.15)'
                          : 'rgba(63,63,70,0.4)',
                      color: episode.progress === 100 ? '#4ade80' : episode.progress > 0 ? '#38abf7' : '#71717a',
                    }}
                  >
                    {episode.index.toString().padStart(2, '0')}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="truncate font-bold text-zinc-100 transition-colors duration-150 group-hover:text-brand-300">{episode.title}</h4>
                    <div className="mt-1.5 flex items-center gap-2">
                      <span className="text-[10px] font-semibold uppercase tracking-widest text-brand-400/80">{episode.currentStage}</span>
                      <span className="text-zinc-700">·</span>
                      <span className="text-[10px] text-zinc-500">{episode.progress}% complete</span>
                    </div>
                    {episode.gate?.blockedReasons?.[0] ? (
                      <p className="mt-1 text-[11px] text-amber-400/80">{episode.gate.blockedReasons[0]}</p>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="hidden w-24 sm:block">
                      <div className="progress-track">
                        <div className="progress-fill" style={{ width: `${episode.progress}%` }} />
                      </div>
                    </div>
                    <ChevronRight size={16} className="shrink-0 text-zinc-600 transition-colors duration-150 group-hover:text-brand-400" />
                  </div>
                </Link>
              ))}
            </div>
          </Panel>

          <Panel title="系列设定" icon={<Wand2 size={18} className="text-brand-300" />}>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="时代背景">
                <input
                  value={settingsDraft.worldEra}
                  onChange={(event) => setSettingsDraft((current) => ({ ...current, worldEra: event.target.value }))}
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-brand-500 focus:outline-none"
                />
              </Field>
              <Field label="视觉风格预设">
                <input
                  value={settingsDraft.visualStylePreset}
                  onChange={(event) => setSettingsDraft((current) => ({ ...current, visualStylePreset: event.target.value }))}
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-brand-500 focus:outline-none"
                />
              </Field>
            </div>
            <div className="mt-4 grid gap-4">
              <Field label="世界观描述">
                <textarea
                  value={settingsDraft.worldDescription}
                  onChange={(event) => setSettingsDraft((current) => ({ ...current, worldDescription: event.target.value }))}
                  className="h-24 w-full resize-none rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-sm text-zinc-200 focus:border-brand-500 focus:outline-none"
                />
              </Field>
              <Field label="核心规则（每行一条）">
                <textarea
                  value={settingsDraft.coreRules}
                  onChange={(event) => setSettingsDraft((current) => ({ ...current, coreRules: event.target.value }))}
                  className="h-24 w-full resize-none rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-sm text-zinc-200 focus:border-brand-500 focus:outline-none"
                />
              </Field>
              <Field label="视觉风格说明">
                <textarea
                  value={settingsDraft.visualStylePrompt}
                  onChange={(event) => setSettingsDraft((current) => ({ ...current, visualStylePrompt: event.target.value }))}
                  className="h-24 w-full resize-none rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-sm text-zinc-200 focus:border-brand-500 focus:outline-none"
                />
              </Field>
              <Field label="风格参考图（每行一个 URL 或 /generated 路径）">
                <textarea
                  value={settingsDraft.referenceImages}
                  onChange={(event) => setSettingsDraft((current) => ({ ...current, referenceImages: event.target.value }))}
                  className="h-20 w-full resize-none rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-sm text-zinc-200 focus:border-brand-500 focus:outline-none"
                />
              </Field>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <Field label="默认景别策略">
                <input
                  value={settingsDraft.defaultShotStrategy}
                  onChange={(event) => setSettingsDraft((current) => ({ ...current, defaultShotStrategy: event.target.value }))}
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-brand-500 focus:outline-none"
                />
              </Field>
              <Field label="默认时长策略">
                <input
                  value={settingsDraft.defaultDurationStrategy}
                  onChange={(event) => setSettingsDraft((current) => ({ ...current, defaultDurationStrategy: event.target.value }))}
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-brand-500 focus:outline-none"
                />
              </Field>
              <Field label="运镜偏好">
                <input
                  value={settingsDraft.cameraMotionPreference}
                  onChange={(event) => setSettingsDraft((current) => ({ ...current, cameraMotionPreference: event.target.value }))}
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-brand-500 focus:outline-none"
                />
              </Field>
            </div>
            <ActionButton onClick={() => void handleSaveSettings()} disabled={pending === 'updateSeriesSettings'}>
              {pending === 'updateSeriesSettings' ? 'Saving settings…' : '保存系列设定'}
            </ActionButton>
          </Panel>

          <Panel title="系列策略配置" icon={<Sparkles size={18} className="text-brand-300" />}>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="默认模型">
                <input
                  value={strategyDraft.model}
                  onChange={(event) => setStrategyDraft((current) => ({ ...current, model: event.target.value }))}
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-brand-500 focus:outline-none"
                />
              </Field>
              <Field label="风格偏好">
                <input
                  value={strategyDraft.stylePreference}
                  onChange={(event) => setStrategyDraft((current) => ({ ...current, stylePreference: event.target.value }))}
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-brand-500 focus:outline-none"
                />
              </Field>
              <Field label="宽高比">
                <input
                  value={strategyDraft.aspectRatio}
                  onChange={(event) => setStrategyDraft((current) => ({ ...current, aspectRatio: event.target.value }))}
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-brand-500 focus:outline-none"
                />
              </Field>
              <Field label="创作模式">
                <input
                  value={strategyDraft.creationMode}
                  onChange={(event) => setStrategyDraft((current) => ({ ...current, creationMode: event.target.value }))}
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-brand-500 focus:outline-none"
                />
              </Field>
            </div>
            <div className="mt-4 grid gap-4">
              <Field label="Prompt 指导">
                <textarea
                  value={strategyDraft.promptGuidance}
                  onChange={(event) => setStrategyDraft((current) => ({ ...current, promptGuidance: event.target.value }))}
                  className="h-20 w-full resize-none rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-sm text-zinc-200 focus:border-brand-500 focus:outline-none"
                />
              </Field>
              <Field label="优先级说明">
                <textarea
                  value={strategyDraft.priorityNote}
                  onChange={(event) => setStrategyDraft((current) => ({ ...current, priorityNote: event.target.value }))}
                  className="h-20 w-full resize-none rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-sm text-zinc-200 focus:border-brand-500 focus:outline-none"
                />
              </Field>
            </div>
            <ActionButton onClick={() => void handleSaveStrategy()} disabled={pending === 'updateSeriesStrategy'}>
              {pending === 'updateSeriesStrategy' ? 'Saving strategy…' : '保存系列策略'}
            </ActionButton>
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel title="共享主体资产" icon={<Box size={18} className="text-brand-300" />}>
            <div className="space-y-3">
              {view.sharedAssets.length ? (
                view.sharedAssets.map((asset) => {
                  const usage = view.sharedAssetUsage.find((item) => item.assetId === asset.id);
                  return (
                    <div key={asset.id} className="rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm font-medium text-zinc-100">{asset.name}</span>
                        <span className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">{asset.type}</span>
                      </div>
                      <p className="mt-2 text-xs text-zinc-400">
                        {asset.syncSource} · used in {usage?.episodeIds.length ?? 0} episode(s)
                      </p>
                    </div>
                  );
                })
              ) : (
                <p className="text-sm text-zinc-500">还没有系列共享主体，可从当前系列资产中提升。</p>
              )}
            </div>

            <div className="mt-6 space-y-3">
              <h4 className="text-sm font-bold text-zinc-100">可提升资产</h4>
              {view.promotableAssets.length ? (
                view.promotableAssets.map((asset) => (
                  <div key={asset.id} className="rounded-xl border border-zinc-800 bg-zinc-950/60 px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-zinc-100">{asset.name}</p>
                        <p className="mt-1 text-xs text-zinc-500">{asset.type} · {asset.state}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => void dispatch({ type: 'promoteAssetToShared', assetId: asset.id })}
                        disabled={pending === 'promoteAssetToShared'}
                        className="rounded-lg border border-zinc-700 px-3 py-2 text-xs font-medium text-zinc-100 transition-colors hover:border-brand-500/50 hover:text-brand-300 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        提升为共享资产
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-xs text-zinc-500">当前没有可提升的系列资产。</p>
              )}
            </div>

            <div className="mt-6 space-y-3">
              <h4 className="text-sm font-bold text-zinc-100">导入全局资产到系列</h4>
              {importableGlobalAssets.length ? (
                importableGlobalAssets.map((asset) => (
                  <div key={asset.id} className="rounded-xl border border-zinc-800 bg-zinc-950/60 px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-zinc-100">{asset.name}</p>
                        <p className="mt-1 text-xs text-zinc-500">{asset.type}</p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => void handleImportGlobalAsset(asset.id, 'linked')}
                          disabled={pending === 'importGlobalAssetToSeries'}
                          className="rounded-lg border border-zinc-700 px-3 py-2 text-xs font-medium text-zinc-100 transition-colors hover:border-brand-500/50 hover:text-brand-300 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Linked
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleImportGlobalAsset(asset.id, 'detached')}
                          disabled={pending === 'importGlobalAssetToSeries'}
                          className="rounded-lg border border-zinc-700 px-3 py-2 text-xs font-medium text-zinc-100 transition-colors hover:border-brand-500/50 hover:text-brand-300 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Detached
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-xs text-zinc-500">所有全局资产都已在当前系列中可见。</p>
              )}
            </div>
          </Panel>

          <Panel title="Global Assets" icon={<Globe2 size={18} className="text-brand-300" />}>
            <div className="space-y-3">
              {view.globalAssets.map((asset) => (
                <div key={asset.id} className="rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-medium text-zinc-100">{asset.name}</span>
                    <span className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">{asset.type}</span>
                  </div>
                  <p className="mt-2 text-xs text-zinc-400">{asset.usedInSeries.length} series linked</p>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Governance Summary" icon={<Sparkles size={18} className="text-brand-300" />}>
            <div className="space-y-3">
              <StrategyItem label="Generation Presets" value={String(view.generationPresets.length)} />
              <StrategyItem label="Usage Cost" value={`${view.usageSummary.currency} ${view.usageSummary.totalCost.toFixed(2)}`} />
              <StrategyItem label="Open Tasks" value={String(view.tasks.filter((task) => task.status !== 'completed').length)} />
            </div>
          </Panel>
        </div>
      </div>

      <Dialog
        open={episodeDialogOpen === 'blank'}
        onClose={() => setEpisodeDialogOpen(null)}
        title="新建集数"
        description="填写基本信息，创建空白集数骨架，后续可在工作区补充剧本与资产。"
        size="md"
      >
        {errorMessage ? (
          <div className="mb-4 rounded-xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{errorMessage}</div>
        ) : null}
        <div className="space-y-4">
          <DialogField label="集数标题">
            <input
              autoFocus
              value={episodeDraft.title}
              onChange={(e) => setEpisodeDraft((d) => ({ ...d, title: e.target.value }))}
              onKeyDown={(e) => { if (e.key === 'Enter') void handleCreateEpisode('blank'); }}
              placeholder="例如：第一集"
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2.5 text-sm text-zinc-100 focus:border-brand-500 focus:outline-none"
            />
          </DialogField>
          <DialogField label="Logline" hint="可选，一句话描述本集核心冲突">
            <textarea
              value={episodeDraft.logline}
              onChange={(e) => setEpisodeDraft((d) => ({ ...d, logline: e.target.value }))}
              placeholder="例如：主角初入京城，卷入政局漩涡…"
              rows={3}
              className="w-full resize-none rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-sm text-zinc-200 focus:border-brand-500 focus:outline-none"
            />
          </DialogField>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 px-4 py-3 text-xs text-zinc-500">
            创建后会继承系列策略与已共享资产，并跳转到对应集数工作区。
          </div>
        </div>
        <DialogFooter>
          <DialogButton variant="ghost" onClick={() => setEpisodeDialogOpen(null)}>取消</DialogButton>
          <DialogButton
            variant="primary"
            loading={pending === 'createEpisode'}
            disabled={!episodeDraft.title.trim()}
            onClick={() => void handleCreateEpisode('blank')}
          >
            创建集数
          </DialogButton>
        </DialogFooter>
      </Dialog>

      <Dialog
        open={episodeDialogOpen === 'source'}
        onClose={() => setEpisodeDialogOpen(null)}
        title="从原文创建集数"
        description="上传或粘贴原文，Agent 将自动分析并生成剧本章节。"
        size="lg"
      >
        {errorMessage ? (
          <div className="mb-4 rounded-xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{errorMessage}</div>
        ) : null}
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <DialogField label="集数标题">
              <input
                autoFocus
                value={episodeDraft.title}
                onChange={(e) => setEpisodeDraft((d) => ({ ...d, title: e.target.value }))}
                placeholder="例如：第一集"
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2.5 text-sm text-zinc-100 focus:border-brand-500 focus:outline-none"
              />
            </DialogField>
            <DialogField label="原文标题">
              <input
                value={episodeDraft.sourceTitle}
                onChange={(e) => setEpisodeDraft((d) => ({ ...d, sourceTitle: e.target.value }))}
                placeholder="小说/原著名称"
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2.5 text-sm text-zinc-100 focus:border-brand-500 focus:outline-none"
              />
            </DialogField>
          </div>
          <DialogField label="Logline" hint="可选">
            <textarea
              value={episodeDraft.logline}
              onChange={(e) => setEpisodeDraft((d) => ({ ...d, logline: e.target.value }))}
              placeholder="可选"
              rows={2}
              className="w-full resize-none rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-sm text-zinc-200 focus:border-brand-500 focus:outline-none"
            />
          </DialogField>
          <DialogDivider />
          <DialogField label="原文内容" hint="支持粘贴文本，或点击下方按钮上传文件">
            <textarea
              value={episodeDraft.sourceContent}
              onChange={(e) => setEpisodeDraft((d) => ({ ...d, sourceContent: e.target.value }))}
              placeholder="在此粘贴原文内容…"
              rows={6}
              className="w-full resize-none rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-sm text-zinc-200 focus:border-brand-500 focus:outline-none"
            />
            <input
              ref={episodeSourceFileRef}
              type="file"
              accept=".txt,.md,text/plain,text/markdown"
              className="hidden"
              onChange={(e) => {
                void handleEpisodeSourceFile(e.target.files?.[0] ?? null);
                e.currentTarget.value = '';
              }}
            />
            <button
              type="button"
              onClick={() => episodeSourceFileRef.current?.click()}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-700 bg-zinc-900/50 py-3 text-sm font-medium text-zinc-400 transition-colors hover:border-brand-500/50 hover:text-zinc-200"
            >
              <Upload size={15} />
              {episodeDraft.fileName ? `已选：${episodeDraft.fileName}` : '上传 .txt / .md 原文文件'}
            </button>
            {episodeDraft.sourceContent ? (
              <p className="mt-1.5 text-xs text-zinc-500">已输入 {episodeDraft.sourceContent.length.toLocaleString()} 字</p>
            ) : null}
          </DialogField>
        </div>
        <DialogFooter>
          <DialogButton variant="ghost" onClick={() => setEpisodeDialogOpen(null)}>取消</DialogButton>
          <DialogButton
            variant="primary"
            loading={pending === 'createEpisodeFromSource'}
            disabled={!episodeDraft.title.trim() || !episodeDraft.sourceTitle.trim() || !episodeDraft.sourceContent.trim()}
            onClick={() => void handleCreateEpisode('source')}
          >
            导入并创建集数
          </DialogButton>
        </DialogFooter>
      </Dialog>
    </div>
  );
}

function Panel({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div
      className="overflow-hidden rounded-3xl"
      style={{
        background: 'rgba(18,18,22,0.8)',
        border: '1px solid rgba(63,63,70,0.45)',
      }}
    >
      <div
        className="flex items-center gap-2.5 px-6 py-4"
        style={{ borderBottom: '1px solid rgba(63,63,70,0.35)', background: 'rgba(24,24,28,0.5)' }}
      >
        <span className="text-brand-400">{icon}</span>
        <span className="text-sm font-bold text-zinc-100">{title}</span>
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-zinc-500">{label}</div>
      {children}
    </label>
  );
}

function ActionButton({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="mt-5 w-full cursor-pointer rounded-xl px-4 py-3 text-sm font-bold text-white transition-all duration-150 hover:brightness-110 disabled:cursor-not-allowed"
      style={{
        background: disabled
          ? 'rgba(39,39,42,0.8)'
          : 'linear-gradient(135deg, #0273c7 0%, #0e91e9 100%)',
        color: disabled ? 'rgb(113,113,122)' : 'white',
        boxShadow: disabled ? 'none' : '0 0 16px rgba(14,145,233,0.2)',
      }}
    >
      {children}
    </button>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config = {
    initialized:  { dot: '#60a5fa', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20', label: 'INIT' },
    producing:    { dot: '#0e91e9', color: 'bg-brand-500/10 text-brand-400 border-brand-500/20', label: 'PRODUCING' },
    partial_done: { dot: '#f59e0b', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20', label: 'PARTIAL' },
    done:         { dot: '#4ade80', color: 'bg-green-500/10 text-green-400 border-green-500/20', label: 'DONE' },
    paused:       { dot: '#71717a', color: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20', label: 'PAUSED' },
    setting:      { dot: '#71717a', color: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20', label: 'SETTING' },
  } as const;

  const item = config[status as keyof typeof config] ?? config.initialized;
  return (
    <span className={cn('flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest', item.color)}>
      <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: item.dot }} />
      {item.label}
    </span>
  );
}

function StatBox({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div
      className="rounded-2xl p-4"
      style={{ background: 'rgba(22,22,26,0.8)', border: '1px solid rgba(63,63,70,0.4)' }}
    >
      <div className="mb-3 flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">{label}</span>
        <span className="text-brand-400/70">{icon}</span>
      </div>
      <p className="text-2xl font-bold leading-none text-zinc-100">{value}</p>
    </div>
  );
}

function StrategyItem({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="flex items-center justify-between rounded-xl px-4 py-3"
      style={{ background: 'rgba(24,24,28,0.6)', border: '1px solid rgba(63,63,70,0.35)' }}
    >
      <p className="text-xs font-semibold uppercase tracking-[0.15em] text-zinc-500">{label}</p>
      <p className="text-sm font-bold text-zinc-200">{value}</p>
    </div>
  );
}
