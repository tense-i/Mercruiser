const SILICONFLOW_IMAGE_API = 'https://api.siliconflow.cn/v1/images/generations';
const DEFAULT_IMAGE_MODEL = 'Kwai-Kolors/Kolors';
const DEFAULT_IMAGE_SIZE = '1024x576';
const IMAGE_TIMEOUT_MS = 90 * 1000;

const IMAGE_URL_SUPPORTED_MODELS = new Set([
  'black-forest-labs/FLUX.2-flex',
  'black-forest-labs/FLUX.1-Kontext-dev',
  'black-forest-labs/FLUX.1-Kontext-pro',
]);

const NO_IMAGE_SIZE_MODELS = new Set<string>();

function getImageModel(override?: string) {
  return override ?? process.env.SILICONFLOW_IMAGE_MODEL ?? DEFAULT_IMAGE_MODEL;
}

export function modelSupportsImageUrls(modelId: string): boolean {
  return IMAGE_URL_SUPPORTED_MODELS.has(modelId);
}

export interface GenerateImageOptions {
  prompt: string;
  apiKey: string;
  model?: string;
  imageSize?: string;
  steps?: number;
  referenceImageBase64s?: string[];
}

export interface GenerateImageResult {
  url: string;
  model: string;
}

export async function generateImageFromPrompt(options: GenerateImageOptions): Promise<GenerateImageResult> {
  const {
    prompt,
    apiKey,
    model,
    imageSize = DEFAULT_IMAGE_SIZE,
    referenceImageBase64s,
  } = options;

  const resolvedModel = getImageModel(model);
  const canUseRefImages = referenceImageBase64s && referenceImageBase64s.length > 0 && modelSupportsImageUrls(resolvedModel);

  const body: Record<string, unknown> = {
    model: resolvedModel,
    prompt,
    ...(!NO_IMAGE_SIZE_MODELS.has(resolvedModel) && { image_size: imageSize }),
    n: 1,
    ...(canUseRefImages && { image_urls: referenceImageBase64s }),
  };

  const response = await fetch(SILICONFLOW_IMAGE_API, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(IMAGE_TIMEOUT_MS),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Image generation failed (${response.status}): ${body}`);
  }

  const data = (await response.json()) as {
    images?: Array<{ url: string }>;
    data?: Array<{ url: string }>;
  };

  const url = data.images?.[0]?.url ?? data.data?.[0]?.url;
  if (!url) {
    throw new Error('No image URL returned from image generation API');
  }

  return { url, model: resolvedModel };
}

export function buildShotImagePrompt(
  shotPrompt: string,
  referenceAssets: Array<{ name: string; type: string; description: string; prompt: string }>,
  opts: { hasRefImages?: boolean } = {},
): string {
  if (!referenceAssets.length) return shotPrompt;
  const assetLines = referenceAssets
    .filter((a) => a.description || a.prompt)
    .map((a) => {
      const parts: string[] = [];
      if (a.description) parts.push(a.description);
      if (a.prompt && a.prompt !== a.description) parts.push(`Visual: ${a.prompt}`);
      return `- ${a.name} (${a.type}): ${parts.join('. ')}`;
    });
  if (!assetLines.length) return shotPrompt;
  const lines = [
    shotPrompt,
    '',
    'Characters and subjects in this scene (maintain their exact visual appearance, design, and style):',
    ...assetLines,
  ];
  if (!opts.hasRefImages) {
    lines.push('', 'IMPORTANT: Preserve all character and subject appearances exactly as described above.');
  }
  return lines.join('\n');
}

export async function downloadImageToBuffer(url: string): Promise<Buffer> {
  const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`Failed to download image (${response.status})`);
  return Buffer.from(await response.arrayBuffer());
}

export function getSiliconflowApiKey(): string | undefined {
  return process.env.SILICONFLOW_API_KEY;
}
