'use client';

import { startTransition, useState } from 'react';

import type { Settings } from '@/lib/domain/types';

export function SettingsCenter({ initialSettings }: { initialSettings: Settings }) {
  const [settings, setSettings] = useState(initialSettings);
  const [status, setStatus] = useState('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
            <div className="mt-1 text-xs text-white/45">语言、供应商、模型、Prompt、Skill、Memory、Agent、请求、文件、数据。</div>
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

          <div className="grid gap-4 xl:grid-cols-3">
            <SettingsCard title="AI">
              <Field label="模式" value={settings.ai.mode} onChange={(value) => setSettings((prev) => ({ ...prev, ai: { ...prev.ai, mode: value as Settings['ai']['mode'] } }))} />
              <Field label="模型" value={settings.ai.model} onChange={(value) => setSettings((prev) => ({ ...prev, ai: { ...prev.ai, model: value } }))} />
              <Area label="系统 Prompt" value={settings.ai.systemPrompt} onChange={(value) => setSettings((prev) => ({ ...prev, ai: { ...prev.ai, systemPrompt: value } }))} />
              <Area label="Skill Prompt" value={settings.ai.skillPrompt} onChange={(value) => setSettings((prev) => ({ ...prev, ai: { ...prev.ai, skillPrompt: value } }))} />
            </SettingsCard>

            <SettingsCard title="Workspace">
              <Field label="画幅" value={settings.workspace.aspectRatio} onChange={(value) => setSettings((prev) => ({ ...prev, workspace: { ...prev.workspace, aspectRatio: value } }))} />
              <Field label="创作模式" value={settings.workspace.creationMode} onChange={(value) => setSettings((prev) => ({ ...prev, workspace: { ...prev.workspace, creationMode: value } }))} />
              <Field label="默认风格" value={settings.workspace.defaultStyle} onChange={(value) => setSettings((prev) => ({ ...prev, workspace: { ...prev.workspace, defaultStyle: value } }))} />
              <ReadonlyCard label="数据路径" value={settings.workspace.dataPath} />
            </SettingsCard>

            <SettingsCard title="Governance">
              <Toggle label="请求日志" value={settings.governance.requestLogging} onChange={(value) => setSettings((prev) => ({ ...prev, governance: { ...prev.governance, requestLogging: value } }))} />
              <Toggle label="允许 Agent 写入" value={settings.governance.allowAgentWrites} onChange={(value) => setSettings((prev) => ({ ...prev, governance: { ...prev.governance, allowAgentWrites: value } }))} />
              <Toggle label="启用记忆" value={settings.ai.memoryEnabled} onChange={(value) => setSettings((prev) => ({ ...prev, ai: { ...prev.ai, memoryEnabled: value } }))} />
            </SettingsCard>
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-3">
            <InfoCard title="Prompt / Skill" body="系统 Prompt、Skill Prompt 已接入本地保存，可继续扩展为多版本模板与系列策略。"/>
            <InfoCard title="Agent / Request" body="当前支持 mock / SiliconFlow / Google 模式，本地写入默认限制在 localhost。"/>
            <InfoCard title="File / Data" body="当前工作区使用 local-first JSON 持久化，后续可迁移为更强的数据库后端。"/>
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
      <p className="mt-2 text-xs leading-6 text-white/42">如需切换，请使用 `MERCRUISER_DATA_PATH` 环境变量重新启动应用。</p>
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
