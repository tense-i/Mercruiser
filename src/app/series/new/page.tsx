"use client";

import Link from "next/link";
import { useRef, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { ButtonPill, OrchestratorPanel, SectionTitle, StudioShell } from "@/components/studio/studio-shell";

function isTextFile(fileName: string): boolean {
  const lower = fileName.toLowerCase();
  return lower.endsWith(".txt") || lower.endsWith(".md");
}

export default function NewSeriesPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [name, setName] = useState("New Chronicle");
  const [summary, setSummary] = useState("一个以城市传闻为线索的悬疑短剧系列。");
  const [rawText, setRawText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [readingFile, setReadingFile] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = name.trim().length > 0 && rawText.trim().length > 0 && !submitting && !readingFile && !fileError;

  const onSelectFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setFileError(null);
    if (!file) {
      return;
    }
    if (!isTextFile(file.name)) {
      setFileError("仅支持 TXT / MD 文件。");
      return;
    }

    setReadingFile(true);
    const reader = new FileReader();
    reader.onload = () => {
      setReadingFile(false);
      const content = typeof reader.result === "string" ? reader.result : "";
      if (!content.trim()) {
        setFileError("文件内容为空，请重新选择。");
        return;
      }
      setRawText(content.replace(/\r\n/g, "\n"));
    };
    reader.onerror = () => {
      setReadingFile(false);
      setFileError("读取文件失败，请重试。");
    };
    reader.readAsText(file, "utf-8");
  };

  const submit = async () => {
    if (!canSubmit) {
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/v1/series", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: name.trim(),
          summary: summary.trim() || undefined,
          rawText: rawText.trim(),
          autoAnalyzeOnImport: true,
        }),
      });
      const json = (await response.json()) as { ok: boolean; data?: { seriesId: string }; error?: string };
      if (!response.ok || !json.ok || !json.data?.seriesId) {
        throw new Error(json.error ?? "创建失败");
      }
      router.push(`/series/${json.data.seriesId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "创建失败");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <StudioShell
      navKey="workspace"
      eyebrow="UC-01"
      title="创建系列"
      description="统一入口：粘贴或上传小说后创建系列，并自动异步生成各集剧本。"
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
          focus="创建系列并自动生成剧本"
          completion={rawText.trim().length > 0 ? 78 : 36}
          blocking={rawText.trim().length > 0 ? "等待确认创建" : "需要导入或粘贴小说文本"}
          nextStep="创建后自动异步推进到剧本阶段"
          recommendations={["检查文本完整性", "补充系列简介", "创建后进入系列详情"]}
          queuePreview={[]}
        />
      }
    >
      <section className="mc-soft-panel rounded-2xl p-4">
        <SectionTitle
          kicker="Series Form"
          title="Series basics"
          description="支持 TXT/MD 导入或直接粘贴文本。"
        />
        <div className="mt-4 grid gap-3">
          <label className="grid gap-1 text-sm">
            系列名称（必填）
            <input value={name} onChange={(event) => setName(event.target.value)} required />
          </label>
          <label className="grid gap-1 text-sm">
            系列简介
            <textarea value={summary} onChange={(event) => setSummary(event.target.value)} />
          </label>
          <label className="grid gap-1 text-sm">
            导入小说文件（TXT/MD）
            <input ref={fileInputRef} type="file" accept=".txt,.md,text/plain,text/markdown" onChange={onSelectFile} />
          </label>
          {fileError ? <p className="text-sm text-[var(--mc-danger)]">{fileError}</p> : null}
          {readingFile ? <p className="text-xs text-[var(--mc-muted)]">正在读取文件...</p> : null}
          <label className="grid gap-1 text-sm">
            小说文本
            <textarea value={rawText} onChange={(event) => setRawText(event.target.value)} rows={12} />
          </label>
          {error ? <p className="text-sm text-[var(--mc-danger)]">{error}</p> : null}
          <div className="flex justify-end gap-2">
            <ButtonPill tone="quiet" onClick={() => router.push("/workspace")}>取消</ButtonPill>
            <ButtonPill tone="primary" onClick={submit} disabled={!canSubmit}>
              {submitting ? "创建中..." : "创建并自动生成剧本"}
            </ButtonPill>
          </div>
        </div>
      </section>
    </StudioShell>
  );
}
