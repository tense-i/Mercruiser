import { NextResponse } from "next/server";
import { z } from "zod";
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

const patchSchema = z
  .object({
    title: z.string().min(1).optional(),
    synopsis: z.string().min(1).optional(),
    sourceText: z.string().min(1).optional(),
  })
  .refine((payload) => payload.title || payload.synopsis || payload.sourceText, {
    message: "title、synopsis、sourceText 至少提供一个",
  });

export async function PATCH(request: Request, context: Params) {
  try {
    const { episodeId } = await context.params;
    const payload = patchSchema.parse(await request.json());
    const updated = mvpStore.updateEpisode(episodeId, payload);
    if (!updated) {
      return NextResponse.json(
        {
          ok: false,
          error: `未找到集数: ${episodeId}`,
        },
        { status: 404 },
      );
    }

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
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "更新集数失败",
      },
      { status: 400 },
    );
  }
}
