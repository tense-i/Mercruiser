"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ButtonPill, OrchestratorPanel, SectionTitle, StudioShell } from "@/components/studio/studio-shell";

function parseEpisodes(raw: string) {
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const [title, ...rest] = line.split("|");
      return {
        id: `import-${index + 1}`,
        title: title.trim(),
        summary: rest.join("|").trim() || "待补充概要",
      };
    });
}

export default function EpisodeImportPage() {
  const params = useParams<{ seriesId: string }>();
  const seriesId = params.seriesId;
  const router = useRouter();
  const [rawInput, setRawInput] = useState(
    "Episode 06 · 雨后门廊 | 角色关系出现新误解，线索转向旧相册。\nEpisode 07 · 走廊低语 | 门外对话暴露母亲的隐藏信息。",
  );
  const preview = useMemo(() => parseEpisodes(rawInput), [rawInput]);

  return (
    <StudioShell
      navKey="workspace"
      eyebrow="UC-04"
      title="批量导入集数"
      description="将多行标题/概要批量导入到当前系列，创建后直接进入集数列表。"
      actions={
        <Link
          href={`/series/${seriesId}`}
          className="inline-flex items-center rounded-lg border border-[var(--mc-stroke)] bg-white px-3 py-1.5 text-sm text-[var(--mc-ink)]"
        >
          返回系列详情
        </Link>
      }
      aside={
        <OrchestratorPanel
          title="Batch Import"
          focus="按行识别集数标题与概要"
          completion={preview.length > 0 ? 72 : 18}
          blocking={preview.length > 0 ? "等待确认创建" : "尚未识别出有效集数"}
          nextStep="确认预览后一次性创建。"
          recommendations={["检查标题格式", "确认概要完整度", "创建后进入集数管理"]}
          queuePreview={[]}
        />
      }
    >
      <section className="mc-soft-panel rounded-2xl p-4">
        <SectionTitle
          kicker="Episode Import"
          title="Line-based bulk creation"
          description="每行格式：`标题 | 概要`。支持只填标题。"
        />

        <div className="mt-4 grid gap-3 xl:grid-cols-2">
          <label className="grid gap-1 text-sm">
            导入内容
            <textarea value={rawInput} onChange={(event) => setRawInput(event.target.value)} rows={10} />
          </label>

          <div className="rounded-xl border border-[var(--mc-stroke)] bg-[var(--mc-soft)] p-3">
            <p className="text-sm font-semibold text-[var(--mc-ink)]">预览结果（{preview.length}）</p>
            <div className="mt-2 space-y-2">
              {preview.length === 0 ? (
                <p className="text-sm text-[var(--mc-muted)]">暂无可导入集数，请检查输入格式。</p>
              ) : (
                preview.map((item) => (
                  <article key={item.id} className="rounded-lg border border-[var(--mc-stroke)] bg-white p-3">
                    <p className="text-sm font-semibold text-[var(--mc-ink)]">{item.title}</p>
                    <p className="mt-1 text-xs text-[var(--mc-muted)]">{item.summary}</p>
                  </article>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <ButtonPill tone="quiet" onClick={() => router.push(`/series/${seriesId}`)}>
            取消
          </ButtonPill>
          <ButtonPill
            tone="primary"
            onClick={() => router.push(`/series/${seriesId}`)}
          >
            创建 {preview.length} 个集数
          </ButtonPill>
        </div>
      </section>
    </StudioShell>
  );
}
