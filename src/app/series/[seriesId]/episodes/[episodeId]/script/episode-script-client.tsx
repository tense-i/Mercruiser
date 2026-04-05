"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowClockwise, CheckCircle, Circle, Sparkle, Warning } from "@phosphor-icons/react/dist/ssr";
import type { EpisodeScriptWorkspaceView as EpisodeScriptWorkspace, ScriptAspectRatio, ScriptCreationMode, ScriptVisualTone } from "@/server/mvp/types";
import { ButtonPill, StudioShell } from "@/components/studio/studio-shell";

const aspectRatioOptions: ScriptAspectRatio[] = ["16:9", "9:16", "4:3", "3:4"];

const creationModeOptions: Array<{ id: ScriptCreationMode; label: string }> = [
  { id: "image_to_video", label: "生图转视频" },
  { id: "reference_video", label: "参考生视频" },
];

const visualToneOptions: Array<{ id: ScriptVisualTone; label: string }> = [
  { id: "realistic", label: "写实" },
  { id: "anime", label: "动漫" },
];

export function EpisodeScriptClient({ workspace }: { workspace: EpisodeScriptWorkspace }) {
  const router = useRouter();
  const [chapterCursor, setChapterCursor] = useState(workspace.chapterCursor);
  const [chapterDrafts, setChapterDrafts] = useState<Record<string, string>>(() => {
    return Object.fromEntries(
      workspace.chapters.map((chapter) => {
        if (chapter.id === workspace.episodeId) {
          return [chapter.id, workspace.scriptText];
        }
        return [
          chapter.id,
          `${chapter.code} · ${chapter.title}\n\n（该章节使用归档文案占位，可切换后继续补写或重排对白节奏。）`,
        ];
      }),
    );
  });
  const [aspectRatio, setAspectRatio] = useState<ScriptAspectRatio>(workspace.config.aspectRatio);
  const [creationMode, setCreationMode] = useState<ScriptCreationMode>(workspace.config.creationMode);
  const [visualTone, setVisualTone] = useState<ScriptVisualTone>(workspace.config.visualTone);
  const [selectedStyleId, setSelectedStyleId] = useState(
    workspace.styleReferences.find((item) => item.selected)?.id ?? workspace.styleReferences[0]?.id ?? "",
  );
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);

  const currentChapter =
    workspace.chapters.find((chapter) => chapter.id === chapterCursor) ?? workspace.chapters[0];
  const currentDraft = chapterDrafts[chapterCursor] ?? "";
  const wordCount = useMemo(() => currentDraft.replace(/\s+/g, "").length, [currentDraft]);
  const progress = Math.min(100, Math.round((wordCount / workspace.targetWords) * 100));

  const visibleStyles = useMemo(
    () => workspace.styleReferences.filter((style) => style.tone === visualTone),
    [visualTone, workspace.styleReferences],
  );

  const saveWorkspace = async () => {
    if (saving) {
      return false;
    }
    setSaving(true);
    setSaveError(null);
    setSaveNotice(null);
    try {
      const response = await fetch(`/api/v1/episodes/${workspace.episodeId}/script-workspace`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          scriptText: chapterDrafts[workspace.episodeId] ?? workspace.scriptText,
          chapterCursor,
          config: {
            aspectRatio,
            creationMode,
            visualTone,
          },
        }),
      });
      const json = (await response.json()) as { ok: boolean; error?: string };
      if (!response.ok || !json.ok) {
        throw new Error(json.error ?? "保存失败");
      }
      setSaveNotice("剧本草稿已保存。");
      return true;
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "保存失败");
      return false;
    } finally {
      setSaving(false);
    }
  };

  return (
    <StudioShell
      navKey="workspace"
      eyebrow="Episode Script"
      title={`${workspace.episodeCode} · 剧本页`}
      description="聚焦章节切换、正文编辑与全局创作参数，先把文本决策稳定，再进入分镜和视频阶段。"
      actions={
        <>
          <Link
            href={`/series/${workspace.seriesId}`}
            className="inline-flex rounded-full border border-[var(--mc-stroke)] bg-white px-4 py-2 text-sm font-semibold text-[var(--mc-ink)]"
          >
            返回系列详情
          </Link>
          <Link
            href={`/series/${workspace.seriesId}/episodes/${workspace.episodeId}`}
            className="inline-flex rounded-full border border-[var(--mc-stroke)] bg-white px-4 py-2 text-sm font-semibold text-[var(--mc-ink)]"
          >
            返回集工作台
          </Link>
          <ButtonPill tone="primary" onClick={() => void saveWorkspace()} disabled={saving}>
            <CheckCircle size={14} />
            {saving ? "保存中..." : "保存剧本草稿"}
          </ButtonPill>
        </>
      }
      compact
    >
      <div className="grid gap-3 xl:grid-cols-[220px_minmax(0,1fr)_320px]">
        <aside className="mc-soft-panel rounded-[1.4rem] p-3">
          <p className="px-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-[var(--mc-muted)]">章节导航</p>
          <div className="mt-2 space-y-1.5">
            {workspace.chapters.map((chapter) => {
              const active = chapter.id === chapterCursor;
              const marker =
                chapter.status === "active" ? (
                  <CheckCircle size={13} className="text-[var(--mc-accent)]" weight="fill" />
                ) : chapter.status === "ready" ? (
                  <Circle size={13} className="text-emerald-300" weight="fill" />
                ) : (
                  <Circle size={13} className="text-white/30" />
                );

              return (
                <button
                  key={chapter.id}
                  onClick={() => setChapterCursor(chapter.id)}
                  className={`w-full rounded-2xl border px-3 py-2.5 text-left transition ${
                    active
                      ? "border-[#f2dfbe]/45 bg-[#f2dfbe]/12"
                      : "border-transparent bg-white/[0.02] hover:border-white/12 hover:bg-white/[0.05]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs text-white/45">{chapter.code}</p>
                      <p className="mt-0.5 text-sm font-semibold text-white">{chapter.title}</p>
                    </div>
                    {marker}
                  </div>
                  <p className="mt-1 text-xs text-white/40">进度 {chapter.progress}%</p>
                </button>
              );
            })}
          </div>

          <ButtonPill tone="quiet">
            <Sparkle size={14} />
            添加剧集
          </ButtonPill>
        </aside>

        <section className="mc-soft-panel rounded-[1.4rem] p-4">
          <div className="flex flex-wrap items-start justify-between gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.2em] text-white/35">{workspace.seriesTitle}</p>
              <h2 className="mt-1 text-xl font-semibold text-white">
                {currentChapter?.code} · {currentChapter?.title}
              </h2>
              <p className="mt-1 text-xs text-white/45">当前阶段建议把冲突点写清楚，再交给分镜 Agent。</p>
            </div>
            <div className="min-w-[180px] rounded-xl border border-white/10 bg-[#0d1219] px-3 py-2">
              <div className="flex items-center justify-between text-xs text-white/45">
                <span>字数进度</span>
                <span>
                  {wordCount}/{workspace.targetWords}
                </span>
              </div>
              <div className="mt-2 h-1.5 rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#d0a15f] via-[#f0d6a8] to-[#fff4e2]"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          </div>

          <textarea
            className="mt-3 min-h-[560px] resize-y rounded-2xl border-white/10 bg-[#0b1118] p-4 text-sm leading-7 text-white"
            value={currentDraft}
            onChange={(event) => {
              const next = event.target.value;
              setChapterDrafts((prev) => ({ ...prev, [chapterCursor]: next }));
            }}
          />

          <div className="mt-3 flex flex-wrap gap-2">
            <ButtonPill tone="quiet">
              <Sparkle size={14} />
              AI 润色当前段落
            </ButtonPill>
            <ButtonPill tone="quiet">
              <ArrowClockwise size={14} />
              重生本段
            </ButtonPill>
            <ButtonPill
              tone="primary"
              onClick={() =>
                void (async () => {
                  const ok = await saveWorkspace();
                  if (ok) {
                    router.push(`/series/${workspace.seriesId}/episodes/${workspace.episodeId}`);
                  }
                })()
              }
            >
              确认并推进分镜
            </ButtonPill>
          </div>
          {saveError ? <p className="mt-2 text-sm text-[var(--mc-danger)]">{saveError}</p> : null}
          {saveNotice ? <p className="mt-2 text-sm text-[var(--mc-good)]">{saveNotice}</p> : null}
        </section>

        <aside className="mc-soft-panel rounded-[1.4rem] p-4">
          <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
            <p className="text-[11px] uppercase tracking-[0.2em] text-white/35">全局设定</p>

            <div className="mt-3">
              <p className="text-xs font-semibold text-white/65">视频比例</p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {aspectRatioOptions.map((ratio) => (
                  <button
                    key={ratio}
                    onClick={() => setAspectRatio(ratio)}
                    className={`rounded-xl border px-3 py-2 text-sm transition ${
                      aspectRatio === ratio
                        ? "border-[#f2dfbe]/45 bg-[#f2dfbe]/12 text-[#f5e7cf]"
                        : "border-white/10 bg-[#0d1219] text-white/65 hover:bg-white/[0.06]"
                    }`}
                  >
                    {ratio}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-3">
              <p className="text-xs font-semibold text-white/65">创作模式</p>
              <div className="mt-2 grid gap-2">
                {creationModeOptions.map((mode) => (
                  <button
                    key={mode.id}
                    onClick={() => setCreationMode(mode.id)}
                    className={`rounded-xl border px-3 py-2 text-sm transition ${
                      creationMode === mode.id
                        ? "border-[#f2dfbe]/45 bg-[#f2dfbe]/12 text-[#f5e7cf]"
                        : "border-white/10 bg-[#0d1219] text-white/65 hover:bg-white/[0.06]"
                    }`}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>
            </div>
          </section>

          <section className="mt-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] uppercase tracking-[0.2em] text-white/35">风格参考</p>
              <div className="inline-flex rounded-full border border-white/10 bg-[#0d1219] p-1">
                {visualToneOptions.map((tone) => (
                  <button
                    key={tone.id}
                    onClick={() => setVisualTone(tone.id)}
                    className={`rounded-full px-3 py-1 text-xs transition ${
                      visualTone === tone.id
                        ? "bg-[#f2dfbe]/90 font-semibold text-[#1a1a1a]"
                        : "text-white/55"
                    }`}
                  >
                    {tone.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              {visibleStyles.map((style) => {
                const selected = style.id === selectedStyleId;
                return (
                  <button
                    key={style.id}
                    onClick={() => setSelectedStyleId(style.id)}
                    className={`rounded-2xl border p-2 text-left transition ${
                      selected
                        ? "border-[#f2dfbe]/45 bg-[#f2dfbe]/10"
                        : "border-white/10 bg-[#0d1219] hover:bg-white/[0.06]"
                    }`}
                  >
                    <div className={`h-20 rounded-xl bg-gradient-to-br ${style.palette}`} />
                    <p className="mt-2 text-xs font-semibold text-white">{style.title}</p>
                    <p className="mt-1 text-[11px] leading-5 text-white/45">{style.summary}</p>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="mt-3 rounded-2xl border border-amber-200/18 bg-amber-500/8 p-3">
            <p className="inline-flex items-center gap-1 text-xs font-semibold text-amber-100">
              <Warning size={12} weight="duotone" />
              执行提示
            </p>
            <ul className="mt-2 space-y-1.5 text-xs leading-5 text-amber-100/80">
              {workspace.quickNotes.map((note) => (
                <li key={note}>• {note}</li>
              ))}
            </ul>
          </section>
        </aside>
      </div>
    </StudioShell>
  );
}
