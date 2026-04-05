import { NextResponse } from "next/server";
import { mvpStore } from "@/server/infrastructure/sqlite/store";
import type { EpisodeStage, TaskRecord } from "@/server/mvp/types";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const episodeId = searchParams.get("episodeId") ?? undefined;
  const seriesId = searchParams.get("seriesId") ?? undefined;
  const stage = searchParams.get("stage") ?? undefined;
  const status = searchParams.get("status") ?? undefined;
  const tasks = mvpStore.listTasks({
    episodeId,
    seriesId,
    stage: stage as EpisodeStage | undefined,
    status: status as TaskRecord["status"] | undefined,
  });
  return NextResponse.json({
    ok: true,
    data: tasks,
  });
}
