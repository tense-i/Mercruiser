import { NextResponse } from "next/server";
import {
  runAssetsStage,
  runEntitiesStage,
  runFinalCutStage,
  runScriptStage,
  runStoryboardStage,
  runVideoStage,
} from "@/server/application/orchestrators/episode-pipeline";
import { buildEpisodeStudioView } from "@/server/application/views/series-episode-views";
import { mvpStore } from "@/server/infrastructure/sqlite/store";
import type { EpisodeSnapshot, EpisodeStage } from "@/server/mvp/types";

type Params = {
  params: Promise<{ taskId: string }>;
};

async function rerunStage(taskId: string, stage: EpisodeStage, episodeId: string): Promise<EpisodeSnapshot> {
  if (stage === "planning") {
    return runEntitiesStage({ episodeId });
  }
  if (stage === "script") {
    return runScriptStage({ episodeId });
  }
  if (stage === "assets") {
    return runAssetsStage({ episodeId });
  }
  if (stage === "storyboard") {
    return runStoryboardStage({ episodeId });
  }
  if (stage === "video") {
    return runVideoStage({ episodeId });
  }
  if (stage === "review" || stage === "export") {
    return runFinalCutStage({ episodeId });
  }

  throw new Error(`任务 ${taskId} 的阶段 ${stage} 暂不支持重新执行`);
}

export async function POST(_request: Request, context: Params) {
  try {
    const { taskId } = await context.params;
    const task = mvpStore.getTask(taskId);

    if (!task) {
      return NextResponse.json(
        {
          ok: false,
          error: "任务不存在",
        },
        { status: 404 },
      );
    }

    const snapshot = await rerunStage(task.id, task.stage, task.episodeId);

    return NextResponse.json({
      ok: true,
      data: {
        message: `${task.action} 已重新触发`,
        episodeStudio: buildEpisodeStudioView(snapshot.episode.id),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "重新执行失败";
    return NextResponse.json(
      {
        ok: false,
        error: message,
      },
      { status: 400 },
    );
  }
}
