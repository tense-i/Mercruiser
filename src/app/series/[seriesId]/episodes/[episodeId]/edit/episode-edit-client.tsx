"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ButtonPill, SectionTitle } from "@/components/studio/studio-shell";

export function EpisodeEditClient({
  seriesId,
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

  return (
    <section className="mc-soft-panel rounded-2xl p-4">
      <SectionTitle
        kicker="Episode Metadata"
        title={`${episodeCode} 基础信息`}
        description="对齐 PRD 的集数信息维护能力。"
      />
      <form
        className="mt-4 grid gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          router.push(`/series/${seriesId}`);
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
          <ButtonPill tone="quiet" onClick={() => router.push(`/series/${seriesId}`)}>
            取消
          </ButtonPill>
          <ButtonPill type="submit" tone="primary">
            保存集数信息
          </ButtonPill>
        </div>
      </form>
    </section>
  );
}
