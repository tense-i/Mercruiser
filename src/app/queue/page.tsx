"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowSquareOut, Warning } from "@phosphor-icons/react/dist/ssr";
import { queueTasks, stageLabels } from "@/lib/mock-data";
import { ButtonPill, OrchestratorPanel, SectionTitle, StudioShell } from "@/components/studio/studio-shell";

export default function QueuePage() {
  const [statusFilter, setStatusFilter] = useState<"all" | "queued" | "running" | "success" | "failed">("all");
  const [seriesFilter, setSeriesFilter] = useState("all");
  const [episodeFilter, setEpisodeFilter] = useState("all");
  const [stageFilter, setStageFilter] = useState<"all" | keyof typeof stageLabels>("all");

  const seriesOptions = useMemo(
    () => Array.from(new Set(queueTasks.map((task) => task.series))),
    [],
  );

  const episodeOptions = useMemo(
    () => Array.from(new Set(queueTasks.map((task) => task.episode))),
    [],
  );

  const filtered = useMemo(
    () =>
      queueTasks.filter((task) => {
        const statusOk = statusFilter === "all" || task.status === statusFilter;
        const seriesOk = seriesFilter === "all" || task.series === seriesFilter;
        const episodeOk = episodeFilter === "all" || task.episode === episodeFilter;
        const stageOk = stageFilter === "all" || task.stage === stageFilter;
        return statusOk && seriesOk && episodeOk && stageOk;
      }),
    [statusFilter, seriesFilter, episodeFilter, stageFilter],
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
          <ButtonPill tone="quiet">刷新任务</ButtonPill>
          <ButtonPill tone="primary">重试可恢复失败</ButtonPill>
        </>
      }
      aside={
        <OrchestratorPanel
          title="Recovery Console"
          focus="失败任务恢复优先级"
          completion={67}
          blocking="Q-2170 需要角色主提示词修复"
          nextStep="先修复角色提示词，再重试失败任务。"
          recommendations={[
            "查看失败详情",
            "应用恢复建议",
            "跳转到资产模块",
          ]}
          queuePreview={queueTasks.slice(0, 3).map((task) => ({
            id: task.id,
            title: `${task.episode} / ${task.action}`,
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
          <select
            value={stageFilter}
            onChange={(event) => setStageFilter(event.target.value as "all" | keyof typeof stageLabels)}
          >
            <option value="all">全部阶段</option>
            {Object.entries(stageLabels).map(([stage, label]) => (
              <option key={stage} value={stage}>
                {label}
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(event.target.value as "all" | "queued" | "running" | "success" | "failed")
            }
          >
            <option value="all">全部状态</option>
            <option value="queued">排队</option>
            <option value="running">运行中</option>
            <option value="success">成功</option>
            <option value="failed">失败</option>
          </select>
        </div>
      </section>

      <section className="mt-3 rounded-2xl border border-[var(--mc-stroke)] bg-white p-4">
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
                    <p>{task.series}</p>
                    <p className="text-xs text-[var(--mc-muted)]">{task.episode}</p>
                  </td>
                  <td className="px-3 py-2 text-[var(--mc-ink)]">{stageLabels[task.stage]}</td>
                  <td className="px-3 py-2 text-[var(--mc-ink)]">{task.action}</td>
                  <td className="px-3 py-2">
                    <span className="rounded-md border border-[var(--mc-stroke)] bg-[var(--mc-soft)] px-2 py-0.5 text-xs text-[var(--mc-ink)]">
                      {task.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-[var(--mc-muted)]">{task.startedAt}</td>
                  <td className="px-3 py-2 text-[var(--mc-muted)]">{task.duration}</td>
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
                  {task.series} · {task.episode}
                </p>
                <p className="mt-2 text-sm text-[var(--mc-muted)]">原因：{task.failureReason}</p>
                <p className="mt-1 text-sm text-[var(--mc-muted)]">恢复建议：{task.recoveryHint}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <ButtonPill tone="quiet">应用恢复建议</ButtonPill>
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
