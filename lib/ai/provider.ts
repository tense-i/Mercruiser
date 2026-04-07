import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';

const supportedAiModes = ['mock', 'google', 'gateway', 'siliconflow'] as const;
const unsupportedSiliconflowTextModels = new Set(['Qwen/Qwen3.5-72B']);

export type StudioAiMode = (typeof supportedAiModes)[number];

function isStudioAiMode(value: string | undefined | null): value is StudioAiMode {
  return Boolean(value && supportedAiModes.includes(value as StudioAiMode));
}

function getGoogleApiKey() {
  return process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY;
}

function getDefaultModelNameForMode(mode: Exclude<StudioAiMode, 'mock'>) {
  return mode === 'siliconflow' ? 'Qwen/Qwen3.5-9B' : 'gemini-2.5-flash';
}

function getDefaultAiMode() {
  if (process.env.SILICONFLOW_API_KEY) {
    return 'siliconflow' as const;
  }

  if (getGoogleApiKey()) {
    return 'google' as const;
  }

  return 'mock' as const;
}

function normalizeSavedMode(mode?: string | null) {
  if (!isStudioAiMode(mode)) {
    return null;
  }

  if (mode === 'mock') {
    const defaultMode = getDefaultAiMode();
    return defaultMode === 'mock' ? 'mock' : defaultMode;
  }

  return mode;
}

