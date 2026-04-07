'use client';

import { BookOpen, Image, Film, Layers, Clock, User, MapPin, Volume2, Mic, Check, X, GripVertical, Minus, Plus } from 'lucide-react';

import { cn } from '@/lib/utils';
import type { EpisodeWorkspaceView } from '@/lib/view-models/studio';

type Chapter = EpisodeWorkspaceView['chapters'][number];
type Asset = EpisodeWorkspaceView['assets'][number];
type Shot = EpisodeWorkspaceView['shots'][number];

// ─────────────────────────── Proposal type ───────────────────────────

export interface Proposal {
  proposalId: string;
  kind: 'updateChapter' | 'updateAsset' | 'updateShot';
  anchorNodeId: string;
  args: Record<string, unknown>;
  diff: Array<{ field: string; from: string; to: string }>;
  summary: string;
  position?: { x: number; y: number };
}

interface NodeProps {
  selected?: boolean;
  onClick?: () => void;
  onDragStart?: (e: React.MouseEvent) => void;
}

// ─────────────────────────── Chapter Node ───────────────────────────

export function ChapterNode({
  chapter,
  selected,
  onClick,
  onDragStart,
}: NodeProps & { chapter: Chapter }) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'w-56 cursor-pointer select-none rounded-2xl border bg-zinc-900 shadow-xl transition-all',
        selected
          ? 'border-violet-500 ring-2 ring-violet-500/30'
          : 'border-zinc-800 hover:border-violet-500/50',
      )}
    >
      {/* header */}
      <div
        onMouseDown={onDragStart}
        className="flex cursor-grab items-center gap-2 rounded-t-2xl bg-violet-950/60 px-3 py-2 active:cursor-grabbing"
      >
        <BookOpen size={12} className="shrink-0 text-violet-400" />
        <span className="truncate text-[11px] font-bold uppercase tracking-widest text-violet-300">
          Chapter
        </span>
        <span className="ml-auto rounded bg-violet-900/60 px-1.5 py-0.5 font-mono text-[9px] text-violet-400">
          #{chapter.index}
        </span>
      </div>
      {/* body */}
      <div className="p-3">
        <p className="truncate text-[13px] font-semibold text-zinc-100">{chapter.title}</p>
        {chapter.scene && (
          <div className="mt-1 flex items-center gap-1">
            <MapPin size={9} className="shrink-0 text-zinc-600" />
            <span className="truncate text-[10px] text-zinc-500">{chapter.scene}</span>
          </div>
        )}
        <p className="mt-2 line-clamp-2 text-[11px] leading-relaxed text-zinc-500">
          {chapter.content}
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────── Asset Node ───────────────────────────

const ASSET_TYPE_COLORS: Record<string, string> = {
  character: 'border-sky-500 ring-sky-500/30 bg-sky-950/40',
  scene: 'border-emerald-500 ring-emerald-500/30 bg-emerald-950/40',
  prop: 'border-amber-500 ring-amber-500/30 bg-amber-950/40',
};

const ASSET_TYPE_HEADER: Record<string, string> = {
  character: 'bg-sky-950/60 text-sky-300',
  scene: 'bg-emerald-950/60 text-emerald-300',
  prop: 'bg-amber-950/60 text-amber-300',
};

