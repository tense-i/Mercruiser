"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowClockwise } from "@phosphor-icons/react/dist/ssr";
import { ButtonPill } from "@/components/studio/studio-shell";

export function TaskRerunButton({
  taskId,
  label,
  tone = "primary",
  onSuccess,
}: {
  taskId: string;
  label: string;
  tone?: "default" | "primary" | "quiet" | "danger";
  onSuccess?: () => void;
}) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const rerunTask = async () => {
    if (running) {
      return;
    }

    setRunning(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/v1/tasks/${taskId}/retry`, {
        method: "POST",
      });
      const json = (await response.json()) as {
        ok: boolean;
        data?: { message?: string };
        error?: string;
      };

      if (!response.ok || !json.ok) {
        throw new Error(json.error ?? "重新执行失败");
      }

      setMessage(json.data?.message ?? "已重新触发当前阶段。");
      onSuccess?.();
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "重新执行失败");
    } finally {
      setRunning(false);
    }
  };

  const isError = Boolean(message && !message.startsWith("已"));

  return (
    <div className="space-y-2">
      <ButtonPill tone={tone} onClick={() => void rerunTask()} disabled={running}>
        <ArrowClockwise size={14} />
        {running ? "执行中..." : label}
      </ButtonPill>
      {message ? <p className={`text-sm ${isError ? "text-[var(--mc-danger)]" : "text-[var(--mc-muted)]"}`}>{message}</p> : null}
    </div>
  );
}