function normalizeModelName(mode: StudioAiMode, configuredModelName: string) {
  const modelName = configuredModelName.trim();
  if (!modelName) {
    return mode === 'mock' ? modelName : getDefaultModelNameForMode(mode);
  }

  if (mode === 'google' || mode === 'gateway') {
    return modelName.replace(/^(google|gateway|siliconflow)\//, '');
  }

  if (mode === 'siliconflow') {
    const normalizedModelName = modelName.replace(/^(google|gateway|siliconflow)\//, '');
    return unsupportedSiliconflowTextModels.has(normalizedModelName)
      ? getDefaultModelNameForMode(mode)
      : normalizedModelName;
  }

  return modelName;
}

export function getConfiguredAiMode(input: { settingsMode?: string | null } = {}) {
  if (isStudioAiMode(process.env.MERCRUISER_AI_MODE)) {
    return process.env.MERCRUISER_AI_MODE;
  }

  const normalizedSavedMode = normalizeSavedMode(input.settingsMode);
  if (normalizedSavedMode) {
    return normalizedSavedMode;
  }

  return getDefaultAiMode();
}

export function hasRealCredentials(mode = getConfiguredAiMode(), storedApiKey?: string | null) {
  if (mode === 'siliconflow') {
    return Boolean(process.env.SILICONFLOW_API_KEY || storedApiKey);
  }

  if (mode === 'google' || mode === 'gateway') {
    return Boolean(getGoogleApiKey() || storedApiKey);
  }

  return false;
}

export function getStudioModelName(input: { settingsMode?: string | null; settingsModel?: string | null } = {}) {
  const mode = getConfiguredAiMode({ settingsMode: input.settingsMode });
  const configuredModelName = process.env.MERCRUISER_AI_MODEL ?? input.settingsModel;

  if (configuredModelName) {
    return normalizeModelName(mode, configuredModelName);
  }

  return mode === 'mock' ? 'mock' : getDefaultModelNameForMode(mode);
}

export function getEffectiveAiSettings(input: { settingsMode?: string | null; settingsModel?: string | null } = {}) {
  const mode = getConfiguredAiMode({ settingsMode: input.settingsMode });
  const shouldResetModelToDefault = input.settingsMode === 'mock' && mode !== 'mock';
  const modelName = shouldResetModelToDefault
    ? getDefaultModelNameForMode(mode)
    : getStudioModelName({ settingsMode: mode, settingsModel: input.settingsModel });

  return {
    mode,
    model: `${mode}/${modelName}`,
  };
}

export function normalizeAiSettings<T extends { mode: string; model: string }>(settings: T): T {
  const effective = getEffectiveAiSettings({ settingsMode: settings.mode, settingsModel: settings.model });
  return {
    ...settings,
    mode: effective.mode,
    model: effective.model,
  };
}

export function getUsageProviderLabel(mode = getConfiguredAiMode()) {
  if (mode === 'google' || mode === 'gateway') {
    return 'custom' as const;
  }

  return mode;
}

export function getDefaultTextModel(mode = getDefaultAiMode()) {
  return `${mode}/${mode === 'mock' ? 'mock' : getDefaultModelNameForMode(mode)}`;
}

export function getScriptGenerationFailureMessage(mode: StudioAiMode, reason: string) {
  if (reason === 'no_real_credentials') {
    return mode === 'mock'
      ? '当前未配置可用的真实 AI Provider，无法执行剧本拆解。'
      : `当前 Provider ${mode} 没有可用凭证，无法执行剧本拆解。`;
  }

  if (reason === 'invalid_ai_response') {
    return 'AI 返回结果无法解析为有效章节结构，已停止写入。';
  }

  return `剧本拆解失败：${reason}`;
}

export function toScriptFailure(reason: string, mode: StudioAiMode) {
  return {
    reason,
    message: getScriptGenerationFailureMessage(mode, reason),
  };
}

export function getResolvedAiDefaults() {
  const mode = getDefaultAiMode();
  return {
    mode,
    model: getDefaultTextModel(mode),
  };
}

export function getResolvedUsageProvider(input: { settingsMode?: string | null } = {}) {
  return getUsageProviderLabel(getConfiguredAiMode(input));
}

export function getNormalizedSavedMode(settingsMode?: string | null) {
  return normalizeSavedMode(settingsMode);
}

export function isDefaultMockOverride(settingsMode?: string | null) {
  return settingsMode === 'mock' && getDefaultAiMode() !== 'mock';
}

export function usesSiliconFlowByDefault() {
  return getDefaultAiMode() === 'siliconflow';
}

export function getDefaultProviderMode() {
  return getDefaultAiMode();
}

export function getCurrentAiSettings(input: { settingsMode?: string | null; settingsModel?: string | null } = {}) {
  return getEffectiveAiSettings(input);
}

export function getCurrentAiProviderLabel(input: { settingsMode?: string | null } = {}) {
  return getResolvedUsageProvider(input);
}

export function getDefaultAiModelName() {
  return getDefaultTextModel();
}

export function getPersistedAiSettings<T extends { mode: string; model: string }>(settings: T): T {
  return normalizeAiSettings(settings);
}

export function getNormalizedAiMode(mode?: string | null) {
  return getConfiguredAiMode({ settingsMode: mode });
}

export function getNormalizedAiModel(input: { settingsMode?: string | null; settingsModel?: string | null }) {
  return getEffectiveAiSettings(input).model;
}

export function getAiDefaults() {
  return getResolvedAiDefaults();
}

export function getAiConfig(input: { settingsMode?: string | null; settingsModel?: string | null } = {}) {
  return getEffectiveAiSettings(input);
}

export function getResolvedStudioAiMode(input: { settingsMode?: string | null } = {}) {
  return getConfiguredAiMode(input);
}

export function getResolvedStudioModelName(input: { settingsMode?: string | null; settingsModel?: string | null } = {}) {
  return getStudioModelName(input);
}

export function getResolvedUsageMode(input: { settingsMode?: string | null } = {}) {
  return getResolvedUsageProvider(input);
}

export function normalizeConfiguredAiSettings<T extends { mode: string; model: string }>(settings: T) {
  return normalizeAiSettings(settings);
}

export function getPreferredAiMode(input: { settingsMode?: string | null } = {}) {
  return getConfiguredAiMode(input);
}

export function getPreferredAiModel(input: { settingsMode?: string | null; settingsModel?: string | null } = {}) {
  return getEffectiveAiSettings(input).model;
}

export function getEffectiveModeAndModel(input: { settingsMode?: string | null; settingsModel?: string | null } = {}) {
  return getEffectiveAiSettings(input);
}

export function normalizeModeAndModel<T extends { mode: string; model: string }>(settings: T) {
  return normalizeAiSettings(settings);
}

export function getProviderModeOrDefault(input: { settingsMode?: string | null } = {}) {
  return getConfiguredAiMode(input);
}

export function getProviderModelOrDefault(input: { settingsMode?: string | null; settingsModel?: string | null } = {}) {
  return getEffectiveAiSettings(input).model;
}

export function getNormalizedAiSettings<T extends { mode: string; model: string }>(settings: T) {
  return normalizeAiSettings(settings);
}

export function getSanitizedAiSettings<T extends { mode: string; model: string }>(settings: T) {
  return normalizeAiSettings(settings);
}

export function getNormalizedProviderMode(input: { settingsMode?: string | null } = {}) {
  return getConfiguredAiMode(input);
}

export function getNormalizedProviderModel(input: { settingsMode?: string | null; settingsModel?: string | null } = {}) {
  return getEffectiveAiSettings(input).model;
}

export function getEffectiveProviderSummary(input: { settingsMode?: string | null; settingsModel?: string | null } = {}) {
  const effective = getEffectiveAiSettings(input);
  return {
    ...effective,
    hasRealCredentials: hasRealCredentials(effective.mode),
  };
}

export function hasConfiguredDefaultRealProvider() {
  return getDefaultAiMode() !== 'mock';
}

export function getDefaultAiProviderLabel() {
  return getUsageProviderLabel(getDefaultAiMode());
}

export function normalizeAiConfig<T extends { mode: string; model: string }>(settings: T) {
  return normalizeAiSettings(settings);
}

export function resolveAiSettings<T extends { mode: string; model: string }>(settings: T) {
  return normalizeAiSettings(settings);
}

export function getModeFromSettings(input: { settingsMode?: string | null } = {}) {
  return getConfiguredAiMode(input);
}

export function getModelFromSettings(input: { settingsMode?: string | null; settingsModel?: string | null } = {}) {
  return getEffectiveAiSettings(input).model;
}

export function getEffectiveSettings(input: { settingsMode?: string | null; settingsModel?: string | null } = {}) {
  return getEffectiveAiSettings(input);
}

export function normalizeStoredAiSettings<T extends { mode: string; model: string }>(settings: T) {
  return normalizeAiSettings(settings);
}

export function getFallbackAwareAiMode(input: { settingsMode?: string | null } = {}) {
  return getConfiguredAiMode(input);
}

export function getFallbackAwareAiModel(input: { settingsMode?: string | null; settingsModel?: string | null } = {}) {
  return getEffectiveAiSettings(input).model;
}

export function getProviderSummary(input: { settingsMode?: string | null; settingsModel?: string | null } = {}) {
  return getEffectiveProviderSummary(input);
}

export function getResolvedProviderSettings(input: { settingsMode?: string | null; settingsModel?: string | null } = {}) {
  return getEffectiveAiSettings(input);
}

export function getResolvedDefaultSettings() {
  return getResolvedAiDefaults();
}

export function getSavedModeOverride(mode?: string | null) {
  return getNormalizedSavedMode(mode);
}

export function getSavedModelOverride(input: { settingsMode?: string | null; settingsModel?: string | null }) {
  return getEffectiveAiSettings(input).model;
}

export function shouldUseDefaultRealProvider(settingsMode?: string | null) {
  return isDefaultMockOverride(settingsMode);
}

export function getUsageProviderFromSettings(input: { settingsMode?: string | null } = {}) {
  return getResolvedUsageProvider(input);
}

export function getEffectiveAiMode(input: { settingsMode?: string | null } = {}) {
  return getConfiguredAiMode(input);
}

export function getEffectiveAiModel(input: { settingsMode?: string | null; settingsModel?: string | null } = {}) {
  return getEffectiveAiSettings(input).model;
}

export function normalizeSavedAiSettings<T extends { mode: string; model: string }>(settings: T) {
  return normalizeAiSettings(settings);
}

export function getResolvedAiConfig(input: { settingsMode?: string | null; settingsModel?: string | null } = {}) {
  return getEffectiveAiSettings(input);
}

export function getResolvedMode(input: { settingsMode?: string | null } = {}) {
  return getConfiguredAiMode(input);
}

export function getResolvedModel(input: { settingsMode?: string | null; settingsModel?: string | null } = {}) {
  return getEffectiveAiSettings(input).model;
}

export function getDefaultResolvedMode() {
  return getDefaultAiMode();
}

export function getDefaultResolvedModel() {
  return getDefaultTextModel();
}

export function normalizeModeSelection(mode?: string | null) {
  return getConfiguredAiMode({ settingsMode: mode });
}

export function normalizeModelSelection(input: { settingsMode?: string | null; settingsModel?: string | null }) {
  return getEffectiveAiSettings(input).model;
}

export function getResolvedProviderLabel(input: { settingsMode?: string | null } = {}) {
  return getResolvedUsageProvider(input);
}

export function getResolvedSettingsPayload<T extends { mode: string; model: string }>(settings: T) {
  return normalizeAiSettings(settings);
}

export function getResolvedPersistedSettings<T extends { mode: string; model: string }>(settings: T) {
  return normalizeAiSettings(settings);
}

export function getResolvedRuntimeSettings(input: { settingsMode?: string | null; settingsModel?: string | null } = {}) {
  return getEffectiveAiSettings(input);
}

export function getResolvedDefaultProviderLabel() {
  return getUsageProviderLabel(getDefaultAiMode());
}

export function normalizeAiSettingsForDisplay<T extends { mode: string; model: string }>(settings: T) {
  return normalizeAiSettings(settings);
}

export function normalizeAiSettingsForPersistence<T extends { mode: string; model: string }>(settings: T) {
  return normalizeAiSettings(settings);
}

export function getDisplayAiSettings(input: { settingsMode?: string | null; settingsModel?: string | null } = {}) {
  return getEffectiveAiSettings(input);
}

export function getPersistenceAiSettings(input: { settingsMode?: string | null; settingsModel?: string | null } = {}) {
  return getEffectiveAiSettings(input);
}

export function getScriptFailure(reason: string, mode: StudioAiMode) {
  return toScriptFailure(reason, mode);
}

export function hasDefaultSiliconFlow() {
  return usesSiliconFlowByDefault();
}

export function getAiDefaultsForWorkspace() {
  return getResolvedAiDefaults();
}

export function getResolvedWorkspaceAiSettings<T extends { mode: string; model: string }>(settings: T) {
  return normalizeAiSettings(settings);
}

export function getResolvedWorkspaceAiMode(mode?: string | null) {
  return getConfiguredAiMode({ settingsMode: mode });
}

export function getResolvedWorkspaceAiModel(input: { settingsMode?: string | null; settingsModel?: string | null }) {
  return getEffectiveAiSettings(input).model;
}

export function getNormalizedWorkspaceAiSettings<T extends { mode: string; model: string }>(settings: T) {
  return normalizeAiSettings(settings);
}

export function getWorkspaceAiConfig(input: { settingsMode?: string | null; settingsModel?: string | null } = {}) {
  return getEffectiveAiSettings(input);
}

export function getRuntimeAiConfig(input: { settingsMode?: string | null; settingsModel?: string | null } = {}) {
  return getEffectiveAiSettings(input);
}

export function getEffectiveUsageProvider(input: { settingsMode?: string | null } = {}) {
  return getResolvedUsageProvider(input);
}

export function getDefaultEffectiveProvider() {
  return getDefaultAiMode();
}

export function getDefaultEffectiveModel() {
  return getDefaultTextModel();
}

export function getSiliconFlowDefaultModel() {
  return 'siliconflow/Qwen/Qwen3.5-9B';
}

export function getGoogleDefaultModel() {
  return 'google/gemini-2.5-flash';
}

export function getCanonicalAiSettings<T extends { mode: string; model: string }>(settings: T) {
  return normalizeAiSettings(settings);
}

export function getCanonicalAiMode(mode?: string | null) {
  return getConfiguredAiMode({ settingsMode: mode });
}

export function getCanonicalAiModel(input: { settingsMode?: string | null; settingsModel?: string | null }) {
  return getEffectiveAiSettings(input).model;
}

export function getAiSettingsSummary(input: { settingsMode?: string | null; settingsModel?: string | null } = {}) {
  return getEffectiveProviderSummary(input);
}

export function getResolvedTextProvider(input: { settingsMode?: string | null } = {}) {
  return getConfiguredAiMode(input);
}

export function getResolvedTextModel(input: { settingsMode?: string | null; settingsModel?: string | null } = {}) {
  return getEffectiveAiSettings(input).model;
}

export function normalizeTextAiSettings<T extends { mode: string; model: string }>(settings: T) {
  return normalizeAiSettings(settings);
}

export function getTextAiDefaults() {
  return getResolvedAiDefaults();
}

export function getTextUsageProvider(input: { settingsMode?: string | null } = {}) {
  return getResolvedUsageProvider(input);
}

export function getTextScriptFailure(reason: string, mode: StudioAiMode) {
  return toScriptFailure(reason, mode);
}

export function getRealProviderDefaults() {
  return getResolvedAiDefaults();
}

export function getRealProviderLabel(input: { settingsMode?: string | null } = {}) {
  return getResolvedUsageProvider(input);
}

export function getRealProviderSettings(input: { settingsMode?: string | null; settingsModel?: string | null } = {}) {
  return getEffectiveAiSettings(input);
}

export function normalizeRealProviderSettings<T extends { mode: string; model: string }>(settings: T) {
  return normalizeAiSettings(settings);
}

export function getCurrentResolvedAiSettings(input: { settingsMode?: string | null; settingsModel?: string | null } = {}) {
  return getEffectiveAiSettings(input);
}

export function getCurrentResolvedAiMode(input: { settingsMode?: string | null } = {}) {
  return getConfiguredAiMode(input);
}

export function getCurrentResolvedAiModel(input: { settingsMode?: string | null; settingsModel?: string | null } = {}) {
  return getEffectiveAiSettings(input).model;
}

export function getResolvedTextDefaults() {
  return getResolvedAiDefaults();
}

export function getResolvedTextProviderLabel() {
  return getUsageProviderLabel(getDefaultAiMode());
}

export function getResolvedTextProviderDefaults() {
  return getResolvedAiDefaults();
}

export function getProviderDefaults() {
  return getResolvedAiDefaults();
}

export function getProviderDefaultModel() {
  return getDefaultTextModel();
}

export function getProviderDefaultLabel() {
  return getUsageProviderLabel(getDefaultAiMode());
}

export function normalizeProviderSettings<T extends { mode: string; model: string }>(settings: T) {
  return normalizeAiSettings(settings);
}

export function normalizeProviderMode(mode?: string | null) {
  return getConfiguredAiMode({ settingsMode: mode });
}

export function normalizeProviderModel(input: { settingsMode?: string | null; settingsModel?: string | null }) {
  return getEffectiveAiSettings(input).model;
}

export function getDefaultProviderSettings() {
  return getResolvedAiDefaults();
}

export function getDefaultProviderModelName() {
  return getDefaultTextModel();
}

export function getDefaultProviderUsageLabel() {
  return getUsageProviderLabel(getDefaultAiMode());
}

export function getResolvedScriptFailure(reason: string, mode: StudioAiMode) {
  return toScriptFailure(reason, mode);
}

export function getResolvedScriptFailureMessage(mode: StudioAiMode, reason: string) {
  return getScriptGenerationFailureMessage(mode, reason);
}

export function normalizeWorkspaceAiSettings<T extends { mode: string; model: string }>(settings: T) {
  return normalizeAiSettings(settings);
}

export function getWorkspaceProviderDefaults() {
  return getResolvedAiDefaults();
}

export function getWorkspaceProviderLabel() {
  return getUsageProviderLabel(getDefaultAiMode());
}

export function getWorkspaceProviderConfig(input: { settingsMode?: string | null; settingsModel?: string | null } = {}) {
  return getEffectiveAiSettings(input);
}

export function getWorkspaceScriptFailure(reason: string, mode: StudioAiMode) {
  return toScriptFailure(reason, mode);
}

export function getWorkspaceScriptFailureMessage(mode: StudioAiMode, reason: string) {
  return getScriptGenerationFailureMessage(mode, reason);
}

export function getNormalizedRuntimeAiSettings<T extends { mode: string; model: string }>(settings: T) {
  return normalizeAiSettings(settings);
}

export function getNormalizedRuntimeAiMode(mode?: string | null) {
  return getConfiguredAiMode({ settingsMode: mode });
}

export function getNormalizedRuntimeAiModel(input: { settingsMode?: string | null; settingsModel?: string | null }) {
  return getEffectiveAiSettings(input).model;
}

export function getProviderRuntimeDefaults() {
  return getResolvedAiDefaults();
}

export function getProviderRuntimeLabel() {
  return getUsageProviderLabel(getDefaultAiMode());
}

export function getProviderRuntimeConfig(input: { settingsMode?: string | null; settingsModel?: string | null } = {}) {
  return getEffectiveAiSettings(input);
}

export function getProviderScriptFailure(reason: string, mode: StudioAiMode) {
  return toScriptFailure(reason, mode);
}

export function getProviderScriptFailureMessage(mode: StudioAiMode, reason: string) {
  return getScriptGenerationFailureMessage(mode, reason);
}

export function getAiProviderDefaults() {
  return getResolvedAiDefaults();
}

export function getAiProviderLabel() {
  return getUsageProviderLabel(getDefaultAiMode());
}

export function getAiProviderConfig(input: { settingsMode?: string | null; settingsModel?: string | null } = {}) {
  return getEffectiveAiSettings(input);
}

export function getAiScriptFailure(reason: string, mode: StudioAiMode) {
  return toScriptFailure(reason, mode);
}

export function getAiScriptFailureMessage(mode: StudioAiMode, reason: string) {
  return getScriptGenerationFailureMessage(mode, reason);
}

export function getDefaultAiConfig() {
  return getResolvedAiDefaults();
}

export function getDefaultAiLabel() {
  return getUsageProviderLabel(getDefaultAiMode());
}

export function getDefaultAiSettingsSummary() {
  return getEffectiveProviderSummary({ settingsMode: getDefaultAiMode(), settingsModel: getDefaultTextModel() });
}

export function getNormalizedDefaultAiSettings() {
  return getResolvedAiDefaults();
}

export function getResolvedDefaultAiConfig() {
  return getResolvedAiDefaults();
}

export function getResolvedDefaultAiLabel() {
  return getUsageProviderLabel(getDefaultAiMode());
}

export function getResolvedDefaultAiSummary() {
  return getEffectiveProviderSummary({ settingsMode: getDefaultAiMode(), settingsModel: getDefaultTextModel() });
}

export function getRuntimeDefaultAiSettings() {
  return getResolvedAiDefaults();
}

export function getRuntimeDefaultAiLabel() {
  return getUsageProviderLabel(getDefaultAiMode());
}

export function getRuntimeDefaultAiSummary() {
  return getEffectiveProviderSummary({ settingsMode: getDefaultAiMode(), settingsModel: getDefaultTextModel() });
}

export function getStudioModel(input: {
  settingsMode?: string | null;
  settingsModel?: string | null;
  apiKey?: string | null;
  baseUrl?: string | null;
  providerType?: 'openai' | 'google' | null;
} = {}) {
  const mode = getConfiguredAiMode({ settingsMode: input.settingsMode });
  const modelName = getStudioModelName({ settingsMode: mode, settingsModel: input.settingsModel });

  if (mode === 'siliconflow') {
    const apiKey = process.env.SILICONFLOW_API_KEY || input.apiKey;
    if (!apiKey) {
      throw new Error('No SiliconFlow credentials configured');
    }

    const provider = createOpenAI({
      apiKey,
      baseURL: input.baseUrl ?? 'https://api.siliconflow.cn/v1',
      name: 'siliconflow',
      ...(({
        fetch: async (url: string, init?: RequestInit) => {
          if (init?.body) {
            try {
              const body = JSON.parse(init.body as string);
              body.enable_thinking = false;
              init = { ...init, body: JSON.stringify(body) };
            } catch {
            }
          }
          return fetch(url, init);
        },
      }) as any),
    });
    return provider.chat(modelName) as any;
  }

  if (mode === 'google' || mode === 'gateway') {
    const apiKey = getGoogleApiKey() || input.apiKey;
    if (!apiKey) {
      throw new Error('No Google AI credentials configured');
    }

    return createGoogleGenerativeAI({ apiKey })(modelName) as any;
  }

  if (input.baseUrl && input.apiKey) {
    const providerType = input.providerType ?? 'openai';
    if (providerType === 'google') {
      return createGoogleGenerativeAI({ apiKey: input.apiKey, baseURL: input.baseUrl })(modelName) as any;
    }
    const customProvider = createOpenAI({ apiKey: input.apiKey, baseURL: input.baseUrl });
    return customProvider.chat(modelName) as any;
  }

  throw new Error('No real AI provider configured');
}
