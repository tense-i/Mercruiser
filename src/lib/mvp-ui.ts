import type { EpisodeStage, StageStatus } from "@/server/mvp/types";

export const stageLabels: Record<EpisodeStage, string> = {
  planning: "策划",
  script: "剧本",
  assets: "资产",
  storyboard: "分镜",
  video: "视频",
  review: "审校",
  export: "成片",
};

export const statusLabels: Record<StageStatus, string> = {
  not_started: "未开始",
  in_progress: "进行中",
  blocked: "阻塞",
  ready: "可执行",
  done: "完成",
};

export function stageProgressPercent(stage: EpisodeStage): number {
  const order: EpisodeStage[] = ["planning", "script", "assets", "storyboard", "video", "review", "export"];
  const index = order.indexOf(stage);
  if (index < 0) {
    return 0;
  }
  return Math.round(((index + 1) / order.length) * 100);
}

export function toneFromStatus(status: StageStatus): "warning" | "good" | "active" {
  if (status === "done") {
    return "good";
  }
  if (status === "blocked") {
    return "warning";
  }
  return "active";
}

export function formatIso(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")} ${String(
    date.getHours(),
  ).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

