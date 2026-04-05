"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ButtonPill, SectionTitle } from "@/components/studio/studio-shell";

export function EpisodeEditClient({
  seriesId,
  episodeId,
  episodeCode,
  title,
  synopsis,
}: {
  seriesId: string;
  episodeId: string;
  episodeCode: string;
  title: string;
  synopsis: string;
}) {
  const router = useRouter();
  const [episodeTitle, setEpisodeTitle] = useState(title);
  const [episodeSynopsis, setEpisodeSynopsis] = useState(synopsis);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  return (
    <section className="mc-soft-panel rounded-2xl p-4">
      <SectionTitle
        kicker="Episode Metadata"
        title={`${episodeCode} 基础信息`}
        description="对齐 PRD 的集数信息维护能力。"
      />
      <form
        className="mt-4 grid gap-3"
        onSubmit={async (event) => {
          event.preventDefault();
          if (saving) {
            return;
          }

          setSaving(true);
          setSaveError(null);
          try {
            const response = await fetch(`/api/v1/episodes/${episodeId}`, {
              method: "PATCH",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                title: episodeTitle.trim(),
                synopsis: episodeSynopsis.trim(),
              }),
            });
            const json = (await response.json()) as { ok: boolean; error?: string };
            if (!response.ok || !json.ok) {
              throw new Error(json.error ?? "保存集数信息失败");
            }
            router.push(`/series/${seriesId}`);
            router.refresh();
          } catch (error) {
            setSaveError(error instanceof Error ? error.message : "保存集数信息失败");
          } finally {
            setSaving(false);
          }
        }}
      >
        <label className="grid gap-1 text-sm">
          集数标题
          <input
            value={episodeTitle}
            onChange={(event) => setEpisodeTitle(event.target.value)}
            required
          />
        </label>
        <label className="grid gap-1 text-sm">
          集数概要
          <textarea
            value={episodeSynopsis}
            onChange={(event) => setEpisodeSynopsis(event.target.value)}
            required
          />
        </label>
        <div className="flex justify-end gap-2">
          <ButtonPill tone="quiet" onClick={() => router.push(`/series/${seriesId}`)} disabled={saving}>
            取消
          </ButtonPill>
          <ButtonPill type="submit" tone="primary" disabled={saving}>
            {saving ? "保存中..." : "保存集数信息"}
          </ButtonPill>
        </div>
        {saveError ? <p className="text-sm text-[var(--mc-danger)]">{saveError}</p> : null}
      </form>
    </section>
  );
}
