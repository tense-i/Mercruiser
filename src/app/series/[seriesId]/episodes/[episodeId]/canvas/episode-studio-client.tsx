"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowClockwise, Check, DownloadSimple, Lock, Sparkle, Warning } from "@phosphor-icons/react/dist/ssr";
import type { EpisodeStudio, SeriesDetail, StageId, VideoCandidate } from "@/lib/mock-data";
import { stageLabels, statusLabels } from "@/lib/mock-data";
import {
  ButtonPill,
  OrchestratorPanel,
  SectionTitle,
  StageDot,
  StudioShell,
} from "@/components/studio/studio-shell";

const stageOrder: StageId[] = [
  "planning",
  "script",
  "assets",
  "storyboard",
  "video",
  "review",
  "export",
];

export function EpisodeStudioClient({
  series,
  episode,
}: {
  series: SeriesDetail;
  episode: EpisodeStudio;
}) {
  const [activeStage, setActiveStage] = useState<StageId>(episode.orchestrator.currentStage);
  const [videoCandidates, setVideoCandidates] = useState<VideoCandidate[]>(episode.video.candidates);

  const selectedCount = useMemo(
    () => videoCandidates.filter((candidate) => candidate.selected).length,
    [videoCandidates],
  );

  const stageHeader = {
    planning: "策划输入与改编目标",
    script: "剧本骨架与正文",
    assets: "资产提取与版本锁定",
    storyboard: "分镜结构与局部修复",
    video: "视频候选与最终选择",
    review: "审校缺失项与装配确认",
    export: "导出与版本记录",
  }[activeStage];

  return (
    <StudioShell
      navKey="workspace"
      eyebrow="Episode Studio"
      title={episode.episodeTitle}
      description="UC-08: Agent 阶段诊断 + 下一步建议。该工作台以阶段感组织执行流程，避免在生成链路中迷失。"
      actions={
        <>
          <Link
            href={`/series/${series.id}`}
            className="inline-flex rounded-full border border-[var(--mc-stroke)] bg-white px-4 py-2 text-sm font-semibold text-[var(--mc-ink)]"
          >
            返回系列详情
          </Link>
          <Link
            href={`/series/${series.id}/episodes/${episode.episodeId}/canvas`}
            className="inline-flex rounded-full border border-[var(--mc-stroke)] bg-white px-4 py-2 text-sm font-semibold text-[var(--mc-ink)]"
          >
            打开画布视图
          </Link>
          <Link
            href={`/series/${series.id}/episodes/${episode.episodeId}/script`}
            className="inline-flex rounded-full border border-[var(--mc-stroke)] bg-white px-4 py-2 text-sm font-semibold text-[var(--mc-ink)]"
          >
            打开剧本页
          </Link>
          <ButtonPill tone="primary">Run stage diagnosis</ButtonPill>
        </>
      }
      aside={
        <OrchestratorPanel
          title="Episode Orchestrator"
          focus={stageLabels[activeStage]}
          completion={episode.orchestrator.completion}
          blocking={episode.orchestrator.blockers.join("；")}
          nextStep={episode.orchestrator.nextAction}
          recommendations={episode.orchestrator.tips}
          queuePreview={series.orchestrator.queuePreview}
        />
      }
      compact
    >
      <div className="grid gap-3 lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="mc-soft-panel rounded-[1.4rem] p-3">
          <p className="px-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-[var(--mc-muted)]">Stage Navigator</p>
          <div className="mt-2 space-y-1">
            {stageOrder.map((stage) => {
              const status = episode.stageProgress[stage];
              return (
                <button
                  key={stage}
                  onClick={() => setActiveStage(stage)}
                  className={`w-full rounded-2xl border px-3 py-2 text-left transition ${activeStage === stage
                      ? "border-[var(--mc-accent)] bg-white"
                      : "border-transparent hover:border-[var(--mc-stroke)] hover:bg-white/70"
                    }`}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--mc-ink)]">
                      <StageDot status={status} />
                      {stageLabels[stage]}
                    </span>
                    <span className="text-xs text-[var(--mc-muted)]">{statusLabels[status]}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </aside>

        <section className="mc-soft-panel rounded-[1.4rem] p-4">
          <SectionTitle
            kicker={`Current Stage · ${stageLabels[activeStage]}`}
            title={stageHeader}
            description="生成、选择、锁定同等重要。每个阶段都保留可操作入口和 Agent 推荐动作。"
          />

          {activeStage === "planning" ? (
            <div className="mt-4 grid gap-3 xl:grid-cols-2">
              <article className="rounded-2xl border border-[var(--mc-stroke)] bg-white/80 p-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--mc-muted)]">原始内容输入区</p>
                <textarea defaultValue={episode.sourceText} className="mt-2" />
                <div className="mt-3 flex flex-wrap gap-2">
                  <ButtonPill tone="quiet">
                    <Sparkle size={14} />
                    Agent 生成剧情骨架
                  </ButtonPill>
                  <ButtonPill tone="quiet">
                    <ArrowClockwise size={14} />
                    重新拆分
                  </ButtonPill>
                </div>
              </article>
              <article className="rounded-2xl border border-[var(--mc-stroke)] bg-white/80 p-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--mc-muted)]">改编策略</p>
                <input defaultValue={episode.planning.adaptationGoal} className="mt-2" />
                <p className="mt-3 text-xs text-[var(--mc-muted)]">拆分参数：{episode.planning.splitParams}</p>
                <ul className="mt-3 space-y-2 text-sm text-[var(--mc-ink)]">
                  {episode.planning.outline.map((item) => (
                    <li key={item} className="rounded-xl border border-[var(--mc-stroke)] bg-[var(--mc-soft)] p-3">
                      {item}
                    </li>
                  ))}
                </ul>
              </article>
            </div>
          ) : null}

          {activeStage === "script" ? (
            <div className="mt-4 grid gap-3 xl:grid-cols-[1fr_1.2fr]">
              <article className="rounded-2xl border border-[var(--mc-stroke)] bg-white/80 p-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--mc-muted)]">剧情骨架</p>
                <ul className="mt-3 space-y-2 text-sm text-[var(--mc-ink)]">
                  {episode.script.skeleton.map((item) => (
                    <li key={item} className="rounded-xl border border-[var(--mc-stroke)] bg-[var(--mc-soft)] p-3">
                      {item}
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-sm text-[var(--mc-muted)]">改编策略：{episode.script.strategy}</p>
              </article>
              <article className="rounded-2xl border border-[var(--mc-stroke)] bg-white/80 p-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--mc-muted)]">剧本结果区</p>
                <div className="mt-3 space-y-2">
                  {episode.script.draft.map((block) => (
                    <div key={block.id} className="rounded-xl border border-[var(--mc-stroke)] bg-[var(--mc-soft)] p-3">
                      <p className="text-sm font-semibold text-[var(--mc-ink)]">{block.heading}</p>
                      <p className="mt-2 text-sm leading-7 text-[var(--mc-ink)]">{block.content}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <ButtonPill tone="quiet">重新生成段落</ButtonPill>
                  <ButtonPill tone="primary">确认进入资产阶段</ButtonPill>
                </div>
              </article>
            </div>
          ) : null}

          {activeStage === "assets" ? (
            <div className="mt-4 grid gap-3 xl:grid-cols-2">
              <article className="rounded-2xl border border-[var(--mc-stroke)] bg-white/80 p-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--mc-muted)]">本集资产提取</p>
                <div className="mt-3 space-y-2">
                  {episode.assets.extracted.map((asset) => (
                    <div key={asset.id} className="rounded-xl border border-[var(--mc-stroke)] bg-[var(--mc-soft)] p-3">
                      <p className="text-sm font-semibold text-[var(--mc-ink)]">
                        {asset.name} <span className="text-xs text-[var(--mc-muted)]">({asset.type})</span>
                      </p>
                      <p className="text-xs text-[var(--mc-muted)]">匹配系列资产：{asset.matchedSeriesAsset}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <ButtonPill tone="quiet">从剧本重新提取</ButtonPill>
                  <ButtonPill tone="quiet">新增本集资产</ButtonPill>
                </div>
              </article>

              <article className="rounded-2xl border border-[var(--mc-stroke)] bg-white/80 p-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--mc-muted)]">候选与锁定</p>
                <div className="mt-3 space-y-2">
                  {episode.assets.variants.map((variant) => (
                    <div key={variant.assetId + variant.variantName} className="rounded-xl border border-[var(--mc-stroke)] bg-[var(--mc-soft)] p-3">
                      <p className="text-sm font-semibold text-[var(--mc-ink)]">{variant.variantName}</p>
                      <p className="text-xs text-[var(--mc-muted)]">{variant.note}</p>
                      <p className="mt-1 text-xs text-[var(--mc-accent)]">{variant.status}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <ButtonPill tone="quiet">生成图像变体</ButtonPill>
                  <ButtonPill tone="quiet">
                    <Lock size={14} />
                    锁定最终版本
                  </ButtonPill>
                  <ButtonPill tone="primary">升级为系列资产</ButtonPill>
                </div>
              </article>
            </div>
          ) : null}

          {activeStage === "storyboard" ? (
            <div className="mt-4 rounded-2xl border border-[var(--mc-stroke)] bg-white/80 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--mc-muted)]">分镜列表 / 局部修复</p>
              <div className="mt-3 space-y-3">
                {episode.storyboard.frames.map((frame) => (
                  <article key={frame.id} className="rounded-xl border border-[var(--mc-stroke)] bg-[var(--mc-soft)] p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-[var(--mc-ink)]">{frame.shot}</p>
                      <span className="rounded-full border border-[var(--mc-stroke)] px-2 py-1 text-xs text-[var(--mc-muted)]">
                        {frame.status}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-[var(--mc-ink)]">Action: {frame.action}</p>
                    <p className="mt-1 text-sm text-[var(--mc-muted)]">Dialogue: {frame.dialogue}</p>
                    <p className="mt-1 text-xs text-[var(--mc-muted)]">Prompt: {frame.prompt}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <ButtonPill tone="quiet">编辑分镜</ButtonPill>
                      <ButtonPill tone="quiet">局部修复</ButtonPill>
                      <ButtonPill tone="quiet">重排顺序</ButtonPill>
                      <ButtonPill tone="quiet">锁定通过</ButtonPill>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          ) : null}

          {activeStage === "video" ? (
            <div className="mt-4 rounded-2xl border border-[var(--mc-stroke)] bg-white/80 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--mc-muted)]">
                视频候选区（已选 {selectedCount}/{episode.storyboard.frames.length}）
              </p>
              <div className="mt-3 space-y-3">
                {videoCandidates.map((candidate) => (
                  <article key={candidate.id} className="rounded-xl border border-[var(--mc-stroke)] bg-[var(--mc-soft)] p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-[var(--mc-ink)]">
                          {candidate.frameId} · {candidate.model}
                        </p>
                        <p className="text-xs text-[var(--mc-muted)]">
                          {candidate.duration} · {candidate.status}
                        </p>
                      </div>
                      {candidate.selected ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-[var(--mc-good)] bg-[color-mix(in_oklch,var(--mc-good)_16%,white)] px-3 py-1 text-xs font-semibold text-[var(--mc-good)]">
                          <Check size={12} /> 已选主结果
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-2 text-sm text-[var(--mc-ink)]">{candidate.summary}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <ButtonPill tone="quiet">查看候选视频</ButtonPill>
                      <ButtonPill
                        tone="quiet"
                        onClick={() => {
                          setVideoCandidates((prev) =>
                            prev.map((item) => ({
                              ...item,
                              selected: item.id === candidate.id,
                            })),
                          );
                        }}
                      >
                        选择为最终视频
                      </ButtonPill>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          ) : null}

          {activeStage === "review" ? (
            <div className="mt-4 grid gap-3 xl:grid-cols-2">
              <article className="rounded-2xl border border-[var(--mc-stroke)] bg-white/80 p-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--mc-muted)]">阶段完成度</p>
                <p className="mt-2 text-4xl font-bold leading-none text-[var(--mc-ink)]">{episode.review.completion}%</p>
                <p className="mt-2 text-sm text-[var(--mc-muted)]">UC-13: 审校 Agent 汇总缺失项、风险项和完成项。</p>
              </article>
              <article className="rounded-2xl border border-[var(--mc-stroke)] bg-white/80 p-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--mc-muted)]">缺失项清单</p>
                <div className="mt-3 space-y-2">
                  {episode.review.checklist.map((item) => (
                    <div key={item.item} className="rounded-xl border border-[var(--mc-stroke)] bg-[var(--mc-soft)] p-3">
                      <p className="text-sm font-semibold text-[var(--mc-ink)]">
                        {item.done ? "✓" : "!"} {item.item}
                      </p>
                      <p className="mt-1 text-xs text-[var(--mc-muted)]">建议操作：{item.action}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <ButtonPill tone="quiet">
                    <Warning size={14} />
                    回到问题模块
                  </ButtonPill>
                  <ButtonPill tone="primary">确认通过审校</ButtonPill>
                </div>
              </article>
            </div>
          ) : null}

          {activeStage === "export" ? (
            <div className="mt-4 grid gap-3 xl:grid-cols-2">
              <article className="rounded-2xl border border-[var(--mc-stroke)] bg-white/80 p-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--mc-muted)]">导出参数</p>
                <div className="mt-3 space-y-2">
                  {episode.export.options.map((option) => (
                    <div key={option.label} className="rounded-xl border border-[var(--mc-stroke)] bg-[var(--mc-soft)] p-3">
                      <p className="text-xs text-[var(--mc-muted)]">{option.label}</p>
                      <p className="text-sm font-semibold text-[var(--mc-ink)]">{option.value}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <ButtonPill tone="quiet">调整导出参数</ButtonPill>
                  <ButtonPill tone="primary">
                    <DownloadSimple size={14} />
                    发起导出
                  </ButtonPill>
                </div>
              </article>
              <article className="rounded-2xl border border-[var(--mc-stroke)] bg-white/80 p-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--mc-muted)]">历史导出记录</p>
                <div className="mt-3 space-y-2">
                  {episode.export.history.map((history) => (
                    <div key={history.version} className="rounded-xl border border-[var(--mc-stroke)] bg-[var(--mc-soft)] p-3">
                      <p className="text-sm font-semibold text-[var(--mc-ink)]">{history.version}</p>
                      <p className="text-xs text-[var(--mc-muted)]">
                        {history.format} · {history.time} · {history.operator}
                      </p>
                    </div>
                  ))}
                </div>
              </article>
            </div>
          ) : null}
        </section>
      </div>
    </StudioShell>
  );
}