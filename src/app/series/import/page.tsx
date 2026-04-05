"use client";

import Link from "next/link";
import { type ChangeEvent, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ButtonPill, OrchestratorPanel, SectionTitle, StudioShell } from "@/components/studio/studio-shell";

function previewEpisodes(rawText: string, maxEpisodes: number): Array<{ id: string; title: string; summary: string }> {
  const chunks = rawText
    .split(/\n{2,}/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, Math.max(1, maxEpisodes));

  return chunks.map((text, index) => ({
    id: `preview-${index + 1}`,
    title: `第 ${index + 1} 集`,
    summary: text.length > 80 ? `${text.slice(0, 80)}...` : text,
  }));
}

function formatBytes(value: number): string {
  if (!Number.isFinite(value) || value <= 0) {
    return "0 B";
  }
  if (value < 1024) {
    return `${value} B`;
  }
  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function isTextFile(fileName: string): boolean {
  const lower = fileName.toLowerCase();
  return lower.endsWith(".txt") || lower.endsWith(".md");
}

type UploadMeta = {
  name: string;
  size: number;
  chars: number;
};

export default function SeriesImportPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [step, setStep] = useState(1);
  const [title, setTitle] = useState("未命名系列");
  const [summary, setSummary] = useState("");
  const [genre, setGenre] = useState("AI 短剧");
  const [rawText, setRawText] = useState("");
  const [worldview, setWorldview] = useState("");
  const [visualGuide, setVisualGuide] = useState("");
  const [directorGuide, setDirectorGuide] = useState("");
  const [maxEpisodes, setMaxEpisodes] = useState(8);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [readingFile, setReadingFile] = useState(false);
  const [uploadMeta, setUploadMeta] = useState<UploadMeta | null>(null);

  const previews = useMemo(() => previewEpisodes(rawText, maxEpisodes), [rawText, maxEpisodes]);

  const canSubmit =
    title.trim().length > 0 &&
    rawText.trim().length > 0 &&
    !submitting &&
    !readingFile &&
    !fileError;

  const onSelectFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setFileError(null);
    setError(null);

    if (!file) {
      return;
    }
    if (!isTextFile(file.name)) {
      setUploadMeta(null);
      setFileError("仅支持 TXT / MD 文件。");
      return;
    }

    setReadingFile(true);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const content = typeof reader.result === "string" ? reader.result : "";
        const normalized = content.replace(/\r\n/g, "\n");
        if (!normalized.trim()) {
          setRawText("");
          setUploadMeta(null);
          setFileError("文件内容为空，请选择有效文本。");
          return;
        }
        setRawText(normalized);
        setUploadMeta({
          name: file.name,
          size: file.size,
          chars: normalized.length,
        });
      } finally {
        setReadingFile(false);
      }
    };
    reader.onerror = () => {
      setReadingFile(false);
      setUploadMeta(null);
      setFileError("读取文件失败，请重试。");
    };
    reader.readAsText(file, "utf-8");
  };

  const clearFile = () => {
    setUploadMeta(null);
    setFileError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const submitImport = async () => {
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
          title: title.trim(),
          summary: summary.trim() || undefined,
          genre: genre.trim() || undefined,
          worldview: worldview.trim() || undefined,
          visualGuide: visualGuide.trim() || undefined,
          directorGuide: directorGuide.trim() || undefined,
          rawText: rawText.trim(),
          maxEpisodes,
          autoAnalyzeOnImport: true,
        }),
      });
      const json = (await response.json()) as {
        ok: boolean;
        data?: { seriesId: string };
        error?: string;
      };
      if (!response.ok || !json.ok || !json.data?.seriesId) {
        throw new Error(json.error ?? "导入失败");
      }
      router.push(`/series/${json.data.seriesId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "导入失败");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <StudioShell
      navKey="workspace"
      eyebrow="UC-03"
      title="导入长文本创建系列"
      description="上传长文本并拆分为可执行集数：上传 -> 参数 -> 预览 -> 确认。"
      actions={
        <Link
          href="/workspace"
          className="inline-flex items-center rounded-lg border border-[var(--mc-stroke)] bg-white px-3 py-1.5 text-sm text-[var(--mc-ink)]"
        >
          返回工作区
        </Link>
      }
      aside={
        <OrchestratorPanel
          title="Import Flow"
          focus={`Step ${step} / 4`}
          completion={step * 25}
          blocking={step < 3 ? "尚未完成分集预览" : "等待确认创建并自动分析"}
          nextStep={step < 4 ? "继续下一步" : "确认后创建系列并自动分析到剧本阶段"}
          recommendations={["检查文件格式", "优化拆分参数", "确认分集预览"]}
          queuePreview={[]}
        />
      }
    >
      <section className="mc-soft-panel rounded-2xl p-4">
        <SectionTitle kicker="Import Wizard" title="Long text to episodes" description="对应业务用例 UC-03。" />

        <div className="mt-3 flex flex-wrap gap-2">
          {[1, 2, 3, 4].map((idx) => (
            <button
              key={idx}
              onClick={() => setStep(idx)}
              className={`rounded-md border px-3 py-1 text-sm ${
                idx === step
                  ? "border-[var(--mc-accent)] bg-[color-mix(in_oklch,var(--mc-accent)_10%,white)]"
                  : "border-[var(--mc-stroke)]"
              }`}
            >
              Step {idx}
            </button>
          ))}
        </div>

        <div className="mt-4 rounded-xl border border-[var(--mc-stroke)] bg-[var(--mc-soft)] p-3">
          {step === 1 ? (
            <div className="grid gap-2">
              <p className="text-sm font-semibold text-[var(--mc-ink)]">输入系列信息并导入文件</p>
              <label className="grid gap-1 text-sm">
                系列标题
                <input value={title} onChange={(event) => setTitle(event.target.value)} />
              </label>
              <label className="grid gap-1 text-sm">
                系列简介
                <textarea value={summary} onChange={(event) => setSummary(event.target.value)} />
              </label>
              <label className="grid gap-1 text-sm">
                导入小说文件（TXT/MD）
                <input ref={fileInputRef} type="file" accept=".txt,.md,text/plain,text/markdown" onChange={onSelectFile} />
              </label>
              {uploadMeta ? (
                <div className="rounded-lg border border-[var(--mc-stroke)] bg-white p-3 text-xs text-[var(--mc-muted)]">
                  <p>文件：{uploadMeta.name}</p>
                  <p>大小：{formatBytes(uploadMeta.size)}</p>
                  <p>字符数：{uploadMeta.chars}</p>
                  <div className="mt-2">
                    <ButtonPill tone="quiet" onClick={clearFile}>
                      清除文件
                    </ButtonPill>
                  </div>
                </div>
              ) : null}
              {fileError ? <p className="text-sm text-[var(--mc-danger)]">{fileError}</p> : null}
              <label className="grid gap-1 text-sm">
                长文本内容（可手动编辑）
                <textarea value={rawText} onChange={(event) => setRawText(event.target.value)} rows={10} />
              </label>
              {readingFile ? <p className="text-xs text-[var(--mc-muted)]">正在读取文件...</p> : null}
            </div>
          ) : null}

          {step === 2 ? (
            <div className="grid gap-2 md:grid-cols-2">
              <label className="grid gap-1 text-sm">
                最大拆分集数
                <select value={String(maxEpisodes)} onChange={(event) => setMaxEpisodes(Number(event.target.value))}>
                  {[4, 6, 8, 10, 12].map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-sm">
                题材
                <input value={genre} onChange={(event) => setGenre(event.target.value)} />
              </label>
              <label className="grid gap-1 text-sm md:col-span-2">
                世界观（可选）
                <textarea value={worldview} onChange={(event) => setWorldview(event.target.value)} />
              </label>
              <label className="grid gap-1 text-sm md:col-span-2">
                视觉规则（可选）
                <textarea value={visualGuide} onChange={(event) => setVisualGuide(event.target.value)} />
              </label>
              <label className="grid gap-1 text-sm md:col-span-2">
                导演规则（可选）
                <textarea value={directorGuide} onChange={(event) => setDirectorGuide(event.target.value)} />
              </label>
            </div>
          ) : null}

          {step === 3 ? (
            <div className="grid gap-2">
              <p className="text-sm font-semibold text-[var(--mc-ink)]">分集预览（本地预估）</p>
              {previews.length === 0 ? (
                <div className="rounded-lg border border-[var(--mc-stroke)] bg-white p-3 text-xs text-[var(--mc-muted)]">
                  暂无可预览内容，请先导入或粘贴文本。
                </div>
              ) : (
                previews.map((episode) => (
                  <div key={episode.id} className="rounded-lg border border-[var(--mc-stroke)] bg-white p-3">
                    <p className="text-sm font-semibold text-[var(--mc-ink)]">{episode.title}</p>
                    <p className="text-xs text-[var(--mc-muted)]">{episode.summary}</p>
                  </div>
                ))
              )}
            </div>
          ) : null}

          {step === 4 ? (
            <div className="space-y-2 text-sm text-[var(--mc-ink)]">
              <p>确认创建后将自动异步分析到剧本阶段（实体 → 剧本）。</p>
              <p>系列：{title}</p>
              <p>预计集数：{previews.length}</p>
              {error ? <p className="text-[var(--mc-danger)]">{error}</p> : null}
            </div>
          ) : null}
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <ButtonPill tone="quiet" onClick={() => setStep((prev) => Math.max(1, prev - 1))}>
            上一步
          </ButtonPill>
          {step < 4 ? (
            <ButtonPill tone="primary" onClick={() => setStep((prev) => Math.min(4, prev + 1))}>
              下一步
            </ButtonPill>
          ) : (
            <ButtonPill tone="primary" onClick={submitImport} disabled={!canSubmit}>
              {submitting ? "创建中..." : "确认并创建"}
            </ButtonPill>
          )}
        </div>
      </section>
    </StudioShell>
  );
}