export function AssetNode({
  asset,
  selected,
  onClick,
  onDragStart,
}: NodeProps & { asset: Asset }) {
  const selectedImg = asset.images.find((i) => i.isSelected);
  const typeKey = asset.type?.toLowerCase() ?? 'prop';
  const borderCls = selected
    ? (ASSET_TYPE_COLORS[typeKey] ?? 'border-sky-500 ring-sky-500/30')
    : (typeKey === 'character'
        ? 'border-zinc-800 hover:border-sky-500/50'
        : typeKey === 'scene'
          ? 'border-zinc-800 hover:border-emerald-500/50'
          : 'border-zinc-800 hover:border-amber-500/50');

  return (
    <div
      onClick={onClick}
      className={cn(
        'w-44 cursor-pointer select-none rounded-2xl border bg-zinc-900 shadow-xl transition-all',
        selected ? `${ASSET_TYPE_COLORS[typeKey] ?? ''} ring-2` : borderCls,
      )}
    >
      {/* header */}
      <div
        className={cn(
          'flex items-center gap-2 rounded-t-2xl px-3 py-2',
          ASSET_TYPE_HEADER[typeKey] ?? 'bg-sky-950/60 text-sky-300',
        )}
        onMouseDown={onDragStart}
      >
        <GripVertical size={9} className="shrink-0 opacity-40" />
        <User size={11} className="shrink-0" />
        <span className="truncate text-[11px] font-bold uppercase tracking-widest">
          {asset.type ?? 'Asset'}
        </span>
      </div>
      {/* image */}
      <div className="relative mx-2 mt-2 aspect-square overflow-hidden rounded-xl bg-zinc-800">
        {selectedImg ? (
          <img
            src={selectedImg.imageUrl}
            alt={asset.name}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <Image size={20} className="text-zinc-700" />
          </div>
        )}
      </div>
      {/* body */}
      <div className="p-3 pt-2">
        <p className="truncate text-[12px] font-semibold text-zinc-100">{asset.name}</p>
        <p className="mt-1 line-clamp-2 text-[10px] leading-relaxed text-zinc-500">
          {asset.description}
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────── Shot Node ───────────────────────────

export function ShotNode({
  shot,
  selected,
  onClick,
  onDragStart,
}: NodeProps & { shot: Shot }) {
  const selectedImg = shot.images.find((i) => i.isSelected);
  const selectedTake = shot.takes.find((t) => t.isSelected);
  const imgUrl = selectedTake?.url ?? selectedImg?.imageUrl;

  return (
    <div
      onClick={onClick}
      className={cn(
        'w-52 cursor-pointer select-none rounded-2xl border bg-zinc-900 shadow-xl transition-all',
        selected
          ? 'border-amber-500 ring-2 ring-amber-500/30'
          : 'border-zinc-800 hover:border-amber-500/50',
      )}
    >
      {/* header */}
      <div
        onMouseDown={onDragStart}
        className="flex cursor-grab items-center gap-2 rounded-t-2xl bg-amber-950/60 px-3 py-2 active:cursor-grabbing"
      >
        <GripVertical size={9} className="shrink-0 text-amber-400/40" />
        <Film size={11} className="shrink-0 text-amber-400" />
        <span className="truncate text-[11px] font-bold uppercase tracking-widest text-amber-300">
          Shot
        </span>
        <span className="ml-auto rounded bg-amber-900/60 px-1.5 py-0.5 font-mono text-[9px] text-amber-400">
          #{shot.index}
        </span>
      </div>
      {/* image */}
      <div className="relative mx-2 mt-2 aspect-video overflow-hidden rounded-xl bg-zinc-800">
        {imgUrl ? (
          <img src={imgUrl} alt={shot.title} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center">
            <Layers size={20} className="text-zinc-700" />
          </div>
        )}
        <div className="absolute bottom-1 right-1 flex items-center gap-0.5 rounded bg-black/70 px-1.5 py-0.5">
          <Clock size={8} className="text-zinc-400" />
          <span className="font-mono text-[9px] text-zinc-300">{shot.durationSeconds}s</span>
        </div>
      </div>
      {/* body */}
      <div className="p-3 pt-2">
        <p className="truncate text-[12px] font-semibold text-zinc-100">{shot.title}</p>
        {shot.dialogue && (
          <div className="mt-1.5 flex items-start gap-1">
            <Mic size={9} className="mt-0.5 shrink-0 text-blue-400" />
            <p className="line-clamp-1 text-[10px] leading-relaxed text-zinc-400">{shot.dialogue}</p>
          </div>
        )}
        {shot.sfx && (
          <div className="mt-1 flex items-start gap-1">
            <Volume2 size={9} className="mt-0.5 shrink-0 text-purple-400" />
            <p className="truncate text-[10px] text-zinc-500">{shot.sfx}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────── node layout ───────────────────────────

export interface CanvasNodeData {
  id: string;
  kind: 'chapter' | 'asset' | 'shot';
  x: number;
  y: number;
  data: Chapter | Asset | Shot;
}

const NODE_GAP = 24;
const COL_CHAPTER_X = 80;
const COL_ASSET_X = 380;
const COL_SHOT_X = 700;
const NODE_H_CHAPTER = 160;
const NODE_H_ASSET = 230;
const NODE_H_SHOT = 210;

// ─────────────────────────── DiffNode ───────────────────────────

export function DiffNode({
  proposal,
  onKeep,
  onDiscard,
  onDragStart,
}: {
  proposal: Proposal;
  onKeep: () => void;
  onDiscard: () => void;
  onDragStart?: (e: React.MouseEvent) => void;
}) {
  return (
    <div
      className="w-72 select-none overflow-hidden rounded-2xl border border-emerald-500/40 bg-zinc-950 shadow-2xl ring-1 ring-emerald-500/20"
      style={{ boxShadow: '0 0 24px rgba(34,197,94,0.12)' }}
    >
      {/* header */}
      <div
        onMouseDown={onDragStart}
        className="flex cursor-grab items-center gap-2 bg-emerald-950/70 px-3 py-2 active:cursor-grabbing"
      >
        <GripVertical size={10} className="shrink-0 text-emerald-600" />
        <span className="flex-1 truncate text-[11px] font-bold text-emerald-300">{proposal.summary}</span>
        <span className="rounded bg-emerald-900/60 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-emerald-500">
          AI 建议
        </span>
      </div>

      {/* diff rows */}
      <div className="divide-y divide-zinc-800/60">
        {proposal.diff.map((row, i) => (
          <div key={i} className="px-3 py-2">
            <p className="mb-1.5 text-[9px] font-bold uppercase tracking-widest text-zinc-600">{row.field}</p>
            <div className="space-y-1">
              <div className="flex items-start gap-1.5 rounded-md bg-red-950/30 px-2 py-1">
                <Minus size={9} className="mt-0.5 shrink-0 text-red-400" />
                <p className="break-all text-[11px] leading-relaxed text-red-300/90 line-clamp-2">{row.from || <span className="italic text-zinc-600">无</span>}</p>
              </div>
              <div className="flex items-start gap-1.5 rounded-md bg-emerald-950/30 px-2 py-1">
                <Plus size={9} className="mt-0.5 shrink-0 text-emerald-400" />
                <p className="break-all text-[11px] leading-relaxed text-emerald-300/90 line-clamp-2">{row.to}</p>
              </div>
            </div>
          </div>
        ))}
        {proposal.diff.length === 0 && (
          <div className="px-3 py-2 text-[11px] text-zinc-600">无字段变动</div>
        )}
      </div>

      {/* actions */}
      <div className="flex gap-2 border-t border-zinc-800/60 p-2.5">
        <button
          onClick={(e) => { e.stopPropagation(); onKeep(); }}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-600/20 py-1.5 text-[12px] font-bold text-emerald-300 transition-colors hover:bg-emerald-600/35"
        >
          <Check size={12} />
          保留
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDiscard(); }}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-red-600/15 py-1.5 text-[12px] font-bold text-red-400 transition-colors hover:bg-red-600/25"
        >
          <X size={12} />
          撤销
        </button>
      </div>
    </div>
  );
}

export function buildCanvasLayout(
  chapters: Chapter[],
  assets: Asset[],
  shots: Shot[],
): CanvasNodeData[] {
  const nodes: CanvasNodeData[] = [];

  // chapters: left column
  chapters.forEach((chapter, i) => {
    nodes.push({
      id: chapter.id,
      kind: 'chapter',
      x: COL_CHAPTER_X,
      y: 80 + i * (NODE_H_CHAPTER + NODE_GAP),
      data: chapter,
    });
  });

  // assets: middle column
  assets.forEach((asset, i) => {
    nodes.push({
      id: asset.id,
      kind: 'asset',
      x: COL_ASSET_X,
      y: 80 + i * (NODE_H_ASSET + NODE_GAP),
      data: asset,
    });
  });

  // shots: right column
  shots.forEach((shot, i) => {
    nodes.push({
      id: shot.id,
      kind: 'shot',
      x: COL_SHOT_X,
      y: 80 + i * (NODE_H_SHOT + NODE_GAP),
      data: shot,
    });
  });

  return nodes;
}
