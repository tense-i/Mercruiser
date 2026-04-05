"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { ButtonPill } from "@/components/studio/studio-shell";
import type { StoryboardRecord } from "@/server/mvp/types";

type StoryboardWorkbenchProps = {
  episodeId: string;
  refreshKey?: string;
  onGenerate?: () => void;
  generating?: boolean;
};

const emptyFrames: StoryboardRecord[] = [];

export function StoryboardWorkbench({
  episodeId,
  refreshKey,
  onGenerate,
  generating = false,
}: StoryboardWorkbenchProps) {
  const [frames, setFrames] = useState<StoryboardRecord[]>(emptyFrames);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadFrames = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/v1/episodes/${episodeId}/storyboards`, { cache: "no-store" });
      const json = (await response.json()) as { ok: boolean; data?: StoryboardRecord[]; error?: string };
      if (!response.ok || !json.ok || !json.data) {
        throw new Error(json.error ?? "加载分镜失败");
      }
      setFrames(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载分镜失败");
    } finally {
      setLoading(false);
    }
  }, [episodeId]);

  useEffect(() => {
    void loadFrames();
  }, [loadFrames, refreshKey]);

  const patchLocal = (storyboardId: string, patch: Partial<StoryboardRecord>) => {
    setFrames((prev) => prev.map((frame) => (frame.id === storyboardId ? { ...frame, ...patch } : frame)));
  };

  const saveFrame = async (frame: StoryboardRecord) => {
    setSavingId(frame.id);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(`/api/v1/episodes/${episodeId}/storyboards`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          storyboardId: frame.id,
          shotIndex: frame.shotIndex,
          title: frame.title,
          action: frame.action,
          dialogue: frame.dialogue,
          prompt: frame.prompt,
          durationSeconds: frame.durationSeconds,
          status: frame.status,
        }),
      });
      const json = (await response.json()) as {
        ok: boolean;
        data?: { storyboards?: StoryboardRecord[] };
        error?: string;
      };
      if (!response.ok || !json.ok || !json.data?.storyboards) {
        throw new Error(json.error ?? "保存分镜失败");
      }
      setFrames(json.data.storyboards);
      setNotice(`${frame.title} 已保存。`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存分镜失败");
    } finally {
      setSavingId(null);
    }
  };

  return (
    <section className="rounded-2xl border border-[var(--mc-stroke)] bg-white/80 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--mc-muted)]">
            Storyboard Workbench
          </p>
          <h3 className="mt-1 text-xl font-semibold text-[var(--mc-ink)]">故事板工作台</h3>
          <p className="mt-1 text-sm text-[var(--mc-muted)]">
            将分镜预览与镜头结构表拆开维护，方便单独修文案、提示词与锁定状态。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ButtonPill tone="quiet" onClick={() => void loadFrames()}>
            刷新分镜
          </ButtonPill>
          {onGenerate ? (
            <ButtonPill tone="primary" onClick={onGenerate} disabled={generating}>
              {generating ? "生成中..." : frames.length > 0 ? "重新生成分镜" : "生成分镜"}
            </ButtonPill>
          ) : null}
        </div>
      </div>

      {error ? <p className="mt-3 text-sm text-[var(--mc-danger)]">{error}</p> : null}
      {notice ? <p className="mt-3 text-sm text-[var(--mc-good)]">{notice}</p> : null}
      {loading ? <p className="mt-3 text-sm text-[var(--mc-muted)]">分镜加载中...</p> : null}

      {!loading && frames.length === 0 ? (
        <div className="mt-4 rounded-xl border border-dashed border-[var(--mc-stroke)] bg-[var(--mc-soft)] p-4 text-sm text-[var(--mc-muted)]">
          当前还没有分镜结果。先在左侧完成镜头结构，再触发分镜生成。
        </div>
      ) : null}

      <div className="mt-4 space-y-3">
        {frames.map((frame) => (
          <article key={frame.id} className="rounded-xl border border-[var(--mc-stroke)] bg-[var(--mc-soft)] p-3">
            <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_180px]">
              <div className="space-y-3">
                <div className="grid gap-3 md:grid-cols-[160px_minmax(0,1fr)]">
                  <label className="grid gap-1 text-xs font-medium text-[var(--mc-muted)]">
                    镜头序号
                    <input
                      type="number"
                      min={1}
                      value={frame.shotIndex}
                      onChange={(event) =>
                        patchLocal(frame.id, { shotIndex: Number(event.target.value) || frame.shotIndex })
                      }
                    />
                  </label>
                  <label className="grid gap-1 text-xs font-medium text-[var(--mc-muted)]">
                    标题
                    <input
                      value={frame.title}
                      onChange={(event) => patchLocal(frame.id, { title: event.target.value })}
                    />
                  </label>
                </div>

                <label className="grid gap-1 text-xs font-medium text-[var(--mc-muted)]">
                  动作
                  <textarea
                    className="min-h-[88px]"
                    value={frame.action}
                    onChange={(event) => patchLocal(frame.id, { action: event.target.value })}
                  />
                </label>

                <label className="grid gap-1 text-xs font-medium text-[var(--mc-muted)]">
                  对白
                  <textarea
                    className="min-h-[88px]"
                    value={frame.dialogue}
                    onChange={(event) => patchLocal(frame.id, { dialogue: event.target.value })}
                  />
                </label>

                <label className="grid gap-1 text-xs font-medium text-[var(--mc-muted)]">
                  Prompt
                  <textarea
                    className="min-h-[108px]"
                    value={frame.prompt}
                    onChange={(event) => patchLocal(frame.id, { prompt: event.target.value })}
                  />
                </label>
              </div>

              <div className="space-y-3">
                <label className="grid gap-1 text-xs font-medium text-[var(--mc-muted)]">
                  状态
                  <select
                    value={frame.status}
                    onChange={(event) =>
                      patchLocal(frame.id, { status: event.target.value as StoryboardRecord["status"] })
                    }
                  >
                    <option value="draft">draft</option>
                    <option value="fixed">fixed</option>
                    <option value="locked">locked</option>
                  </select>
                </label>

                <label className="grid gap-1 text-xs font-medium text-[var(--mc-muted)]">
                  时长（秒）
                  <input
                    type="number"
                    min={1}
                    max={60}
                    value={frame.durationSeconds}
                    onChange={(event) =>
                      patchLocal(frame.id, {
                        durationSeconds: Number(event.target.value) || frame.durationSeconds,
                      })
                    }
                  />
                </label>

                <div className="rounded-xl border border-[var(--mc-stroke)] bg-white p-3">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-[var(--mc-muted)]">预览</p>
                  {frame.imageUrl ? (
                    <Image
                      src={frame.imageUrl}
                      alt={frame.title}
                      width={480}
                      height={270}
                      unoptimized
                      className="mt-2 aspect-video w-full rounded-lg object-cover"
                    />
                  ) : (
                    <div className="mt-2 flex aspect-video items-center justify-center rounded-lg bg-[var(--mc-soft)] text-xs text-[var(--mc-muted)]">
                      暂无预览图
                    </div>
                  )}
                </div>

                <ButtonPill
                  tone="quiet"
                  onClick={() => void saveFrame(frame)}
                  disabled={savingId === frame.id}
                >
                  {savingId === frame.id ? "保存中..." : "保存分镜"}
                </ButtonPill>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
