import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowSquareOut } from "@phosphor-icons/react/dist/ssr";
import { getCanvasNodeIdByStage, getEpisodeIdByLabel, getSeriesIdByTitle, getTaskById, stageLabels } from "@/lib/mock-data";
import { ButtonPill, OrchestratorPanel, SectionTitle, StudioShell } from "@/components/studio/studio-shell";

type PageProps = {
  params: Promise<{ taskId: string }>;
};

export default async function QueueTaskDetailPage({ params }: PageProps) {
  const { taskId } = await params;
  const task = getTaskById(taskId);

  if (!task) {
    notFound();
  }

  const seriesId = getSeriesIdByTitle(task.series);
  const episodeId = getEpisodeIdByLabel(task.episode);
  const jumpExecutionHref =
    seriesId && episodeId ? `/series/${seriesId}/episodes/${episodeId}` : seriesId ? `/series/${seriesId}` : "/workspace";
  const jumpCanvasHref =
    seriesId && episodeId
      ? `/series/${seriesId}/episodes/${episodeId}/canvas?focus=${getCanvasNodeIdByStage(task.stage)}&panel=chat`
      : jumpExecutionHref;

  return (
    <StudioShell
      navKey="queue"
      eyebrow="Task Detail"
      title={`任务 ${task.id}`}
      description="任务详情页：展示失败原因、恢复策略和跳转入口。"
      actions={
        <Link
          href="/queue"
          className="inline-flex items-center rounded-lg border border-[var(--mc-stroke)] bg-white px-3 py-1.5 text-sm text-[var(--mc-ink)]"
        >
          返回任务中心
        </Link>
      }
      aside={
        <OrchestratorPanel
          title="Recovery Plan"
          focus={task.action}
          completion={task.status === "failed" ? 35 : 82}
          blocking={task.failureReason ?? "无阻塞"}
          nextStep={task.recoveryHint ?? "继续观察任务状态。"}
          recommendations={["应用修复建议", "重试任务", "跳转对应模块"]}
          queuePreview={[{ id: task.id, title: `${task.episode} / ${task.action}`, status: task.status }]}
        />
      }
    >
      <section className="mc-soft-panel rounded-2xl p-4">
        <SectionTitle
          kicker="Task Summary"
          title="执行上下文"
          description="将日志级错误翻译为可执行修复动作。"
        />

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-[var(--mc-stroke)] bg-[var(--mc-soft)] p-3">
            <p className="text-[11px] text-[var(--mc-muted)]">系列 / 集数</p>
            <p className="text-sm font-semibold text-[var(--mc-ink)]">{task.series} · {task.episode}</p>
          </div>
          <div className="rounded-xl border border-[var(--mc-stroke)] bg-[var(--mc-soft)] p-3">
            <p className="text-[11px] text-[var(--mc-muted)]">阶段 / 状态</p>
            <p className="text-sm font-semibold text-[var(--mc-ink)]">{stageLabels[task.stage]} · {task.status}</p>
          </div>
          <div className="rounded-xl border border-[var(--mc-stroke)] bg-[var(--mc-soft)] p-3">
            <p className="text-[11px] text-[var(--mc-muted)]">动作</p>
            <p className="text-sm font-semibold text-[var(--mc-ink)]">{task.action}</p>
          </div>
          <div className="rounded-xl border border-[var(--mc-stroke)] bg-[var(--mc-soft)] p-3">
            <p className="text-[11px] text-[var(--mc-muted)]">开始 / 耗时</p>
            <p className="text-sm font-semibold text-[var(--mc-ink)]">{task.startedAt} · {task.duration}</p>
          </div>
        </div>

        <div className="mt-4 grid gap-3">
          <div className="rounded-xl border border-[var(--mc-stroke)] bg-[var(--mc-soft)] p-3">
            <p className="text-[11px] text-[var(--mc-muted)]">失败原因</p>
            <p className="text-sm text-[var(--mc-ink)]">{task.failureReason ?? "当前任务无失败信息。"}</p>
          </div>
          <div className="rounded-xl border border-[var(--mc-stroke)] bg-[var(--mc-soft)] p-3">
            <p className="text-[11px] text-[var(--mc-muted)]">恢复建议</p>
            <p className="text-sm text-[var(--mc-ink)]">{task.recoveryHint ?? "无需恢复操作。"}</p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <ButtonPill tone="primary">应用恢复建议</ButtonPill>
          <ButtonPill tone="quiet">重试任务</ButtonPill>
          <Link
            href={jumpExecutionHref}
            className="inline-flex items-center gap-1 rounded-lg border border-[var(--mc-stroke)] bg-white px-3 py-1.5 text-sm text-[var(--mc-ink)]"
          >
            跳转执行页
            <ArrowSquareOut size={13} />
          </Link>
          <Link
            href={jumpCanvasHref}
            className="inline-flex items-center gap-1 rounded-lg border border-[var(--mc-stroke)] bg-white px-3 py-1.5 text-sm text-[var(--mc-ink)]"
          >
            打开画布
            <ArrowSquareOut size={13} />
          </Link>
        </div>
      </section>
    </StudioShell>
  );
}
