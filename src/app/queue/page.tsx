"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowSquareOut, Warning } from "@phosphor-icons/react/dist/ssr";
import type { EpisodeStage, TaskRecord } from "@/server/mvp/types";
import { stageLabels } from "@/lib/mvp-ui";
import { ButtonPill, OrchestratorPanel, SectionTitle, StudioShell } from "@/components/studio/studio-shell";

type QueueTaskView = TaskRecord & {
  durationText: string;
  startedAtText: string;
};

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
  const ms = end - start;
  if (ms < 1000) {
    return `${ms}ms`;
  }
  const sec = Math.floor(ms / 1000);
  if (sec < 60) {
    return `${sec}s`;
  }
  return `${Math.floor(sec / 60)}m ${sec % 60}s`;
}

function recoveryHint(stage: EpisodeStage): string {
  if (stage === "planning") {
    return "检查原始文本并重试实体识别。";
  }
  if (stage === "script") {
    return "修订剧本策略后重新生成剧本。";
  }
  if (stage === "assets") {
    return "补充关键实体后重跑资产提取。";
  }
  if (stage === "storyboard") {
    return "先修复脚本/资产引用，再重生分镜。";
  }
  if (stage === "video") {
    return "检查视频模型配置，必要时切换模型重试。";
  }
  if (stage === "review") {
    return "补齐未选定视频后重新审校。";
  }
  return "检查片段素材后重试导出。";
}

