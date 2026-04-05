import { NextResponse } from "next/server";
import { z } from "zod";
import { buildEpisodeScriptWorkspaceView } from "@/server/application/views/series-episode-views";
import { mvpStore } from "@/server/infrastructure/sqlite/store";

type Params = {
  params: Promise<{ episodeId: string }>;
};

export async function GET(_: Request, context: Params) {
  const { episodeId } = await context.params;
  const workspace = buildEpisodeScriptWorkspaceView(episodeId);
  if (!workspace) {
    return NextResponse.json(
      {
        ok: false,
        error: `未找到集数: ${episodeId}`,
      },
      { status: 404 },
    );
  }

  return NextResponse.json({
    ok: true,
    data: workspace,
  });
}

const patchSchema = z.object({
  scriptText: z.string().optional(),
  chapterDrafts: z.record(z.string(), z.string()).optional(),
  targetWords: z.number().int().min(100).max(10000).optional(),
  chapterCursor: z.string().optional(),
  config: z
    .object({
      aspectRatio: z.enum(["16:9", "9:16", "4:3", "3:4"]).optional(),
      creationMode: z.enum(["image_to_video", "reference_video"]).optional(),
      visualTone: z.enum(["realistic", "anime"]).optional(),
    })
    .optional(),
});

export async function PATCH(request: Request, context: Params) {
  try {
    const { episodeId } = await context.params;
    const episode = mvpStore.getEpisode(episodeId);
    if (!episode) {
      return NextResponse.json(
        {
          ok: false,
          error: `未找到集数: ${episodeId}`,
        },
        { status: 404 },
      );
    }

    const payload = patchSchema.parse(await request.json());
    if (payload.chapterDrafts && Object.keys(payload.chapterDrafts).length > 0) {
      const chapters = mvpStore.listEpisodeChapters(episodeId);
      const missingDraftEntries = Object.entries(payload.chapterDrafts).filter(
        ([chapterId]) => !chapters.some((chapter) => chapter.id === chapterId),
      );

      for (const [chapterId, content] of missingDraftEntries) {
        if (chapterId === episodeId) {
          mvpStore.saveEpisodeChapter({
            id: episodeId,
            episodeId,
            chapterCode: "第1章",
            title: episode.title,
            content,
            orderIndex: 0,
            status: payload.chapterCursor === episodeId ? "active" : "ready",
          });
        }
      }

      const nextChapters = mvpStore.listEpisodeChapters(episodeId).map((chapter) =>
        mvpStore.saveEpisodeChapter({
          id: chapter.id,
          episodeId,
          chapterCode: chapter.chapterCode,
          title: chapter.title,
          content: payload.chapterDrafts?.[chapter.id] ?? chapter.content,
          orderIndex: chapter.orderIndex,
          status: chapter.id === payload.chapterCursor ? "active" : (payload.chapterDrafts?.[chapter.id] ?? chapter.content).trim() ? "ready" : "draft",
        }),
      );
      const aggregatedScript = nextChapters
        .sort((a, b) => a.orderIndex - b.orderIndex)
        .map((chapter) => `${chapter.chapterCode} · ${chapter.title}\n\n${chapter.content}`.trim())
        .join("\n\n");
      mvpStore.saveScript(episodeId, {
        strategy: "基于章节草稿保存剧本版本",
        outline: nextChapters.map((chapter) => chapter.title),
        scriptText: aggregatedScript,
      });
      if (episode.stage === "planning" || episode.stage === "script") {
        mvpStore.updateEpisodeStage(episodeId, "assets", "ready");
      }
    } else if (payload.scriptText && payload.scriptText.trim().length > 0) {
      const latest = mvpStore.getLatestScript(episodeId);
      mvpStore.saveScript(episodeId, {
        strategy: latest?.strategy ?? "人工编辑保存剧本版本",
        outline: latest?.outline ?? ["手工保存版本"],
        scriptText: payload.scriptText.trim(),
      });
      if (episode.stage === "planning" || episode.stage === "script") {
        mvpStore.updateEpisodeStage(episodeId, "assets", "ready");
      }
    }

    if (payload.targetWords || payload.chapterCursor || payload.config) {
      mvpStore.saveEpisodeScriptWorkspaceConfig({
        episodeId,
        targetWords: payload.targetWords,
        chapterCursor: payload.chapterCursor,
        aspectRatio: payload.config?.aspectRatio,
        creationMode: payload.config?.creationMode,
        visualTone: payload.config?.visualTone,
      });
    }

    const workspace = buildEpisodeScriptWorkspaceView(episodeId);
    return NextResponse.json({
      ok: true,
      data: workspace,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "保存剧本失败",
      },
      { status: 400 },
    );
  }
}
