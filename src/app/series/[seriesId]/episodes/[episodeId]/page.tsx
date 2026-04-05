import { notFound } from "next/navigation";
import { buildEpisodeStudioView, buildSeriesDetailView } from "@/server/application/views/series-episode-views";
import { EpisodeStudioClient } from "./episode-studio-client";

type PageProps = {
  params: Promise<{ seriesId: string; episodeId: string }>;
};

export default async function EpisodeStudioPage({ params }: PageProps) {
  const { seriesId, episodeId } = await params;
  const series = buildSeriesDetailView(seriesId);
  const episode = buildEpisodeStudioView(episodeId);

  if (!series || !episode || episode.seriesId !== seriesId) {
    notFound();
  }

  return <EpisodeStudioClient series={series} episode={episode} />;
}
