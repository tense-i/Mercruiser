import { NextResponse } from "next/server";
import { z } from "zod";
import {
  runAssetsStage,
  runEntitiesStage,
  runEpisodePipeline,
  runFinalCutStage,
  runScriptStage,
  runStoryboardStage,
  runVideoStage,
  selectVideoCandidate,
} from "@/server/mvp/pipeline";

type Params = {
  params: Promise<{ episodeId: string }>;
};

const actionSchema = z.object({
  action: z.enum(["entities", "script", "assets", "storyboard", "video", "select-video", "final-cut", "run-pipeline"]),
  textModelRef: z.string().optional(),
  videoModelRef: z.string().optional(),
  candidateId: z.string().optional(),
});

export async function POST(request: Request, context: Params) {
  try {
    const { episodeId } = await context.params;
    const payload = actionSchema.parse(await request.json());

    if (payload.action === "entities") {
      const snapshot = await runEntitiesStage({
        episodeId,
        textModelRef: payload.textModelRef,
      });
      return NextResponse.json({ ok: true, data: snapshot });
    }

    if (payload.action === "script") {
      const snapshot = await runScriptStage({
        episodeId,
        textModelRef: payload.textModelRef,
      });
      return NextResponse.json({ ok: true, data: snapshot });
    }

    if (payload.action === "assets") {
      const snapshot = await runAssetsStage({
        episodeId,
        textModelRef: payload.textModelRef,
      });
      return NextResponse.json({ ok: true, data: snapshot });
    }

    if (payload.action === "storyboard") {
      const snapshot = await runStoryboardStage({
        episodeId,
        textModelRef: payload.textModelRef,
      });
      return NextResponse.json({ ok: true, data: snapshot });
    }

    if (payload.action === "video") {
      const snapshot = await runVideoStage({
        episodeId,
        videoModelRef: payload.videoModelRef,
      });
      return NextResponse.json({ ok: true, data: snapshot });
    }

    if (payload.action === "select-video") {
      if (!payload.candidateId) {
        return NextResponse.json(
          {
            ok: false,
            error: "select-video 需要 candidateId",
          },
          { status: 400 },
        );
      }

      const snapshot = selectVideoCandidate({
        episodeId,
        candidateId: payload.candidateId,
      });
      return NextResponse.json({ ok: true, data: snapshot });
    }

    if (payload.action === "final-cut") {
      const snapshot = await runFinalCutStage({
        episodeId,
      });
      return NextResponse.json({ ok: true, data: snapshot });
    }

    const snapshot = await runEpisodePipeline({
      episodeId,
      textModelRef: payload.textModelRef,
      videoModelRef: payload.videoModelRef,
    });
    return NextResponse.json({ ok: true, data: snapshot });
  } catch (error) {
    const message = error instanceof Error ? error.message : "执行失败";
    return NextResponse.json(
      {
        ok: false,
        error: message,
      },
      { status: 400 },
    );
  }
}

