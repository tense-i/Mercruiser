import { NextResponse } from "next/server";
import { mvpStore } from "@/server/mvp/store";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const episodeId = searchParams.get("episodeId") ?? undefined;
  const tasks = mvpStore.listTasks(episodeId);
  return NextResponse.json({
    ok: true,
    data: tasks,
  });
}

