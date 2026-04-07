'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Camera,
  CheckCircle2,
  ChevronRight,
  FileText,
  History,
  Layers,
  LayoutDashboard,
  ListTree,
  Mic,
  MonitorPlay,
  PlusCircle,
  Save,
  Sparkles,
  Type,
  Upload,
  Video,
  Volume2,
  Wand2,
  Zap,
} from 'lucide-react';

import type { EpisodeStationId, EpisodeWorkspaceView } from '@/lib/view-models/studio';
import { readSourceFile } from '@/lib/source-file';
import { cn } from '@/lib/utils';
import { Dialog, DialogField, DialogFooter, DialogButton, DialogDivider, DialogSection } from '@/components/ui/dialog';
import { PROVIDER_IDS, getProviderModels, getDefaultModelForProvider, IMAGE_MODEL_CATALOG, DEFAULT_IMAGE_MODEL_ID } from '@/lib/ai/providers-catalog';
import type { ProviderId } from '@/lib/ai/providers-catalog';

const tabs = [
  { id: 'overview', label: '概览', icon: <LayoutDashboard size={18} /> },
  { id: 'script', label: '剧本', icon: <Type size={18} /> },
  { id: 'subjects', label: '主体', icon: <Layers size={18} /> },
  { id: 'shots', label: '分镜', icon: <ListTree size={18} /> },
  { id: 'storyboard', label: '故事板', icon: <MonitorPlay size={18} /> },
  { id: 'final-cut', label: '成片', icon: <Video size={18} /> },
] as const;

const tabIconMap: Record<EpisodeStationId, React.ReactNode> = {
  overview: <LayoutDashboard size={18} />,
  script: <Type size={18} />,
  subjects: <Layers size={18} />,
  shots: <ListTree size={18} />,
  storyboard: <MonitorPlay size={18} />,
  'final-cut': <Video size={18} />,
};

const actionDispatchers = {
  generate_script: 'generateScriptFromSource',
  extract_assets: 'extractAssetsFromScript',
  generate_asset_images: 'generateAssetImages',
  generate_shots: 'generateShotsFromChapters',
  generate_shot_images: 'generateShotImages',
} as const;

function isDispatchableAction(kind: string): kind is keyof typeof actionDispatchers {
  return kind in actionDispatchers;
}

function actionTargetTab(kind: string): EpisodeStationId {
  switch (kind) {
    case 'generate_script':
      return 'script';
    case 'extract_assets':
    case 'generate_asset_images':
      return 'subjects';
    case 'generate_shots':
      return 'shots';
    case 'generate_shot_images':
    case 'open_storyboard':
      return 'storyboard';
    case 'open_final_cut':
    case 'export_episode':
      return 'final-cut';
    default:
      return 'overview';
  }
}

type RecommendedAction = NonNullable<EpisodeWorkspaceView['workflow']>['recommendedAction'];

function getActionLabel(action: RecommendedAction | null) {
  if (!action) {
    return '查看工位';
  }

  return action.label;
}

function getActionHelpText(action: RecommendedAction | null) {
  if (!action) {
    return '当前没有可执行建议动作。';
  }

  if (action.reason) {
    return action.reason;
  }

  return action.enabled ? '满足条件后可立即执行。' : '当前条件未满足。';
}

const assetFilters = [
  { id: 'all', label: 'All Assets' },
  { id: 'character', label: 'Characters' },
  { id: 'scene', label: 'Scenes' },
  { id: 'prop', label: 'Props' },
] as const;

const ASYNC_DISPATCH_TYPES = new Set([
  'generateScriptFromSource',
  'extractAssetsFromScript',
  'generateShotsFromChapters',
  'generateShotImages',
  'generateAssetImages',
]);

const COMMAND_LABELS: Record<string, string> = {
  generateScriptFromSource: '生成剧本',
  extractAssetsFromScript: '提取主体',
  generateShotsFromChapters: '生成分镜表',
  generateShotImages: '生成分镜图片',
  generateAssetImages: '批量生成资产图片',
};

