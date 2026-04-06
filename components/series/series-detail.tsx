'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Box, CheckCircle2, ChevronRight, Clock, Film, Globe2, PlusCircle, Sparkles, Wand2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import type { SeriesView } from '@/lib/view-models/studio';
import { cn } from '@/lib/utils';

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
  const [episodeDraft, setEpisodeDraft] = useState({
    title: '',
    logline: '',
    sourceTitle: '',
    sourceContent: '',
  });

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
      setEpisodeDraft({ title: '', logline: '', sourceTitle: '', sourceContent: '' });
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

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      {errorMessage ? (
        <div className="rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{errorMessage}</div>
      ) : null}

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-3">
            <StatusBadge status={view.series.status} />
            <span className="font-mono text-xs text-zinc-500">ID: {view.series.id}</span>
          </div>
          <h2 className="mb-3 text-4xl font-bold tracking-tight">{view.series.name}</h2>
          <p className="max-w-3xl leading-relaxed text-zinc-400">{view.series.description}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          {focusEpisode ? (
            <Link
              href={`/series/${view.series.id}/episodes/${focusEpisode.id}`}
              className="rounded-xl border border-brand-500/30 bg-brand-500/10 px-4 py-2 text-sm font-medium text-brand-300 transition-colors hover:bg-brand-500/20"
            >
              Continue Current Episode
            </Link>
          ) : null}
          <button
            type="button"
            onClick={() => void handleCreateEpisode('blank')}
            disabled={pending === 'createEpisode' || !episodeDraft.title.trim()}
            className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-brand-500 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500"
          >
            快速新建集数
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <StatBox label="Total Episodes" value={view.episodes.length.toString()} icon={<Film size={16} />} />
        <StatBox label="Overall Progress" value={`${view.series.progress}%`} icon={<CheckCircle2 size={16} />} />
        <StatBox label="Global Assets" value={view.globalAssets.length.toString()} icon={<Globe2 size={16} />} />
        <StatBox label="Created At" value={view.series.createdAt.slice(0, 10)} icon={<Clock size={16} />} />
      </div>

      <div className="grid gap-8 lg:grid-cols-[1.35fr_0.95fr]">
        <div className="space-y-8">
          <Panel title="集数管理" icon={<PlusCircle size={18} className="text-brand-300" />}>
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4">
                <h4 className="text-sm font-bold text-zinc-100">空白创建</h4>
                <p className="mt-2 text-xs text-zinc-500">适合先建集数骨架，再补剧本与资产。</p>
              </div>
              <div className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4">
                <h4 className="text-sm font-bold text-zinc-100">从原文创建</h4>
                <p className="mt-2 text-xs text-zinc-500">写入原文后直接进入脚本工位，后续可继续拆章节。</p>
              </div>
            </div>
            <div className="mt-4 grid gap-3">
              <input
                value={episodeDraft.title}
                onChange={(event) => setEpisodeDraft((current) => ({ ...current, title: event.target.value }))}
                placeholder="Episode title"
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-brand-500 focus:outline-none"
              />
              <textarea
                value={episodeDraft.logline}
                onChange={(event) => setEpisodeDraft((current) => ({ ...current, logline: event.target.value }))}
                placeholder="Logline / brief (optional)"
                className="h-20 w-full resize-none rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-sm text-zinc-200 focus:border-brand-500 focus:outline-none"
              />
              <div className="grid gap-3 lg:grid-cols-2">
                <button
                  type="button"
                  onClick={() => void handleCreateEpisode('blank')}
                  disabled={pending === 'createEpisode' || !episodeDraft.title.trim()}
                  className="rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm font-medium text-zinc-100 transition-colors hover:border-brand-500/40 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {pending === 'createEpisode' ? 'Creating…' : '空白创建'}
                </button>
                <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3 text-xs text-zinc-500">
                  创建后会继承系列策略与已共享资产，并跳转到对应集数工作区。
                </div>
              </div>
              <input
                value={episodeDraft.sourceTitle}
                onChange={(event) => setEpisodeDraft((current) => ({ ...current, sourceTitle: event.target.value }))}
                placeholder="Source title"
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-brand-500 focus:outline-none"
              />
              <textarea
                value={episodeDraft.sourceContent}
                onChange={(event) => setEpisodeDraft((current) => ({ ...current, sourceContent: event.target.value }))}
                placeholder="Paste source text here to create the episode from source"
                className="h-28 w-full resize-none rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-sm text-zinc-200 focus:border-brand-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => void handleCreateEpisode('source')}
                disabled={pending === 'createEpisodeFromSource' || !episodeDraft.title.trim() || !episodeDraft.sourceTitle.trim() || !episodeDraft.sourceContent.trim()}
                className="rounded-xl bg-brand-600 px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-brand-500 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500"
              >
                {pending === 'createEpisodeFromSource' ? 'Creating from source…' : '从原文创建'}
              </button>
            </div>

            <div className="mt-6 space-y-3">
              {view.episodes.map((episode) => (
                <Link
                  key={episode.id}
                  href={`/series/${episode.seriesId}/episodes/${episode.id}`}
                  className="group flex w-full items-center gap-4 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4 transition-all hover:border-brand-500/30 hover:bg-zinc-900"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-800 text-sm font-bold text-zinc-400 transition-colors group-hover:bg-brand-600/20 group-hover:text-brand-400">
                    {episode.index.toString().padStart(2, '0')}
                  </div>
                  <div className="flex-1 text-left">
                    <h4 className="font-bold text-zinc-100">{episode.title}</h4>
                    <div className="mt-1 flex items-center gap-3">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-brand-400">{episode.currentStage}</span>
                      <div className="h-1 w-1 rounded-full bg-zinc-700" />
                      <span className="text-[10px] font-medium text-zinc-500">{episode.progress}% Complete</span>
                    </div>
                    {episode.gate?.blockedReasons?.[0] ? <p className="mt-2 text-xs text-amber-300">{episode.gate.blockedReasons[0]}</p> : null}
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="hidden h-1.5 w-32 overflow-hidden rounded-full bg-zinc-800 sm:block">
                      <div className="h-full rounded-full bg-brand-500" style={{ width: `${episode.progress}%` }} />
                    </div>
                    <ChevronRight size={20} className="text-zinc-600 transition-colors group-hover:text-brand-400" />
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
    </div>
  );
}

function Panel({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="glass-panel rounded-3xl p-6">
      <div className="mb-4 flex items-center gap-2 font-bold text-zinc-100">
        {icon}
        <span>{title}</span>
      </div>
      {children}
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
      className="mt-5 w-full rounded-xl bg-brand-600 px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-brand-500 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500"
    >
      {children}
    </button>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config = {
    initialized: { color: 'bg-blue-500/10 text-blue-400 border-blue-500/20', label: 'Initialized' },
    producing: { color: 'bg-brand-500/10 text-brand-400 border-brand-500/20', label: 'Producing' },
    partial_done: { color: 'bg-amber-500/10 text-amber-400 border-amber-500/20', label: 'Partial' },
    done: { color: 'bg-green-500/10 text-green-400 border-green-500/20', label: 'Completed' },
    paused: { color: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20', label: 'Paused' },
    setting: { color: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20', label: 'Setting' },
  } as const;

  const item = config[status as keyof typeof config] ?? config.initialized;
  return <span className={cn('rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest', item.color)}>{item.label}</span>;
}

function StatBox({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="glass-panel rounded-2xl p-5">
      <div className="mb-2 flex items-center gap-2 text-sm text-zinc-500">{icon}{label}</div>
      <p className="text-2xl font-bold text-zinc-100">{value}</p>
    </div>
  );
}

function StrategyItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-3">
      <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">{label}</p>
      <p className="mt-2 text-sm font-medium text-zinc-200">{value}</p>
    </div>
  );
}
