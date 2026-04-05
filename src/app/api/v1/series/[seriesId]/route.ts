import { NextResponse } from "next/server";
import { z } from "zod";
import { buildSeriesDetailView } from "@/server/application/views/series-episode-views";
import { mvpStore } from "@/server/infrastructure/sqlite/store";

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

const patchSchema = z.object({
  title: z.string().min(1).optional(),
  summary: z.string().min(1).optional(),
  genre: z.string().min(1).optional(),
  status: z.enum(["initialized", "setting", "producing", "partial_done", "done", "paused"]).optional(),
  worldview: z.string().optional(),
  visualGuide: z.string().optional(),
  directorGuide: z.string().optional(),
});

export async function PATCH(request: Request, context: Params) {
  try {
    const { seriesId } = await context.params;
    const payload = patchSchema.parse(await request.json());
    const updated = mvpStore.updateSeries(seriesId, payload);
    if (!updated) {
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
        series: updated,
        episodes,
        seriesDetail,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "更新系列失败",
      },
      { status: 400 },
    );
  }
}

export async function DELETE(_: Request, context: Params) {
  const { seriesId } = await context.params;
  const deleted = mvpStore.deleteSeries(seriesId);
  if (!deleted) {
    return NextResponse.json(
      {
        ok: false,
        error: `未找到系列: ${seriesId}`,
      },
      { status: 404 },
    );
  }
  return NextResponse.json({
    ok: true,
    data: {
      deleted: true,
      seriesId,
    },
  });
}
