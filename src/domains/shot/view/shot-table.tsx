"use client";

import { useCallback, useEffect, useState } from "react";
import { ButtonPill } from "@/components/studio/studio-shell";
import type { EpisodeShotRecord } from "@/server/mvp/types";

const emptyRows: EpisodeShotRecord[] = [];

export function ShotTable({ episodeId }: { episodeId: string }) {
  const [shots, setShots] = useState<EpisodeShotRecord[]>(emptyRows);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadShots = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/v1/episodes/${episodeId}/shots`, { cache: "no-store" });
      const json = (await response.json()) as { ok: boolean; data?: EpisodeShotRecord[]; error?: string };
      if (!response.ok || !json.ok || !json.data) {
        throw new Error(json.error ?? "加载镜头失败");
      }
      setShots(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载镜头失败");
    } finally {
      setLoading(false);
    }
  }, [episodeId]);

  useEffect(() => {
    void loadShots();
  }, [loadShots]);

  const addShot = async () => {
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(`/api/v1/episodes/${episodeId}/shots`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });
      const json = (await response.json()) as { ok: boolean; data?: { shots?: EpisodeShotRecord[] }; error?: string };
      if (!response.ok || !json.ok || !json.data?.shots) {
        throw new Error(json.error ?? "新增镜头失败");
      }
      setShots(json.data.shots);
      setNotice("已新增镜头。");
    } catch (err) {
      setError(err instanceof Error ? err.message : "新增镜头失败");
    }
  };

  const patchLocal = (shotId: string, patch: Partial<EpisodeShotRecord>) => {
    setShots((prev) => prev.map((shot) => (shot.id === shotId ? { ...shot, ...patch } : shot)));
  };

  const saveShot = async (shot: EpisodeShotRecord) => {
    setSavingId(shot.id);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(`/api/v1/episodes/${episodeId}/shots`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          shotId: shot.id,
          chapterId: shot.chapterId,
          shotCode: shot.shotCode,
          scene: shot.scene,
          shotSize: shot.shotSize,
          composition: shot.composition,
          cameraMovement: shot.cameraMovement,
          lighting: shot.lighting,
          description: shot.description,
          soundEffect: shot.soundEffect,
          dialogue: shot.dialogue,
          durationSeconds: shot.durationSeconds,
          status: shot.status,
          orderIndex: shot.orderIndex,
          locked: shot.locked,
        }),
      });
      const json = (await response.json()) as { ok: boolean; data?: { shots?: EpisodeShotRecord[] }; error?: string };
      if (!response.ok || !json.ok || !json.data?.shots) {
        throw new Error(json.error ?? "保存镜头失败");
      }
      setShots(json.data.shots);
      setNotice(`镜头 ${shot.shotCode} 已保存。`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存镜头失败");
    } finally {
      setSavingId(null);
    }
  };

  return (
    <section className="rounded-2xl border border-[var(--mc-stroke)] bg-white/80 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--mc-muted)]">Shot Table</p>
          <h3 className="mt-1 text-xl font-semibold text-[var(--mc-ink)]">结构化镜头表</h3>
          <p className="mt-1 text-sm text-[var(--mc-muted)]">先把镜头结构写清楚，再进入故事板生成。</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ButtonPill tone="quiet" onClick={() => void loadShots()}>刷新镜头</ButtonPill>
          <ButtonPill tone="primary" onClick={() => void addShot()}>新增镜头</ButtonPill>
        </div>
      </div>

      {error ? <p className="mt-3 text-sm text-[var(--mc-danger)]">{error}</p> : null}
      {notice ? <p className="mt-3 text-sm text-[var(--mc-good)]">{notice}</p> : null}
      {loading ? <p className="mt-3 text-sm text-[var(--mc-muted)]">镜头加载中...</p> : null}

      <div className="mt-4 overflow-auto rounded-xl border border-[var(--mc-stroke)]">
        <table className="min-w-[1200px] w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--mc-stroke)] text-left text-[11px] uppercase tracking-[0.2em] text-[var(--mc-muted)]">
              <th className="px-3 py-2">分镜号</th>
              <th className="px-3 py-2">场景</th>
              <th className="px-3 py-2">景别</th>
              <th className="px-3 py-2">构图</th>
              <th className="px-3 py-2">运镜</th>
              <th className="px-3 py-2">光影</th>
              <th className="px-3 py-2">分镜描述</th>
              <th className="px-3 py-2">音效</th>
              <th className="px-3 py-2">对白</th>
              <th className="px-3 py-2">时长</th>
              <th className="px-3 py-2">状态</th>
              <th className="px-3 py-2">操作</th>
            </tr>
          </thead>
          <tbody>
            {shots.map((shot) => (
              <tr key={shot.id} className="border-b border-[var(--mc-stroke)] align-top last:border-b-0">
                <td className="px-3 py-2">
                  <input value={shot.shotCode} onChange={(event) => patchLocal(shot.id, { shotCode: event.target.value })} />
                </td>
                <td className="px-3 py-2">
                  <input value={shot.scene} onChange={(event) => patchLocal(shot.id, { scene: event.target.value })} />
                </td>
                <td className="px-3 py-2">
                  <input value={shot.shotSize} onChange={(event) => patchLocal(shot.id, { shotSize: event.target.value })} />
                </td>
                <td className="px-3 py-2">
                  <input value={shot.composition} onChange={(event) => patchLocal(shot.id, { composition: event.target.value })} />
                </td>
                <td className="px-3 py-2">
                  <input value={shot.cameraMovement} onChange={(event) => patchLocal(shot.id, { cameraMovement: event.target.value })} />
                </td>
                <td className="px-3 py-2">
                  <input value={shot.lighting} onChange={(event) => patchLocal(shot.id, { lighting: event.target.value })} />
                </td>
                <td className="px-3 py-2">
                  <textarea className="min-h-[88px]" value={shot.description} onChange={(event) => patchLocal(shot.id, { description: event.target.value })} />
                </td>
                <td className="px-3 py-2">
                  <input value={shot.soundEffect} onChange={(event) => patchLocal(shot.id, { soundEffect: event.target.value })} />
                </td>
                <td className="px-3 py-2">
                  <textarea className="min-h-[88px]" value={shot.dialogue} onChange={(event) => patchLocal(shot.id, { dialogue: event.target.value })} />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="number"
                    min={1}
                    max={60}
                    value={shot.durationSeconds}
                    onChange={(event) => patchLocal(shot.id, { durationSeconds: Number(event.target.value) || 1 })}
                  />
                </td>
                <td className="px-3 py-2">
                  <select value={shot.status} onChange={(event) => patchLocal(shot.id, { status: event.target.value as EpisodeShotRecord["status"] })}>
                    <option value="draft">draft</option>
                    <option value="ready">ready</option>
                    <option value="locked">locked</option>
                  </select>
                </td>
                <td className="px-3 py-2">
                  <ButtonPill tone="quiet" onClick={() => void saveShot(shot)} disabled={savingId === shot.id}>
                    {savingId === shot.id ? "保存中..." : "保存"}
                  </ButtonPill>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