export function EpisodeWorkspace({ initialView }: { initialView: EpisodeWorkspaceView }) {
  const [view, setView] = useState(initialView);
  const [activeTab, setActiveTab] = useState<EpisodeStationId>(initialView.workflow?.currentStation ?? 'overview');
  const [selectedChapterId, setSelectedChapterId] = useState(initialView.chapters[0]?.id ?? '');
  const [selectedAssetId, setSelectedAssetId] = useState(initialView.assets[0]?.id ?? '');
  const [assetFilter, setAssetFilter] = useState<(typeof assetFilters)[number]['id']>('all');
  const [selectedShotId, setSelectedShotId] = useState(initialView.shots[0]?.id ?? '');
  const [storyboardMediaType, setStoryboardMediaType] = useState<'image' | 'video'>('image');
  const [pending, setPending] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [asyncJob, setAsyncJob] = useState<{ jobId: string; commandType: string; label: string; episodeId: string; targetTab?: EpisodeStationId } | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!asyncJob) {
      if (pollingRef.current) clearInterval(pollingRef.current);
      return;
    }
    const poll = async () => {
      try {
        const [jobRes, viewRes] = await Promise.all([
          fetch(`/api/studio?job=${asyncJob.jobId}`),
          fetch(`/api/studio?episodeId=${asyncJob.episodeId}`),
        ]);
        const [jobData, viewData] = await Promise.all([jobRes.json(), viewRes.json()]);
        if (viewData.episodeView) setView(viewData.episodeView);
        if (jobData.job?.status === 'done') {
          if (pollingRef.current) clearInterval(pollingRef.current);
          const targetTab = asyncJob.targetTab;
          setAsyncJob(null);
          if (targetTab) setActiveTab(targetTab);
          setToast({ type: 'success', message: `${asyncJob.label}已完成` });
          setTimeout(() => setToast(null), 4000);
        } else if (jobData.job?.status === 'failed') {
          if (pollingRef.current) clearInterval(pollingRef.current);
          setAsyncJob(null);
          setErrorMessage(jobData.job.error ?? `${asyncJob.label}失败`);
        }
      } catch {
      }
    };
    pollingRef.current = setInterval(poll, 3000);
    return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
  }, [asyncJob]);
  const [importSourceOpen, setImportSourceOpen] = useState(false);
  const [generateScriptOpen, setGenerateScriptOpen] = useState(false);
  const [generateShotsOpen, setGenerateShotsOpen] = useState(false);
  const [batchAssetsOpen, setBatchAssetsOpen] = useState(false);
  const [batchShotImagesOpen, setBatchShotImagesOpen] = useState(false);
  const [sourceDraft, setSourceDraft] = useState({ title: '', content: '', fileName: '' });
  const [generateScriptConfig, setGenerateScriptConfig] = useState({ style: 'commercial', chapterCount: '6', dialogueMode: 'rich' });
  const [generateShotsConfig, setGenerateShotsConfig] = useState({ mode: 'full', style: 'commercial', avgDuration: '4', directorPlan: true });
  const [batchAssetsConfig, setBatchAssetsConfig] = useState({ skipExisting: true, countPerAsset: '2' });
  const [batchShotImagesConfig, setBatchShotImagesConfig] = useState({ skipExisting: true, countPerShot: '1' });
  const [aiOverrideConfig, setAiOverrideConfig] = useState<{ mode: ProviderId | ''; model: string }>({ mode: '', model: '' });
  const [selectedImageModelId, setSelectedImageModelId] = useState<string>(DEFAULT_IMAGE_MODEL_ID);
  const [availableImageModels, setAvailableImageModels] = useState<Array<{ id: string; label: string; provider: string; supportsRefImages: boolean; noImageSize: boolean }> | null>(null);
  const [imageModelsLoading, setImageModelsLoading] = useState(false);

  const fetchImageModels = () => {
    setImageModelsLoading(true);
    fetch('/api/image-models')
      .then((r) => r.json())
      .then((data: { models: Array<{ id: string; label: string; provider: string; supportsRefImages: boolean; noImageSize: boolean }> }) => {
        const models = data.models?.length ? data.models : [...IMAGE_MODEL_CATALOG];
        setAvailableImageModels(models);
        if (!models.find((m) => m.id === selectedImageModelId)) {
          setSelectedImageModelId(models[0]!.id);
        }
      })
      .catch(() => {})
      .finally(() => setImageModelsLoading(false));
  };

  useEffect(() => { fetchImageModels(); }, []);
  const sourceFileRef = useRef<HTMLInputElement | null>(null);

  const selectedChapter = view.chapters.find((chapter) => chapter.id === selectedChapterId) ?? view.chapters[0] ?? null;
  const filteredAssets = useMemo(
    () => view.assets.filter((asset) => assetFilter === 'all' || asset.type === assetFilter),
    [assetFilter, view.assets],
  );
  const selectedAsset = filteredAssets.find((asset) => asset.id === selectedAssetId) ?? filteredAssets[0] ?? null;
  const selectedShot = view.shots.find((shot) => shot.id === selectedShotId) ?? view.shots[0] ?? null;
  const selectedStoryboard = view.storyboards.find((item) => item.shotId === selectedShot?.id) ?? null;
  const workflow = view.workflow;
  const currentStation = workflow?.stations.find((station) => station.id === activeTab) ?? null;
  const recommendedAction = workflow?.recommendedAction ?? null;
  const activeAction = currentStation?.primaryAction ?? recommendedAction;
  const actionMap = useMemo(() => new Map((view.gate?.availableActions ?? []).map((action) => [action.kind, action])), [view.gate]);

  function openStation(tab: EpisodeStationId) {
    const station = workflow?.stations.find((item) => item.id === tab);
    if (station?.canEnter === false) {
      setErrorMessage(station.blockingReasons[0] ?? `${station.label}工位当前不可进入`);
      return;
    }
    setErrorMessage(null);
    setActiveTab(tab);
  }

  async function runWorkflowAction(action: typeof recommendedAction) {
    if (!action) return;
    if (!action.enabled) {
      setErrorMessage(action.reason ?? '当前动作不可执行');
      return;
    }
    if (asyncJob) {
      setErrorMessage(`${asyncJob.label}正在后台运行，请等待完成后再操作`);
      return;
    }
    if (isDispatchableAction(action.kind)) {
      const commandType = actionDispatchers[action.kind];
      const targetTab = actionTargetTab(action.kind);
      await dispatch({ type: commandType, episodeId: view.episode.id }, targetTab);
      if (!ASYNC_DISPATCH_TYPES.has(commandType)) {
        openStation(targetTab);
      }
      return;
    }
    openStation(actionTargetTab(action.kind));
  }

  async function dispatch(command: Record<string, unknown>, targetTab?: EpisodeStationId) {
    const commandType = String(command.type);
    const isAsync = ASYNC_DISPATCH_TYPES.has(commandType);
    try {
      setPending(commandType);
      const response = await fetch('/api/studio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          command,
          async: isAsync,
          context: {
            episodeId: view.episode.id,
            seriesId: view.episode.seriesId,
          },
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? '操作失败');
      }
      if (payload.jobId) {
        setErrorMessage(null);
        setAsyncJob({
          jobId: payload.jobId,
          commandType,
          label: COMMAND_LABELS[commandType] ?? commandType,
          episodeId: view.episode.id,
          targetTab,
        });
        return;
      }
      if (!payload.episodeView) {
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

  function openImportSourceDialog() {
    setSourceDraft({
      title: view.sourceDocument?.title ?? '',
      content: view.sourceDocument?.content ?? '',
      fileName: '',
    });
    setImportSourceOpen(true);
  }

  async function handleSourceFileSelected(file: File | null) {
    if (!file) return;
    try {
      const parsed = await readSourceFile(file);
      setSourceDraft((d) => ({
        title: d.title || parsed.title,
        content: parsed.content,
        fileName: parsed.fileName,
      }));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '读取原文文件失败');
    }
  }

  async function handleImportSource() {
    await dispatch({
      type: 'importSourceDocument',
      episodeId: view.episode.id,
      title: sourceDraft.title || view.sourceDocument?.title || '未命名原文',
      content: sourceDraft.content,
      autoAnalyze: true,
    });
    setImportSourceOpen(false);
  }

  async function handleGenerateScriptWithConfig() {
    await dispatch({
      type: 'generateScriptFromSource',
      episodeId: view.episode.id,
      style: generateScriptConfig.style,
      chapterCount: Number(generateScriptConfig.chapterCount),
      dialogueMode: generateScriptConfig.dialogueMode,
      ...(aiOverrideConfig.mode ? { aiMode: aiOverrideConfig.mode, aiModel: aiOverrideConfig.model || undefined } : {}),
    });
    setGenerateScriptOpen(false);
  }

  async function handleGenerateShotsWithConfig() {
    await dispatch({
      type: 'generateShotsFromChapters',
      episodeId: view.episode.id,
      mode: generateShotsConfig.mode,
      style: generateShotsConfig.style,
      avgDurationSeconds: Number(generateShotsConfig.avgDuration),
      includeDirectorPlan: generateShotsConfig.directorPlan,
      ...(aiOverrideConfig.mode ? { aiMode: aiOverrideConfig.mode, aiModel: aiOverrideConfig.model || undefined } : {}),
    });
    setGenerateShotsOpen(false);
  }

  async function handleBatchGenerateAssets() {
    await dispatch({
      type: 'generateAssetImages',
      episodeId: view.episode.id,
      skipExisting: batchAssetsConfig.skipExisting,
      countPerAsset: Number(batchAssetsConfig.countPerAsset),
    });
    setBatchAssetsOpen(false);
  }

  async function handleBatchGenerateShotImages() {
    await dispatch({
      type: 'generateShotImages',
      episodeId: view.episode.id,
      skipExisting: batchShotImagesConfig.skipExisting,
      countPerShot: Number(batchShotImagesConfig.countPerShot),
    });
    setBatchShotImagesOpen(false);
  }

  const blockedSummary = workflow?.blockedReasons[0] ?? view.gate?.blockedReasons[0] ?? '当前阶段无硬门禁阻塞。';
  const workflowHelpText = getActionHelpText(activeAction);
  const workflowActionLabel = getActionLabel(activeAction);
  const currentStationDescription = currentStation?.description ?? '按工位推进当前集的生产流程。';
  const currentStationWarnings = currentStation?.blockingReasons ?? [];
  const activeInputs = workflow?.requiredInputs ?? [];
  const workflowWarnings = workflow?.stations.filter((station) => station.isDirty || station.blockingReasons.length > 0) ?? [];
  const overviewCards = workflow?.stations ?? [];
  const handlePrimaryAction = () => {
    runWorkflowAction(activeAction);
  };

  const nextStepCta = {
    label: workflowActionLabel,
    run: async () => {
      handlePrimaryAction();
    },
  };

  return (
    <div className="flex h-full flex-col">
      {/* Fixed toast notification */}
      {toast ? (
        <div
          className={cn(
            'fixed right-5 top-5 z-50 flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-medium shadow-2xl transition-all',
            toast.type === 'success'
              ? 'border border-green-400/20 bg-green-500/90 text-white'
              : 'border border-rose-400/20 bg-rose-500/90 text-white',
          )}
        >
          {toast.type === 'success' ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
          {toast.message}
        </div>
      ) : null}

      {/* Async job running banner */}
      {asyncJob ? (
        <div className="mb-4 flex items-center gap-2 rounded-2xl border border-brand-400/20 bg-brand-500/10 px-4 py-3 text-sm text-brand-200">
          <Sparkles size={14} className="animate-pulse shrink-0" />
          <span><span className="font-semibold">{asyncJob.label}</span> 正在后台运行，完成后自动提示…</span>
        </div>
      ) : null}

      {errorMessage ? (
        <div className="mb-4 rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{errorMessage}</div>
      ) : null}

      {/* ── Unified station nav + action bar ── */}
      <div
        className="mb-5 overflow-hidden rounded-2xl"
        style={{ background: 'rgba(16,16,20,0.95)', border: '1px solid rgba(63,63,70,0.45)' }}
      >
        {/* Row 1: tabs + divider + action CTA */}
        <div className="flex items-stretch">
          {/* Station tabs */}
          <div className="flex flex-1 items-stretch overflow-hidden">
            {overviewCards.map((station) => {
              const isActive = activeTab === station.id;
              return (
                <button
                  key={station.id}
                  type="button"
                  onClick={() => openStation(station.id)}
                  disabled={!station.canEnter}
                  className={cn(
                    'group relative flex flex-1 cursor-pointer flex-col items-center gap-0.5 px-3 py-3 text-center transition-all duration-150',
                    isActive ? 'text-brand-300' : 'text-zinc-500 hover:text-zinc-300',
                    !station.canEnter && 'cursor-not-allowed opacity-30',
                  )}
                  style={isActive ? { background: 'rgba(14,145,233,0.08)' } : {}}
                >
                  {/* Active indicator bar */}
                  {isActive ? (
                    <div
                      className="absolute bottom-0 left-0 right-0 h-[2px]"
                      style={{ background: 'linear-gradient(90deg, #0273c7, #38abf7)' }}
                    />
                  ) : null}
                  {/* Dirty badge */}
                  {station.isDirty ? (
                    <span
                      className="absolute right-1.5 top-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full text-[8px] font-bold"
                      style={{ background: 'rgba(245,158,11,0.25)', color: '#fbbf24' }}
                    >
                      !
                    </span>
                  ) : null}
                  <div className={cn(
                    'flex h-6 w-6 items-center justify-center rounded-lg transition-all duration-150',
                    isActive ? 'bg-brand-500/15 text-brand-400' : 'text-zinc-500 group-hover:text-zinc-300',
                  )}>
                    {tabIconMap[station.id]}
                  </div>
                  <span className="text-[11px] font-semibold leading-none">{station.label}</span>
                  {/* Progress/done indicator */}
                  {station.progress === 100 ? (
                    <CheckCircle2 size={9} className="text-green-400" />
                  ) : station.progress > 0 ? (
                    <div className="h-[2px] w-6 overflow-hidden rounded-full bg-zinc-800">
                      <div style={{ width: `${station.progress}%`, height: '100%', background: '#0e91e9', opacity: 0.7 }} />
                    </div>
                  ) : (
                    <div className="h-[2px] w-6 rounded-full bg-zinc-800/60" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Vertical divider */}
          <div className="my-2 w-px shrink-0" style={{ background: 'rgba(63,63,70,0.5)' }} />

          {/* Action CTA */}
          <div className="flex shrink-0 items-center gap-3 px-4">
            <div className="min-w-0 hidden sm:block">
              <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-zinc-600">下一步</p>
              <p className="max-w-[160px] truncate text-xs font-bold text-zinc-300">{workflowActionLabel}</p>
            </div>
            <button
              type="button"
              onClick={handlePrimaryAction}
              disabled={!recommendedAction || !recommendedAction.enabled || pending !== null}
              className="flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-xl px-4 py-2 text-sm font-bold text-white transition-all duration-150 hover:brightness-110 disabled:cursor-not-allowed"
              style={{
                background: (!recommendedAction || !recommendedAction.enabled || pending !== null)
                  ? 'rgba(39,39,42,0.8)'
                  : 'linear-gradient(135deg, #0273c7 0%, #0e91e9 100%)',
                color: (!recommendedAction || !recommendedAction.enabled || pending !== null) ? 'rgb(113,113,122)' : 'white',
                boxShadow: (!recommendedAction || !recommendedAction.enabled || pending !== null) ? 'none' : '0 0 16px rgba(14,145,233,0.25)',
              }}
            >
              {pending ? '处理中…' : workflowActionLabel}
              <ChevronRight size={13} />
            </button>
          </div>
        </div>

        {/* Row 2: current station description + status badge */}
        <div
          className="flex items-center justify-between gap-4 px-4 py-2"
          style={{ borderTop: '1px solid rgba(63,63,70,0.3)' }}
        >
          <p className="min-w-0 truncate text-[11px] text-zinc-500">{currentStationDescription}</p>
          <div className="flex shrink-0 items-center gap-2">
            {currentStationWarnings[0] ? (
              <span className="max-w-[200px] truncate text-[11px] text-amber-400/80">{currentStationWarnings[0]}</span>
            ) : null}
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-semibold text-zinc-600"
              style={{ background: 'rgba(39,39,42,0.5)', border: '1px solid rgba(63,63,70,0.35)' }}
            >
              {currentStation?.status ?? 'idle'}
            </span>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden">
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
            <div className="space-y-5 lg:col-span-2">
              <div
                className="rounded-2xl p-5"
                style={{ background: 'rgba(18,18,22,0.8)', border: '1px solid rgba(63,63,70,0.4)' }}
              >
                <p className="mb-4 text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">Production Status</p>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {overviewCards
                    .filter((station) => station.id !== 'overview')
                    .slice(0, 4)
                    .map((station) => (
                      <ProductionStep key={station.id} label={station.label} status={station.status} progress={station.progress} dirty={station.isDirty} />
                    ))}
                </div>
              </div>

              <div
                className="rounded-2xl p-5"
                style={{ background: 'rgba(18,18,22,0.8)', border: '1px solid rgba(63,63,70,0.4)' }}
              >
                <div className="mb-4 flex items-center justify-between">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">Recent Activity</p>
                  <span className="text-[10px] text-zinc-600">最近 {view.workflowRuns.length} 条运行记录</span>
                </div>
                <div className="space-y-2">
                  {view.workflowRuns.length ? (
                    view.workflowRuns.map((run) => (
                      <ActivityItem
                        key={run.id}
                        icon={<Sparkles className="text-brand-400" size={14} />}
                        title={`${run.agent} · ${run.stage}`}
                        time={run.updatedAt}
                        description={run.summary}
                      />
                    ))
                  ) : (
                    <ActivityItem
                      icon={<History className="text-zinc-500" size={14} />}
                      title="暂无工作流记录"
                      time="now"
                      description="从剧本生成开始，建立生产流水线。"
                    />
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div
                className="rounded-2xl p-5"
                style={{
                  background: 'linear-gradient(160deg, rgba(2,115,199,0.1) 0%, rgba(14,145,233,0.05) 100%)',
                  border: '1px solid rgba(14,145,233,0.2)',
                }}
              >
                <div className="mb-4 flex items-center gap-3">
                  <div
                    className="flex h-9 w-9 items-center justify-center rounded-xl"
                    style={{ background: 'linear-gradient(135deg, #0273c7, #0e91e9)', boxShadow: '0 0 16px rgba(14,145,233,0.3)' }}
                  >
                    <Sparkles className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-brand-300">Agent Copilot</h4>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-brand-400/50">Next Step</p>
                  </div>
                </div>
                <p className="mb-4 text-sm leading-relaxed text-zinc-400">{blockedSummary}</p>
                <button
                  type="button"
                  onClick={() => void nextStepCta.run()}
                  className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold text-white transition-all duration-150 hover:brightness-110"
                  style={{
                    background: 'linear-gradient(135deg, #0273c7 0%, #0e91e9 100%)',
                    boxShadow: '0 0 20px rgba(14,145,233,0.25)',
                  }}
                >
                  {nextStepCta.label}
                  <ChevronRight size={15} />
                </button>
              </div>

              <div
                className="rounded-2xl p-5"
                style={{ background: 'rgba(18,18,22,0.8)', border: '1px solid rgba(63,63,70,0.4)' }}
              >
                <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">Governance</p>
                <div className="grid grid-cols-2 gap-2">
                  <InfoPill label="Global Assets" value={String(view.globalAssets.length)} />
                  <InfoPill label="Presets" value={String(view.generationPresets.length)} />
                  <InfoPill label="Usage" value={`${view.usageSummary.currency} ${view.usageSummary.totalCost.toFixed(2)}`} />
                  <InfoPill label="Warnings" value={String(view.cascadeWarnings.length)} />
                </div>
              </div>

              {view.cascadeWarnings.length ? (
                <div className="rounded-3xl border border-amber-500/20 bg-amber-500/10 p-6">
                  <h4 className="text-sm font-bold text-amber-200">Cascade Warnings</h4>
                  <div className="mt-4 space-y-3">
                    {view.cascadeWarnings.slice(0, 3).map((warning) => (
                      <div key={warning.shotId} className="rounded-2xl border border-amber-400/10 bg-black/20 px-4 py-3 text-xs text-amber-100/90">
                        <div className="font-semibold">{warning.shotTitle}</div>
                        <div className="mt-1 leading-6">{warning.message}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        )}

        {activeTab === 'script' && (view.chapters.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-950/40 px-8 py-10 text-center">
              <p className="text-sm text-zinc-500">暂无剧本章节。请先导入原文并生成剧本。</p>
              <button type="button" onClick={openImportSourceDialog} className="mt-4 rounded-xl bg-brand-600 px-5 py-2 text-sm font-bold text-white hover:bg-brand-500">导入原文</button>
            </div>
          </div>
        ) : selectedChapter && (
          <div className="flex h-full gap-4">
            {/* Chapter sidebar */}
            <div className="flex w-56 shrink-0 flex-col gap-1.5">
              <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">章节列表</p>
              {view.chapters.map((chapter) => (
                <button
                  key={chapter.id}
                  onClick={() => setSelectedChapterId(chapter.id)}
                  className={cn(
                    'cursor-pointer flex flex-col items-start rounded-xl px-3 py-2.5 text-left transition-all duration-150',
                    chapter.id === selectedChapter.id
                      ? 'text-brand-300'
                      : 'text-zinc-400 hover:text-zinc-200',
                  )}
                  style={chapter.id === selectedChapter.id ? {
                    background: 'rgba(14,145,233,0.08)',
                    border: '1px solid rgba(14,145,233,0.2)',
                  } : {
                    background: 'rgba(20,20,24,0.6)',
                    border: '1px solid rgba(63,63,70,0.35)',
                  }}
                >
                  <span className="mb-0.5 font-mono text-[9px] font-bold uppercase tracking-widest opacity-60">CH {chapter.index}</span>
                  <span className="text-[13px] font-semibold leading-snug">{chapter.title}</span>
                </button>
              ))}
              <div
                className="rounded-xl p-3 text-[11px] text-zinc-600"
                style={{ border: '1px dashed rgba(63,63,70,0.4)' }}
              >
                暂不支持手动新增章节
              </div>
            </div>

            {/* Main editor */}
            <div
              className="flex flex-1 flex-col rounded-2xl"
              style={{ background: 'rgba(16,16,20,0.9)', border: '1px solid rgba(63,63,70,0.4)' }}
            >
              <div
                className="flex items-center justify-between px-6 py-4"
                style={{ borderBottom: '1px solid rgba(63,63,70,0.35)' }}
              >
                <h3 className="text-base font-bold text-zinc-100">{selectedChapter.title}</h3>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={openImportSourceDialog}
                    className="flex cursor-pointer items-center gap-1.5 rounded-xl border border-zinc-700/80 bg-zinc-900/80 px-3 py-1.5 text-xs font-medium text-zinc-300 transition-all duration-150 hover:border-zinc-600 hover:bg-zinc-800"
                  >
                    <FileText size={12} />
                    {view.sourceDocument ? '更新原文' : '导入原文'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setGenerateScriptOpen(true)}
                    disabled={!view.sourceDocument}
                    className="flex cursor-pointer items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold text-white transition-all duration-150 hover:brightness-110 disabled:cursor-not-allowed"
                    style={{
                      background: !view.sourceDocument ? 'rgba(39,39,42,0.8)' : 'linear-gradient(135deg, #0273c7, #0e91e9)',
                      color: !view.sourceDocument ? 'rgb(113,113,122)' : 'white',
                    }}
                  >
                    <Wand2 size={12} />
                    生成剧本
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
                    className="flex cursor-pointer items-center gap-1.5 rounded-xl border border-zinc-700/80 bg-zinc-900/80 px-3 py-1.5 text-xs font-medium text-zinc-300 transition-all duration-150 hover:border-zinc-600 hover:bg-zinc-800"
                  >
                    <Save size={12} />
                    保存
                  </button>
                </div>
              </div>
              <textarea
                key={selectedChapter.id}
                id={`chapter-${selectedChapter.id}`}
                className="custom-scrollbar flex-1 resize-none border-none bg-transparent p-6 text-base leading-8 text-zinc-300 focus:outline-none"
                defaultValue={selectedChapter.content}
              />
              <div
                className="flex items-center justify-between px-6 py-3 text-[11px] text-zinc-600"
                style={{ borderTop: '1px solid rgba(63,63,70,0.3)' }}
              >
                <div className="flex gap-4">
                  <span>Scene: {selectedChapter.scene}</span>
                  <span>Duration: ~{selectedChapter.estimatedDurationSeconds}s</span>
                </div>
                <span>{selectedChapter.dialogues.length} dialogues</span>
              </div>
            </div>

            {/* Source sidebar */}
            <div
              className="custom-scrollbar flex w-64 shrink-0 flex-col gap-5 overflow-y-auto rounded-2xl p-4"
              style={{ background: 'rgba(16,16,20,0.85)', border: '1px solid rgba(63,63,70,0.4)' }}
            >
              <SectionCard title="原文状态">
                {view.sourceDocument ? (
                  <div className="space-y-2">
                    <div
                      className="rounded-xl px-3 py-3"
                      style={{ background: 'rgba(22,22,26,0.8)', border: '1px solid rgba(63,63,70,0.35)' }}
                    >
                      <p className="text-xs font-bold text-zinc-200">{view.sourceDocument.title}</p>
                      <p className="mt-1 text-[10px] text-zinc-500">{view.sourceDocument.content.length.toLocaleString()} 字</p>
                    </div>
                    <button
                      type="button"
                      onClick={openImportSourceDialog}
                      className="w-full cursor-pointer rounded-lg border border-zinc-700/80 bg-zinc-900/80 py-2 text-xs font-medium text-zinc-300 transition-all duration-150 hover:border-zinc-600 hover:bg-zinc-800"
                    >
                      更新原文
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={openImportSourceDialog}
                    className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl py-4 text-xs font-medium text-zinc-500 transition-all duration-150 hover:text-zinc-300"
                    style={{ border: '1px dashed rgba(63,63,70,0.5)' }}
                  >
                    <Upload size={13} />
                    导入原文
                  </button>
                )}
              </SectionCard>
            </div>
          </div>
        ))}

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
                  onClick={() => setBatchAssetsOpen(true)}
                  className="flex items-center gap-2 rounded-xl bg-zinc-800 px-4 py-2 text-sm font-bold text-white transition-all hover:bg-zinc-700"
                >
                  <Layers size={16} />
                  批量生成
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedAssetId('');
                  }}
                  className="flex items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-100 transition-all hover:bg-zinc-800"
                >
                  <PlusCircle size={16} />
                  手动添加
                </button>
              </div>
              <div className="custom-scrollbar min-h-0 flex-1 grid grid-cols-1 gap-4 overflow-y-auto pb-4 sm:grid-cols-2 lg:grid-cols-3">
                {filteredAssets.map((asset) => (
                  <button
                    key={asset.id}
                    type="button"
                    onClick={() => setSelectedAssetId(asset.id)}
                    className={cn(
                      'group flex flex-col overflow-hidden rounded-2xl border text-left transition-all hover:border-brand-500/50',
                      asset.id === selectedAsset?.id ? 'border-brand-500/50' : 'border-zinc-800/80',
                    )}
                    style={{ background: 'rgba(18,18,22,0.8)' }}
                  >
                    <div className="flex items-center justify-between border-b border-zinc-800/50 p-3">
                      <h4 className="text-sm font-bold">{asset.name}</h4>
                      {asset.isFaceLocked ? <Camera size={14} className="text-brand-400" /> : null}
                    </div>
                    <div className="relative flex aspect-video items-center justify-center overflow-hidden bg-zinc-900">
                      {((asset.images.length ? asset.images : asset.versions).find((image) => image.isSelected)
                        ?? (asset.images.length ? asset.images : asset.versions)[0])?.imageUrl ? (
                        <img
                          src={((asset.images.length ? asset.images : asset.versions).find((image) => image.isSelected)
                            ?? (asset.images.length ? asset.images : asset.versions)[0]).imageUrl}
                          alt={asset.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-zinc-800 via-zinc-900 to-zinc-950 text-[11px] text-zinc-500">
                          暂无主体图
                        </div>
                      )}
                    </div>
                    <div className="flex items-center justify-between bg-zinc-900/50 p-3">
                      <span className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">{asset.type}</span>
                      <span className="text-xs font-bold text-zinc-300">{asset.voice || 'No voice'}</span>
                    </div>
                    <div className="flex items-center justify-between px-3 py-2 text-[10px] text-zinc-500">
                      <span>{asset.syncSource}</span>
                      <span>{asset.globalAssetId ? 'Global linked' : 'Episode local'}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div
              className="custom-scrollbar flex h-full w-80 shrink-0 flex-col overflow-y-auto rounded-2xl p-4"
              style={{ background: 'rgba(16,16,20,0.85)', border: '1px solid rgba(63,63,70,0.4)' }}
            >
              <div
                className="mb-4 flex items-center justify-between pb-3"
                style={{ borderBottom: '1px solid rgba(63,63,70,0.35)' }}
              >
                <h3 className="text-sm font-bold text-zinc-200">{selectedAsset ? selectedAsset.name : 'Asset Workspace'}</h3>
                {selectedAsset?.isShared ? <span className="rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest" style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)', color: '#6ee7b7' }}>Shared</span> : null}
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

                  <SectionCard title="Governance">
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <InfoPill label="Revision" value={String(selectedAsset.revision)} />
                      <InfoPill label="Preset" value={selectedAsset.appliedPresetId ?? 'None'} />
                      <InfoPill label="Sync" value={selectedAsset.syncSource} />
                      <InfoPill label="Global" value={selectedAsset.globalAssetId ?? 'None'} />
                    </div>
                  </SectionCard>

                  <div className="flex flex-col gap-2">
                    <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2">
                      <div className="mb-1.5 flex items-center justify-between">
                        <span className="text-[10px] font-bold text-zinc-500">IMAGE MODEL{imageModelsLoading ? ' …' : ''}</span>
                        <div className="flex items-center gap-1.5">
                          {availableImageModels?.find((m) => m.id === selectedImageModelId)?.supportsRefImages && (
                            <span className="rounded bg-brand-600/20 px-1.5 py-0.5 text-[9px] font-bold text-brand-400">REF IMAGE ✓</span>
                          )}
                          <button type="button" onClick={fetchImageModels} title="Refresh model list" className="text-zinc-600 hover:text-zinc-400">↻</button>
                        </div>
                      </div>
                      <select
                        value={selectedImageModelId}
                        onChange={(e) => setSelectedImageModelId(e.target.value)}
                        className="w-full bg-transparent font-mono text-xs text-brand-400 focus:outline-none"
                        disabled={!availableImageModels}
                      >
                        {availableImageModels ? availableImageModels.map((m) => (
                          <option key={m.id} value={m.id} className="bg-zinc-900 text-zinc-100">
                            {m.label}
                          </option>
                        )) : <option value="">Loading…</option>}
                      </select>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        void dispatch({
                          type: 'generateAssetImages',
                          episodeId: view.episode.id,
                          assetIds: [selectedAsset.id],
                          imageModel: selectedImageModelId,
                        })
                      }
                      className="flex w-full items-center justify-center gap-1 rounded-lg bg-brand-600 py-2 text-sm font-bold text-white shadow-lg shadow-brand-600/20 hover:bg-brand-500"
                    >
                      Generate <Zap size={14} />
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
                    {(selectedAsset.images.length || selectedAsset.versions.length) ? (
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
                            {image.imageUrl ? (
                              <img src={image.imageUrl} alt="" className="h-full w-full object-cover" />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-zinc-800 via-zinc-900 to-zinc-950 text-[11px] text-zinc-500">
                                未生成
                              </div>
                            )}
                            {image.isSelected ? (
                              <div className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-brand-500">
                                <CheckCircle2 size={10} className="text-white" />
                              </div>
                            ) : null}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-zinc-500">点击 Generate 生成主体图片。</p>
                    )}
                  </SectionCard>
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-950/40 px-4 py-6 text-sm text-zinc-500">
                  {view.assets.length === 0
                    ? '暂无主体资产，请先从剧本提取主体。'
                    : '点击左侧资产卡片查看详情。'}
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
                  onClick={() => view.shots.length ? setBatchShotImagesOpen(true) : setGenerateShotsOpen(true)}
                  className="flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2 text-sm font-bold text-white shadow-lg shadow-brand-600/20 transition-colors hover:bg-brand-500"
                >
                  {view.shots.length ? '批量生成分镜图' : '生成分镜表'} <ChevronRight size={16} />
                </button>
              </div>

              <div className="custom-scrollbar flex-1 space-y-4 overflow-y-auto pr-2">
                {view.shots.map((shot) => (
                  <div
                    key={shot.id}
                    className={cn(
                      'overflow-hidden rounded-2xl border transition-colors',
                      shot.id === selectedShot?.id ? 'border-brand-500/50' : 'border-zinc-800/80',
                    )}
                    style={{ background: 'rgba(18,18,22,0.8)' }}
                  >
                  <div className="flex items-start gap-4 border-b border-zinc-800 bg-zinc-900/80 px-4 py-3">
                    <span className="mt-0.5 whitespace-nowrap text-sm font-bold text-brand-400">Shot {shot.index}</span>
                    <p className="flex-1 text-sm leading-relaxed text-zinc-300">{shot.description}</p>
                    <div className="flex gap-2">
                      <div className={cn(
                        'rounded-lg px-2 py-1 text-[10px] font-bold uppercase tracking-[0.18em]',
                        shot.assetRefStatus === 'broken'
                          ? 'bg-rose-500/15 text-rose-200'
                          : shot.assetRefStatus === 'stale'
                            ? 'bg-amber-500/15 text-amber-200'
                            : 'bg-emerald-500/15 text-emerald-200',
                      )}>
                        {shot.assetRefStatus}
                      </div>
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

            <div
              className="custom-scrollbar flex h-full w-80 shrink-0 flex-col overflow-y-auto rounded-2xl p-4"
              style={{ background: 'rgba(16,16,20,0.85)', border: '1px solid rgba(63,63,70,0.4)' }}
            >
              <div
                className="mb-4 flex items-center justify-between pb-3"
                style={{ borderBottom: '1px solid rgba(63,63,70,0.35)' }}
              >
                <h3 className="text-sm font-bold text-zinc-200">{selectedShot ? selectedShot.title : 'Shot Workspace'}</h3>
                {selectedShot ? (
                  <span className="rounded-full px-2 py-0.5 font-mono text-[9px] font-bold" style={{ background: 'rgba(39,39,42,0.7)', border: '1px solid rgba(63,63,70,0.4)', color: '#71717a' }}>Shot {selectedShot.index}</span>
                ) : null}
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

                  <SectionCard title="Reference Health">
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <InfoPill label="Revision" value={String(selectedShot.revision)} />
                      <InfoPill label="Preset" value={selectedShot.appliedPresetId ?? 'None'} />
                      <InfoPill label="Asset refs" value={selectedShot.assetRefStatus} />
                      <InfoPill label="Multimodal" value={String(selectedShot.multimodalInputs.length)} />
                    </div>
                    {selectedShot.brokenAssetRefs.length ? (
                      <div className="mt-3 rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-3 text-xs text-rose-100">
                        {selectedShot.brokenAssetRefs.map((item) => `${item.assetId}:${item.reason}`).join(' / ')}
                      </div>
                    ) : null}
                    {selectedShot.dialogueTrack ? (
                      <div className="mt-3 rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-3 text-xs text-zinc-300">
                        Audio-first · {Math.round(selectedShot.dialogueTrack.duration / 1000)}s · lip sync {selectedShot.dialogueTrack.lipSyncEnabled ? 'on' : 'off'}
                      </div>
                    ) : null}
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

        {activeTab === 'storyboard' && (view.shots.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-950/40 px-8 py-10 text-center">
              <p className="text-sm text-zinc-500">暂无分镜。请先锁定资产并生成分镜表。</p>
              <button type="button" onClick={() => setGenerateShotsOpen(true)} className="mt-4 rounded-xl bg-brand-600 px-5 py-2 text-sm font-bold text-white hover:bg-brand-500">生成分镜表</button>
            </div>
          </div>
        ) : selectedShot && (
          <div className="flex h-full gap-6">
            <div className="flex min-w-0 flex-1 flex-col gap-4">
              <div className="relative flex flex-1 items-center justify-center overflow-hidden rounded-3xl border border-zinc-800 bg-black shadow-2xl">
                {(() => {
                  const previewUrl = selectedShot.takes.find((t) => t.isSelected)?.url ?? selectedShot.images.find((i) => i.isSelected)?.imageUrl;
                  return previewUrl ? (
                    <img
                      key={previewUrl}
                      src={previewUrl}
                      alt={selectedShot.title}
                      className="h-full w-full object-cover"
                      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                    />
                  ) : (
                    <div className="h-full w-full bg-gradient-to-br from-zinc-800 via-zinc-900 to-zinc-950" />
                  );
                })()}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-6 pt-20">
                  <p className="max-w-3xl text-lg font-medium text-white">
                    <span className="mr-2 font-bold text-brand-400">Storyboard:</span>
                    {selectedStoryboard?.subtitle || selectedShot.dialogue || selectedShot.description}
                  </p>
                  <div className="mt-4 rounded-lg bg-zinc-800/60 px-3 py-2 text-xs text-zinc-300 backdrop-blur-md">
                    当前版本仅支持选择镜头主版本，字幕编辑、音频预览和故事板预览器尚未接通。
                  </div>
                </div>
              </div>

              <div
                className="flex h-40 flex-col rounded-2xl p-3"
                style={{ background: 'rgba(16,16,20,0.85)', border: '1px solid rgba(63,63,70,0.4)' }}
              >
                <div className="mb-3 flex items-center justify-between px-2">
                  <div className="flex items-center gap-3">
                    <h4 className="text-sm font-bold">All Shots <span className="font-normal text-zinc-500">({view.shots.length} total)</span></h4>
                  </div>
                  <div className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs text-zinc-500">
                    批量故事板/视频生成尚未接通，当前仅支持逐步推进已实现流程。
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
                      {(shot.images.find((i) => i.isSelected) ?? shot.images[0])?.imageUrl ? (
                        <img src={(shot.images.find((i) => i.isSelected) ?? shot.images[0])!.imageUrl} alt={`Shot ${shot.index}`} className="h-full w-full object-cover" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                      ) : (
                        <div className="h-full w-full bg-gradient-to-br from-zinc-800 via-zinc-900 to-zinc-950" />
                      )}
                      <div className="absolute left-1 top-1 rounded bg-black/60 px-1.5 py-0.5 text-[8px] font-bold text-white backdrop-blur-md">Shot {shot.index}</div>
                      <div className="absolute right-1 top-1 rounded bg-black/60 px-1.5 py-0.5 font-mono text-[8px] text-zinc-300 backdrop-blur-md">
                        {typeof shot.duration === 'string' ? shot.duration : `${shot.duration}s`}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div
              className="custom-scrollbar flex h-full w-80 shrink-0 flex-col overflow-y-auto rounded-2xl p-4"
              style={{ background: 'rgba(16,16,20,0.85)', border: '1px solid rgba(63,63,70,0.4)' }}
            >
              <div className="mb-4 flex gap-1 rounded-xl p-1" style={{ background: 'rgba(24,24,28,0.8)', border: '1px solid rgba(63,63,70,0.35)' }}>
                <button onClick={() => setStoryboardMediaType('image')} className={cn('flex-1 cursor-pointer rounded-lg py-1.5 text-xs font-bold transition-all duration-150', storyboardMediaType === 'image' ? 'bg-zinc-700 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300')}>
                  Image
                </button>
                <button onClick={() => setStoryboardMediaType('video')} className={cn('flex-1 cursor-pointer rounded-lg py-1.5 text-xs font-bold transition-all duration-150', storyboardMediaType === 'video' ? 'bg-zinc-700 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300')}>
                  Video
                </button>
              </div>

              <div key={selectedShot.id} className="space-y-6">
                <SectionCard title={`Image Prompt Shot ${selectedShot.index}`}>
                  <textarea className="custom-scrollbar h-32 w-full resize-none rounded-xl border border-zinc-800 bg-zinc-900 p-3 font-mono text-xs leading-relaxed text-zinc-300 focus:border-brand-500 focus:outline-none" defaultValue={selectedShot.prompt} />
                </SectionCard>

                <div className="flex flex-col gap-2">
                  <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2">
                    <div className="mb-1.5 flex items-center justify-between">
                      <span className="text-[10px] font-bold text-zinc-500">IMAGE MODEL{imageModelsLoading ? ' …' : ''}</span>
                      <div className="flex items-center gap-1.5">
                        {availableImageModels?.find((m) => m.id === selectedImageModelId)?.supportsRefImages && (
                          <span className="rounded bg-brand-600/20 px-1.5 py-0.5 text-[9px] font-bold text-brand-400">REF IMAGE ✓</span>
                        )}
                        <button type="button" onClick={fetchImageModels} title="Refresh model list" className="text-zinc-600 hover:text-zinc-400">↻</button>
                      </div>
                    </div>
                    <select
                      value={selectedImageModelId}
                      onChange={(e) => setSelectedImageModelId(e.target.value)}
                      className="w-full bg-transparent font-mono text-xs text-brand-400 focus:outline-none"
                      disabled={!availableImageModels}
                    >
                      {availableImageModels ? availableImageModels.map((m) => (
                        <option key={m.id} value={m.id} className="bg-zinc-900 text-zinc-100">
                          {m.label}
                        </option>
                      )) : <option value="">Loading…</option>}
                    </select>
                  </div>
                  <button
                    onClick={() =>
                      void dispatch({
                        type: 'generateShotImages',
                        episodeId: view.episode.id,
                        shotIds: [selectedShot.id],
                        imageModel: selectedImageModelId,
                      })
                    }
                    className="flex w-full items-center justify-center gap-1 rounded-lg bg-brand-600 py-2 text-sm font-bold text-white shadow-lg shadow-brand-600/20 hover:bg-brand-500"
                  >
                    Generate <Zap size={14} />
                  </button>
                </div>

                <SectionCard title="Reference Subjects">
                  <div className="custom-scrollbar flex gap-3 overflow-x-auto pb-2">
                    {view.assets.filter((a) => selectedShot.referenceAssetIds.includes(a.id)).map((asset) => {
                      const assetImgUrl = (asset.images.find((i) => i.isSelected) ?? asset.images[0])?.imageUrl;
                      return (
                        <div key={asset.id} className="w-20 shrink-0">
                          <div className="relative aspect-square overflow-hidden rounded-xl border border-zinc-700 bg-zinc-900">
                            {assetImgUrl ? (
                              <img src={assetImgUrl} alt={asset.name} className="h-full w-full object-cover" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                            ) : null}
                          </div>
                          <p className="truncate pt-1 text-center text-[10px] font-bold">{asset.name}</p>
                        </div>
                      );
                    })}
                  </div>
                </SectionCard>

                <SectionCard title={`${storyboardMediaType === 'image' ? 'Image' : 'Video'} Takes (${selectedShot.takes.length})`}>
                  <div className="grid grid-cols-2 gap-2">
                    {selectedShot.takes.map((take, index) => {
                      const isLatest = index === selectedShot.takes.length - 1 && selectedShot.takes.length > 0;
                      return (
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
                          {take.url ? (
                            <img src={take.url} alt={`Take ${index + 1}`} className="h-full w-full object-cover" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                          ) : (
                            <div className="h-full w-full bg-gradient-to-br from-zinc-800 via-zinc-900 to-zinc-950" />
                          )}
                          <div className="absolute left-1 top-1 rounded bg-black/60 px-1.5 py-0.5 font-mono text-[8px] text-white">#{index + 1}</div>
                          {isLatest && (
                            <div className="absolute left-1 bottom-1 rounded bg-emerald-500/80 px-1.5 py-0.5 font-mono text-[8px] font-bold text-white">NEW</div>
                          )}
                          {take.isSelected ? (
                            <div className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-brand-500">
                              <CheckCircle2 size={10} className="text-white" />
                            </div>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                </SectionCard>
              </div>
            </div>
          </div>
        ))}

        {activeTab === 'final-cut' && (
          <div className="flex h-full flex-col gap-6 rounded-3xl border border-zinc-800 bg-zinc-900/60 p-8">
            <div>
              <h3 className="text-2xl font-bold text-zinc-100">成片工位尚未完成</h3>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-zinc-400">
                当前版本还没有实现可用的成片装配与预览闭环。这里暂时只保留只读轨道信息，避免用伪播放器和伪时间线误导你继续操作。
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <InfoPill label="Resolution" value={view.finalCut?.resolution ?? '1080p'} />
              <InfoPill label="FPS" value={String(view.finalCut?.fps ?? 24)} />
              <InfoPill label="Tracks" value={String(view.finalCut?.tracks.length ?? 0)} />
            </div>

            <div className="space-y-3">
              {(view.finalCut?.tracks ?? []).map((track) => (
                <div key={track.id} className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm font-bold text-zinc-200">
                      {track.type === 'video' ? <Video size={16} /> : track.type === 'dialogue' ? <Mic size={16} /> : <Volume2 size={16} />}
                      <span>{track.name}</span>
                    </div>
                    <span className="text-xs text-zinc-500">{track.items.length} item(s)</span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {track.items.length ? (
                      track.items.map((item) => (
                        <div key={item.id} className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs text-zinc-300">
                          {item.label}
                        </div>
                      ))
                    ) : (
                      <div className="text-xs text-zinc-500">该轨道暂无内容。</div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
              下一阶段需要先补齐“从故事板选定结果自动装配到成片时间线”的真实能力，再开放编辑与导出。
            </div>
          </div>
        )}
      </div>

      {/* ── 导入原文 Dialog ── */}
      <Dialog
        open={importSourceOpen}
        onClose={() => setImportSourceOpen(false)}
        title={view.sourceDocument ? '更新原文' : '导入原文'}
        description="上传或粘贴原文，保存后可触发 Agent 自动分析并生成剧本章节。"
        size="lg"
      >
        <div className="space-y-4">
          <DialogField label="原文标题">
            <input
              autoFocus
              value={sourceDraft.title}
              onChange={(e) => setSourceDraft((d) => ({ ...d, title: e.target.value }))}
              placeholder="例如：长安十二时辰"
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2.5 text-sm text-zinc-100 focus:border-brand-500 focus:outline-none"
            />
          </DialogField>
          <DialogDivider />
          <DialogField label="原文内容" hint="支持粘贴文本，或点击下方按钮上传文件">
            <textarea
              value={sourceDraft.content}
              onChange={(e) => setSourceDraft((d) => ({ ...d, content: e.target.value }))}
              placeholder="在此粘贴原文内容…"
              rows={8}
              className="w-full resize-none rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-sm text-zinc-200 focus:border-brand-500 focus:outline-none"
            />
            <input
              ref={sourceFileRef}
              type="file"
              accept=".txt,.md,text/plain,text/markdown"
              className="hidden"
              onChange={(e) => {
                void handleSourceFileSelected(e.target.files?.[0] ?? null);
                e.currentTarget.value = '';
              }}
            />
            <button
              type="button"
              onClick={() => sourceFileRef.current?.click()}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-700 bg-zinc-900/50 py-3 text-sm font-medium text-zinc-400 transition-colors hover:border-brand-500/50 hover:text-zinc-200"
            >
              <Upload size={15} />
              {sourceDraft.fileName ? `已选：${sourceDraft.fileName}` : '上传 .txt / .md 原文文件'}
            </button>
            {sourceDraft.content ? (
              <p className="mt-1.5 text-xs text-zinc-500">已输入 {sourceDraft.content.length.toLocaleString()} 字</p>
            ) : null}
          </DialogField>
        </div>
        <DialogFooter>
          <DialogButton variant="ghost" onClick={() => setImportSourceOpen(false)}>取消</DialogButton>
          <DialogButton
            variant="primary"
            loading={pending === 'importSourceDocument'}
            disabled={!sourceDraft.content.trim()}
            onClick={() => void handleImportSource()}
          >
            保存并自动分析
          </DialogButton>
        </DialogFooter>
      </Dialog>

      {/* ── 生成剧本配置 Dialog ── */}
      <Dialog
        open={generateScriptOpen}
        onClose={() => setGenerateScriptOpen(false)}
        title="生成剧本"
        description="ScriptAgent 将根据原文内容按以下参数生成结构化剧本章节。"
        size="md"
      >
        <div className="space-y-4">
          <DialogSection title="生成参数">
            <DialogField label="目标章节数" hint="建议与集数时长匹配，每章约 2-5 分钟">
              <select
                value={generateScriptConfig.chapterCount}
                onChange={(e) => setGenerateScriptConfig((d) => ({ ...d, chapterCount: e.target.value }))}
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2.5 text-sm text-zinc-100 focus:border-brand-500 focus:outline-none"
              >
                {['4', '6', '8', '10', '12'].map((n) => (
                  <option key={n} value={n}>{n} 章</option>
                ))}
              </select>
            </DialogField>
            <DialogField label="叙事风格">
              <select
                value={generateScriptConfig.style}
                onChange={(e) => setGenerateScriptConfig((d) => ({ ...d, style: e.target.value }))}
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2.5 text-sm text-zinc-100 focus:border-brand-500 focus:outline-none"
              >
                <option value="commercial">商业剧情</option>
                <option value="literary">文艺叙事</option>
                <option value="fast_paced">快节奏剪辑</option>
              </select>
            </DialogField>
            <DialogField label="对白模式">
              <select
                value={generateScriptConfig.dialogueMode}
                onChange={(e) => setGenerateScriptConfig((d) => ({ ...d, dialogueMode: e.target.value }))}
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2.5 text-sm text-zinc-100 focus:border-brand-500 focus:outline-none"
              >
                <option value="rich">丰富对白</option>
                <option value="minimal">精简对白</option>
                <option value="narration">旁白为主</option>
              </select>
            </DialogField>
          </DialogSection>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 px-4 py-3 text-xs text-zinc-500">
            原文：{view.sourceDocument?.title} · {(view.sourceDocument?.content.length ?? 0).toLocaleString()} 字
          </div>
          <AiProviderSection value={aiOverrideConfig} onChange={setAiOverrideConfig} />
        </div>
        <DialogFooter>
          <DialogButton variant="ghost" onClick={() => setGenerateScriptOpen(false)}>取消</DialogButton>
          <DialogButton
            variant="primary"
            loading={pending === 'generateScriptFromSource'}
            onClick={() => void handleGenerateScriptWithConfig()}
          >
            开始生成剧本
          </DialogButton>
        </DialogFooter>
      </Dialog>

      {/* ── 生成分镜表配置 Dialog ── */}
      <Dialog
        open={generateShotsOpen}
        onClose={() => setGenerateShotsOpen(false)}
        title="生成分镜表"
        description="ProductionAgent 将依据剧本章节生成结构化分镜，包含 12 字段与导演规划。"
        size="md"
      >
        <div className="space-y-4">
          <DialogSection title="生成参数">
            <DialogField label="生成模式">
              <select
                value={generateShotsConfig.mode}
                onChange={(e) => setGenerateShotsConfig((d) => ({ ...d, mode: e.target.value }))}
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2.5 text-sm text-zinc-100 focus:border-brand-500 focus:outline-none"
              >
                <option value="full">完整生成（含 Prompt）</option>
                <option value="structure_only">仅结构（不含 Prompt）</option>
              </select>
            </DialogField>
            <DialogField label="风格倾向">
              <select
                value={generateShotsConfig.style}
                onChange={(e) => setGenerateShotsConfig((d) => ({ ...d, style: e.target.value }))}
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2.5 text-sm text-zinc-100 focus:border-brand-500 focus:outline-none"
              >
                <option value="commercial">商业剧情</option>
                <option value="literary">文艺叙事</option>
                <option value="fast_paced">快节奏剪辑</option>
              </select>
            </DialogField>
            <DialogField label="平均镜头时长">
              <select
                value={generateShotsConfig.avgDuration}
                onChange={(e) => setGenerateShotsConfig((d) => ({ ...d, avgDuration: e.target.value }))}
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2.5 text-sm text-zinc-100 focus:border-brand-500 focus:outline-none"
              >
                <option value="3">3 秒</option>
                <option value="4">4 秒（推荐）</option>
                <option value="5">5 秒</option>
              </select>
            </DialogField>
            <label className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm text-zinc-300">
              生成导演规划（推荐）
              <input
                type="checkbox"
                checked={generateShotsConfig.directorPlan}
                onChange={(e) => setGenerateShotsConfig((d) => ({ ...d, directorPlan: e.target.checked }))}
                className="h-4 w-4 accent-brand-500"
              />
            </label>
          </DialogSection>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 px-4 py-3 text-xs text-zinc-500">
            当前集剧本共 {view.chapters.length} 章 · 预计生成分镜时长 30-120 秒
          </div>
          <AiProviderSection value={aiOverrideConfig} onChange={setAiOverrideConfig} />
        </div>
        <DialogFooter>
          <DialogButton variant="ghost" onClick={() => setGenerateShotsOpen(false)}>取消</DialogButton>
          <DialogButton
            variant="primary"
            loading={pending === 'generateShotsFromChapters'}
            onClick={() => void handleGenerateShotsWithConfig()}
          >
            开始生成
          </DialogButton>
        </DialogFooter>
      </Dialog>

      {/* ── 批量生成资产图片 Dialog ── */}
      <Dialog
        open={batchAssetsOpen}
        onClose={() => setBatchAssetsOpen(false)}
        title="批量生成资产图片"
        description="对当前集所有资产批量生成图片，完成后可进入分镜工位。"
        size="sm"
      >
        <div className="space-y-4">
          <DialogField label="每个资产生成数量">
            <select
              value={batchAssetsConfig.countPerAsset}
              onChange={(e) => setBatchAssetsConfig((d) => ({ ...d, countPerAsset: e.target.value }))}
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2.5 text-sm text-zinc-100 focus:border-brand-500 focus:outline-none"
            >
              <option value="1">1 张</option>
              <option value="2">2 张（推荐）</option>
              <option value="3">3 张</option>
            </select>
          </DialogField>
          <label className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm text-zinc-300">
            跳过已有图片的资产
            <input
              type="checkbox"
              checked={batchAssetsConfig.skipExisting}
              onChange={(e) => setBatchAssetsConfig((d) => ({ ...d, skipExisting: e.target.checked }))}
              className="h-4 w-4 accent-brand-500"
            />
          </label>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 px-4 py-3 text-xs text-zinc-500">
            待生成：{view.assets.filter((a) => !batchAssetsConfig.skipExisting || a.images.length === 0).length} 个资产
          </div>
        </div>
        <DialogFooter>
          <DialogButton variant="ghost" onClick={() => setBatchAssetsOpen(false)}>取消</DialogButton>
          <DialogButton
            variant="primary"
            loading={pending === 'generateAssetImages'}
            disabled={view.assets.length === 0}
            onClick={() => void handleBatchGenerateAssets()}
          >
            开始批量生成
          </DialogButton>
        </DialogFooter>
      </Dialog>

      {/* ── 批量生成分镜图 Dialog ── */}
      <Dialog
        open={batchShotImagesOpen}
        onClose={() => setBatchShotImagesOpen(false)}
        title="批量生成分镜图"
        description="为当前集所有分镜批量生成关键帧图片。"
        size="sm"
      >
        <div className="space-y-4">
          <DialogField label="每个镜头生成数量">
            <select
              value={batchShotImagesConfig.countPerShot}
              onChange={(e) => setBatchShotImagesConfig((d) => ({ ...d, countPerShot: e.target.value }))}
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2.5 text-sm text-zinc-100 focus:border-brand-500 focus:outline-none"
            >
              <option value="1">1 张（推荐）</option>
              <option value="2">2 张</option>
              <option value="3">3 张</option>
            </select>
          </DialogField>
          <label className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm text-zinc-300">
            跳过已有图片的镜头
            <input
              type="checkbox"
              checked={batchShotImagesConfig.skipExisting}
              onChange={(e) => setBatchShotImagesConfig((d) => ({ ...d, skipExisting: e.target.checked }))}
              className="h-4 w-4 accent-brand-500"
            />
          </label>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 px-4 py-3 text-xs text-zinc-500">
            当前集共 {view.shots.length} 个镜头 · 预计耗时 {Math.ceil(view.shots.length * 0.5)} 分钟
          </div>
        </div>
        <DialogFooter>
          <DialogButton variant="ghost" onClick={() => setBatchShotImagesOpen(false)}>取消</DialogButton>
          <DialogButton
            variant="primary"
            loading={pending === 'generateShotImages'}
            disabled={view.shots.length === 0}
            onClick={() => void handleBatchGenerateShotImages()}
          >
            开始批量生成
          </DialogButton>
        </DialogFooter>
      </Dialog>
    </div>
  );
}

function AiProviderSection({
  value,
  onChange,
}: {
  value: { mode: ProviderId | ''; model: string };
  onChange: (v: { mode: ProviderId | ''; model: string }) => void;
}) {
  const selectClass = 'w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2.5 text-sm text-zinc-100 focus:border-brand-500 focus:outline-none';
  const models = value.mode ? getProviderModels(value.mode as ProviderId) : [];

  function handleProviderChange(pid: string) {
    if (!pid) {
      onChange({ mode: '', model: '' });
      return;
    }
    const defaultModel = getDefaultModelForProvider(pid as ProviderId);
    onChange({ mode: pid as ProviderId, model: defaultModel });
  }

  return (
    <div className="rounded-xl border border-zinc-700/50 bg-zinc-900/60 p-3">
      <p className="mb-3 text-[11px] uppercase tracking-widest text-zinc-500">AI 供应商覆盖（可选）</p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="mb-1.5 text-xs text-zinc-500">供应商</p>
          <select
            value={value.mode}
            onChange={(e) => handleProviderChange(e.target.value)}
            className={selectClass}
          >
            <option value="">使用全局设置</option>
            {PROVIDER_IDS.map((pid) => (
              <option key={pid} value={pid}>
                {pid === 'siliconflow' ? 'SiliconFlow' : pid === 'google' ? 'Google AI' : pid === 'gateway' ? 'Google Gateway' : 'Mock'}
              </option>
            ))}
          </select>
        </div>
        <div>
          <p className="mb-1.5 text-xs text-zinc-500">模型</p>
          <select
            value={value.model}
            onChange={(e) => onChange({ ...value, model: e.target.value })}
            disabled={!value.mode || value.mode === 'mock'}
            className={selectClass}
          >
            {!value.mode && <option value="">—</option>}
            {models.map((m) => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}

function ProductionStep({ label, status, progress, dirty }: { label: string; status: string; progress: number; dirty?: boolean }) {
  return (
    <div
      className="rounded-2xl p-4"
      style={{ background: 'rgba(20,20,24,0.8)', border: '1px solid rgba(63,63,70,0.4)' }}
    >
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <span className="text-sm font-bold text-zinc-100">{label}</span>
        <div className="flex items-center gap-1.5">
          {dirty ? (
            <span className="rounded-full bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-bold text-amber-300">刷新</span>
          ) : null}
          <span className="text-[10px] uppercase tracking-widest text-zinc-600">{status}</span>
        </div>
      </div>
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${progress}%` }} />
      </div>
      <p className="mt-1.5 text-[10px] text-zinc-600">{progress}%</p>
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
    <div
      className="flex items-start gap-3 rounded-2xl p-4"
      style={{ background: 'rgba(20,20,24,0.7)', border: '1px solid rgba(63,63,70,0.35)' }}
    >
      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-zinc-800/60">{icon}</div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-zinc-200">{title}</p>
        {description ? <p className="mt-1 text-xs leading-relaxed text-zinc-500">{description}</p> : null}
      </div>
      <span className="shrink-0 font-mono text-[10px] text-zinc-600">{time.slice(0, 10)}</span>
    </div>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">{title}</h4>
      {children}
    </div>
  );
}

function InfoPill({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="rounded-xl px-3 py-3"
      style={{ background: 'rgba(22,22,26,0.7)', border: '1px solid rgba(63,63,70,0.35)' }}
    >
      <div className="text-[10px] font-semibold uppercase tracking-[0.15em] text-zinc-600">{label}</div>
      <div className="mt-1.5 break-all text-sm font-bold text-zinc-200">{value}</div>
    </div>
  );
}

function AssetFilter({ label, active, onClick }: { label: string; active?: boolean; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'cursor-pointer rounded-full px-4 py-1.5 text-xs font-semibold transition-all duration-150',
        active
          ? 'text-brand-300'
          : 'text-zinc-500 hover:text-zinc-300',
      )}
      style={active ? {
        background: 'rgba(14,145,233,0.1)',
        border: '1px solid rgba(14,145,233,0.25)',
      } : {
        background: 'rgba(24,24,28,0.6)',
        border: '1px solid rgba(63,63,70,0.4)',
      }}
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
