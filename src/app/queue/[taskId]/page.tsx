import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowSquareOut } from "@phosphor-icons/react/dist/ssr";
import { TaskRerunButton } from "@/components/studio/task-rerun-button";
import { stageLabels } from "@/lib/mvp-ui";
import { mvpStore } from "@/server/infrastructure/sqlite/store";
import { OrchestratorPanel, SectionTitle, StudioShell } from "@/components/studio/studio-shell";

type PageProps = {
  params: Promise<{ taskId: string }>;
};

function recoveryHint(stage: keyof typeof stageLabels): string {
  if (stage === "planning") {
    return "检查原始文本并重试实体识别。";
  }
  if (stage === "script") {
    return "修订剧本策略并重新生成。";
  }
  if (stage === "assets") {
    return "补充关键实体后重试资产提取。";
  }
  if (stage === "storyboard") {
    return "修复分镜提示词并局部重试。";
  }
  if (stage === "video") {
    return "切换视频模型或使用本地 fallback。";
  }
  if (stage === "review") {
    return "补齐未选定候选后重新审校。";
  }
  return "检查片段素材后重试导出。";
}

function formatTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")} ${String(
    date.getHours(),
  ).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function durationText(startIso: string, endIso: string): string {
  const start = new Date(startIso).getTime();
  const end = new Date(endIso).getTime();
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) {
    return "--";
  }
  const sec = Math.floor((end - start) / 1000);
  if (sec < 60) {
    return `${sec}s`;
  }
  return `${Math.floor(sec / 60)}m ${sec % 60}s`;
}

export default async function QueueTaskDetailPage({ params }: PageProps) {
  const { taskId } = await params;
  const task = mvpStore.getTask(taskId);

  if (!task) {
    notFound();
  }

  const series = mvpStore.getSeries(task.seriesId);
  const episode = mvpStore.getEpisode(task.episodeId);
  const jumpExecutionHref = `/series/${task.seriesId}/episodes/${task.episodeId}`;
  const jumpCanvasHref = `/series/${task.seriesId}/episodes/${task.episodeId}/canvas`;

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
          blocking={task.error ?? "无阻塞"}
          nextStep={task.status === "failed" ? recoveryHint(task.stage) : "继续观察任务状态。"}
          recommendations={["应用修复建议", "重试任务", "跳转对应模块"]}
          queuePreview={[{ id: task.id, title: `${task.episodeId} / ${task.action}`, status: task.status }]}
        />
      }
    >
      <section className="mc-soft-panel rounded-2xl p-4">
        <SectionTitle kicker="Task Summary" title="执行上下文" description="将日志级错误翻译为可执行修复动作。" />

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-[var(--mc-stroke)] bg-[var(--mc-soft)] p-3">
            <p className="text-[11px] text-[var(--mc-muted)]">系列 / 集数</p>
            <p className="text-sm font-semibold text-[var(--mc-ink)]">
              {series?.title ?? task.seriesId} · {episode?.code ?? task.episodeId}
            </p>
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
            <p className="text-sm font-semibold text-[var(--mc-ink)]">
              {formatTime(task.createdAt)} · {durationText(task.createdAt, task.updatedAt)}
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-3">
          <div className="rounded-xl border border-[var(--mc-stroke)] bg-[var(--mc-soft)] p-3">
            <p className="text-[11px] text-[var(--mc-muted)]">失败原因</p>
            <p className="text-sm text-[var(--mc-ink)]">{task.error ?? "当前任务无失败信息。"}</p>
          </div>
          <div className="rounded-xl border border-[var(--mc-stroke)] bg-[var(--mc-soft)] p-3">
            <p className="text-[11px] text-[var(--mc-muted)]">恢复建议</p>
            <p className="text-sm text-[var(--mc-ink)]">{recoveryHint(task.stage)}</p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <TaskRerunButton taskId={task.id} label={task.status === "failed" ? "重试当前阶段" : "重新执行当前阶段"} />
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
