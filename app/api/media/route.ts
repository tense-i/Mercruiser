import { NextResponse } from 'next/server';
import { join } from 'node:path';
import { readFile } from 'node:fs/promises';

import { MEDIA_ROOT } from '@/lib/server/media-store';

const MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const pathParam = searchParams.get('path') ?? '';

  const safePath = pathParam.replace(/\.\./g, '').replace(/^\/+/, '');
  if (!safePath) return new NextResponse(null, { status: 400 });

  const fullPath = join(MEDIA_ROOT, safePath);

  try {
    const data = await readFile(fullPath);
    const ext = safePath.split('.').pop()?.toLowerCase() ?? 'jpg';
    return new NextResponse(data, {
      headers: {
        'Content-Type': MIME[ext] ?? 'image/jpeg',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}
