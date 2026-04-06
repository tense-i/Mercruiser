'use client';

import { useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  Camera,
  CheckCircle2,
  ChevronRight,
  Clock,
  Download,
  Film,
  History,
  Image as ImageIcon,
  Layers,
  LayoutDashboard,
  ListTree,
  Mic,
  MonitorPlay,
  MoreVertical,
  Play,
  Plus,
  Scissors,
  Sparkles,
  Type,
  Upload,
  Video,
  Volume2,
  Wand2,
  Zap,
} from 'lucide-react';

import type { EpisodeWorkspaceView } from '@/lib/view-models/studio';
import { cn } from '@/lib/utils';

const tabs = [
  { id: 'overview', label: 'Overview', icon: <LayoutDashboard size={18} /> },
  { id: 'script', label: 'Script', icon: <Type size={18} /> },
  { id: 'subjects', label: 'Assets', icon: <Layers size={18} /> },
  { id: 'shots', label: 'Shot List', icon: <ListTree size={18} /> },
  { id: 'storyboard', label: 'Storyboard', icon: <MonitorPlay size={18} /> },
  { id: 'final-cut', label: 'Final Video', icon: <Video size={18} /> },
] as const;

const assetFilters = [
  { id: 'all', label: 'All Assets' },
  { id: 'character', label: 'Characters' },
  { id: 'scene', label: 'Scenes' },
  { id: 'prop', label: 'Props' },
] as const;

