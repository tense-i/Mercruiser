import { NextResponse } from "next/server";
import { z } from "zod";
import { mvpStore } from "@/server/infrastructure/sqlite/store";

type Params = {
  params: Promise<{ episodeId: string }>;
};

const postSchema = z.object({
  chapterId: z.string().optional(),
  scene: z.string().optional(),
  description: z.string().optional(),
});

const patchSchema = z.object({
  shotId: z.string().min(1),
  chapterId: z.string().nullable().optional(),
  shotCode: z.string().min(1).optional(),
  scene: z.string().optional(),
  shotSize: z.string().optional(),
  composition: z.string().optional(),
  cameraMovement: z.string().optional(),
  lighting: z.string().optional(),
  description: z.string().optional(),
  soundEffect: z.string().optional(),
  dialogue: z.string().optional(),
  durationSeconds: z.number().int().min(1).max(60).optional(),
  status: z.enum(["draft", "ready", "locked"]).optional(),
  orderIndex: z.number().int().min(0).optional(),
  locked: z.boolean().optional(),
});

export async function GET(_: Request, context: Params) {
  const { episodeId } = await context.params;
  return NextResponse.json({
    ok: true,
    data: mvpStore.listEpisodeShots(episodeId),
  });
}

export async function POST(request: Request, context: Params) {
  try {
    const { episodeId } = await context.params;
    const episode = mvpStore.getEpisode(episodeId);
    if (!episode) {
      return NextResponse.json({ ok: false, error: `未找到集数: ${episodeId}` }, { status: 404 });
    }

    const payload = postSchema.parse(await request.json());
    const shot = mvpStore.createEpisodeShot({
      episodeId,
      chapterId: payload.chapterId,
      scene: payload.scene,
      description: payload.description,
    });

    return NextResponse.json({
      ok: true,
      data: {
        shot,
        shots: mvpStore.listEpisodeShots(episodeId),
      },
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "创建镜头失败" },
      { status: 400 },
    );
  }
}

export async function PATCH(request: Request, context: Params) {
  try {
    const { episodeId } = await context.params;
    const payload = patchSchema.parse(await request.json());
    const current = mvpStore.listEpisodeShots(episodeId).find((shot) => shot.id === payload.shotId);
    if (!current) {
      return NextResponse.json({ ok: false, error: `未找到镜头: ${payload.shotId}` }, { status: 404 });
    }

    const shot = mvpStore.saveEpisodeShot({
      id: current.id,
      episodeId,
      chapterId: payload.chapterId ?? current.chapterId,
      shotCode: payload.shotCode ?? current.shotCode,
      scene: payload.scene ?? current.scene,
      shotSize: payload.shotSize ?? current.shotSize,
      composition: payload.composition ?? current.composition,
      cameraMovement: payload.cameraMovement ?? current.cameraMovement,
      lighting: payload.lighting ?? current.lighting,
      description: payload.description ?? current.description,
      soundEffect: payload.soundEffect ?? current.soundEffect,
      dialogue: payload.dialogue ?? current.dialogue,
      durationSeconds: payload.durationSeconds ?? current.durationSeconds,
      status: payload.status ?? current.status,
      orderIndex: payload.orderIndex ?? current.orderIndex,
      locked: payload.locked ?? current.locked,
    });

    return NextResponse.json({
      ok: true,
      data: {
        shot,
        shots: mvpStore.listEpisodeShots(episodeId),
      },
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "更新镜头失败" },
      { status: 400 },
    );
  }
}
