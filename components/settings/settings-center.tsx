'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Eye,
  EyeOff,
  Loader2,
  Plus,
  Settings2,
  Star,
  Trash2,
  Zap,
} from 'lucide-react';

import { normalizeAiSettings } from '@/lib/ai/provider';
import type { MercruiserConfig, ProviderEntry } from '@/lib/server/config-store';
import type { APIUsageRecord, GenerationPreset, Settings, UsageAlert } from '@/lib/domain/types';

type TestStatus = 'idle' | 'testing' | 'ok' | 'error';

interface ProviderTestResult {
  ok: boolean;
  latencyMs?: number;
  message: string;
}

type NavTab = 'providers' | 'ai' | 'workspace' | 'advanced';

const NAV_ITEMS: { id: NavTab; label: string }[] = [
  { id: 'providers', label: 'AI 供应商' },
  { id: 'ai', label: 'AI 默认设置' },
  { id: 'workspace', label: 'Workspace' },
  { id: 'advanced', label: '高级 / 用量' },
];

const newCustomProvider = (): ProviderEntry => ({
  id: `custom-${Date.now()}`,
  label: '自定义供应商',
  baseUrl: '',
  apiKey: '',
  enabled: true,
  type: 'openai',
  models: [],
  isCustom: true,
});

export function SettingsCenter({
  initialSettings,
  usageRecords,
  usageAlerts,
  generationPresets,
  globalAssetCount,
}: {
  initialSettings: Settings;
  usageRecords: APIUsageRecord[];
  usageAlerts: UsageAlert[];
  generationPresets: GenerationPreset[];
  globalAssetCount: number;
}) {
  const [activeTab, setActiveTab] = useState<NavTab>('providers');
  const [settings, setSettings] = useState({
    ...initialSettings,
    ai: normalizeAiSettings(initialSettings.ai),
  });
  const [config, setConfig] = useState<MercruiserConfig | null>(null);
  const [configStatus, setConfigStatus] = useState<'loading' | 'idle' | 'saving' | 'saved' | 'error'>('loading');
  const [wsStatus, setWsStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const usageSummary = useMemo(
    () => ({
      totalCost: usageRecords.reduce((sum, record) => sum + (record.estimatedCost ?? 0), 0),
      requestCount: usageRecords.length,
      latestRecords: usageRecords.slice(0, 5),
    }),
    [usageRecords],
  );

  useEffect(() => {
    void fetch('/api/config/providers')
      .then((r) => r.json())
      .then((data: MercruiserConfig) => {
        setConfig(data);
        setConfigStatus('idle');
      })
      .catch(() => setConfigStatus('error'));
  }, []);

  async function saveConfig() {
    if (!config) return;
    setConfigStatus('saving');
    try {
      const r = await fetch('/api/config/providers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      const saved: MercruiserConfig = await r.json();
      setConfig(saved);
      setConfigStatus('saved');
      setTimeout(() => setConfigStatus('idle'), 2000);
    } catch {
      setConfigStatus('error');
    }
  }

  async function saveWorkspaceSettings() {
    setWsStatus('saving');
    try {
      const r = await fetch('/api/studio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: { type: 'updateSettings', settings }, context: { refreshSettings: true } }),
      });
      const payload = await r.json();
      if (!r.ok || !payload.settings) throw new Error(payload.error ?? '保存失败');
      setSettings(payload.settings);
      setWsStatus('saved');
      setTimeout(() => setWsStatus('idle'), 2000);
    } catch (e) {
      setWsStatus('error');
      setErrorMessage(e instanceof Error ? e.message : '保存失败');
    }
  }

  function patchProvider(id: string, patch: Partial<ProviderEntry>) {
    setConfig((prev) => {
      if (!prev) return prev;
      return { ...prev, providers: prev.providers.map((p) => (p.id === id ? { ...p, ...patch } : p)) };
    });
  }

  function addCustomProvider() {
    setConfig((prev) => {
      if (!prev) return prev;
      return { ...prev, providers: [...prev.providers, newCustomProvider()] };
    });
  }

  function removeProvider(id: string) {
    setConfig((prev) => {
      if (!prev) return prev;
      return { ...prev, providers: prev.providers.filter((p) => p.id !== id) };
    });
  }

  const inputCls = 'w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-white/20 focus:border-[#f2dfbe]/40';
  const btnCls = 'rounded-full border border-white/10 bg-white/[0.03] px-4 py-1.5 text-xs text-white/70 transition hover:border-[#f2dfbe]/30 hover:text-white';

  return (
    <div className="flex min-h-0 gap-0 rounded-3xl border border-white/10 bg-[#0f131a] shadow-[0_20px_80px_rgba(0,0,0,0.25)]">
      {/* ── Sidebar ── */}
      <nav className="flex w-44 shrink-0 flex-col border-r border-white/6 py-4">
        <p className="px-5 pb-3 text-[10px] uppercase tracking-widest text-white/25">设置</p>
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setActiveTab(item.id)}
            className={`flex items-center gap-2 px-5 py-2.5 text-left text-sm transition ${activeTab === item.id ? 'text-white' : 'text-white/40 hover:text-white/70'}`}
          >
            {activeTab === item.id && <ChevronRight size={12} className="shrink-0 text-[#f2dfbe]" />}
            {activeTab !== item.id && <span className="w-3" />}
            {item.label}
          </button>
        ))}
      </nav>

      {/* ── Content ── */}
      <div className="min-w-0 flex-1 overflow-y-auto p-6">
        {errorMessage && (
          <div className="mb-4 rounded-xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{errorMessage}</div>
        )}

        {/* ════ Providers ════ */}
        {activeTab === 'providers' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-medium text-white">AI 供应商</h2>
                <p className="mt-0.5 text-xs text-white/35">
                  配置好后点击"保存"写入 <code className="text-white/50">~/.mercruiser/config.toml</code>
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={addCustomProvider} className={`flex items-center gap-1.5 ${btnCls}`}>
                  <Plus size={11} /> 添加自定义
                </button>
                <button
                  type="button"
                  onClick={() => void saveConfig()}
                  disabled={configStatus === 'saving' || configStatus === 'loading'}
                  className="rounded-full bg-[#f2dfbe] px-4 py-1.5 text-xs font-medium text-[#111] transition hover:brightness-105 disabled:opacity-50"
                >
                  {configStatus === 'saving' ? '保存中…' : configStatus === 'saved' ? '✓ 已保存' : '保存供应商配置'}
                </button>
              </div>
            </div>

            {configStatus === 'loading' ? (
              <div className="flex items-center gap-2 py-10 text-sm text-white/30">
                <Loader2 size={14} className="animate-spin" /> 读取配置…
              </div>
            ) : (config?.providers ?? []).map((provider) => (
              <ProviderCard
                key={provider.id}
                provider={provider}
                isDefault={config?.defaultProviderId === provider.id}
                defaultModel={config?.defaultModel ?? ''}
                onPatch={(patch) => patchProvider(provider.id, patch)}
                onSetDefault={() => setConfig((prev) => prev ? { ...prev, defaultProviderId: provider.id } : prev)}
                onDelete={provider.isCustom ? () => removeProvider(provider.id) : undefined}
              />
            ))}

            {/* Default model row */}
            {config && (
              <div className="mt-2 rounded-[20px] border border-white/8 bg-[#131922] p-4">
                <p className="mb-3 text-xs text-white/40">全局默认模型（当默认供应商启用时使用）</p>
                <input
                  value={config.defaultModel}
                  onChange={(e) => setConfig((prev) => prev ? { ...prev, defaultModel: e.target.value } : prev)}
                  placeholder="e.g. Qwen/Qwen2.5-7B-Instruct"
                  className={inputCls}
                />
              </div>
            )}
          </div>
        )}

        {/* ════ AI Defaults ════ */}
        {activeTab === 'ai' && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-medium text-white">AI 默认设置</h2>
                <p className="mt-0.5 text-xs text-white/35">Workspace 级别的 AI 配置，优先于全局默认值。</p>
              </div>
              <button
                type="button"
                onClick={() => void saveWorkspaceSettings()}
                disabled={wsStatus === 'saving'}
                className="rounded-full bg-[#f2dfbe] px-4 py-1.5 text-xs font-medium text-[#111] transition hover:brightness-105 disabled:opacity-50"
              >
                {wsStatus === 'saving' ? '保存中…' : wsStatus === 'saved' ? '✓ 已保存' : '保存'}
              </button>
            </div>

            <FormSection>
              <FormField label="AI 模式">
                <select
                  value={settings.ai.mode}
                  onChange={(e) => setSettings((p) => ({ ...p, ai: { ...p.ai, mode: e.target.value as Settings['ai']['mode'] } }))}
                  className={inputCls}
                >
                  <option value="mock">Mock（本地测试）</option>
                  <option value="siliconflow">SiliconFlow</option>
                  <option value="google">Google AI (Gemini)</option>
                  <option value="gateway">Google AI Gateway</option>
                </select>
              </FormField>
              <FormField label="模型">
                <input
                  value={settings.ai.model}
                  onChange={(e) => setSettings((p) => ({ ...p, ai: { ...p.ai, model: e.target.value } }))}
                  placeholder="e.g. siliconflow/Qwen/Qwen2.5-7B-Instruct"
                  className={inputCls}
                />
              </FormField>
              <FormField label="系统 Prompt">
                <textarea
                  rows={6}
                  value={settings.ai.systemPrompt}
                  onChange={(e) => setSettings((p) => ({ ...p, ai: { ...p.ai, systemPrompt: e.target.value } }))}
                  className={inputCls}
                />
              </FormField>
            </FormSection>
          </div>
        )}

        {/* ════ Workspace ════ */}
        {activeTab === 'workspace' && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium text-white">Workspace 设置</h2>
              <button
                type="button"
                onClick={() => void saveWorkspaceSettings()}
                disabled={wsStatus === 'saving'}
                className="rounded-full bg-[#f2dfbe] px-4 py-1.5 text-xs font-medium text-[#111] transition hover:brightness-105 disabled:opacity-50"
              >
                {wsStatus === 'saving' ? '保存中…' : wsStatus === 'saved' ? '✓ 已保存' : '保存'}
              </button>
            </div>
            <FormSection>
              <FormField label="画幅比例">
                <input value={settings.workspace.aspectRatio} onChange={(e) => setSettings((p) => ({ ...p, workspace: { ...p.workspace, aspectRatio: e.target.value } }))} className={inputCls} />
              </FormField>
              <FormField label="创作模式">
                <input value={settings.workspace.creationMode} onChange={(e) => setSettings((p) => ({ ...p, workspace: { ...p.workspace, creationMode: e.target.value } }))} className={inputCls} />
              </FormField>
              <FormField label="默认风格">
                <input value={settings.workspace.defaultStyle} onChange={(e) => setSettings((p) => ({ ...p, workspace: { ...p.workspace, defaultStyle: e.target.value } }))} className={inputCls} />
              </FormField>
              <FormField label="数据路径">
                <input readOnly value={settings.workspace.dataPath} className={`${inputCls} cursor-default opacity-50`} />
              </FormField>
            </FormSection>
          </div>
        )}

        {/* ════ Advanced ════ */}
        {activeTab === 'advanced' && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium text-white">高级 / 用量</h2>
              <button
                type="button"
                onClick={() => void saveWorkspaceSettings()}
                disabled={wsStatus === 'saving'}
                className="rounded-full bg-[#f2dfbe] px-4 py-1.5 text-xs font-medium text-[#111] transition hover:brightness-105 disabled:opacity-50"
              >
                {wsStatus === 'saving' ? '保存中…' : wsStatus === 'saved' ? '✓ 已保存' : '保存'}
              </button>
            </div>

            <SectionTitle>用量限制</SectionTitle>
            <FormSection>
              <FormField label="单任务阈值">
                <input type="number" min={0} step="0.1" value={settings.usage.singleTaskLimit} onChange={(e) => setSettings((p) => ({ ...p, usage: { ...p.usage, singleTaskLimit: Number(e.target.value) } }))} className={inputCls} />
              </FormField>
              <FormField label="日阈值">
                <input type="number" min={0} step="1" value={settings.usage.dailyLimit} onChange={(e) => setSettings((p) => ({ ...p, usage: { ...p.usage, dailyLimit: Number(e.target.value) } }))} className={inputCls} />
              </FormField>
              <FormField label="月阈值">
                <input type="number" min={0} step="1" value={settings.usage.monthlyLimit} onChange={(e) => setSettings((p) => ({ ...p, usage: { ...p.usage, monthlyLimit: Number(e.target.value) } }))} className={inputCls} />
              </FormField>
            </FormSection>

            <SectionTitle>用量记录</SectionTitle>
            <div className="rounded-[20px] border border-white/8 bg-[#131922] p-4">
              <p className="mb-1 text-sm text-white/50">{usageSummary.requestCount} 次调用 · {settings.usage.currency} {usageSummary.totalCost.toFixed(2)} · 全局资产 {globalAssetCount} 个</p>
              <div className="mt-3 space-y-2">
                {usageSummary.latestRecords.map((r) => (
                  <div key={r.id} className="flex items-center justify-between text-xs text-white/40">
                    <span>{r.taskType} · {r.endpoint}</span>
                    <span>{r.model} · {r.estimatedCost?.toFixed(3) ?? '0.000'} {r.currency}</span>
                  </div>
                ))}
                {usageSummary.latestRecords.length === 0 && <p className="text-xs text-white/25">暂无记录</p>}
              </div>
            </div>

            <SectionTitle>告警</SectionTitle>
            <div className="rounded-[20px] border border-white/8 bg-[#131922] p-4 space-y-2">
              {usageAlerts.length === 0 ? (
                <p className="text-xs text-white/25">暂无告警</p>
              ) : usageAlerts.map((a) => (
                <div key={a.id} className="flex items-center justify-between text-xs">
                  <span className="text-white/50">{a.type}</span>
                  <span className={`rounded-full px-2 py-0.5 ${a.status === 'exceeded' ? 'bg-rose-500/15 text-rose-300' : a.status === 'warning' ? 'bg-amber-500/15 text-amber-300' : 'bg-emerald-500/15 text-emerald-300'}`}>{a.status}</span>
                </div>
              ))}
            </div>

            <SectionTitle>治理</SectionTitle>
            <FormSection>
              <ToggleRow label="请求日志" value={settings.governance.requestLogging} onChange={(v) => setSettings((p) => ({ ...p, governance: { ...p.governance, requestLogging: v } }))} />
              <ToggleRow label="允许 Agent 写入" value={settings.governance.allowAgentWrites} onChange={(v) => setSettings((p) => ({ ...p, governance: { ...p.governance, allowAgentWrites: v } }))} />
            </FormSection>
          </div>
        )}
      </div>
    </div>
  );
}

