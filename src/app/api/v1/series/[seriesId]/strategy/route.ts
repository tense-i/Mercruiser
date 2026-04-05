import { NextResponse } from "next/server";
import { z } from "zod";
import { buildSeriesDetailView } from "@/server/application/views/series-episode-views";
import { mvpStore } from "@/server/infrastructure/sqlite/store";

type Params = {
  params: Promise<{ seriesId: string }>;
};

const strategySchema = z.object({
  textModelRef: z.string().min(1).optional(),
  imageModelRef: z.string().min(1).optional(),
  videoModelRef: z.string().min(1).optional(),
  promptPolicies: z
    .array(
      z.object({
        stage: z.string().min(1),
        policy: z.string().min(1),
      }),
    )
    .optional(),
  agentPolicies: z
    .array(
      z.object({
        name: z.string().min(1),
        value: z.string().min(1),
      }),
    )
    .optional(),
});

export async function GET(_: Request, context: Params) {
  const { seriesId } = await context.params;
  const series = mvpStore.getSeries(seriesId);
  if (!series) {
    return NextResponse.json({ ok: false, error: `未找到系列: ${seriesId}` }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    data: {
      strategy: mvpStore.getSeriesStrategy(seriesId),
      seriesDetail: buildSeriesDetailView(seriesId),
    },
  });
}

export async function PATCH(request: Request, context: Params) {
  try {
    const { seriesId } = await context.params;
    const series = mvpStore.getSeries(seriesId);
    if (!series) {
      return NextResponse.json({ ok: false, error: `未找到系列: ${seriesId}` }, { status: 404 });
    }

    const payload = strategySchema.parse(await request.json());
    const strategy = mvpStore.saveSeriesStrategy({
      seriesId,
      textModelRef: payload.textModelRef,
      imageModelRef: payload.imageModelRef,
      videoModelRef: payload.videoModelRef,
      promptPolicies: payload.promptPolicies,
      agentPolicies: payload.agentPolicies,
    });

    return NextResponse.json({
      ok: true,
      data: {
        strategy,
        seriesDetail: buildSeriesDetailView(seriesId),
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "保存系列策略失败",
      },
      { status: 400 },
    );
  }
}
