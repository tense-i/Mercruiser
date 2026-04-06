import { notFound } from 'next/navigation';

import { EpisodeWorkspace } from '@/components/episode/episode-workspace';
import { studioRepository } from '@/lib/server/repository/studio-repository';

export default async function EpisodePage({
  params,
}: {
  params: Promise<{ seriesId: string; episodeId: string }>;
}) {
  const { seriesId, episodeId } = await params;
  const view = await studioRepository.getEpisodeWorkspaceView(episodeId);

  if (!view || view.episode.seriesId !== seriesId) {
    notFound();
  }

  return <EpisodeWorkspace initialView={view} />;
}