export function EpisodeWorkspace({ initialView }: { initialView: EpisodeWorkspaceView }) {
  const [view, setView] = useState(initialView);
  const [activeTab, setActiveTab] = useState<(typeof tabs)[number]['id']>('overview');
  const [selectedChapterId, setSelectedChapterId] = useState(initialView.chapters[0]?.id ?? '');
  const [selectedAssetId, setSelectedAssetId] = useState(initialView.assets[0]?.id ?? '');
  const [assetFilter, setAssetFilter] = useState<(typeof assetFilters)[number]['id']>('all');
  const [selectedShotId, setSelectedShotId] = useState(initialView.shots[0]?.id ?? '');
  const [storyboardMediaType, setStoryboardMediaType] = useState<'image' | 'video'>('image');
  const [pending, setPending] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const selectedChapter = view.chapters.find((chapter) => chapter.id === selectedChapterId) ?? view.chapters[0] ?? null;
  const filteredAssets = useMemo(
    () => view.assets.filter((asset) => assetFilter === 'all' || asset.type === assetFilter),
    [assetFilter, view.assets],
  );
  const selectedAsset = filteredAssets.find((asset) => asset.id === selectedAssetId) ?? filteredAssets[0] ?? null;
  const selectedShot = view.shots.find((shot) => shot.id === selectedShotId) ?? view.shots[0] ?? null;
  const selectedStoryboard = view.storyboards.find((item) => item.shotId === selectedShot?.id) ?? null;
  const actionMap = useMemo(() => new Map((view.gate?.availableActions ?? []).map((action) => [action.kind, action])), [view.gate]);

  async function dispatch(command: Record<string, unknown>) {
    try {
      setPending(String(command.type));
      const response = await fetch('/api/studio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          command,
          context: {
            episodeId: view.episode.id,
            seriesId: view.episode.seriesId,
          },
        }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.episodeView) {
        throw new Error(payload.error ?? '保存失败');
      }
      setErrorMessage(null);
      setView(payload.episodeView);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '保存失败');
    } finally {
      setPending(null);
    }
  }

  const blockedSummary = view.gate?.blockedReasons[0] ?? '当前阶段无硬门禁阻塞。';
  const nextStepCta = useMemo(() => {
    const scriptAction = actionMap.get('generate_script');
    const extractAction = actionMap.get('extract_assets');
    const assetRenderAction = actionMap.get('generate_asset_images');
    const shotAction = actionMap.get('generate_shots');
    const storyboardAction = actionMap.get('generate_shot_images');

    switch (view.gate?.currentStage) {
      case 'script_generation':
        if (scriptAction?.enabled) {
          return {
            label: scriptAction.label,
            run: () => dispatch({ type: 'generateScriptFromSource', episodeId: view.episode.id }),
          };
        }
        return {
          label: 'Complete Source Document',
          run: () => setActiveTab('script'),
        };
      case 'asset_extraction':
        return {
          label: extractAction?.label ?? 'Extract Assets',
          run: () => dispatch({ type: 'extractAssetsFromScript', episodeId: view.episode.id }),
        };
      case 'asset_rendering':
        return {
          label: assetRenderAction?.label ?? 'Generate Asset Images',
          run: () => dispatch({ type: 'generateAssetImages', episodeId: view.episode.id }),
        };
      case 'shot_generation':
        return {
          label: shotAction?.label ?? 'Generate Shot List',
          run: () => dispatch({ type: 'generateShotsFromChapters', episodeId: view.episode.id }),
        };
      case 'shot_rendering':
        return {
          label: storyboardAction?.label ?? 'Generate Storyboard Images',
          run: () => dispatch({ type: 'generateShotImages', episodeId: view.episode.id }),
        };
      case 'storyboard':
        return {
          label: 'Open Storyboard',
          run: () => setActiveTab('storyboard'),
        };
      case 'final_cut':
      case 'export':
        return {
          label: 'Open Final Video',
          run: () => setActiveTab('final-cut'),
        };
      default:
        return {
          label: 'Review Workspace',
          run: () => setActiveTab('script'),
        };
    }
  }, [actionMap, view.episode.id, view.gate?.currentStage]);

  return (
    <div className="flex h-full flex-col">
      {errorMessage ? (
        <div className="mb-4 rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{errorMessage}</div>
      ) : null}

      <div className="mb-8 flex items-center gap-1 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-all',
              activeTab === tab.id ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300',
            )}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1">
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
            <div className="space-y-8 lg:col-span-2">
              <div className="glass-panel rounded-3xl p-8">
                <h3 className="mb-6 text-2xl font-bold">Production Status</h3>
                <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
                  <ProductionStep label="Script" status={view.episode.stationStates.script} progress={view.chapters.length ? 100 : 0} />
                  <ProductionStep label="Assets" status={view.episode.stationStates.subjects} progress={view.assets.length ? Math.min(100, Math.round((view.assets.filter((asset) => asset.state === 'completed').length / Math.max(view.assets.length, 1)) * 100)) : 0} />
                  <ProductionStep label="Storyboard" status={view.episode.stationStates.storyboard} progress={view.shots.length ? Math.min(100, Math.round((view.shots.filter((shot) => shot.images.some((image) => image.isSelected)).length / Math.max(view.shots.length, 1)) * 100)) : 0} />
                  <ProductionStep label="Rendering" status={view.episode.stationStates['final-cut']} progress={view.finalCut?.tracks.length ? 100 : 0} />
                </div>
              </div>

              <div className="glass-panel rounded-3xl p-8">
                <div className="mb-6 flex items-center justify-between">
                  <h3 className="text-xl font-bold">Recent Activity</h3>
                  <span className="text-sm text-zinc-500">Workflow runs and recovery history for this episode.</span>
                </div>
                <div className="space-y-4">
                  {view.workflowRuns.length ? (
                    view.workflowRuns.map((run) => (
                      <ActivityItem
                        key={run.id}
                        icon={<Sparkles className="text-brand-400" size={16} />}
                        title={`${run.agent} finished ${run.stage}`}
                        time={run.updatedAt}
                        description={run.summary}
                      />
                    ))
                  ) : (
                    <ActivityItem
                      icon={<History className="text-zinc-400" size={16} />}
                      title="No workflow activity yet"
                      time="now"
                      description="Start from script generation to build the pipeline."
                    />
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="rounded-3xl border border-brand-500/20 bg-brand-600/10 p-6">
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500 shadow-lg shadow-brand-500/20">
                    <Sparkles className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h4 className="font-bold text-brand-400">Agent Copilot</h4>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-brand-300/60">Next Recommended Action</p>
                  </div>
                </div>
                <p className="mb-6 text-sm leading-relaxed text-zinc-300">
                  {blockedSummary}
                </p>
                <button
                  type="button"
                  onClick={() => void nextStepCta.run()}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-500 py-3 font-bold text-white shadow-lg shadow-brand-500/20 transition-all hover:bg-brand-400"
                >
                  {nextStepCta.label}
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'script' && selectedChapter && (
          <div className="flex h-full gap-6">
            <div className="flex w-64 flex-col gap-3">
              <h4 className="px-2 text-xs font-bold uppercase tracking-widest text-zinc-500">Chapters</h4>
              {view.chapters.map((chapter) => (
                <button
                  key={chapter.id}
                  onClick={() => setSelectedChapterId(chapter.id)}
                  className={cn(
                    'flex flex-col items-start rounded-2xl border p-4 text-left transition-all',
                    chapter.id === selectedChapter.id ? 'border-brand-500/50 bg-brand-500/5' : 'border-zinc-800 bg-zinc-900 hover:border-brand-500/30',
                  )}
                >
                  <span className="mb-1 text-[10px] font-bold text-zinc-500">CHAPTER {chapter.index}</span>
                  <span className="font-bold text-sm">{chapter.title}</span>
                </button>
              ))}
              <button className="flex items-center justify-center gap-2 rounded-2xl border border-dashed border-zinc-800 p-4 text-zinc-500 transition-all hover:border-zinc-600 hover:text-zinc-300">
                <Plus size={18} />
                <span className="text-sm font-medium">Add Chapter</span>
              </button>
            </div>

            <div className="glass-panel flex flex-1 flex-col rounded-3xl p-8">
              <div className="mb-6 flex items-center justify-between">
                <h3 className="text-2xl font-bold">{selectedChapter.title}</h3>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() =>
                      void dispatch({
                        type: 'generateScriptFromSource',
                        episodeId: view.episode.id,
                      })
                    }
                    className="rounded-xl bg-zinc-800 px-4 py-2 text-sm font-medium transition-colors hover:bg-zinc-700"
                  >
                    Generate Script
                  </button>
                  <button
                    onClick={() => {
                      const textarea = document.getElementById(`chapter-${selectedChapter.id}`) as HTMLTextAreaElement | null;
                      void dispatch({
                        type: 'updateChapter',
                        chapterId: selectedChapter.id,
                        content: textarea?.value ?? selectedChapter.content,
                      });
                    }}
                    className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-500"
                  >
                    Save Draft
                  </button>
                </div>
              </div>
              <textarea
                id={`chapter-${selectedChapter.id}`}
                className="custom-scrollbar flex-1 resize-none border-none bg-transparent text-lg leading-relaxed text-zinc-300 focus:outline-none"
                defaultValue={selectedChapter.content}
              />
              <div className="mt-6 flex items-center justify-between border-t border-zinc-800 pt-6 text-xs text-zinc-500">
                <div className="flex gap-4">
                  <span>Scene: {selectedChapter.scene}</span>
                  <span>Est. Duration: {selectedChapter.estimatedDurationSeconds}s</span>
                </div>
                <span>Dialogues: {selectedChapter.dialogues.length}</span>
              </div>
            </div>

            <div className="glass-panel custom-scrollbar flex w-80 flex-col gap-8 overflow-y-auto rounded-3xl p-6">
              <div className="flex flex-col gap-2">
                <button
                  onClick={() =>
                    void dispatch({
                      type: 'extractAssetsFromScript',
                      episodeId: view.episode.id,
                    })
                  }
                  className="flex items-center justify-center gap-2 rounded-xl bg-brand-600 py-3 text-sm font-bold text-white shadow-lg shadow-brand-600/20 transition-colors hover:bg-brand-500"
                >
                  <Wand2 size={16} />
                  Extract Assets & Shots
                </button>
                <button className="flex items-center justify-center gap-2 rounded-xl border border-brand-500/30 bg-zinc-800 py-3 text-sm font-bold text-brand-400 transition-colors hover:bg-zinc-700">
                  <Mic size={16} />
                  Generate Global Audio
                </button>
              </div>

              <SectionCard title="Video Ratio">
                <div className="grid grid-cols-4 gap-2">
                  {['16:9', '9:16', '4:3', '3:4'].map((ratio, index) => (
                    <button
                      key={ratio}
                      className={cn(
                        'flex flex-col items-center gap-1 rounded-lg border py-2 text-xs font-bold transition-all',
                        index === 1 ? 'border-brand-500 bg-brand-500/10 text-brand-400' : 'border-zinc-800 bg-zinc-900 text-zinc-500 hover:border-zinc-600',
                      )}
                    >
                      <div
                        className={cn('rounded-sm border-2', index === 1 ? 'border-brand-400' : 'border-zinc-500')}
                        style={{ width: ratio === '16:9' ? 24 : ratio === '9:16' ? 14 : 20, height: ratio === '16:9' ? 14 : ratio === '9:16' ? 24 : 15 }}
                      />
                      {ratio}
                    </button>
                  ))}
                </div>
              </SectionCard>

              <SectionCard title="Source Document">
                <input
                  id="source-title"
                  defaultValue={view.sourceDocument?.title ?? `${view.episode.title} 原文`}
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 focus:border-brand-500 focus:outline-none"
                />
                <textarea
                  id="source-content"
                  defaultValue={view.sourceDocument?.content ?? ''}
                  className="custom-scrollbar mt-3 h-40 w-full resize-none rounded-xl border border-zinc-800 bg-zinc-900 p-3 text-xs leading-relaxed text-zinc-300 focus:border-brand-500 focus:outline-none"
                />
                <button
                  onClick={() =>
                    void dispatch({
                      type: 'importSourceDocument',
                      episodeId: view.episode.id,
                      title: (document.getElementById('source-title') as HTMLInputElement | null)?.value ?? view.sourceDocument?.title ?? '未命名原文',
                      content: (document.getElementById('source-content') as HTMLTextAreaElement | null)?.value ?? view.sourceDocument?.content ?? '',
                    })
                  }
                  className="mt-3 w-full rounded-lg bg-zinc-800 py-2 text-sm font-bold text-white transition-colors hover:bg-zinc-700"
                >
                  Save Source
                </button>
              </SectionCard>
            </div>
          </div>
        )}

        {activeTab === 'subjects' && (
          <div className="flex h-full gap-6">
            <div className="flex flex-1 flex-col gap-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  {assetFilters.map((filter) => {
                    const count =
                      filter.id === 'all'
                        ? view.assets.length
                        : view.assets.filter((asset) => asset.type === filter.id).length;
                    return (
                      <AssetFilter
                        key={filter.id}
                        label={`${filter.label} (${count})`}
                        active={assetFilter === filter.id}
                        onClick={() => {
                          setAssetFilter(filter.id);
                          const nextAsset =
                            filter.id === 'all'
                              ? view.assets[0]
                              : view.assets.find((asset) => asset.type === filter.id);
                          if (nextAsset) {
                            setSelectedAssetId(nextAsset.id);
                          }
                        }}
                      />
                    );
                  })}
                </div>
                <button
                  type="button"
                  onClick={() =>
                    void dispatch({
                      type: 'generateAssetImages',
                      episodeId: view.episode.id,
                    })
                  }
                  className="flex items-center gap-2 rounded-xl bg-zinc-800 px-4 py-2 text-sm font-bold text-white transition-all hover:bg-zinc-700"
                >
                  <Layers size={16} />
                  Batch Generate
                </button>
              </div>
              <div className="custom-scrollbar grid grid-cols-1 gap-4 overflow-y-auto pb-4 sm:grid-cols-2 lg:grid-cols-3">
                {filteredAssets.map((asset) => (
                  <button
                    key={asset.id}
                    type="button"
                    onClick={() => setSelectedAssetId(asset.id)}
                    className={cn(
                      'group glass-panel flex flex-col overflow-hidden rounded-2xl border text-left transition-all hover:border-brand-500/50',
                      asset.id === selectedAsset?.id ? 'border-brand-500/50' : 'border-zinc-800',
                    )}
                  >
                    <div className="flex items-center justify-between border-b border-zinc-800/50 p-3">
                      <h4 className="text-sm font-bold">{asset.name}</h4>
                      {asset.isFaceLocked ? <Camera size={14} className="text-brand-400" /> : null}
                    </div>
                    <div className="relative flex aspect-video items-center justify-center overflow-hidden bg-zinc-900">
                      <div className="h-full w-full bg-gradient-to-br from-zinc-800 via-zinc-900 to-zinc-950" />
                    </div>
                    <div className="flex items-center justify-between bg-zinc-900/50 p-3">
                      <span className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">{asset.type}</span>
                      <span className="text-xs font-bold text-zinc-300">{asset.voice || 'No voice'}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="glass-panel custom-scrollbar flex h-full w-80 flex-col overflow-y-auto rounded-3xl p-6">
              <div className="mb-6 flex items-center justify-between">
                <h3 className="font-bold">{selectedAsset ? `Asset Workspace · ${selectedAsset.name}` : 'Asset Workspace'}</h3>
                {selectedAsset?.isShared ? <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-300">Shared</span> : null}
              </div>

              {selectedAsset ? (
                <div key={selectedAsset.id} className="space-y-6">
                  <SectionCard title="Asset Prompt">
                    <textarea
                      id={`asset-prompt-${selectedAsset.id}`}
                      className="custom-scrollbar h-32 w-full resize-none rounded-xl border border-zinc-800 bg-zinc-900 p-3 font-mono text-xs leading-relaxed text-zinc-300 focus:border-brand-500 focus:outline-none"
                      defaultValue={selectedAsset.prompt}
                    />
                  </SectionCard>

                  <SectionCard title="Asset Notes">
                    <textarea
                      id={`asset-description-${selectedAsset.id}`}
                      className="custom-scrollbar h-28 w-full resize-none rounded-xl border border-zinc-800 bg-zinc-900 p-3 text-sm leading-relaxed text-zinc-300 focus:border-brand-500 focus:outline-none"
                      defaultValue={selectedAsset.description}
                    />
                  </SectionCard>

                  <SectionCard title="Voice & Sharing">
                    <div className="space-y-3">
                      <input
                        id={`asset-voice-${selectedAsset.id}`}
                        className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 focus:border-brand-500 focus:outline-none"
                        defaultValue={selectedAsset.voice}
                        placeholder="e.g. narrator-f1"
                      />
                      <label className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-3 text-sm text-zinc-300">
                        Promote to shared asset
                        <input id={`asset-shared-${selectedAsset.id}`} type="checkbox" defaultChecked={selectedAsset.isShared} className="h-4 w-4 accent-brand-500" />
                      </label>
                    </div>
                  </SectionCard>

                  <div className="flex items-center gap-2">
                    <div className="flex flex-1 items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2">
                      <span className="text-[10px] font-bold text-zinc-500">Model</span>
                      <span className="font-mono text-xs text-brand-400">SiliconFlow | Chat</span>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        void dispatch({
                          type: 'generateAssetImages',
                          episodeId: view.episode.id,
                        })
                      }
                      className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-brand-600 py-2 text-sm font-bold text-white shadow-lg shadow-brand-600/20 hover:bg-brand-500"
                    >
                      Generate <Zap size={14} /> 2
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      void dispatch({
                        type: 'updateAsset',
                        assetId: selectedAsset.id,
                        prompt: (document.getElementById(`asset-prompt-${selectedAsset.id}`) as HTMLTextAreaElement | null)?.value ?? selectedAsset.prompt,
                        description: (document.getElementById(`asset-description-${selectedAsset.id}`) as HTMLTextAreaElement | null)?.value ?? selectedAsset.description,
                        voice: (document.getElementById(`asset-voice-${selectedAsset.id}`) as HTMLInputElement | null)?.value ?? selectedAsset.voice,
                        isShared: (document.getElementById(`asset-shared-${selectedAsset.id}`) as HTMLInputElement | null)?.checked ?? selectedAsset.isShared,
                      })
                    }
                    className="w-full rounded-xl bg-zinc-800 py-3 text-sm font-bold text-white transition-colors hover:bg-zinc-700"
                  >
                    Save Asset Workspace
                  </button>

                  <SectionCard title="Generated Materials">
                    <div className="grid grid-cols-2 gap-2">
                      {(selectedAsset.images.length ? selectedAsset.images : selectedAsset.versions).map((image) => (
                        <button
                          key={image.id}
                          type="button"
                          onClick={() =>
                            void dispatch({
                              type: 'selectAssetImage',
                              assetId: selectedAsset.id,
                              imageId: image.id,
                            })
                          }
                          className={cn(
                            'relative aspect-[16/9] overflow-hidden rounded-xl border-2',
                            image.isSelected ? 'border-brand-500' : 'border-transparent hover:border-zinc-600',
                          )}
                        >
                          <div className="h-full w-full bg-gradient-to-br from-zinc-800 via-zinc-900 to-zinc-950" />
                          {image.isSelected ? (
                            <div className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-brand-500">
                              <CheckCircle2 size={10} className="text-white" />
                            </div>
                          ) : null}
                        </button>
                      ))}
                    </div>
                  </SectionCard>
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-950/40 px-4 py-6 text-sm text-zinc-500">
                  No assets in this filter yet. Extract subjects from the script first.
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'shots' && (
          <div className="flex h-full gap-6">
            <div className="flex min-w-0 flex-1 flex-col">
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold">Smart Shot List</h3>
                  <p className="mt-1 text-sm text-zinc-500">Edit shot intent here before rendering storyboard images.</p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    void dispatch({
                      type: view.shots.length ? 'generateShotImages' : 'generateShotsFromChapters',
                      episodeId: view.episode.id,
                    })
                  }
                  className="flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2 text-sm font-bold text-white shadow-lg shadow-brand-600/20 transition-colors hover:bg-brand-500"
                >
                  {view.shots.length ? 'Generate Storyboard' : 'Generate Shot List'} <ChevronRight size={16} />
                </button>
              </div>

              <div className="custom-scrollbar flex-1 space-y-4 overflow-y-auto pr-2">
                {view.shots.map((shot) => (
                  <div
                    key={shot.id}
                    className={cn(
                      'glass-panel overflow-hidden rounded-2xl border transition-colors',
                      shot.id === selectedShot?.id ? 'border-brand-500/50' : 'border-zinc-800',
                    )}
                  >
                  <div className="flex items-start gap-4 border-b border-zinc-800 bg-zinc-900/80 px-4 py-3">
                    <span className="mt-0.5 whitespace-nowrap text-sm font-bold text-brand-400">Shot {shot.index}</span>
                    <p className="flex-1 text-sm leading-relaxed text-zinc-300">{shot.description}</p>
                    <div className="flex gap-2">
                      {shot.continuityIssues.length ? (
                        <div className="rounded-lg bg-yellow-500/10 p-1.5 text-yellow-500">
                          <AlertCircle size={14} />
                        </div>
                      ) : null}
                      <div className="rounded-lg bg-zinc-800/80 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-400">
                        {shot.referenceAssetIds.length} refs
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-12 items-start gap-4 p-4 text-xs">
                    <Cell span="1" label="Scene" value={`@${shot.scene}`} strong />
                    <Cell span="1" label="Comp" value={shot.composition} strong />
                    <Cell span="1" label="Camera" value={shot.cameraMotion || shot.cameraMove || 'Static'} strong />
                    <Cell span="1" label="Lighting" value={shot.lighting} strong />
                    <div className="col-span-4 flex flex-col gap-1">
                      <span className="font-medium text-zinc-500">Prompt</span>
                      <p className="line-clamp-3 rounded-md border border-zinc-800/50 bg-zinc-950 p-2 font-mono leading-relaxed text-zinc-400">{shot.prompt}</p>
                    </div>
                    <Cell span="2" label="Dialogue" value={shot.dialogue || '-'} strong />
                    <Cell span="1" label="Duration" value={`${shot.durationSeconds}s`} strong />
                    <div className="col-span-1 flex flex-col items-end gap-1">
                      <span className="font-medium text-zinc-500">Action</span>
                      <button type="button" onClick={() => setSelectedShotId(shot.id)} className="font-bold text-brand-400 transition-colors hover:text-brand-300">
                        Edit
                      </button>
                    </div>
                  </div>
                </div>
                ))}
                {!view.shots.length ? (
                  <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-950/40 px-4 py-6 text-sm text-zinc-500">
                    No shot list yet. Once assets are locked, generate the first structured shot pass from chapters.
                  </div>
                ) : null}
              </div>
            </div>

            <div className="glass-panel custom-scrollbar flex h-full w-80 flex-col overflow-y-auto rounded-3xl p-6">
              <div className="mb-6 flex items-center justify-between">
                <h3 className="font-bold">{selectedShot ? `Shot Workspace · ${selectedShot.title}` : 'Shot Workspace'}</h3>
                {selectedShot ? <span className="rounded-full border border-zinc-800 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-400">Shot {selectedShot.index}</span> : null}
              </div>

              {selectedShot ? (
                <div key={selectedShot.id} className="space-y-6">
                  <SectionCard title="Shot Prompt">
                    <textarea
                      id={`shot-prompt-${selectedShot.id}`}
                      className="custom-scrollbar h-32 w-full resize-none rounded-xl border border-zinc-800 bg-zinc-900 p-3 font-mono text-xs leading-relaxed text-zinc-300 focus:border-brand-500 focus:outline-none"
                      defaultValue={selectedShot.prompt}
                    />
                  </SectionCard>

                  <SectionCard title="Structured Fields">
                    <div className="space-y-3">
                      <input id={`shot-scene-${selectedShot.id}`} className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 focus:border-brand-500 focus:outline-none" defaultValue={selectedShot.scene} placeholder="Scene" />
                      <input id={`shot-composition-${selectedShot.id}`} className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 focus:border-brand-500 focus:outline-none" defaultValue={selectedShot.composition} placeholder="Composition" />
                      <input id={`shot-lighting-${selectedShot.id}`} className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 focus:border-brand-500 focus:outline-none" defaultValue={selectedShot.lighting} placeholder="Lighting" />
                      <input id={`shot-camera-${selectedShot.id}`} className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 focus:border-brand-500 focus:outline-none" defaultValue={selectedShot.cameraMotion || selectedShot.cameraMove} placeholder="Camera motion" />
                      <textarea id={`shot-dialogue-${selectedShot.id}`} className="custom-scrollbar h-24 w-full resize-none rounded-xl border border-zinc-800 bg-zinc-900 p-3 text-sm leading-relaxed text-zinc-300 focus:border-brand-500 focus:outline-none" defaultValue={selectedShot.dialogue} placeholder="Dialogue / subtitle cue" />
                      <input id={`shot-duration-${selectedShot.id}`} type="number" min={1} className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 focus:border-brand-500 focus:outline-none" defaultValue={selectedShot.durationSeconds} />
                    </div>
                  </SectionCard>

                  <button
                    type="button"
                    onClick={() =>
                      void dispatch({
                        type: 'updateShot',
                        shotId: selectedShot.id,
                        prompt: (document.getElementById(`shot-prompt-${selectedShot.id}`) as HTMLTextAreaElement | null)?.value ?? selectedShot.prompt,
                        scene: (document.getElementById(`shot-scene-${selectedShot.id}`) as HTMLInputElement | null)?.value ?? selectedShot.scene,
                        composition: (document.getElementById(`shot-composition-${selectedShot.id}`) as HTMLInputElement | null)?.value ?? selectedShot.composition,
                        lighting: (document.getElementById(`shot-lighting-${selectedShot.id}`) as HTMLInputElement | null)?.value ?? selectedShot.lighting,
                        cameraMotion: (document.getElementById(`shot-camera-${selectedShot.id}`) as HTMLInputElement | null)?.value ?? selectedShot.cameraMotion,
                        dialogue: (document.getElementById(`shot-dialogue-${selectedShot.id}`) as HTMLTextAreaElement | null)?.value ?? selectedShot.dialogue,
                        durationSeconds: Number((document.getElementById(`shot-duration-${selectedShot.id}`) as HTMLInputElement | null)?.value ?? selectedShot.durationSeconds),
                      })
                    }
                    className="w-full rounded-xl bg-zinc-800 py-3 text-sm font-bold text-white transition-colors hover:bg-zinc-700"
                  >
                    Save Shot Workspace
                  </button>
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-950/40 px-4 py-6 text-sm text-zinc-500">
                  Generate shots first, then edit prompts and structured metadata here.
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'storyboard' && selectedShot && (
          <div className="flex h-full gap-6">
            <div className="flex min-w-0 flex-1 flex-col gap-4">
              <div className="relative flex flex-1 items-center justify-center overflow-hidden rounded-3xl border border-zinc-800 bg-black shadow-2xl">
                <div className="h-full w-full bg-gradient-to-br from-zinc-800 via-zinc-900 to-zinc-950" />
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-6 pt-20">
                  <p className="max-w-3xl text-lg font-medium text-white">
                    <span className="mr-2 font-bold text-brand-400">Storyboard:</span>
                    {selectedStoryboard?.subtitle || selectedShot.dialogue || selectedShot.description}
                  </p>
                  <div className="mt-4 flex gap-2">
                    <button className="rounded-lg bg-zinc-800/80 px-3 py-1.5 text-xs font-bold text-white backdrop-blur-md transition-colors hover:bg-zinc-700">Edit Subtitles</button>
                    <button className="flex items-center gap-1 rounded-lg bg-zinc-800/80 px-3 py-1.5 text-xs font-bold text-white backdrop-blur-md transition-colors hover:bg-zinc-700">
                      <Volume2 size={14} /> Preview Audio
                    </button>
                  </div>
                </div>
                <button className="absolute right-4 top-4 rounded-lg bg-black/50 p-2 text-white backdrop-blur-md transition-colors hover:bg-black/80">
                  <MonitorPlay size={20} />
                </button>
              </div>

              <div className="glass-panel flex h-48 flex-col rounded-3xl p-4">
                <div className="mb-3 flex items-center justify-between px-2">
                  <div className="flex items-center gap-3">
                    <h4 className="text-sm font-bold">All Shots <span className="font-normal text-zinc-500">({view.shots.length} total)</span></h4>
                    <button className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-500 text-white">
                      <Play size={12} fill="currentColor" className="ml-0.5" />
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <button className="rounded-lg bg-zinc-800 px-3 py-1.5 text-xs font-bold transition-colors hover:bg-zinc-700">Batch Images</button>
                    <button className="rounded-lg bg-zinc-800 px-3 py-1.5 text-xs font-bold transition-colors hover:bg-zinc-700">Batch Video</button>
                  </div>
                </div>
                <div className="custom-scrollbar flex flex-1 items-center gap-3 overflow-x-auto pb-2">
                  {view.shots.map((shot) => (
                    <button
                      key={shot.id}
                      onClick={() => setSelectedShotId(shot.id)}
                      className={cn(
                        'relative h-full shrink-0 aspect-[16/9] overflow-hidden rounded-xl border-2',
                        shot.id === selectedShot.id ? 'border-brand-500' : 'border-zinc-800 hover:border-zinc-600',
                      )}
                    >
                      <div className="h-full w-full bg-gradient-to-br from-zinc-800 via-zinc-900 to-zinc-950" />
                      <div className="absolute left-1 top-1 rounded bg-black/60 px-1.5 py-0.5 text-[8px] font-bold text-white backdrop-blur-md">Shot {shot.index}</div>
                      <div className="absolute right-1 top-1 rounded bg-black/60 px-1.5 py-0.5 font-mono text-[8px] text-zinc-300 backdrop-blur-md">
                        {typeof shot.duration === 'string' ? shot.duration : `${shot.duration}s`}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="glass-panel custom-scrollbar flex h-full w-80 flex-col overflow-y-auto rounded-3xl p-6">
              <div className="mb-6 flex gap-2 rounded-xl bg-zinc-900 p-1">
                <button onClick={() => setStoryboardMediaType('image')} className={cn('flex-1 rounded-lg py-1.5 text-xs font-bold transition-colors', storyboardMediaType === 'image' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300')}>
                  Image
                </button>
                <button onClick={() => setStoryboardMediaType('video')} className={cn('flex-1 rounded-lg py-1.5 text-xs font-bold transition-colors', storyboardMediaType === 'video' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300')}>
                  Video
                </button>
              </div>

              <div className="space-y-6">
                <SectionCard title={`Image Prompt Shot ${selectedShot.index}`}>
                  <textarea className="custom-scrollbar h-32 w-full resize-none rounded-xl border border-zinc-800 bg-zinc-900 p-3 font-mono text-xs leading-relaxed text-zinc-300 focus:border-brand-500 focus:outline-none" defaultValue={selectedShot.prompt} />
                </SectionCard>

                <div className="flex items-center gap-2">
                  <div className="flex flex-1 items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2">
                    <span className="text-[10px] font-bold text-zinc-500">Model</span>
                    <span className="font-mono text-xs text-brand-400">SiliconFlow | Chat</span>
                  </div>
                  <button
                    onClick={() =>
                      void dispatch({
                        type: 'generateShotImages',
                        episodeId: view.episode.id,
                      })
                    }
                    className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-brand-600 py-2 text-sm font-bold text-white shadow-lg shadow-brand-600/20 hover:bg-brand-500"
                  >
                    Generate <Zap size={14} /> 2
                  </button>
                </div>

                <SectionCard title="Reference Subjects">
                  <div className="custom-scrollbar flex gap-3 overflow-x-auto pb-2">
                    {view.assets.slice(0, 2).map((asset) => (
                      <div key={asset.id} className="w-20 shrink-0">
                        <div className="aspect-square rounded-xl border border-zinc-700 bg-zinc-900" />
                        <p className="truncate pt-1 text-center text-[10px] font-bold">{asset.name}</p>
                      </div>
                    ))}
                  </div>
                </SectionCard>

                <SectionCard title={`${storyboardMediaType === 'image' ? 'Image Takes' : 'Video Takes'} (${selectedShot.takes.length})`}>
                  <div className="grid grid-cols-2 gap-2">
                    {selectedShot.takes.map((take, index) => (
                      <button
                        key={take.id}
                        onClick={() =>
                          void dispatch({
                            type: 'selectTake',
                            shotId: selectedShot.id,
                            takeId: take.id,
                          })
                        }
                        className={cn(
                          'relative aspect-[16/9] overflow-hidden rounded-xl border-2',
                          take.isSelected ? 'border-brand-500' : 'border-transparent hover:border-zinc-600',
                        )}
                      >
                        <div className="h-full w-full bg-gradient-to-br from-zinc-800 via-zinc-900 to-zinc-950" />
                        <div className="absolute left-1 top-1 rounded bg-black/60 px-1.5 py-0.5 font-mono text-[8px] text-white">Take {index + 1}</div>
                        {take.isSelected ? (
                          <div className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-brand-500">
                            <CheckCircle2 size={10} className="text-white" />
                          </div>
                        ) : null}
                      </button>
                    ))}
                  </div>
                </SectionCard>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'final-cut' && (
          <div className="flex h-full flex-col gap-4">
            <div className="relative flex flex-1 flex-col items-center justify-center overflow-hidden rounded-3xl border border-zinc-800 bg-black shadow-2xl">
              <div className="absolute left-4 top-4 flex items-center gap-2 rounded-lg border border-white/10 bg-black/50 px-3 py-1.5 backdrop-blur-md">
                <Video size={16} className="text-brand-400" />
                <span className="text-xs font-bold text-white">{view.finalCut?.resolution ?? '1080p'} • {view.finalCut?.fps ?? 24}fps</span>
              </div>
              <div className="h-full w-full bg-gradient-to-br from-zinc-800 via-zinc-900 to-zinc-950" />
              <div className="absolute inset-0 flex items-center justify-center">
                <button className="flex h-20 w-20 items-center justify-center rounded-full bg-brand-500/90 text-white shadow-2xl shadow-brand-500/50 transition-transform hover:scale-110">
                  <Play size={32} fill="currentColor" className="ml-2" />
                </button>
              </div>
              <div className="absolute bottom-0 left-0 right-0 flex h-16 items-end bg-gradient-to-t from-black/90 to-transparent px-6 pb-4">
                <div className="flex w-full items-center gap-4">
                  <span className="font-mono text-xs text-zinc-300">00:00:00</span>
                  <div className="h-1 flex-1 overflow-hidden rounded-full bg-zinc-800">
                    <div className="h-full w-1/3 rounded-full bg-brand-500" />
                  </div>
                  <span className="font-mono text-xs text-zinc-300">00:00:05</span>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-zinc-800 bg-zinc-900/80 p-4 backdrop-blur-md">
              <div className="mb-4 flex items-center justify-between px-2">
                <div className="flex items-center gap-4">
                  <h3 className="text-sm font-bold text-zinc-300">Timeline</h3>
                  <div className="flex items-center gap-2">
                    <button className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-800">
                      <Scissors size={16} />
                    </button>
                    <button className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-800">
                      <Plus size={16} />
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-zinc-500">Zoom</span>
                  <input type="range" className="w-24 accent-brand-500" defaultValue="50" />
                </div>
              </div>

              <div className="relative flex flex-col gap-2">
                <div className="absolute bottom-0 top-0 left-1/3 z-20 w-0.5 bg-brand-500">
                  <div className="absolute -left-1.5 -top-2 h-3.5 w-3.5 rounded-sm bg-brand-500" />
                </div>
                {(view.finalCut?.tracks ?? []).map((track) => (
                  <div key={track.id} className="flex h-14 items-center gap-2 rounded-xl border border-zinc-800/50 bg-zinc-950/50 p-1">
                    <div className="flex w-16 items-center justify-center border-r border-zinc-800 text-zinc-600">
                      {track.type === 'video' ? <Video size={16} /> : track.type === 'dialogue' ? <Mic size={16} /> : <Volume2 size={16} />}
                    </div>
                    <div className="relative flex h-full flex-1 gap-1">
                      {track.items.map((item, index) => (
                        <button
                          key={item.id}
                          onClick={() =>
                            void dispatch({
                              type: 'updateTimelineItem',
                              finalCutId: view.finalCut!.id,
                              trackId: track.id,
                              itemId: item.id,
                              label: item.label,
                              locked: !item.locked,
                            })
                          }
                          className="absolute h-full rounded-lg border border-blue-500/30 bg-blue-900/30 px-2 text-left text-[10px] font-bold text-blue-300"
                          style={{
                            left: `${(index / Math.max(track.items.length, 1)) * 70}%`,
                            width: `${Math.max(18, (item.endSeconds - item.startSeconds) * 5)}%`,
                          }}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ProductionStep({ label, status, progress }: { label: string; status: string; progress: number }) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-bold">{label}</span>
        <span className="text-[10px] uppercase tracking-widest text-zinc-500">{status}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
        <div className="h-full rounded-full bg-gradient-to-r from-brand-600 to-brand-400" style={{ width: `${progress}%` }} />
      </div>
      <p className="mt-2 text-xs text-zinc-500">{progress}%</p>
    </div>
  );
}

function ActivityItem({
  icon,
  title,
  time,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  time: string;
  description?: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
      <div className="mt-0.5">{icon}</div>
      <div className="flex-1">
        <p className="text-sm font-medium text-zinc-100">{title}</p>
        {description ? <p className="mt-1 text-xs leading-6 text-zinc-400">{description}</p> : null}
      </div>
      <span className="text-[10px] text-zinc-500">{time}</span>
    </div>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="mb-2 text-xs font-bold text-zinc-500">{title}</h4>
      {children}
    </div>
  );
}

function AssetFilter({ label, active, onClick }: { label: string; active?: boolean; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn('rounded-full border px-4 py-2 text-sm font-bold transition-all', active ? 'border-brand-500/30 bg-brand-500/10 text-brand-400' : 'border-zinc-800 bg-zinc-900 text-zinc-500 hover:border-zinc-600 hover:text-zinc-300')}
    >
      {label}
    </button>
  );
}

function Cell({ label, value, strong, span }: { label: string; value: string; strong?: boolean; span: string }) {
  const spanClass =
    span === '1'
      ? 'col-span-1'
      : span === '2'
        ? 'col-span-2'
        : span === '4'
          ? 'col-span-4'
          : 'col-span-1';

  return (
    <div className={cn(spanClass, 'flex flex-col gap-1')}>
      <span className="font-medium text-zinc-500">{label}</span>
      <span className={cn(strong ? 'font-bold text-zinc-200' : 'text-zinc-400')}>{value}</span>
    </div>
  );
}
