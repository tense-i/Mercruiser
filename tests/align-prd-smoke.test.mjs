import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import test from "node:test";

const PORT = 3300 + Math.floor(Math.random() * 300);
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
      // keep polling until ready
    }

    await sleep(1_000);
  }

  throw new Error(`Timed out waiting for Next server\n${logs.join("")}`);
}

test("PRD-aligned episode edit flow and script workspace persist against real data", { timeout: 180_000 }, async () => {
  const logs = [];
  const server = spawn("npx", ["next", "dev", "--port", String(PORT)], {
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
    const createPayload = {
      title: `Align PRD Smoke ${uniqueSuffix}`,
      summary: "smoke test series",
      genre: "都市",
      episodeSources: [
        {
          title: "原始集标题",
          synopsis: "原始集概要",
          text: "第一集原始正文",
        },
      ],
      autoAnalyzeOnImport: false,
    };

    const createResult = await fetchJson("/api/v1/series", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(createPayload),
    });

    assert.equal(createResult.response.status, 200);
    assert.equal(createResult.json.ok, true);
    seriesId = createResult.json.data.seriesId;
    const [episodeId] = createResult.json.data.episodeIds;
    assert.ok(seriesId);
    assert.ok(episodeId);

    const initialEditPage = await fetch(`${BASE_URL}/series/${seriesId}/episodes/${episodeId}/edit`);
    assert.equal(initialEditPage.status, 200);
    const initialEditHtml = await initialEditPage.text();
    assert.match(initialEditHtml, /原始集标题/);
    assert.match(initialEditHtml, /原始集概要/);

    const episodePatch = await fetchJson(`/api/v1/episodes/${episodeId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title: "更新后的集标题",
        synopsis: "更新后的集概要",
      }),
    });

    assert.equal(episodePatch.response.status, 200);
    assert.equal(episodePatch.json.ok, true);
    assert.equal(episodePatch.json.data.episode.title, "更新后的集标题");
    assert.equal(episodePatch.json.data.episode.synopsis, "更新后的集概要");

    const episodeGet = await fetchJson(`/api/v1/episodes/${episodeId}`);
    assert.equal(episodeGet.response.status, 200);
    assert.equal(episodeGet.json.data.episode.title, "更新后的集标题");
    assert.equal(episodeGet.json.data.episode.synopsis, "更新后的集概要");

    const updatedEditPage = await fetch(`${BASE_URL}/series/${seriesId}/episodes/${episodeId}/edit`);
    assert.equal(updatedEditPage.status, 200);
    const updatedEditHtml = await updatedEditPage.text();
    assert.match(updatedEditHtml, /更新后的集标题/);
    assert.match(updatedEditHtml, /更新后的集概要/);

    const workspacePatch = await fetchJson(`/api/v1/episodes/${episodeId}/script-workspace`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        scriptText: "更新后的剧本正文",
        targetWords: 1500,
        chapterCursor: episodeId,
        config: {
          aspectRatio: "16:9",
          creationMode: "reference_video",
          visualTone: "anime",
        },
      }),
    });

    assert.equal(workspacePatch.response.status, 200);
    assert.equal(workspacePatch.json.ok, true);
    assert.equal(workspacePatch.json.data.scriptText, "更新后的剧本正文");
    assert.equal(workspacePatch.json.data.targetWords, 1500);
    assert.equal(workspacePatch.json.data.config.aspectRatio, "16:9");
    assert.equal(workspacePatch.json.data.config.creationMode, "reference_video");
    assert.equal(workspacePatch.json.data.config.visualTone, "anime");

    const workspaceGet = await fetchJson(`/api/v1/episodes/${episodeId}/script-workspace`);
    assert.equal(workspaceGet.response.status, 200);
    assert.equal(workspaceGet.json.data.scriptText, "更新后的剧本正文");
    assert.equal(workspaceGet.json.data.targetWords, 1500);
    assert.equal(workspaceGet.json.data.config.aspectRatio, "16:9");
    assert.equal(workspaceGet.json.data.config.creationMode, "reference_video");
    assert.equal(workspaceGet.json.data.config.visualTone, "anime");

    const episodeAfterScript = await fetchJson(`/api/v1/episodes/${episodeId}`);
    assert.equal(episodeAfterScript.response.status, 200);
    assert.equal(episodeAfterScript.json.data.episode.stage, "assets");
    assert.equal(episodeAfterScript.json.data.episode.status, "ready");
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
