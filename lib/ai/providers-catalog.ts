export const PROVIDER_CATALOG = {
  siliconflow: {
    label: 'SiliconFlow',
    baseUrl: 'https://api.siliconflow.cn/v1',
    envKey: 'SILICONFLOW_API_KEY',
    models: [
      { id: 'Qwen/Qwen2.5-7B-Instruct', label: 'Qwen 2.5 7B Instruct（推荐）' },
      { id: 'Qwen/Qwen2.5-72B-Instruct', label: 'Qwen 2.5 72B Instruct' },
      { id: 'Qwen/Qwen3.5-9B', label: 'Qwen 3.5 9B' },
      { id: 'Qwen/QwQ-32B', label: 'QwQ 32B（深度推理）' },
      { id: 'deepseek-ai/DeepSeek-V3', label: 'DeepSeek V3' },
      { id: 'deepseek-ai/DeepSeek-R1', label: 'DeepSeek R1（推理）' },
      { id: 'THUDM/glm-4-9b-chat', label: 'GLM-4 9B Chat' },
    ],
  },
  google: {
    label: 'Google AI (Gemini)',
    baseUrl: 'https://generativelanguage.googleapis.com',
    envKey: 'GOOGLE_GENERATIVE_AI_API_KEY',
    models: [
      { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash（推荐）' },
      { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
      { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
      { id: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro' },
    ],
  },
  gateway: {
    label: 'Google AI Gateway',
    baseUrl: 'https://generativelanguage.googleapis.com',
    envKey: 'GOOGLE_GENERATIVE_AI_API_KEY',
    models: [
      { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash（推荐）' },
      { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
      { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
    ],
  },
  mock: {
    label: 'Mock（本地测试，无需 API Key）',
    baseUrl: null,
    envKey: null,
    models: [
      { id: 'mock', label: 'Mock Model' },
    ],
  },
} as const;

export const IMAGE_MODEL_CATALOG = [
  { id: 'Kwai-Kolors/Kolors',   label: 'Kolors',     provider: 'SiliconFlow', supportsRefImages: false, noImageSize: false },
  { id: 'Qwen/Qwen-Image',      label: 'Qwen Image', provider: 'SiliconFlow', supportsRefImages: false, noImageSize: false },
] as const;

export const IMAGE_MODEL_EXTRA = [
  { id: 'black-forest-labs/FLUX.1-schnell',      label: 'FLUX.1 Schnell',     provider: 'SiliconFlow', supportsRefImages: false, noImageSize: false },
  { id: 'black-forest-labs/FLUX.1-dev',          label: 'FLUX.1 Dev',         provider: 'SiliconFlow', supportsRefImages: false, noImageSize: false },
  { id: 'black-forest-labs/FLUX.2-flex',         label: 'FLUX.2 Flex',        provider: 'SiliconFlow', supportsRefImages: true,  noImageSize: false },
  { id: 'black-forest-labs/FLUX.1-Kontext-dev',  label: 'FLUX.1 Kontext Dev', provider: 'SiliconFlow', supportsRefImages: true,  noImageSize: false },
  { id: 'black-forest-labs/FLUX.1-Kontext-pro',  label: 'FLUX.1 Kontext Pro', provider: 'SiliconFlow', supportsRefImages: true,  noImageSize: false },
] as const;

export type ImageModelId = (typeof IMAGE_MODEL_CATALOG)[number]['id'];
export const DEFAULT_IMAGE_MODEL_ID: ImageModelId = 'Kwai-Kolors/Kolors';

export type ProviderId = keyof typeof PROVIDER_CATALOG;

export const PROVIDER_IDS = Object.keys(PROVIDER_CATALOG) as ProviderId[];

export function getProviderLabel(id: ProviderId) {
  return PROVIDER_CATALOG[id].label;
}

export function getProviderModels(id: ProviderId) {
  return PROVIDER_CATALOG[id].models as readonly { id: string; label: string }[];
}

export function getDefaultModelForProvider(id: ProviderId) {
  return PROVIDER_CATALOG[id].models[0]?.id ?? '';
}
