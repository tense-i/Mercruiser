'use client';

import { startTransition, useMemo, useState } from 'react';

import type { APIUsageRecord, GenerationPreset, Settings, UsageAlert } from '@/lib/domain/types';

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
  const [settings, setSettings] = useState(initialSettings);
  const [status, setStatus] = useState('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const usageSummary = useMemo(
    () => ({
      totalCost: usageRecords.reduce((sum, record) => sum + (record.estimatedCost ?? 0), 0),
      requestCount: usageRecords.length,
      latestRecords: usageRecords.slice(0, 5),
    }),
    [usageRecords],
  );

  const save = async () => {
    try {
      setStatus('saving');
      const response = await fetch('/api/studio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          command: {
            type: 'updateSettings',
            settings,
          },
          context: {
            refreshSettings: true,
          },
        }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.settings) {
        throw new Error(payload.error ?? '设置保存失败');
      }
      setSettings(payload.settings);
      setErrorMessage(null);
      setStatus('saved');
    } catch (error) {
      setStatus('idle');
      setErrorMessage(error instanceof Error ? error.message : '设置保存失败');
    }
  };

  return (
    <div className="space-y-5">
      <section className="rounded-3xl border border-white/10 bg-[#0f131a] shadow-[0_20px_80px_rgba(0,0,0,0.25)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/6 px-5 py-4">
          <div>
            <div className="text-sm font-medium tracking-wide text-white">设置中心</div>
            <div className="mt-1 text-xs text-white/45">语言、供应商、用量监控、生成模板、协作权限预留与本地数据治理。</div>
          </div>
          <button
            type="button"
            onClick={() => {
              startTransition(() => {
                void save();
              });
            }}
            className="rounded-full bg-[#f2dfbe] px-5 py-2.5 text-sm font-medium text-[#111] transition hover:brightness-105"
          >
            {status === 'saving' ? '保存中...' : status === 'saved' ? '已保存' : '保存设置'}
          </button>
        </div>

        <div className="p-5">
          {errorMessage ? (
            <div className="mb-4 rounded-2xl border border-rose-400/20 bg-rose-500/15 px-4 py-3 text-sm text-rose-100">{errorMessage}</div>
          ) : null}

          <div className="grid gap-4 xl:grid-cols-4">
            <SettingsCard title="AI">
              <Field label="模式" value={settings.ai.mode} onChange={(value) => setSettings((prev) => ({ ...prev, ai: { ...prev.ai, mode: value as Settings['ai']['mode'] } }))} />
              <Field label="模型" value={settings.ai.model} onChange={(value) => setSettings((prev) => ({ ...prev, ai: { ...prev.ai, model: value } }))} />
              <Area label="系统 Prompt" value={settings.ai.systemPrompt} onChange={(value) => setSettings((prev) => ({ ...prev, ai: { ...prev.ai, systemPrompt: value } }))} />
            </SettingsCard>

            <SettingsCard title="Workspace">
              <Field label="画幅" value={settings.workspace.aspectRatio} onChange={(value) => setSettings((prev) => ({ ...prev, workspace: { ...prev.workspace, aspectRatio: value } }))} />
              <Field label="创作模式" value={settings.workspace.creationMode} onChange={(value) => setSettings((prev) => ({ ...prev, workspace: { ...prev.workspace, creationMode: value } }))} />
              <Field label="默认风格" value={settings.workspace.defaultStyle} onChange={(value) => setSettings((prev) => ({ ...prev, workspace: { ...prev.workspace, defaultStyle: value } }))} />
              <ReadonlyCard label="数据路径" value={settings.workspace.dataPath} />
            </SettingsCard>

            <SettingsCard title="Usage Guardrails">
              <NumberField label="单任务阈值" value={settings.usage.singleTaskLimit} onChange={(value) => setSettings((prev) => ({ ...prev, usage: { ...prev.usage, singleTaskLimit: value } }))} />
              <NumberField label="日阈值" value={settings.usage.dailyLimit} onChange={(value) => setSettings((prev) => ({ ...prev, usage: { ...prev.usage, dailyLimit: value } }))} />
              <NumberField label="月阈值" value={settings.usage.monthlyLimit} onChange={(value) => setSettings((prev) => ({ ...prev, usage: { ...prev.usage, monthlyLimit: value } }))} />
              <Field label="通知方式" value={settings.usage.notifyMethod} onChange={(value) => setSettings((prev) => ({ ...prev, usage: { ...prev.usage, notifyMethod: value as Settings['usage']['notifyMethod'] } }))} />
            </SettingsCard>

            <SettingsCard title="Governance">
              <Toggle label="请求日志" value={settings.governance.requestLogging} onChange={(value) => setSettings((prev) => ({ ...prev, governance: { ...prev.governance, requestLogging: value } }))} />
              <Toggle label="允许 Agent 写入" value={settings.governance.allowAgentWrites} onChange={(value) => setSettings((prev) => ({ ...prev, governance: { ...prev.governance, allowAgentWrites: value } }))} />
              <Field label="权限模式" value={settings.governance.permissionMode} onChange={(value) => setSettings((prev) => ({ ...prev, governance: { ...prev.governance, permissionMode: value as Settings['governance']['permissionMode'] } }))} />
              <ReadonlyCard label="预留角色" value={settings.governance.reservedRoles.join(' / ')} />
            </SettingsCard>
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-3">
            <InfoCard title="API 用量总览" body={`${usageSummary.requestCount} 次调用 · ${settings.usage.currency} ${usageSummary.totalCost.toFixed(2)} · 全局资产 ${globalAssetCount} 个`} />
            <InfoCard title="生成模板" body={`${generationPresets.length} 个预设，覆盖 ${generationPresets.map((preset) => preset.scope).join(' / ') || '暂无'} scope。`} />
            <InfoCard title="协作预留" body="当前保留权限模式、角色集合与 API 预警阻断规则；多人协作与高级编辑仍按 PRD 作为后续阶段。" />
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-2">
            <section className="rounded-[28px] border border-white/8 bg-[#131922] p-5">
              <div className="text-[11px] uppercase tracking-[0.2em] text-white/35">Usage Alerts</div>
              <div className="mt-4 space-y-3">
                {usageAlerts.map((alert) => (
                  <div key={alert.id} className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 text-sm text-white/72">
                    <div className="flex items-center justify-between gap-3">
                      <span>{alert.type}</span>
                      <span className={`rounded-full px-3 py-1 text-xs ${alert.status === 'exceeded' ? 'bg-rose-500/15 text-rose-200' : alert.status === 'warning' ? 'bg-amber-500/15 text-amber-200' : 'bg-emerald-500/15 text-emerald-200'}`}>{alert.status}</span>
                    </div>
                    <div className="mt-2 text-xs text-white/45">
                      当前 {alert.currentValue.toFixed(2)} / 阈值 {alert.threshold.toFixed(2)} · {alert.notifyMethod}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-[28px] border border-white/8 bg-[#131922] p-5">
              <div className="text-[11px] uppercase tracking-[0.2em] text-white/35">Latest Usage Records</div>
              <div className="mt-4 space-y-3">
                {usageSummary.latestRecords.map((record) => (
                  <div key={record.id} className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 text-sm text-white/72">
                    <div className="flex items-center justify-between gap-3">
                      <span>{record.taskType}</span>
                      <span>{record.endpoint}</span>
                    </div>
                    <div className="mt-2 text-xs text-white/45">
                      {record.model} · {record.estimatedCost?.toFixed(2) ?? '0.00'} {record.currency}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      </section>
    </div>
  );
}

function SettingsCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[28px] border border-white/8 bg-[#131922] p-5">
      <div className="text-[11px] uppercase tracking-[0.2em] text-white/35">{title}</div>
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm text-white/48">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white outline-none transition focus:border-[#f2dfbe]/40"
      />
    </label>
  );
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm text-white/48">{label}</span>
      <input
        type="number"
        min={0}
        step="0.1"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white outline-none transition focus:border-[#f2dfbe]/40"
      />
    </label>
  );
}

function Area({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm text-white/48">{label}</span>
      <textarea
        rows={6}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm leading-6 text-white outline-none transition focus:border-[#f2dfbe]/40"
      />
    </label>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (value: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-left"
    >
      <span className="text-sm text-white/72">{label}</span>
      <span className={`rounded-full px-3 py-1 text-xs ${value ? 'bg-emerald-500/15 text-emerald-200' : 'bg-white/8 text-white/48'}`}>
        {value ? '开启' : '关闭'}
      </span>
    </button>
  );
}

function ReadonlyCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
      <p className="text-sm text-white/48">{label}</p>
      <p className="mt-2 text-sm text-white">{value}</p>
    </div>
  );
}

function InfoCard({ title, body }: { title: string; body: string }) {
  return (
    <section className="rounded-[28px] border border-white/8 bg-[#131922] p-5">
      <div className="text-[11px] uppercase tracking-[0.2em] text-white/35">{title}</div>
      <p className="mt-4 text-sm leading-6 text-white/62">{body}</p>
    </section>
  );
}
