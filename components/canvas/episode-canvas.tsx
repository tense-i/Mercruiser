'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import { X, ZoomIn, ZoomOut, Maximize2, BookOpen, Users, Film, GripHorizontal } from 'lucide-react';

import { cn } from '@/lib/utils';
import type { EpisodeWorkspaceView } from '@/lib/view-models/studio';
import {
  ChapterNode,
  AssetNode,
  ShotNode,
  DiffNode,
  buildCanvasLayout,
  type CanvasNodeData,
  type Proposal,
} from './canvas-nodes';
import { CanvasChat } from './canvas-chat';
import { NodeDetailPanel } from './node-detail-panel';

interface EpisodeCanvasProps {
  view: EpisodeWorkspaceView;
  onClose: () => void;
}

type Filter = 'chapter' | 'asset' | 'shot';

const MIN_SCALE = 0.2;
const MAX_SCALE = 2.0;
const ZOOM_STEP = 0.15;
const DIFF_OFFSET_X = 320; // pixels to the right of anchor node

interface DraggingState {
  id: string;
  startMouseX: number;
  startMouseY: number;
  startNodeX: number;
  startNodeY: number;
}

export function EpisodeCanvas({ view, onClose }: EpisodeCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [transform, setTransform] = useState({ x: 40, y: 40, scale: 0.85 });
  const transformRef = useRef(transform);
  transformRef.current = transform;

  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0, tx: 0, ty: 0 });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filters, setFilters] = useState<Set<Filter>>(new Set(['chapter', 'asset', 'shot']));
  const [chatOpen, setChatOpen] = useState(true);

  // per-node custom positions (overrides auto-layout)
  const [nodePositions, setNodePositions] = useState<Record<string, { x: number; y: number }>>({});
  const draggingRef = useRef<DraggingState | null>(null);

  // proposals from AI chat
  const [proposals, setProposals] = useState<Proposal[]>([]);
  // proposal positions (also draggable)
  const [proposalPositions, setProposalPositions] = useState<Record<string, { x: number; y: number }>>({});

  const allNodes = buildCanvasLayout(view.chapters, view.assets, view.shots);
  const visibleNodes = allNodes.filter((n) => filters.has(n.kind));

  const getNodePos = useCallback(
    (node: CanvasNodeData) => nodePositions[node.id] ?? { x: node.x, y: node.y },
    [nodePositions],
  );

  const fitToView = useCallback(() => {
    if (!visibleNodes.length) {
      setTransform({ x: 40, y: 40, scale: 0.85 });
      return;
    }
    const container = containerRef.current;
    if (!container) return;
    const w = container.clientWidth;
    const h = container.clientHeight;
    const minX = Math.min(...visibleNodes.map((n) => getNodePos(n).x));
    const minY = Math.min(...visibleNodes.map((n) => getNodePos(n).y));
    const maxX = Math.max(...visibleNodes.map((n) => getNodePos(n).x + 220));
    const maxY = Math.max(...visibleNodes.map((n) => getNodePos(n).y + 240));
    const scaleX = (w - 80) / (maxX - minX);
    const scaleY = (h - 80) / (maxY - minY);
    const scale = Math.min(scaleX, scaleY, MAX_SCALE);
    const tx = (w - (maxX - minX) * scale) / 2 - minX * scale;
    const ty = (h - (maxY - minY) * scale) / 2 - minY * scale;
    setTransform({ x: tx, y: ty, scale: Math.max(scale, MIN_SCALE) });
  }, [visibleNodes, getNodePos]);

  useEffect(() => { fitToView(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── wheel zoom ──
  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
    setTransform((t) => ({ ...t, scale: Math.max(MIN_SCALE, Math.min(MAX_SCALE, t.scale + delta)) }));
  }, []);

  // ── canvas pan ──
  const onCanvasMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if ((e.target as HTMLElement).closest('[data-node]')) return;
      setIsPanning(true);
      setPanStart({ x: e.clientX, y: e.clientY, tx: transform.x, ty: transform.y });
    },
    [transform],
  );

  // ── node drag start ──
  const onNodeDragStart = useCallback(
    (nodeId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      const t = transformRef.current;
      const allNodesCurrent = buildCanvasLayout(view.chapters, view.assets, view.shots);
      const node = allNodesCurrent.find((n) => n.id === nodeId);
      const currentPos = nodePositions[nodeId] ?? (node ? { x: node.x, y: node.y } : { x: 0, y: 0 });
      draggingRef.current = {
        id: nodeId,
        startMouseX: e.clientX,
        startMouseY: e.clientY,
        startNodeX: currentPos.x,
        startNodeY: currentPos.y,
      };
      void t;
    },
    [nodePositions, view],
  );

  // ── proposal drag start ──
  const onProposalDragStart = useCallback(
    (proposalId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      const currentPos = proposalPositions[proposalId] ?? { x: 0, y: 0 };
      draggingRef.current = {
        id: `proposal:${proposalId}`,
        startMouseX: e.clientX,
        startMouseY: e.clientY,
        startNodeX: currentPos.x,
        startNodeY: currentPos.y,
      };
    },
    [proposalPositions],
  );

  // ── unified mouse move ──
  const onMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const d = draggingRef.current;
      if (d) {
        const t = transformRef.current;
        const dx = (e.clientX - d.startMouseX) / t.scale;
        const dy = (e.clientY - d.startMouseY) / t.scale;
        if (d.id.startsWith('proposal:')) {
          const pid = d.id.slice(9);
          setProposalPositions((prev) => ({ ...prev, [pid]: { x: d.startNodeX + dx, y: d.startNodeY + dy } }));
        } else {
          setNodePositions((prev) => ({ ...prev, [d.id]: { x: d.startNodeX + dx, y: d.startNodeY + dy } }));
        }
        return;
      }
      if (!isPanning) return;
      setTransform((t) => ({
        ...t,
        x: panStart.tx + e.clientX - panStart.x,
        y: panStart.ty + e.clientY - panStart.y,
      }));
    },
    [isPanning, panStart],
  );

  const onMouseUp = useCallback(() => {
    draggingRef.current = null;
    setIsPanning(false);
  }, []);

  const zoom = (delta: number) =>
    setTransform((t) => ({ ...t, scale: Math.max(MIN_SCALE, Math.min(MAX_SCALE, t.scale + delta)) }));

  const toggleFilter = (f: Filter) =>
    setFilters((prev) => {
      const next = new Set(prev);
      if (next.has(f)) { if (next.size > 1) next.delete(f); } else { next.add(f); }
      return next;
    });

  // ── receive proposals from chat ──
  const handleProposals = useCallback(
    (incoming: Proposal[]) => {
      const withPositions = incoming.map((p) => {
        // place diff node to the right of its anchor node
        const allNodesCurrent = buildCanvasLayout(view.chapters, view.assets, view.shots);
        const anchor = allNodesCurrent.find((n) => n.id === p.anchorNodeId);
        const anchorPos = anchor ? (nodePositions[anchor.id] ?? { x: anchor.x, y: anchor.y }) : { x: 600, y: 100 };
        return {
          ...p,
          position: { x: anchorPos.x + DIFF_OFFSET_X, y: anchorPos.y },
        };
      });
      setProposals((prev) => [
        ...prev.filter((p) => !incoming.find((i) => i.anchorNodeId === p.anchorNodeId && i.kind === p.kind)),
        ...withPositions,
      ]);
      // initialise proposal drag positions
      const posInit: Record<string, { x: number; y: number }> = {};
      withPositions.forEach((p) => { if (p.position) posInit[p.proposalId] = p.position; });
      setProposalPositions((prev) => ({ ...prev, ...posInit }));
    },
    [nodePositions, view],
  );

  // ── keep a proposal: dispatch to studio API ──
  const keepProposal = useCallback(async (proposal: Proposal) => {
    try {
      await fetch('/api/studio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(proposal.args),
      });
    } catch { /* ignore */ }
    setProposals((prev) => prev.filter((p) => p.proposalId !== proposal.proposalId));
  }, []);

  const discardProposal = useCallback((proposalId: string) => {
    setProposals((prev) => prev.filter((p) => p.proposalId !== proposalId));
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex" style={{ left: '240px' }}>
      {/* ── node detail panel (left slide-in) ── */}
      <div
        className="shrink-0 overflow-hidden transition-all duration-200"
        style={{
          width: selectedId ? '280px' : '0px',
          borderRight: selectedId ? '1px solid rgba(63,63,70,0.45)' : 'none',
        }}
      >
        {selectedId && (
          <NodeDetailPanel
            nodeId={selectedId}
            view={view}
            onClose={() => setSelectedId(null)}
          />
        )}
      </div>

      {/* ── canvas area ── */}
      <div className="relative flex flex-1 flex-col overflow-hidden bg-zinc-950">
        {/* mini header */}
        <div
          className="flex shrink-0 items-center gap-3 px-4 py-2.5"
          style={{ background: 'rgba(12,12,16,0.95)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(63,63,70,0.4)' }}
        >
          <GripHorizontal size={14} className="text-zinc-600" />
          <span className="text-[13px] font-bold text-zinc-200">{view.episode.title}</span>
          <span className="text-[11px] text-zinc-600">·</span>
          <span className="text-[11px] text-zinc-500">无限画布</span>

          {proposals.length > 0 && (
            <span className="ml-2 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
              {proposals.length} 条 AI 建议待确认
            </span>
          )}

          {/* filters */}
          <div className="ml-4 flex items-center gap-1.5">
            {([
              { kind: 'chapter' as Filter, label: '章节', icon: BookOpen, color: 'violet' },
              { kind: 'asset' as Filter, label: '主体', icon: Users, color: 'sky' },
              { kind: 'shot' as Filter, label: '分镜', icon: Film, color: 'amber' },
            ] as const).map(({ kind, label, icon: Icon, color }) => (
              <button
                key={kind}
                onClick={() => toggleFilter(kind)}
                className={cn(
                  'flex items-center gap-1 rounded-lg px-2.5 py-1 text-[10px] font-bold transition-all',
                  filters.has(kind)
                    ? color === 'violet' ? 'bg-violet-500/20 text-violet-300'
                      : color === 'sky' ? 'bg-sky-500/20 text-sky-300'
                      : 'bg-amber-500/20 text-amber-300'
                    : 'bg-zinc-800/60 text-zinc-600 hover:text-zinc-400',
                )}
              >
                <Icon size={9} />
                {label}
                <span className="font-mono">
                  {kind === 'chapter' ? view.chapters.length : kind === 'asset' ? view.assets.length : view.shots.length}
                </span>
              </button>
            ))}
          </div>

          <div className="ml-auto flex items-center gap-2">
            <div className="flex items-center gap-0.5 rounded-lg border border-zinc-800 bg-zinc-900">
              <button onClick={() => zoom(-ZOOM_STEP)} className="px-2 py-1.5 text-zinc-500 hover:text-zinc-300"><ZoomOut size={12} /></button>
              <span className="px-1 font-mono text-[10px] text-zinc-500">{Math.round(transform.scale * 100)}%</span>
              <button onClick={() => zoom(ZOOM_STEP)} className="px-2 py-1.5 text-zinc-500 hover:text-zinc-300"><ZoomIn size={12} /></button>
            </div>
            <button onClick={fitToView} className="rounded-lg border border-zinc-800 bg-zinc-900 p-1.5 text-zinc-500 hover:text-zinc-300" title="适配视图"><Maximize2 size={12} /></button>
            <button
              onClick={() => setChatOpen((v) => !v)}
              className={cn(
                'rounded-lg border px-2.5 py-1 text-[10px] font-bold transition-all',
                chatOpen ? 'border-brand-600/50 bg-brand-600/20 text-brand-300' : 'border-zinc-800 bg-zinc-900 text-zinc-500 hover:text-zinc-300',
              )}
            >
              AI 助手
            </button>
            <button onClick={onClose} className="rounded-lg border border-zinc-800 bg-zinc-900 p-1.5 text-zinc-500 hover:text-red-400" title="关闭画布"><X size={14} /></button>
          </div>
        </div>

        {/* canvas viewport */}
        <div
          ref={containerRef}
          className={cn('relative flex-1 overflow-hidden', draggingRef.current ? 'cursor-grabbing' : isPanning ? 'cursor-grabbing' : 'cursor-grab')}
          onMouseDown={onCanvasMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
          onWheel={onWheel}
          style={{
            backgroundImage: `radial-gradient(circle, rgba(63,63,70,0.35) 1px, transparent 1px)`,
            backgroundSize: `${24 * transform.scale}px ${24 * transform.scale}px`,
            backgroundPosition: `${transform.x}px ${transform.y}px`,
          }}
        >
          <div
            style={{
              position: 'absolute', top: 0, left: 0,
              transformOrigin: '0 0',
              transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
            }}
          >
            {/* regular nodes */}
            {visibleNodes.map((node) => {
              const pos = getNodePos(node);
              return (
                <div
                  key={node.id}
                  data-node="true"
                  style={{ position: 'absolute', left: pos.x, top: pos.y }}
                  onClick={() => setSelectedId((prev) => (prev === node.id ? null : node.id))}
                >
                  {node.kind === 'chapter' && (
                    <ChapterNode
                      chapter={node.data as EpisodeWorkspaceView['chapters'][number]}
                      selected={selectedId === node.id}
                      onClick={() => {}}
                      onDragStart={(e) => onNodeDragStart(node.id, e)}
                    />
                  )}
                  {node.kind === 'asset' && (
                    <AssetNode
                      asset={node.data as EpisodeWorkspaceView['assets'][number]}
                      selected={selectedId === node.id}
                      onClick={() => {}}
                      onDragStart={(e) => onNodeDragStart(node.id, e)}
                    />
                  )}
                  {node.kind === 'shot' && (
                    <ShotNode
                      shot={node.data as EpisodeWorkspaceView['shots'][number]}
                      selected={selectedId === node.id}
                      onClick={() => {}}
                      onDragStart={(e) => onNodeDragStart(node.id, e)}
                    />
                  )}
                </div>
              );
            })}

            {/* diff / proposal nodes */}
            {proposals.map((proposal) => {
              const pos = proposalPositions[proposal.proposalId] ?? proposal.position ?? { x: 800, y: 100 };
              return (
                <div
                  key={proposal.proposalId}
                  data-node="true"
                  style={{ position: 'absolute', left: pos.x, top: pos.y }}
                >
                  <DiffNode
                    proposal={proposal}
                    onKeep={() => void keepProposal(proposal)}
                    onDiscard={() => discardProposal(proposal.proposalId)}
                    onDragStart={(e) => onProposalDragStart(proposal.proposalId, e)}
                  />
                </div>
              );
            })}
          </div>

          {visibleNodes.length === 0 && (
            <div className="flex h-full items-center justify-center">
              <p className="text-sm text-zinc-600">没有可显示的节点，请调整过滤器</p>
            </div>
          )}
        </div>
      </div>

      {/* ── chat panel ── */}
      {chatOpen && (
        <div className="shrink-0" style={{ width: '340px', borderLeft: '1px solid rgba(63,63,70,0.45)' }}>
          <CanvasChat
            view={view}
            selectedNodeId={selectedId}
            onProposals={handleProposals}
          />
        </div>
      )}
    </div>
  );
}
