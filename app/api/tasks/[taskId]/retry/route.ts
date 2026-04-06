import { NextResponse } from 'next/server';

import { studioRepository } from '@/lib/server/repository/studio-repository';
import { assertLocalMutationRequest } from '@/lib/server/request-guard';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ taskId: string }> },
) {
  const guard = assertLocalMutationRequest(request);
  if (guard) {
    return guard;
  }
  const { taskId } = await params;
  const result = await studioRepository.dispatch({
    type: 'retryTask',
    taskId,
  });

  return NextResponse.json({
    ok: true,
    result,
    tasks: (await studioRepository.getWorkspace()).tasks,
  });
}