function ProviderCard({
  provider,
  isDefault,
  defaultModel,
  onPatch,
  onSetDefault,
  onDelete,
}: {
  provider: ProviderEntry;
  isDefault: boolean;
  defaultModel: string;
  onPatch: (patch: Partial<ProviderEntry>) => void;
  onSetDefault: () => void;
  onDelete?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [testStatus, setTestStatus] = useState<TestStatus>('idle');
  const [testResult, setTestResult] = useState<ProviderTestResult | null>(null);
  const [modelInput, setModelInput] = useState('');

  const inputCls = 'w-full rounded-xl border border-white/10 bg-[#0f131a] px-3 py-2 text-sm text-white outline-none transition placeholder:text-white/20 focus:border-[#f2dfbe]/40';

  async function test() {
    setTestStatus('testing');
    setTestResult(null);
    const model = provider.models[0] ?? defaultModel;
    try {
      const r = await fetch('/api/test-provider', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: provider.isCustom ? undefined : provider.id,
          model,
          apiKey: provider.apiKey || undefined,
          baseUrl: provider.isCustom ? provider.baseUrl : undefined,
          providerType: provider.type,
        }),
      });
      const data: ProviderTestResult = await r.json();
      setTestStatus(data.ok ? 'ok' : 'error');
      setTestResult(data);
    } catch (e) {
      setTestStatus('error');
      setTestResult({ ok: false, message: e instanceof Error ? e.message : '测试失败' });
    }
  }

  function addModel() {
    const m = modelInput.trim();
    if (!m || provider.models.includes(m)) return;
    onPatch({ models: [...provider.models, m] });
    setModelInput('');
  }

  return (
    <div className={`rounded-[20px] border transition ${provider.enabled ? 'border-white/10 bg-[#131922]' : 'border-white/5 bg-[#0e1219] opacity-60'}`}>
      {/* Header row */}
      <div className="flex items-center gap-3 px-4 py-3">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex flex-1 items-center gap-3 text-left"
        >
          <span className="flex-1 text-sm font-medium text-white">{provider.label}</span>
          {isDefault && (
            <span className="flex items-center gap-1 rounded-full border border-[#f2dfbe]/20 bg-[#f2dfbe]/8 px-2.5 py-0.5 text-[10px] text-[#f2dfbe]">
              <Star size={9} /> 默认
            </span>
          )}
          {testStatus === 'ok' && <CheckCircle2 size={13} className="shrink-0 text-emerald-400" />}
          {testStatus === 'error' && <AlertCircle size={13} className="shrink-0 text-rose-400" />}
          <ChevronRight size={14} className={`shrink-0 text-white/30 transition ${expanded ? 'rotate-90' : ''}`} />
        </button>

        {/* toggle */}
        <button
          type="button"
          onClick={() => onPatch({ enabled: !provider.enabled })}
          className={`h-5 w-9 rounded-full transition ${provider.enabled ? 'bg-emerald-500/70' : 'bg-white/15'}`}
        >
          <span className={`block h-3.5 w-3.5 translate-y-[1px] rounded-full bg-white shadow transition ${provider.enabled ? 'translate-x-[18px]' : 'translate-x-[3px]'}`} />
        </button>
      </div>

      {/* Expanded form */}
      {expanded && (
        <div className="border-t border-white/6 px-4 pb-4 pt-4 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <p className="mb-1.5 text-xs text-white/40">名称</p>
              <input value={provider.label} onChange={(e) => onPatch({ label: e.target.value })} className={inputCls} />
            </div>
            <div>
              <p className="mb-1.5 text-xs text-white/40">类型</p>
              <select
                value={provider.type}
                onChange={(e) => onPatch({ type: e.target.value as ProviderEntry['type'] })}
                className={inputCls}
              >
                <option value="openai">OpenAI-compatible</option>
                <option value="google">Google AI</option>
              </select>
            </div>
          </div>

          <div>
            <p className="mb-1.5 text-xs text-white/40">Base URL</p>
            <input
              value={provider.baseUrl}
              onChange={(e) => onPatch({ baseUrl: e.target.value })}
              placeholder="https://api.example.com/v1"
              className={inputCls}
            />
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <p className="text-xs text-white/40">API Key <span className="text-white/20">（留空则从环境变量读取）</span></p>
              <button type="button" onClick={() => setShowKey((v) => !v)} className="text-white/25 hover:text-white/50">
                {showKey ? <EyeOff size={12} /> : <Eye size={12} />}
              </button>
            </div>
            <input
              type={showKey ? 'text' : 'password'}
              value={provider.apiKey}
              onChange={(e) => onPatch({ apiKey: e.target.value })}
              placeholder="sk-..."
              className={inputCls}
            />
          </div>

          {/* Models */}
          <div>
            <p className="mb-2 text-xs text-white/40">模型列表</p>
            <div className="flex flex-wrap gap-1.5">
              {provider.models.map((m) => (
                <span key={m} className="flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-0.5 text-xs text-white/60">
                  {m}
                  <button type="button" onClick={() => onPatch({ models: provider.models.filter((x) => x !== m) })} className="ml-0.5 text-white/30 hover:text-rose-400">
                    <Trash2 size={9} />
                  </button>
                </span>
              ))}
            </div>
            <div className="mt-2 flex gap-2">
              <input
                value={modelInput}
                onChange={(e) => setModelInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addModel(); } }}
                placeholder="添加模型 ID，回车确认"
                className={`flex-1 ${inputCls}`}
              />
              <button type="button" onClick={addModel} className="rounded-xl border border-white/10 bg-white/[0.03] px-3 text-white/50 hover:text-white">
                <Plus size={13} />
              </button>
            </div>
          </div>

          {/* Test result */}
          {testResult && testStatus !== 'testing' && (
            <div className={`rounded-xl border px-3 py-2 text-xs ${testResult.ok ? 'border-emerald-500/20 bg-emerald-500/8 text-emerald-200' : 'border-rose-500/20 bg-rose-500/8 text-rose-200'}`}>
              {testResult.message}
            </div>
          )}

          {/* Footer actions */}
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void test()}
                disabled={testStatus === 'testing'}
                className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-white/60 transition hover:text-white disabled:opacity-40"
              >
                {testStatus === 'testing' ? <Loader2 size={11} className="animate-spin" /> : <Zap size={11} />}
                {testStatus === 'testing' ? '测试中…' : '测试连接'}
              </button>
              {!isDefault && (
                <button
                  type="button"
                  onClick={onSetDefault}
                  className="flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-white/60 hover:text-[#f2dfbe]"
                >
                  <Star size={11} /> 设为默认
                </button>
              )}
            </div>
            {onDelete && (
              <button type="button" onClick={onDelete} className="flex items-center gap-1 text-xs text-white/25 hover:text-rose-400">
                <Trash2 size={11} /> 删除
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] uppercase tracking-widest text-white/25">{children}</p>;
}

function FormSection({ children }: { children: React.ReactNode }) {
  return <div className="rounded-[20px] border border-white/8 bg-[#131922] p-4 space-y-3">{children}</div>;
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-xs text-white/40">{label}</p>
      {children}
    </div>
  );
}

function ToggleRow({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className="flex w-full items-center justify-between text-left"
    >
      <span className="text-sm text-white/60">{label}</span>
      <span className={`rounded-full px-3 py-0.5 text-xs ${value ? 'bg-emerald-500/15 text-emerald-300' : 'bg-white/6 text-white/30'}`}>
        {value ? '开启' : '关闭'}
      </span>
    </button>
  );
}
