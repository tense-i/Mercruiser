import { afterEach, describe, expect, it } from 'vitest';

import { getConfiguredAiMode, getStudioModelName, hasRealCredentials } from '@/lib/ai/provider';

const originalEnv = {
  MERCRUISER_AI_MODE: process.env.MERCRUISER_AI_MODE,
  MERCRUISER_AI_MODEL: process.env.MERCRUISER_AI_MODEL,
  SILICONFLOW_API_KEY: process.env.SILICONFLOW_API_KEY,
  GOOGLE_GENERATIVE_AI_API_KEY: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
  GEMINI_API_KEY: process.env.GEMINI_API_KEY,
};

function resetAiEnv() {
  process.env.MERCRUISER_AI_MODE = originalEnv.MERCRUISER_AI_MODE;
  process.env.MERCRUISER_AI_MODEL = originalEnv.MERCRUISER_AI_MODEL;
  process.env.SILICONFLOW_API_KEY = originalEnv.SILICONFLOW_API_KEY;
  process.env.GOOGLE_GENERATIVE_AI_API_KEY = originalEnv.GOOGLE_GENERATIVE_AI_API_KEY;
  process.env.GEMINI_API_KEY = originalEnv.GEMINI_API_KEY;
}

describe('ai provider config', () => {
  afterEach(() => {
    resetAiEnv();
  });

  it('uses persisted settings mode when no env override is present', () => {
    delete process.env.MERCRUISER_AI_MODE;
    delete process.env.SILICONFLOW_API_KEY;
    delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    delete process.env.GEMINI_API_KEY;

    expect(getConfiguredAiMode({ settingsMode: 'siliconflow' })).toBe('siliconflow');
  });

  it('checks credentials against the selected provider mode', () => {
    delete process.env.MERCRUISER_AI_MODE;
    delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    process.env.SILICONFLOW_API_KEY = 'test-key';

    expect(hasRealCredentials('siliconflow')).toBe(true);
    expect(hasRealCredentials('google')).toBe(false);
  });

  it('normalizes provider-prefixed model names from saved settings', () => {
    delete process.env.MERCRUISER_AI_MODEL;

    expect(getStudioModelName({ settingsMode: 'google', settingsModel: 'google/gemini-2.5-flash' })).toBe(
      'gemini-2.5-flash',
    );
    expect(getStudioModelName({ settingsMode: 'siliconflow', settingsModel: 'siliconflow/Qwen/Qwen3.5-9B' })).toBe(
      'Qwen/Qwen3.5-9B',
    );
  });
});
