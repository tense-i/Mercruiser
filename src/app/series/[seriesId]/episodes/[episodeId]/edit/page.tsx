import Link from "next/link";
import { notFound } from "next/navigation";
import { EpisodeEditClient } from "./episode-edit-client";
import { OrchestratorPanel, StudioShell } from "@/components/studio/studio-shell";
import { mvpStore } from "@/server/infrastructure/sqlite/store";

type PageProps = {
  params: Promise<{ seriesId: string; episodeId: string }>;
};

export default async function EpisodeEditPage({ params }: PageProps) {
  const { seriesId, episodeId } = await params;
  const series = mvpStore.getSeries(seriesId);
  const episode = mvpStore.getEpisode(episodeId);

  if (!series || !episode || episode.seriesId !== seriesId) {
    notFound();
  }

  return (
    <StudioShell
      navKey="workspace"
      eyebrow="UC-04"
      title={`编辑 ${episode.code}`}
      description="维护集数标题与概要，支持后续生产阶段继续沿用。"
      actions={
        <Link
          href={`/series/${seriesId}`}
          className="inline-flex items-center rounded-lg border border-[var(--mc-stroke)] bg-white px-3 py-1.5 text-sm text-[var(--mc-ink)]"
        >
          返回系列详情
        </Link>
      }
      aside={
        <OrchestratorPanel
          title="Episode Metadata"
          focus="标题与概要维护"
          completion={66}
          blocking="等待保存后生效"
          nextStep="保存后返回集数列表。"
          recommendations={["检查标题一致性", "优化概要长度", "保存并继续执行"]}
          queuePreview={[]}
        />
      }
    >
      <EpisodeEditClient
        seriesId={seriesId}
        episodeId={episode.id}
        episodeCode={episode.code}
        title={episode.title}
        synopsis={episode.synopsis}
      />
    </StudioShell>
  );
}
