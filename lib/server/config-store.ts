import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { parse as parseTOML, stringify as stringifyTOML } from 'smol-toml';

export interface ProviderEntry {
  id: string;
  label: string;
  baseUrl: string;
  apiKey: string;
  enabled: boolean;
  type: 'openai' | 'google';
  models: string[];
  isCustom?: boolean;
}

export interface MercruiserConfig {
  defaultProviderId: string;
  defaultModel: string;
  providers: ProviderEntry[];
}

const CONFIG_DIR = path.join(os.homedir(), '.mercruiser');
const CONFIG_PATH = path.join(CONFIG_DIR, 'config.toml');

const DEFAULT_PROVIDERS: ProviderEntry[] = [
  {
    id: 'siliconflow',
    label: 'SiliconFlow',
    baseUrl: 'https://api.siliconflow.cn/v1',
    apiKey: '',
    enabled: true,
    type: 'openai',
    models: [
      'Qwen/Qwen2.5-7B-Instruct',
      'Qwen/Qwen2.5-72B-Instruct',
      'Qwen/QwQ-32B',
      'deepseek-ai/DeepSeek-V3',
      'deepseek-ai/DeepSeek-R1',
    ],
  },
  {
    id: 'google',
    label: 'Google AI (Gemini)',
    baseUrl: 'https://generativelanguage.googleapis.com',
    apiKey: '',
    enabled: true,
    type: 'google',
    models: ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash', 'gemini-1.5-pro'],
  },
  {
    id: 'gateway',
    label: 'Google AI Gateway',
    baseUrl: 'https://generativelanguage.googleapis.com',
    apiKey: '',
    enabled: false,
    type: 'google',
    models: ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash'],
  },
];

const DEFAULT_CONFIG: MercruiserConfig = {
  defaultProviderId: 'siliconflow',
  defaultModel: 'Qwen/Qwen2.5-7B-Instruct',
  providers: DEFAULT_PROVIDERS,
};

function toTomlObject(config: MercruiserConfig): Record<string, unknown> {
  return {
    default: {
      provider: config.defaultProviderId,
      model: config.defaultModel,
    },
    providers: config.providers.map((p) => ({
      id: p.id,
      label: p.label,
      base_url: p.baseUrl,
      api_key: p.apiKey,
      enabled: p.enabled,
      type: p.type,
      models: p.models,
      is_custom: p.isCustom ?? false,
    })),
  };
}

function fromTomlObject(raw: Record<string, unknown>): MercruiserConfig {
  const def = (raw.default ?? {}) as Record<string, unknown>;
  const rawProviders = Array.isArray(raw.providers) ? raw.providers : [];

  const providers: ProviderEntry[] = rawProviders.map((p: Record<string, unknown>) => ({
    id: String(p.id ?? ''),
    label: String(p.label ?? ''),
    baseUrl: String(p.base_url ?? ''),
    apiKey: String(p.api_key ?? ''),
    enabled: Boolean(p.enabled ?? true),
    type: (p.type === 'google' ? 'google' : 'openai') as ProviderEntry['type'],
    models: Array.isArray(p.models) ? p.models.map(String) : [],
    isCustom: Boolean(p.is_custom ?? false),
  }));

  return {
    defaultProviderId: String(def.provider ?? 'siliconflow'),
    defaultModel: String(def.model ?? 'Qwen/Qwen2.5-7B-Instruct'),
    providers: providers.length > 0 ? providers : DEFAULT_PROVIDERS,
  };
}

export async function readConfig(): Promise<MercruiserConfig> {
  try {
    const raw = await fs.readFile(CONFIG_PATH, 'utf8');
    const parsed = parseTOML(raw) as Record<string, unknown>;
    return fromTomlObject(parsed);
  } catch {
    return { ...DEFAULT_CONFIG, providers: DEFAULT_PROVIDERS.map((p) => ({ ...p })) };
  }
}

export async function writeConfig(config: MercruiserConfig): Promise<void> {
  await fs.mkdir(CONFIG_DIR, { recursive: true });
  const toml = stringifyTOML(toTomlObject(config));
  const tmp = `${CONFIG_PATH}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tmp, toml, 'utf8');
  await fs.rename(tmp, CONFIG_PATH);
}

export function getEffectiveApiKey(entry: ProviderEntry): string | undefined {
  if (entry.apiKey) return entry.apiKey;
  if (entry.id === 'siliconflow') return process.env.SILICONFLOW_API_KEY ?? undefined;
  if (entry.id === 'google' || entry.id === 'gateway') {
    return process.env.GOOGLE_GENERATIVE_AI_API_KEY ?? process.env.GEMINI_API_KEY ?? undefined;
  }
  return undefined;
}
