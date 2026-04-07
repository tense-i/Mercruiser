import { generateText } from 'ai';
import { NextResponse } from 'next/server';

import { getStudioModel } from '@/lib/ai/provider';
import { assertLocalMutationRequest } from '@/lib/server/request-guard';

export async function POST(request: Request) {
  const guard = assertLocalMutationRequest(request);
  if (guard) return guard;

  let body: { mode?: string; model?: string; apiKey?: string; baseUrl?: string; providerType?: 'openai' | 'google' };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid request body' }, { status: 400 });
  }

  const { mode, model, apiKey, baseUrl, providerType } = body;

  if (!mode || mode === 'mock') {
    return NextResponse.json({ ok: true, latencyMs: 0, message: 'Mock 模式无需测试，直接可用。' });
  }

  const start = Date.now();
  try {
    const aiModel = getStudioModel({
      settingsMode: mode,
      settingsModel: model,
      apiKey: apiKey || null,
      baseUrl: baseUrl || null,
      providerType: providerType || null,
    });

    const result = await generateText({
      model: aiModel,
      prompt: 'Reply with exactly: ok',
      maxOutputTokens: 16,
    });

    const latencyMs = Date.now() - start;
    const replyText = result.text?.trim().toLowerCase() ?? '';
    const success = replyText.length > 0;

    return NextResponse.json({
      ok: success,
      latencyMs,
      message: success
        ? `连接成功，响应时间 ${latencyMs}ms`
        : '连接成功但返回为空，请检查模型配置。',
      reply: result.text,
    });
  } catch (error) {
    const latencyMs = Date.now() - start;
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { ok: false, latencyMs, error: message, message: `连接失败：${message}` },
      { status: 200 },
    );
  }
}
