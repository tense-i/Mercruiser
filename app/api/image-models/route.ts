import { NextResponse } from 'next/server';
import { IMAGE_MODEL_CATALOG, IMAGE_MODEL_EXTRA } from '@/lib/ai/providers-catalog';

const SILICONFLOW_CANDIDATES = [...IMAGE_MODEL_CATALOG, ...IMAGE_MODEL_EXTRA].filter(
  (m) => m.provider === 'SiliconFlow',
);
const VOLCENGINE_CANDIDATES = IMAGE_MODEL_EXTRA.filter((m) => m.provider === 'Volcengine');

async function probeSiliconflow(apiKey: string) {
  try {
    const res = await fetch('https://api.siliconflow.cn/v1/models', {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [...IMAGE_MODEL_CATALOG];
    const data = (await res.json()) as { data?: Array<{ id: string }> };
    const accountIds = new Set((data.data ?? []).map((m) => m.id));
    const available = SILICONFLOW_CANDIDATES.filter((m) => accountIds.has(m.id));
    return available.length > 0 ? available : [...IMAGE_MODEL_CATALOG];
  } catch {
    return [...IMAGE_MODEL_CATALOG];
  }
}

export async function GET() {
  const sfKey = process.env.SILICONFLOW_API_KEY;
  const veKey = process.env.VOLCENGINE_API_KEY;

  const [sfModels, veModels] = await Promise.all([
    sfKey ? probeSiliconflow(sfKey) : Promise.resolve([...IMAGE_MODEL_CATALOG]),
    veKey ? Promise.resolve([...VOLCENGINE_CANDIDATES]) : Promise.resolve([]),
  ]);

  const models = [...sfModels, ...veModels];
  return NextResponse.json({ models: models.length > 0 ? models : [...IMAGE_MODEL_CATALOG] });
}
