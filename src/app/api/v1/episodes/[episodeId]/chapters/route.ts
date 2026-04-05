import { NextResponse } from "next/server";
import { z } from "zod";
import { buildEpisodeScriptWorkspaceView } from "@/server/application/views/series-episode-views";
import { mvpStore } from "@/server/infrastructure/sqlite/store";

type Params = {
  params: Promise<{ episodeId: string }>;
};

const postSchema = z.object({
  title: z.string().min(1).optional(),
  content: z.string().optional(),
});

const patchSchema = z.object({
  chapterId: z.string().min(1),
  title: z.string().min(1).optional(),
  content: z.string().optional(),
  orderIndex: z.number().int().min(0).optional(),
  status: z.enum(["active", "ready", "draft"]).optional(),
});

export async function GET(_: Request, context: Params) {
  const { episodeId } = await context.params;
  return NextResponse.json({
    ok: true,
    data: mvpStore.listEpisodeChapters(episodeId),
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
    const chapter = mvpStore.createEpisodeChapter({
      episodeId,
      title: payload.title,
      content: payload.content,
    });

    return NextResponse.json({
      ok: true,
      data: {
        chapter,
        workspace: buildEpisodeScriptWorkspaceView(episodeId),
      },
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "创建章节失败" },
      { status: 400 },
    );
  }
}

export async function PATCH(request: Request, context: Params) {
  try {
    const { episodeId } = await context.params;
    const episode = mvpStore.getEpisode(episodeId);
    if (!episode) {
      return NextResponse.json({ ok: false, error: `未找到集数: ${episodeId}` }, { status: 404 });
    }

    const payload = patchSchema.parse(await request.json());
    const current = mvpStore.listEpisodeChapters(episodeId).find((chapter) => chapter.id === payload.chapterId);
    if (!current) {
      return NextResponse.json({ ok: false, error: `未找到章节: ${payload.chapterId}` }, { status: 404 });
    }

    const chapter = mvpStore.saveEpisodeChapter({
      id: current.id,
      episodeId,
      chapterCode: current.chapterCode,
      title: payload.title ?? current.title,
      content: payload.content ?? current.content,
      orderIndex: payload.orderIndex ?? current.orderIndex,
      status: payload.status ?? current.status,
    });

    return NextResponse.json({
      ok: true,
      data: {
        chapter,
        workspace: buildEpisodeScriptWorkspaceView(episodeId),
      },
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "更新章节失败" },
      { status: 400 },
    );
  }
}
