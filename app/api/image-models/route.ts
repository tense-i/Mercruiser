import { NextResponse } from 'next/server';
import { IMAGE_MODEL_CATALOG, IMAGE_MODEL_EXTRA } from '@/lib/ai/providers-catalog';

const ALL_CANDIDATES = [...IMAGE_MODEL_CATALOG, ...IMAGE_MODEL_EXTRA];

export async function GET() {
  const apiKey = process.env.SILICONFLOW_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ models: [...IMAGE_MODEL_CATALOG] });
  }

  try {
    const res = await fetch('https://api.siliconflow.cn/v1/models', {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return NextResponse.json({ models: [...IMAGE_MODEL_CATALOG] });

    const data = (await res.json()) as { data?: Array<{ id: string }> };
    const accountIds = new Set((data.data ?? []).map((m) => m.id));

    const available = ALL_CANDIDATES.filter((m) => accountIds.has(m.id));
    return NextResponse.json({ models: available.length > 0 ? available : [...IMAGE_MODEL_CATALOG] });
  } catch {
    return NextResponse.json({ models: [...IMAGE_MODEL_CATALOG] });
  }
}
