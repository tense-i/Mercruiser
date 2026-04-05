import { NextResponse } from "next/server";
import { z } from "zod";
import { mvpStore } from "@/server/infrastructure/sqlite/store";

type Params = {
  params: Promise<{ episodeId: string }>;
};

const patchSchema = z.object({
  storyboardId: z.string().min(1),
  shotIndex: z.number().int().min(1).optional(),
  title: z.string().min(1).optional(),
  action: z.string().min(1).optional(),
  dialogue: z.string().optional(),
  prompt: z.string().min(1).optional(),
  durationSeconds: z.number().int().min(1).max(60).optional(),
  status: z.enum(["draft", "fixed", "locked"]).optional(),
});

export async function GET(_: Request, context: Params) {
  const { episodeId } = await context.params;
  return NextResponse.json({
    ok: true,
    data: mvpStore.listStoryboards(episodeId),
  });
}

export async function PATCH(request: Request, context: Params) {
  try {
    const { episodeId } = await context.params;
    const payload = patchSchema.parse(await request.json());
    const storyboard = mvpStore.saveStoryboard({
      id: payload.storyboardId,
      episodeId,
      shotIndex: payload.shotIndex,
      title: payload.title,
      action: payload.action,
      dialogue: payload.dialogue,
      prompt: payload.prompt,
      durationSeconds: payload.durationSeconds,
      status: payload.status,
    });

    if (!storyboard) {
      return NextResponse.json({ ok: false, error: `未找到分镜: ${payload.storyboardId}` }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      data: {
        storyboard,
        storyboards: mvpStore.listStoryboards(episodeId),
      },
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "更新分镜失败" },
      { status: 400 },
    );
  }
}
