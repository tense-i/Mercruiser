import { notFound } from "next/navigation";
import { buildEpisodeScriptWorkspaceView } from "@/server/application/views/series-episode-views";
import { EpisodeScriptClient } from "./episode-script-client";

type PageProps = {
  params: Promise<{ seriesId: string; episodeId: string }>;
};

export default async function EpisodeScriptPage({ params }: PageProps) {
  const { seriesId, episodeId } = await params;
  const workspace = buildEpisodeScriptWorkspaceView(episodeId);

  if (!workspace || workspace.seriesId !== seriesId) {
    notFound();
  }

  return <EpisodeScriptClient workspace={workspace} />;
}
