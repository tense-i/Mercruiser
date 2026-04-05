import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import test from "node:test";
import Database from "better-sqlite3";

const PORT = 3600 + Math.floor(Math.random() * 300);
const BASE_URL = `http://127.0.0.1:${PORT}`;

async function fetchJson(path, init) {
  const response = await fetch(`${BASE_URL}${path}`, init);
  const text = await response.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch (error) {
    throw new Error(`Expected JSON from ${path}, got: ${text}\n${error}`);
  }
  return { response, json };
}

async function waitForServer(server, logs) {
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) {
      throw new Error(`Next server exited early with code ${server.exitCode}\n${logs.join("")}`);
    }

    try {
      const response = await fetch(`${BASE_URL}/api/v1/series`);
      if (response.ok) {
        return;
      }
    } catch {
      // retry
    }

    await sleep(1_000);
  }

  throw new Error(`Timed out waiting for Next server\n${logs.join("")}`);
}

test("storyboard workbench loads separately from shot planning and preserves video compatibility", { timeout: 120_000 }, async () => {
  const logs = [];
  const server = spawn("npx", ["next", "start", "--port", String(PORT)], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      NEXT_TELEMETRY_DISABLED: "1",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  server.stdout.on("data", (chunk) => logs.push(String(chunk)));
  server.stderr.on("data", (chunk) => logs.push(String(chunk)));

  let seriesId = null;

  try {
    await waitForServer(server, logs);

    const uniqueSuffix = Date.now();
    const createResult = await fetchJson("/api/v1/series", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: `Storyboard Smoke ${uniqueSuffix}`,
        summary: "storyboard workbench smoke",
        genre: "悬疑",
        episodeSources: [
          {
            title: "分镜工作台测试集",
            synopsis: "验证分镜与镜头规划拆分。",
            text: "主角在仓库内对峙，灯光闪烁，随后快速切到近景对白。",
          },
        ],
        autoAnalyzeOnImport: false,
      }),
    });

    assert.equal(createResult.response.status, 200);
    assert.equal(createResult.json.ok, true);
    seriesId = createResult.json.data.seriesId;
    const [episodeId] = createResult.json.data.episodeIds;
    assert.ok(episodeId);

    const scriptResult = await fetchJson(`/api/v1/episodes/${episodeId}/script-workspace`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        scriptText: "镜头一：仓库全景建立空间。\n镜头二：近景捕捉人物对峙对白。",
      }),
    });
    assert.equal(scriptResult.response.status, 200);
    assert.equal(scriptResult.json.ok, true);

    const shotResult = await fetchJson(`/api/v1/episodes/${episodeId}/shots`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        scene: "仓库夜景",
        description: "先建立空间，再切近景对峙。",
      }),
    });
    assert.equal(shotResult.response.status, 200);
    assert.equal(shotResult.json.ok, true);

    const db = new Database(join(process.cwd(), "data", "mercruiser-mvp.sqlite"));
    const storyboardId = `storyboard_${randomUUID()}`;
    const candidateId = `video_${randomUUID()}`;
    const now = new Date().toISOString();

    db.prepare(
      `INSERT INTO episode_storyboards (
        id, episode_id, shot_index, title, action, dialogue, prompt, duration_seconds, asset_refs_json, status, image_url, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      storyboardId,
      episodeId,
      1,
      "镜头 1 · 初版",
      "建立仓库空间和人物站位。",
      "角色A：别再退了。",
      "warehouse storyboard prompt",
      4,
      JSON.stringify([]),
      "draft",
      null,
      now,
    );

    db.prepare("UPDATE episodes SET stage = ?, status = ?, updated_at = ? WHERE id = ?").run(
      "storyboard",
      "ready",
      now,
      episodeId,
    );

    db.prepare(
      `INSERT INTO episode_video_candidates (
        id, episode_id, storyboard_id, provider, model, status, summary, video_url, local_path, selected, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      candidateId,
      episodeId,
      storyboardId,
      "local-fallback",
      "ffmpeg-synthetic",
      "ready",
      "seeded compatibility candidate",
      "/mvp-media/fallback.mp4",
      "/tmp/fallback.mp4",
      1,
      now,
    );

    db.close();

    const workbenchPage = await fetch(`${BASE_URL}/series/${seriesId}/episodes/${episodeId}`);
    assert.equal(workbenchPage.status, 200);
    const workbenchHtml = await workbenchPage.text();
    assert.match(workbenchHtml, /结构化镜头表/);
    assert.match(workbenchHtml, /故事板工作台/);

    const storyboardsGet = await fetchJson(`/api/v1/episodes/${episodeId}/storyboards`);
    assert.equal(storyboardsGet.response.status, 200);
    assert.equal(storyboardsGet.json.ok, true);
    assert.ok(storyboardsGet.json.data.length > 0);

    const firstStoryboard = storyboardsGet.json.data.find((item) => item.id === storyboardId);
    assert.ok(firstStoryboard);
    const patchResult = await fetchJson(`/api/v1/episodes/${episodeId}/storyboards`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        storyboardId: firstStoryboard.id,
        title: "镜头 1 · 修订版",
        action: "改为更明确的推镜动作与角色站位。",
        dialogue: "角色A：别再退了。",
        prompt: "revised storyboard prompt",
        durationSeconds: 5,
        status: "fixed",
      }),
    });

    assert.equal(patchResult.response.status, 200);
    assert.equal(patchResult.json.ok, true);
    assert.equal(patchResult.json.data.storyboard.id, firstStoryboard.id);

    const patchedGet = await fetchJson(`/api/v1/episodes/${episodeId}/storyboards`);
    const patchedStoryboard = patchedGet.json.data.find((item) => item.id === firstStoryboard.id);
    assert.ok(patchedStoryboard);
    assert.equal(patchedStoryboard.title, "镜头 1 · 修订版");
    assert.equal(patchedStoryboard.action, "改为更明确的推镜动作与角色站位。");
    assert.equal(patchedStoryboard.dialogue, "角色A：别再退了。");
    assert.equal(patchedStoryboard.prompt, "revised storyboard prompt");
    assert.equal(patchedStoryboard.durationSeconds, 5);
    assert.equal(patchedStoryboard.status, "fixed");

    const episodeGet = await fetchJson(`/api/v1/episodes/${episodeId}`);
    assert.equal(episodeGet.response.status, 200);
    assert.equal(episodeGet.json.data.episode.stage, "storyboard");
    assert.equal(episodeGet.json.data.episode.status, "ready");
    const relatedStoryboard = episodeGet.json.data.storyboards.find((item) => item.id === firstStoryboard.id);
    assert.ok(relatedStoryboard);
    assert.equal(relatedStoryboard.prompt, "revised storyboard prompt");
    assert.equal(relatedStoryboard.durationSeconds, 5);
    const relatedCandidates = episodeGet.json.data.videos.filter((item) => item.storyboardId === firstStoryboard.id);
    assert.equal(relatedCandidates.length, 1);
    assert.equal(relatedCandidates[0].id, candidateId);
  } finally {
    if (seriesId) {
      try {
        await fetchJson(`/api/v1/series/${seriesId}`, { method: "DELETE" });
      } catch {
        // best-effort cleanup
      }
    }

    if (server.exitCode === null) {
      server.kill("SIGTERM");
      await sleep(3_000);
    }

    if (server.exitCode === null) {
      server.kill("SIGKILL");
    }
  }
});
