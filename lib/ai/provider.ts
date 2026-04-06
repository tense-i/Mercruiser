import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';

const supportedAiModes = ['mock', 'google', 'gateway', 'siliconflow'] as const;

export type StudioAiMode = (typeof supportedAiModes)[number];

function isStudioAiMode(value: string | undefined | null): value is StudioAiMode {
  return Boolean(value && supportedAiModes.includes(value as StudioAiMode));
}

function getGoogleApiKey() {
  return process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY;
}

function normalizeModelName(mode: StudioAiMode, configuredModelName: string) {
  const modelName = configuredModelName.trim();
  if (!modelName) {
    return mode === 'siliconflow' ? 'Qwen/Qwen3.5-9B' : 'gemini-2.5-flash';
  }

  if (mode === 'google' || mode === 'gateway') {
    return modelName.replace(/^(google|gateway)\//, '');
  }

  if (mode === 'siliconflow') {
    return modelName.replace(/^siliconflow\//, '');
  }

  return modelName;
}

export function getConfiguredAiMode(input: { settingsMode?: string | null } = {}) {
  if (isStudioAiMode(process.env.MERCRUISER_AI_MODE)) {
    return process.env.MERCRUISER_AI_MODE;
  }

  if (isStudioAiMode(input.settingsMode)) {
    return input.settingsMode;
  }

  if (process.env.SILICONFLOW_API_KEY) {
    return 'siliconflow';
  }

  if (getGoogleApiKey()) {
    return 'google';
  }

  return 'mock';
}

export function hasRealCredentials(mode = getConfiguredAiMode()) {
  if (mode === 'siliconflow') {
    return Boolean(process.env.SILICONFLOW_API_KEY);
  }

  if (mode === 'google' || mode === 'gateway') {
    return Boolean(getGoogleApiKey());
  }

  return false;
}

export function getStudioModelName(input: { settingsMode?: string | null; settingsModel?: string | null } = {}) {
  const mode = getConfiguredAiMode({ settingsMode: input.settingsMode });
  const configuredModelName = process.env.MERCRUISER_AI_MODEL ?? input.settingsModel;

  if (configuredModelName) {
    return normalizeModelName(mode, configuredModelName);
  }

  return mode === 'siliconflow' ? 'Qwen/Qwen3.5-9B' : 'gemini-2.5-flash';
}

export function getStudioModel(input: { settingsMode?: string | null; settingsModel?: string | null } = {}) {
  const mode = getConfiguredAiMode({ settingsMode: input.settingsMode });
  const modelName = getStudioModelName({ settingsMode: mode, settingsModel: input.settingsModel });

  if (mode === 'siliconflow') {
    const apiKey = process.env.SILICONFLOW_API_KEY;
    if (!apiKey) {
      throw new Error('No SiliconFlow credentials configured');
    }

    const provider = createOpenAI({
      apiKey,
      baseURL: 'https://api.siliconflow.cn/v1',
      name: 'siliconflow',
    });
    return provider.chat(modelName) as any;
  }

  if (mode === 'google' || mode === 'gateway') {
    const apiKey = getGoogleApiKey();
    if (!apiKey) {
      throw new Error('No Google AI credentials configured');
    }

    return createGoogleGenerativeAI({ apiKey })(modelName) as any;
  }

  throw new Error('No real AI provider configured');
}
