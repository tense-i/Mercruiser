import { NextResponse } from 'next/server';

const localHosts = new Set(['localhost', '127.0.0.1', '0.0.0.0']);

export function assertLocalMutationRequest(request: Request) {
  if (process.env.MERCRUISER_ALLOW_REMOTE_WRITE === 'true') {
    return null;
  }

  const url = new URL(request.url);
  if (localHosts.has(url.hostname)) {
    return null;
  }

  return NextResponse.json(
    {
      ok: false,
      error: 'Remote writes are disabled by default for this local-first workspace.',
    },
    { status: 403 },
  );
}
