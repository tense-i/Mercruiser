import { NextResponse } from "next/server";
import { mvpStore } from "@/server/mvp/store";

type Params = {
  params: Promise<{ episodeId: string }>;
};

export async function GET(_: Request, context: Params) {
  const { episodeId } = await context.params;
  const snapshot = mvpStore.getEpisodeSnapshot(episodeId);
  if (!snapshot) {
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
    data: snapshot,
  });
}

