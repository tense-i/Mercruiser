import { NextResponse } from "next/server";
import { buildEpisodeStudioView } from "@/server/application/views/series-episode-views";
import { mvpStore } from "@/server/infrastructure/sqlite/store";

type Params = {
  params: Promise<{ episodeId: string }>;
};

export async function GET(_: Request, context: Params) {
  const { episodeId } = await context.params;
  const snapshot = mvpStore.getEpisodeSnapshot(episodeId);
  if (!snapshot) {
    return NextResponse.json(
      {
        ok: false,
        error: `未找到集数: ${episodeId}`,
      },
      { status: 404 },
    );
  }

  const episodeStudio = buildEpisodeStudioView(episodeId);
  return NextResponse.json({
    ok: true,
    data: {
      ...snapshot,
      episodeStudio,
    },
  });
}
