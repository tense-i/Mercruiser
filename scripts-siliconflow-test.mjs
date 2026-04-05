#!/usr/bin/env node

const baseUrl = process.env.MERCRUISER_BASE_URL || 'http://localhost:3000';
const apiKey = process.env.SILICONFLOW_API_KEY;

const silicon = {
  id: 'siliconflow',
  name: 'SiliconFlow',
  provider: 'openai-compatible',
  baseUrl: 'https://api.siliconflow.cn/v1',
  apiKey: apiKey || '',
  enabled: true,
  models: [
    { name: 'DeepSeek V3', modelName: 'deepseek-ai/DeepSeek-V3', type: 'text', supportsTools: true },
    { name: 'Kwai Kolors', modelName: 'Kwai-Kolors/Kolors', type: 'image' },
    { name: 'Wan2.2 T2V', modelName: 'Wan-AI/Wan2.2-T2V-A14B', type: 'video' },
  ],
  config: {
    imageEndpoint: '/images/generations',
    videoCreateEndpoint: '/video/submit',
    videoQueryEndpoint: '/video/status',
    videoQueryMethod: 'POST',
    videoApiFlavor: 'siliconflow-v1',
  },
};

async function call(path, init = {}) {
  const resp = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(init.headers || {}),
    },
  });
  const body = await resp.json().catch(() => ({}));
  return { resp, body };
}

async function ensureVendor() {
  const { resp, body } = await call('/api/v1/vendors', {
    method: 'POST',
    body: JSON.stringify(silicon),
  });
  if (!resp.ok || !body?.ok) {
    throw new Error(`保存硅基流动配置失败: ${body?.error || resp.status}`);
  }
}

async function testVendorModels() {
  const models = [
    { type: 'text', modelRef: 'siliconflow:deepseek-ai/DeepSeek-V3' },
    { type: 'image', modelRef: 'siliconflow:Kwai-Kolors/Kolors' },
    { type: 'video', modelRef: 'siliconflow:Wan-AI/Wan2.2-T2V-A14B' },
  ];

  const results = [];
  for (const item of models) {
    const { resp, body } = await call('/api/v1/vendors/test', {
      method: 'POST',
      body: JSON.stringify(item),
    });
    results.push({
      ...item,
      ok: resp.ok && body?.ok,
      status: body?.data?.status || body?.error || `HTTP_${resp.status}`,
      raw: body,
    });
  }
  return results;
}

async function createSeriesAndRunPipeline() {
  const rawText = [
    '第一章 夜雨电话',
    '女主在夜雨中接到匿名电话，决定回到老宅。',
    '',
    '第二章 旧照线索',
    '她发现旧照片与失踪案有关，冲突升级。',
  ].join('\n');

  const { resp, body } = await call('/api/v1/series', {
    method: 'POST',
    body: JSON.stringify({
      title: `SiliconFlow联调-${Date.now()}`,
      summary: '硅基流动端到端联调',
      rawText,
      autoAnalyzeOnImport: true,
    }),
  });

  if (!resp.ok || !body?.ok) {
    throw new Error(`创建系列失败: ${body?.error || resp.status}`);
  }

  const seriesId = body.data.seriesId;
  let episodeId = body.data.episodeIds?.[0];

  for (let i = 0; i < 20; i += 1) {
    const detail = await call(`/api/v1/series/${seriesId}`);
    const episodes = detail.body?.data?.episodes || [];
    if (!episodeId && episodes[0]?.id) {
      episodeId = episodes[0].id;
    }
    if (episodes.length > 0 && episodes.every((ep) => ep.stage === 'assets' || ep.stage === 'script' || ep.status === 'blocked')) {
      break;
    }
    await new Promise((r) => setTimeout(r, 1500));
  }

  if (!episodeId) {
    throw new Error('未找到可测试集数');
  }

  const actions = ['assets', 'storyboard', 'video', 'final-cut'];
  const actionResults = [];
  for (const action of actions) {
    const { resp: actionResp, body: actionBody } = await call(`/api/v1/episodes/${episodeId}/actions`, {
      method: 'POST',
      body: JSON.stringify({
        action,
        textModelRef: 'siliconflow:deepseek-ai/DeepSeek-V3',
        videoModelRef: 'siliconflow:Wan-AI/Wan2.2-T2V-A14B',
      }),
    });
    actionResults.push({ action, ok: actionResp.ok && actionBody?.ok, body: actionBody });
  }

  const snapshot = await call(`/api/v1/episodes/${episodeId}`);
  const finalCutUrl = snapshot.body?.data?.finalCut?.fileUrl || null;

  return { seriesId, episodeId, actionResults, finalCutUrl };
}

async function main() {
  if (!apiKey) {
    console.error('Missing SILICONFLOW_API_KEY.');
    process.exit(2);
  }

  await ensureVendor();

  const vendorTests = await testVendorModels();
  const e2e = await createSeriesAndRunPipeline();

  const summary = {
    baseUrl,
    vendorTests: vendorTests.map((item) => ({
      type: item.type,
      modelRef: item.modelRef,
      ok: item.ok,
      status: item.status,
    })),
    e2e: {
      seriesId: e2e.seriesId,
      episodeId: e2e.episodeId,
      actions: e2e.actionResults.map((item) => ({ action: item.action, ok: item.ok })),
      finalCutUrl: e2e.finalCutUrl,
    },
  };

  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
