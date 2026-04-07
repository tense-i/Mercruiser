'use client';

import { X, BookOpen, User, Film, Mic, Volume2, Image as ImageIcon, Tag } from 'lucide-react';

import { cn } from '@/lib/utils';
import type { EpisodeWorkspaceView } from '@/lib/view-models/studio';

type Chapter = EpisodeWorkspaceView['chapters'][number];
type Asset = EpisodeWorkspaceView['assets'][number];
type Shot = EpisodeWorkspaceView['shots'][number];

interface NodeDetailPanelProps {
  nodeId: string;
  view: EpisodeWorkspaceView;
  onClose: () => void;
}

function Field({ label, value, mono }: { label: string; value?: string | null; mono?: boolean }) {
  if (!value) return null;
  return (
    <div>
      <p className="mb-1 text-[9px] font-bold uppercase tracking-widest text-zinc-600">{label}</p>
      <p className={cn('text-[12px] leading-relaxed text-zinc-300 whitespace-pre-wrap break-words', mono && 'font-mono text-[11px] text-emerald-300/90')}>{value}</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 border-b border-zinc-800 pb-1">{title}</p>
      {children}
    </div>
  );
}

// ── Chapter detail ─────────────────────────────────────────────────────

function ChapterDetail({ chapter, onClose }: { chapter: Chapter; onClose: () => void }) {
  return (
    <>
      <div className="flex shrink-0 items-center gap-2 border-b border-zinc-800 px-4 py-3">
        <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-violet-500/20">
          <BookOpen size={11} className="text-violet-400" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-bold text-zinc-100">{chapter.title}</p>
          <p className="text-[10px] text-zinc-600">Chapter #{chapter.index}</p>
        </div>
        <button onClick={onClose} className="rounded-lg p-1 text-zinc-600 hover:text-zinc-300">
          <X size={14} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
        <Section title="基本信息">
          <Field label="标题" value={chapter.title} />
          <Field label="场景" value={chapter.scene} />
        </Section>
        {chapter.content && (
          <Section title="正文内容">
            <p className="text-[12px] leading-relaxed text-zinc-300 whitespace-pre-wrap">{chapter.content}</p>
          </Section>
        )}
        {chapter.dialogues && chapter.dialogues.length > 0 && (
          <Section title={`对白 (${chapter.dialogues.length})`}>
            <div className="space-y-2">
              {chapter.dialogues.map((d, i) => (
                <div key={i} className="rounded-xl bg-zinc-800/60 px-3 py-2">
                  {d.speaker && (
                    <p className="mb-0.5 text-[10px] font-bold text-violet-400">{d.speaker}</p>
                  )}
                  <p className="text-[11px] leading-relaxed text-zinc-300">{d.content}</p>
                </div>
              ))}
            </div>
          </Section>
        )}
      </div>
    </>
  );
}

// ── Asset detail ────────────────────────────────────────────────────────

const ASSET_TYPE_COLOR: Record<string, string> = {
  character: 'bg-sky-500/20 text-sky-400',
  scene: 'bg-emerald-500/20 text-emerald-400',
  prop: 'bg-amber-500/20 text-amber-400',
};

function AssetDetail({ asset, onClose }: { asset: Asset; onClose: () => void }) {
  const typeKey = asset.type?.toLowerCase() ?? 'prop';
  const selectedImg = asset.images.find((i) => i.isSelected) ?? asset.images[0];
  return (
    <>
      <div className="flex shrink-0 items-center gap-2 border-b border-zinc-800 px-4 py-3">
        <div className={cn('flex h-6 w-6 items-center justify-center rounded-lg', ASSET_TYPE_COLOR[typeKey] ?? 'bg-sky-500/20 text-sky-400')}>
          <User size={11} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-bold text-zinc-100">{asset.name}</p>
          <p className="text-[10px] text-zinc-600 capitalize">{asset.type ?? 'Asset'} · {asset.state}</p>
        </div>
        <button onClick={onClose} className="rounded-lg p-1 text-zinc-600 hover:text-zinc-300">
          <X size={14} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
        {selectedImg && (
          <div className="overflow-hidden rounded-2xl border border-zinc-800">
            <img src={selectedImg.imageUrl} alt={asset.name} className="w-full object-cover" />
          </div>
        )}

        {asset.images.length > 1 && (
          <Section title={`所有图片 (${asset.images.length})`}>
            <div className="grid grid-cols-3 gap-1.5">
              {asset.images.map((img) => (
                <div key={img.id} className={cn('overflow-hidden rounded-xl border', img.isSelected ? 'border-sky-500' : 'border-zinc-800')}>
                  <img src={img.imageUrl} alt="" className="aspect-square w-full object-cover" />
                </div>
              ))}
            </div>
          </Section>
        )}

        <Section title="基本信息">
          <Field label="名称" value={asset.name} />
          <Field label="类型" value={asset.type} />
          <Field label="状态" value={asset.state} />
          {asset.isShared && (
            <div className="flex items-center gap-1.5">
              <Tag size={10} className="text-zinc-500" />
              <span className="text-[11px] text-zinc-500">共享主体</span>
            </div>
          )}
        </Section>

        <Section title="描述与提示词">
          <Field label="描述" value={asset.description} />
          <Field label="图片提示词" value={asset.prompt} mono />
        </Section>

        {asset.voice && (
          <Section title="配音">
            <Field label="音色" value={asset.voice} />
          </Section>
        )}
      </div>
    </>
  );
}

