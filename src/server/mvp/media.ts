import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, relative, sep } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const PUBLIC_ROOT = join(process.cwd(), "public");
const MEDIA_ROOT = join(PUBLIC_ROOT, "mvp-media");

function colorFromSeed(seed: string): string {
  const hash = createHash("md5").update(seed).digest("hex").slice(0, 6);
  return `#${hash}`;
}

function toPublicUrl(absPath: string): string {
  const rel = relative(PUBLIC_ROOT, absPath).split(sep).join("/");
  return `/${rel}`;
}

async function ensureDir(path: string): Promise<void> {
  await mkdir(path, { recursive: true });
}

export async function writePublicJson(filePath: string, payload: unknown): Promise<string> {
  const absPath = join(MEDIA_ROOT, filePath);
  await ensureDir(dirname(absPath));
  await writeFile(absPath, JSON.stringify(payload, null, 2), "utf8");
  return toPublicUrl(absPath);
}

export async function createSyntheticClip(input: {
  episodeId: string;
  storyboardId: string;
  index: number;
  durationSeconds: number;
  label: string;
}): Promise<{ absPath: string; publicUrl: string }> {
  const dir = join(MEDIA_ROOT, input.episodeId, "videos");
  await ensureDir(dir);

  const filename = `${input.storyboardId}-${input.index + 1}.mp4`;
  const absPath = join(dir, filename);
  const color = colorFromSeed(`${input.episodeId}:${input.storyboardId}:${input.index}`);

  // Keep ffmpeg filter text simple to avoid escaping pitfalls in labels.
  const safeLabel = input.label.replace(/[^0-9A-Za-z _-]/g, "").slice(0, 48) || "Shot";
  const vf = `drawtext=text='${safeLabel}':fontcolor=white:fontsize=34:x=(w-text_w)/2:y=(h-text_h)/2`;

  await execFileAsync("ffmpeg", [
    "-y",
    "-f",
    "lavfi",
    "-i",
    `color=c=${color}:s=1280x720:d=${Math.max(1, input.durationSeconds)}`,
    "-vf",
    vf,
    "-pix_fmt",
    "yuv420p",
    "-c:v",
    "libx264",
    "-t",
    String(Math.max(1, input.durationSeconds)),
    absPath,
  ]);

  return { absPath, publicUrl: toPublicUrl(absPath) };
}

export async function concatFinalCut(input: {
  episodeId: string;
  clipAbsPaths: string[];
}): Promise<{ absPath: string; publicUrl: string; manifestUrl: string }> {
  const dir = join(MEDIA_ROOT, input.episodeId, "final-cut");
  await ensureDir(dir);

  const manifestPath = join(dir, "clips.txt");
  const manifest = input.clipAbsPaths
    .map((clip) => `file '${clip.replace(/'/g, "'\\''")}'`)
    .join("\n");
  await writeFile(manifestPath, manifest, "utf8");

  const outputPath = join(dir, `episode-${input.episodeId}.mp4`);

  await execFileAsync("ffmpeg", [
    "-y",
    "-f",
    "concat",
    "-safe",
    "0",
    "-i",
    manifestPath,
    "-c",
    "copy",
    outputPath,
  ]);

  return {
    absPath: outputPath,
    publicUrl: toPublicUrl(outputPath),
    manifestUrl: toPublicUrl(manifestPath),
  };
}
