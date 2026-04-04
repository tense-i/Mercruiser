import { notFound } from "next/navigation";
import { getEpisodeStudio, getSeriesById } from "@/lib/mock-data";
import { EpisodeStudioClient } from "./episode-studio-client";

type PageProps = {
  params: Promise<{ seriesId: string; episodeId: string }>;
};

export default async function EpisodeStudioPage({ params }: PageProps) {
  const { seriesId, episodeId } = await params;
  const series = getSeriesById(seriesId);
  const episode = getEpisodeStudio(seriesId, episodeId);

  if (!series || !episode) {
    notFound();
  }

  return <EpisodeStudioClient series={series} episode={episode} />;
}

