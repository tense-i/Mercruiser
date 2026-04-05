import { NextResponse } from "next/server";
import { z } from "zod";
import { runEntitiesStage, runScriptStage } from "@/server/application/orchestrators/episode-pipeline";
import { mvpStore } from "@/server/infrastructure/sqlite/store";

const createOneSchema = z.object({
  title: z.string().min(1),
  synopsis: z.string().default(""),
  sourceText: z.string().optional(),
  autoAnalyzeToScript: z.boolean().optional().default(false),
});

const createBatchSchema = z.object({
  episodes: z
    .array(
      z.object({
        title: z.string().min(1),
        synopsis: z.string().default(""),
        sourceText: z.string().optional(),
      }),
    )
    .min(1),
});

type Params = {
  params: Promise<{ seriesId: string }>;
};

export async function POST(request: Request, context: Params) {
  try {
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

    const raw = await request.json();

    if (raw && Array.isArray(raw.episodes)) {
      const payload = createBatchSchema.parse(raw);
      const episodes = mvpStore.createEpisodesBatch({
        seriesId,
        episodes: payload.episodes,
      });
      return NextResponse.json({
        ok: true,
        data: {
          created: episodes.length,
          episodes,
        },
      });
    }

    const payload = createOneSchema.parse(raw);
    const episode = mvpStore.createEpisode({
      seriesId,
      title: payload.title,
      synopsis: payload.synopsis,
      sourceText: payload.sourceText,
    });
    if (payload.autoAnalyzeToScript) {
      void (async () => {
        try {
          await runEntitiesStage({ episodeId: episode.id });
          await runScriptStage({ episodeId: episode.id });
        } catch {
          // keep non-blocking behavior
        }
      })();
    }

    return NextResponse.json({
      ok: true,
      data: {
        created: 1,
        episodes: [episode],
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "创建集数失败",
      },
      { status: 400 },
    );
  }
}
