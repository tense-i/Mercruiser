import { NextResponse } from "next/server";
import { z } from "zod";
import { buildSeriesDetailView } from "@/server/application/views/series-episode-views";
import { mvpStore } from "@/server/infrastructure/sqlite/store";

type Params = {
  params: Promise<{ seriesId: string }>;
};

const assetSchema = z.object({
  name: z.string().min(1),
  category: z.enum(["characters", "scenes", "props"]),
  summary: z.string().default(""),
  mainVersion: z.string().min(1),
  locked: z.boolean(),
  note: z.string().optional(),
  owner: z.string().optional(),
  episodeRefs: z.array(z.string()).optional(),
  variants: z
    .array(
      z.object({
        id: z.string().optional(),
        label: z.string().min(1),
        prompt: z.string(),
        selected: z.boolean(),
        locked: z.boolean(),
      }),
    )
    .min(1),
});

export async function PATCH(request: Request, context: Params) {
  try {
    const { seriesId } = await context.params;
    const series = mvpStore.getSeries(seriesId);
    if (!series) {
      return NextResponse.json({ ok: false, error: `未找到系列: ${seriesId}` }, { status: 404 });
    }

    const payload = assetSchema.parse(await request.json());
    const selectedVariant =
      payload.variants.find((variant) => variant.selected) ??
      payload.variants.find((variant) => variant.label === payload.mainVersion);
    if (!selectedVariant) {
      return NextResponse.json({ ok: false, error: "必须指定一个主版本" }, { status: 400 });
    }

    const variants = payload.variants.map((variant) => ({
      ...variant,
      selected: variant.label === selectedVariant.label,
      locked: variant.label === selectedVariant.label ? payload.locked : variant.locked,
    }));

    const saved = mvpStore.saveSeriesSharedAsset({
      seriesId,
      name: payload.name,
      category: payload.category,
      summary: payload.summary,
      mainVersion: selectedVariant.label,
      locked: payload.locked,
      note: payload.note,
      owner: payload.owner,
      episodeRefs: payload.episodeRefs,
      variants,
    });

    return NextResponse.json({
      ok: true,
      data: {
        asset: saved.asset,
        variants: saved.variants,
        seriesDetail: buildSeriesDetailView(seriesId),
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "保存共享资产失败",
      },
      { status: 400 },
    );
  }
}
