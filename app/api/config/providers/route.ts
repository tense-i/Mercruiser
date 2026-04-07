import { NextResponse } from 'next/server';

import { readConfig, writeConfig } from '@/lib/server/config-store';
import type { MercruiserConfig } from '@/lib/server/config-store';
import { assertLocalMutationRequest } from '@/lib/server/request-guard';

export async function GET() {
  try {
    const config = await readConfig();
    return NextResponse.json(config);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '读取配置失败' },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const guard = assertLocalMutationRequest(request);
  if (guard) return guard;

  let body: MercruiserConfig;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  try {
    await writeConfig(body);
    const saved = await readConfig();
    return NextResponse.json(saved);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '保存配置失败' },
      { status: 500 },
    );
  }
}
