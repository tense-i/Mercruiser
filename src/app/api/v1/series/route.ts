import { NextResponse } from "next/server";
import { z } from "zod";
import { bootstrapSeriesToScript, importSeriesFromNovel } from "@/server/application/orchestrators/series-bootstrap";
import { mvpStore } from "@/server/infrastructure/sqlite/store";

const episodeSourceSchema = z.object({
  title: z.string().min(1),
  synopsis: z.string().default(""),
  text: z.string().min(1),
});

const createSeriesSchema = z
  .object({
    title: z.string().min(1),
    summary: z.string().optional(),
    genre: z.string().optional(),
    worldview: z.string().optional(),
    visualGuide: z.string().optional(),
    directorGuide: z.string().optional(),
    rawText: z.string().optional(),
    maxEpisodes: z.number().int().min(1).max(100).optional(),
    episodeSources: z.array(episodeSourceSchema).optional(),
    autoAnalyzeOnImport: z.boolean().optional().default(true),
  })
  .superRefine((value, ctx) => {
    const hasRawText = Boolean(value.rawText && value.rawText.trim().length > 0);
    const hasEpisodes = Boolean(value.episodeSources && value.episodeSources.length > 0);
    if (!hasRawText && !hasEpisodes) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "rawText 或 episodeSources 至少提供一个",
      });
    }
  });

export async function GET() {
  const series = mvpStore.listSeries().map((item) => {
    const episodes = mvpStore.listEpisodes(item.id);
    return {
      ...item,
      episodesTotal: episodes.length,
      episodesDone: episodes.filter((episode) => episode.status === "done").length,
    };
  });

  return NextResponse.json({
    ok: true,
    data: series,
  });
}

export async function POST(request: Request) {
  try {
    const payload = createSeriesSchema.parse(await request.json());
    const result = importSeriesFromNovel(payload);

    const autoAnalyze = payload.autoAnalyzeOnImport === true;
    if (autoAnalyze) {
      void bootstrapSeriesToScript({
        seriesId: result.seriesId,
        episodeIds: result.episodeIds,
      });
    }

    return NextResponse.json({
      ok: true,
      data: {
        ...result,
        analysis: {
          mode: "async",
          targetStage: "script",
          started: autoAnalyze,
        },
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "导入系列失败";
    return NextResponse.json(
      {
        ok: false,
        error: message,
      },
      { status: 400 },
    );
  }
}
