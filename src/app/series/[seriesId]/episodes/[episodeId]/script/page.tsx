import { notFound } from "next/navigation";
import { getEpisodeScriptWorkspace } from "@/lib/mock-data";
import { EpisodeScriptClient } from "./episode-script-client";

type PageProps = {
  params: Promise<{ seriesId: string; episodeId: string }>;
};

export default async function EpisodeScriptPage({ params }: PageProps) {
  const { seriesId, episodeId } = await params;
  const workspace = getEpisodeScriptWorkspace(seriesId, episodeId);

  if (!workspace) {
    notFound();
  }

  return <EpisodeScriptClient workspace={workspace} />;
}
