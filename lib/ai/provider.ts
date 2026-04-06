import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';

export function getConfiguredAiMode() {
  if (process.env.MERCRUISER_AI_MODE) {
    return process.env.MERCRUISER_AI_MODE;
  }

  if (process.env.SILICONFLOW_API_KEY) {
    return 'siliconflow';
  }

  if (process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY) {
    return 'google';
  }

  return 'mock';
}

export function hasRealCredentials() {
  return Boolean(
    process.env.SILICONFLOW_API_KEY ||
      process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
      process.env.GEMINI_API_KEY,
  );
}

export function getStudioModelName() {
  if (getConfiguredAiMode() === 'siliconflow') {
    return process.env.MERCRUISER_AI_MODEL ?? 'Qwen/Qwen3.5-9B';
  }

  return process.env.MERCRUISER_AI_MODEL ?? 'gemini-2.5-flash';
}

export function getStudioModel() {
  const mode = getConfiguredAiMode();

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
    return provider.chat(getStudioModelName()) as any;
  }

  if (mode === 'google' || mode === 'gateway') {
    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('No Google AI credentials configured');
    }

    return createGoogleGenerativeAI({ apiKey })(getStudioModelName()) as any;
  }

  throw new Error('No real AI provider configured');
}