// ── Shot detail ─────────────────────────────────────────────────────────

function ShotDetail({ shot, onClose }: { shot: Shot; onClose: () => void }) {
  const selectedImg = shot.images.find((i) => i.isSelected) ?? shot.images[0];
  const selectedTake = shot.takes.find((t) => t.isSelected);
  const displayImg = selectedTake?.url ?? selectedImg?.imageUrl;
  return (
    <>
      <div className="flex shrink-0 items-center gap-2 border-b border-zinc-800 px-4 py-3">
        <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-amber-500/20">
          <Film size={11} className="text-amber-400" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-bold text-zinc-100">{shot.title}</p>
          <p className="text-[10px] text-zinc-600">Shot #{shot.index} · {shot.durationSeconds ?? 4}s</p>
        </div>
        <button onClick={onClose} className="rounded-lg p-1 text-zinc-600 hover:text-zinc-300">
          <X size={14} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
        {displayImg && (
          <div className="overflow-hidden rounded-2xl border border-zinc-800">
            <img src={displayImg} alt={shot.title} className="w-full object-cover" />
          </div>
        )}

        {shot.takes.length > 1 && (
          <Section title={`所有 Take (${shot.takes.length})`}>
            <div className="grid grid-cols-3 gap-1.5">
              {shot.takes.map((take) => (
                <div key={take.id} className={cn('overflow-hidden rounded-xl border', take.isSelected ? 'border-amber-500' : 'border-zinc-800')}>
                  {take.url ? (
                    <img src={take.url} alt="" className="aspect-video w-full object-cover" />
                  ) : (
                    <div className="flex aspect-video items-center justify-center bg-zinc-800">
                      <ImageIcon size={14} className="text-zinc-600" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Section>
        )}

        <Section title="镜头信息">
          <Field label="标题" value={shot.title} />
          <Field label="景别" value={shot.shotSize} />
          <Field label="运镜" value={shot.cameraMove} />
          <Field label="时长" value={shot.durationSeconds ? `${shot.durationSeconds}s` : null} />
          <Field label="状态" value={shot.status} />
        </Section>

        <Section title="内容">
          <Field label="场景描述" value={shot.description} />
          {shot.dialogue && (
            <div>
              <p className="mb-1 flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest text-zinc-600">
                <Mic size={8} /> 对白
              </p>
              <p className="text-[12px] leading-relaxed text-blue-300/90">{shot.dialogue}</p>
            </div>
          )}
          {shot.sfx && (
            <div>
              <p className="mb-1 flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest text-zinc-600">
                <Volume2 size={8} /> 音效
              </p>
              <p className="text-[12px] leading-relaxed text-purple-300/90">{shot.sfx}</p>
            </div>
          )}
        </Section>

        <Section title="提示词">
          <Field label="图片提示词" value={shot.prompt} mono />
        </Section>

        {shot.associatedAssetNames && shot.associatedAssetNames.length > 0 && (
          <Section title={`关联主体 (${shot.associatedAssetNames.length})`}>
            <div className="flex flex-wrap gap-1.5">
              {shot.associatedAssetNames.map((name) => (
                <span key={name} className="rounded-lg bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-400">{name}</span>
              ))}
            </div>
          </Section>
        )}
      </div>
    </>
  );
}

// ── Main export ─────────────────────────────────────────────────────────

export function NodeDetailPanel({ nodeId, view, onClose }: NodeDetailPanelProps) {
  const chapter = view.chapters.find((c) => c.id === nodeId);
  const asset = view.assets.find((a) => a.id === nodeId);
  const shot = view.shots.find((s) => s.id === nodeId);

  if (!chapter && !asset && !shot) return null;

  return (
    <div
      className="flex h-full flex-col overflow-hidden"
      style={{ background: 'rgba(12,12,16,0.97)', borderRight: '1px solid rgba(63,63,70,0.45)' }}
    >
      {chapter && <ChapterDetail chapter={chapter} onClose={onClose} />}
      {asset && <AssetDetail asset={asset} onClose={onClose} />}
      {shot && <ShotDetail shot={shot} onClose={onClose} />}
    </div>
  );
}
