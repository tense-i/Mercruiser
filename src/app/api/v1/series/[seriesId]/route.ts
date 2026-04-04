import { NextResponse } from "next/server";
import { mvpStore } from "@/server/mvp/store";
import { buildSeriesDetailView } from "@/server/mvp/ui-views";

type Params = {
  params: Promise<{ seriesId: string }>;
};

export async function GET(_: Request, context: Params) {
  const { seriesId } = await context.params;
  const series = mvpStore.getSeries(seriesId);
  if (!series) {
    return NextResponse.json(
      {
        ok: false,
        error: `未找到系列: ${seriesId}`,
      },
      { status: 404 },
    );
  }

  const episodes = mvpStore.listEpisodes(seriesId);
  const seriesDetail = buildSeriesDetailView(seriesId);
  return NextResponse.json({
    ok: true,
    data: {
      series,
      episodes,
      seriesDetail,
    },
  });
}
