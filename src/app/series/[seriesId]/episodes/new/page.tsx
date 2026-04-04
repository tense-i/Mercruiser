"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ButtonPill, OrchestratorPanel, SectionTitle, StudioShell } from "@/components/studio/studio-shell";

export default function NewEpisodePage() {
  const params = useParams<{ seriesId: string }>();
  const seriesId = params.seriesId;
  const router = useRouter();

  return (
    <StudioShell
      navKey="workspace"
      eyebrow="UC-04"
      title="新增集数"
      description="在系列中补充新的执行单元，输入标题和概要后进入待生产状态。"
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
          title="Episode Create"
          focus="创建 Episode 执行单元"
          completion={35}
          blocking="尚未填写集数概要"
          nextStep="保存后加入集数列表。"
          recommendations={["检查标题格式", "补充冲突钩子", "创建后进入工作台"]}
          queuePreview={[]}
        />
      }
    >
      <section className="mc-soft-panel rounded-2xl p-4">
        <SectionTitle
          kicker="Episode Form"
          title="Episode basics"
          description="对应业务用例 UC-04。"
        />
        <form
          className="mt-4 grid gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            router.push(`/series/${seriesId}`);
          }}
        >
          <label className="grid gap-1 text-sm">
            集数标题
            <input defaultValue="Episode 06 · 雨后门廊" required />
          </label>
          <label className="grid gap-1 text-sm">
            集数概要
            <textarea defaultValue="角色关系出现新的误解，线索将转向旧相册。" />
          </label>
          <div className="flex justify-end gap-2">
            <ButtonPill tone="quiet" onClick={() => router.push(`/series/${seriesId}`)}>
              取消
            </ButtonPill>
            <ButtonPill type="submit" tone="primary">
              创建集数
            </ButtonPill>
          </div>
        </form>
      </section>
    </StudioShell>
  );
}