export default function QueuePage() {
  const [tasks, setTasks] = useState<QueueTaskView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | TaskRecord["status"]>("all");
  const [seriesFilter, setSeriesFilter] = useState("all");
  const [episodeFilter, setEpisodeFilter] = useState("all");
  const [stageFilter, setStageFilter] = useState<"all" | EpisodeStage>("all");

  const loadTasks = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/v1/tasks", { cache: "no-store" });
      const json = (await response.json()) as { ok: boolean; data?: TaskRecord[]; error?: string };
      if (!response.ok || !json.ok || !json.data) {
        throw new Error(json.error ?? "加载任务失败");
      }
      setTasks(
        json.data.map((task) => ({
          ...task,
          startedAtText: formatTime(task.createdAt),
          durationText: durationText(task.createdAt, task.updatedAt),
        })),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载任务失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadTasks();
  }, []);

  const seriesOptions = useMemo(() => Array.from(new Set(tasks.map((task) => task.seriesId))), [tasks]);
  const episodeOptions = useMemo(() => Array.from(new Set(tasks.map((task) => task.episodeId))), [tasks]);

  const filtered = useMemo(
    () =>
      tasks.filter((task) => {
        const statusOk = statusFilter === "all" || task.status === statusFilter;
        const seriesOk = seriesFilter === "all" || task.seriesId === seriesFilter;
        const episodeOk = episodeFilter === "all" || task.episodeId === episodeFilter;
        const stageOk = stageFilter === "all" || task.stage === stageFilter;
        return statusOk && seriesOk && episodeOk && stageOk;
      }),
    [tasks, statusFilter, seriesFilter, episodeFilter, stageFilter],
  );

  const failedTasks = filtered.filter((task) => task.status === "failed");

  return (
    <StudioShell
      navKey="queue"
      eyebrow="Task Center"
      title="Queue & Recovery"
      description="UC-15: 观察异步任务状态、定位失败原因，并快速跳回对应模块恢复流程。"
      actions={
        <>
          <ButtonPill tone="quiet" onClick={() => void loadTasks()}>
            刷新任务
          </ButtonPill>
        </>
      }
      aside={
        <OrchestratorPanel
          title="Recovery Console"
          focus={failedTasks[0]?.action ?? "任务队列巡检"}
          completion={tasks.length === 0 ? 0 : Math.round(((tasks.length - failedTasks.length) / tasks.length) * 100)}
          blocking={failedTasks[0]?.error ?? "当前无失败阻塞"}
          nextStep={failedTasks[0] ? recoveryHint(failedTasks[0].stage) : "继续推进当前工作流"}
          recommendations={["查看失败详情", "应用恢复建议", "跳转对应执行页"]}
          queuePreview={filtered.slice(0, 3).map((task) => ({
            id: task.id,
            title: `${task.episodeId} / ${task.action}`,
            status: task.status,
          }))}
        />
      }
    >
      <section className="mc-soft-panel rounded-2xl p-4">
        <SectionTitle
          kicker="Filters"
          title="Task state visibility"
          description="按系列、集数、阶段和状态筛选后，失败任务应始终可见并可恢复。"
        />
        <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
          <select value={seriesFilter} onChange={(event) => setSeriesFilter(event.target.value)}>
            <option value="all">全部系列</option>
            {seriesOptions.map((series) => (
              <option key={series} value={series}>
                {series}
              </option>
            ))}
          </select>
          <select value={episodeFilter} onChange={(event) => setEpisodeFilter(event.target.value)}>
            <option value="all">全部集数</option>
            {episodeOptions.map((episode) => (
              <option key={episode} value={episode}>
                {episode}
              </option>
            ))}
          </select>
          <select value={stageFilter} onChange={(event) => setStageFilter(event.target.value as "all" | EpisodeStage)}>
            <option value="all">全部阶段</option>
            {Object.entries(stageLabels).map(([stage, label]) => (
              <option key={stage} value={stage}>
                {label}
              </option>
            ))}
          </select>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as "all" | TaskRecord["status"])}>
            <option value="all">全部状态</option>
            <option value="waiting">waiting</option>
            <option value="running">running</option>
            <option value="success">success</option>
            <option value="failed">failed</option>
            <option value="retrying">retrying</option>
          </select>
        </div>
      </section>

      <section className="mt-3 rounded-2xl border border-[var(--mc-stroke)] bg-white p-4">
        {loading ? <p className="text-sm text-[var(--mc-muted)]">任务加载中...</p> : null}
        {error ? <p className="text-sm text-[var(--mc-danger)]">{error}</p> : null}
        <div className="overflow-auto rounded-xl border border-[var(--mc-stroke)]">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--mc-stroke)] text-left text-[11px] uppercase tracking-[0.2em] text-[var(--mc-muted)]">
                <th className="px-3 py-2">Task ID</th>
                <th className="px-3 py-2">系列 / 集数</th>
                <th className="px-3 py-2">阶段</th>
                <th className="px-3 py-2">动作</th>
                <th className="px-3 py-2">状态</th>
                <th className="px-3 py-2">开始时间</th>
                <th className="px-3 py-2">耗时</th>
                <th className="px-3 py-2">详情</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((task) => (
                <tr key={task.id} className="border-b border-[var(--mc-stroke)] last:border-b-0">
                  <td className="px-3 py-2 font-semibold text-[var(--mc-ink)]">{task.id}</td>
                  <td className="px-3 py-2 text-[var(--mc-ink)]">
                    <p>{task.seriesId}</p>
                    <p className="text-xs text-[var(--mc-muted)]">{task.episodeId}</p>
                  </td>
                  <td className="px-3 py-2 text-[var(--mc-ink)]">{stageLabels[task.stage]}</td>
                  <td className="px-3 py-2 text-[var(--mc-ink)]">{task.action}</td>
                  <td className="px-3 py-2">
                    <span className="rounded-md border border-[var(--mc-stroke)] bg-[var(--mc-soft)] px-2 py-0.5 text-xs text-[var(--mc-ink)]">
                      {task.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-[var(--mc-muted)]">{task.startedAtText}</td>
                  <td className="px-3 py-2 text-[var(--mc-muted)]">{task.durationText}</td>
                  <td className="px-3 py-2">
                    <Link
                      href={`/queue/${task.id}`}
                      className="inline-flex items-center gap-1 rounded-md border border-[var(--mc-stroke)] bg-white px-2 py-1 text-xs text-[var(--mc-ink)] hover:border-[var(--mc-accent)]"
                    >
                      打开
                      <ArrowSquareOut size={12} />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-3 mc-soft-panel rounded-2xl p-4">
        <SectionTitle
          kicker="Failure Recovery"
          title="Failed tasks need visible repair paths"
          description="失败任务不能只停留在日志；必须提供原因、修复建议和跳转入口。"
        />
        <div className="mt-3 grid gap-3 xl:grid-cols-2">
          {failedTasks.length === 0 ? (
            <article className="rounded-xl border border-[var(--mc-stroke)] bg-white p-3 text-sm text-[var(--mc-muted)]">
              当前筛选条件下无失败任务。
            </article>
          ) : (
            failedTasks.map((task) => (
              <article key={task.id} className="rounded-xl border border-[var(--mc-stroke)] bg-white p-3">
                <p className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--mc-danger)]">
                  <Warning size={13} /> failed
                </p>
                <p className="mt-1 text-base font-semibold text-[var(--mc-ink)]">{task.id}</p>
                <p className="text-sm text-[var(--mc-ink)]">
                  {task.seriesId} · {task.episodeId}
                </p>
                <p className="mt-2 text-sm text-[var(--mc-muted)]">原因：{task.error ?? "暂无错误详情"}</p>
                <p className="mt-1 text-sm text-[var(--mc-muted)]">恢复建议：{recoveryHint(task.stage)}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link
                    href={`/queue/${task.id}`}
                    className="inline-flex items-center gap-1 rounded-lg border border-[var(--mc-stroke)] bg-white px-3 py-1.5 text-sm text-[var(--mc-ink)]"
                  >
                    打开详情
                    <ArrowSquareOut size={13} />
                  </Link>
                </div>
              </article>
            ))
          )}
        </div>
      </section>
    </StudioShell>
  );
}
