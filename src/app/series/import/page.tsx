"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ButtonPill, OrchestratorPanel, SectionTitle, StudioShell } from "@/components/studio/studio-shell";
import { importPreviewEpisodes } from "@/lib/mock-data";

export default function SeriesImportPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);

  return (
    <StudioShell
      navKey="workspace"
      eyebrow="UC-03"
      title="导入长文本创建系列"
      description="上传长文本并拆分为可执行集数：上传 -> 参数 -> 预览 -> 确认。"
      actions={
        <Link
          href="/workspace"
          className="inline-flex items-center rounded-lg border border-[var(--mc-stroke)] bg-white px-3 py-1.5 text-sm text-[var(--mc-ink)]"
        >
          返回工作区
        </Link>
      }
      aside={
        <OrchestratorPanel
          title="Import Flow"
          focus={`Step ${step} / 4`}
          completion={step * 25}
          blocking={step < 3 ? "尚未完成分集预览" : "等待确认创建"}
          nextStep={step < 4 ? "继续下一步" : "确认后创建系列与集数"}
          recommendations={["检查文本格式", "优化拆分参数", "确认分集预览"]}
          queuePreview={[]}
        />
      }
    >
      <section className="mc-soft-panel rounded-2xl p-4">
        <SectionTitle
          kicker="Import Wizard"
          title="Long text to episodes"
          description="对应业务用例 UC-03。"
        />

        <div className="mt-3 flex flex-wrap gap-2">
          {[1, 2, 3, 4].map((idx) => (
            <button
              key={idx}
              onClick={() => setStep(idx)}
              className={`rounded-md border px-3 py-1 text-sm ${idx === step
                  ? "border-[var(--mc-accent)] bg-[color-mix(in_oklch,var(--mc-accent)_10%,white)]"
                  : "border-[var(--mc-stroke)]"
                }`}
            >
              Step {idx}
            </button>
          ))}
        </div>

        <div className="mt-4 rounded-xl border border-[var(--mc-stroke)] bg-[var(--mc-soft)] p-3">
          {step === 1 ? (
            <div className="grid gap-2">
              <p className="text-sm font-semibold text-[var(--mc-ink)]">上传文件或粘贴文本</p>
              <textarea defaultValue="在暴雨夜里，叶雪清听见门外脚步......" />
            </div>
          ) : null}

          {step === 2 ? (
            <div className="grid gap-2 md:grid-cols-2">
              <label className="grid gap-1 text-sm">
                每集时长
                <select defaultValue="90s">
                  <option>60s</option>
                  <option>90s</option>
                  <option>120s</option>
                </select>
              </label>
              <label className="grid gap-1 text-sm">
                拆分方式
                <select defaultValue="按冲突点">
                  <option>按冲突点</option>
                  <option>按章节</option>
                  <option>按场景节奏</option>
                </select>
              </label>
            </div>
          ) : null}

          {step === 3 ? (
            <div className="grid gap-2">
              <p className="text-sm font-semibold text-[var(--mc-ink)]">分集预览</p>
              {importPreviewEpisodes.map((episode) => (
                <div key={episode.id} className="rounded-lg border border-[var(--mc-stroke)] bg-white p-3">
                  <p className="text-sm font-semibold text-[var(--mc-ink)]">{episode.title}</p>
                  <p className="text-xs text-[var(--mc-muted)]">{episode.summary}</p>
                </div>
              ))}
            </div>
          ) : null}

          {step === 4 ? (
            <div className="text-sm text-[var(--mc-ink)]">
              确认创建后，将生成系列并初始化 3 个集数，随后跳转到系列详情页。
            </div>
          ) : null}
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <ButtonPill tone="quiet" onClick={() => setStep((prev) => Math.max(1, prev - 1))}>
            上一步
          </ButtonPill>
          {step < 4 ? (
            <ButtonPill tone="primary" onClick={() => setStep((prev) => Math.min(4, prev + 1))}>
              下一步
            </ButtonPill>
          ) : (
            <ButtonPill tone="primary" onClick={() => router.push("/series/glasshouse")}>
              确认并创建
            </ButtonPill>
          )}
        </div>
      </section>
    </StudioShell>
  );
}