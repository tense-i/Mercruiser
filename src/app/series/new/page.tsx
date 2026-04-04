"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ButtonPill, OrchestratorPanel, SectionTitle, StudioShell } from "@/components/studio/studio-shell";

export default function NewSeriesPage() {
  const router = useRouter();
  const [name, setName] = useState("New Chronicle");
  const [summary, setSummary] = useState("一个以城市传闻为线索的悬疑短剧系列。");

  return (
    <StudioShell
      navKey="workspace"
      eyebrow="UC-01"
      title="创建系列"
      description="建立一个可持续生产多集内容的顶层容器。名称必填，创建后自动进入系列详情页。"
      actions={
        <>
          <Link
            href="/workspace"
            className="inline-flex items-center rounded-lg border border-[var(--mc-stroke)] bg-white px-3 py-1.5 text-sm text-[var(--mc-ink)]"
          >
            返回工作区
          </Link>
        </>
      }
      aside={
        <OrchestratorPanel
          title="Create Flow"
          focus="准备创建系列对象"
          completion={40}
          blocking="需要确认系列名称和定位"
          nextStep="填写名称与简介后保存。"
          recommendations={["检查命名规范", "设置初始风格", "创建后进入系列详情"]}
          queuePreview={[]}
        />
      }
    >
      <section className="mc-soft-panel rounded-2xl p-4">
        <SectionTitle
          kicker="Series Form"
          title="Series basics"
          description="这个页面对应业务用例 UC-01。"
        />
        <form
          className="mt-4 grid gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            router.push("/series/glasshouse");
          }}
        >
          <label className="grid gap-1 text-sm">
            系列名称（必填）
            <input value={name} onChange={(event) => setName(event.target.value)} required />
          </label>
          <label className="grid gap-1 text-sm">
            系列简介
            <textarea value={summary} onChange={(event) => setSummary(event.target.value)} />
          </label>
          <div className="flex justify-end gap-2">
            <ButtonPill tone="quiet" onClick={() => router.push("/workspace")}>取消</ButtonPill>
            <ButtonPill type="submit" tone="primary">
              保存并进入系列
            </ButtonPill>
          </div>
        </form>
      </section>
    </StudioShell>
  );
}
