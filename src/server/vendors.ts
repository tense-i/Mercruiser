import type { LanguageModel } from "ai";
import { generateText } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { mvpStore } from "@/server/mvp/store";
import type { VendorConfig, VendorModel, VendorModelType } from "@/server/mvp/types";

function trimSlash(value: string): string {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

function buildHeaders(vendor: VendorConfig): Record<string, string> {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${vendor.apiKey.replace(/^Bearer\s+/i, "")}`,
  };
}

function buildUrl(vendor: VendorConfig, path: string): string {
  if (/^https?:\/\//i.test(path)) {
    return path;
  }
  return `${trimSlash(vendor.baseUrl)}${path.startsWith("/") ? "" : "/"}${path}`;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function isSiliconflowVideoApi(vendor: VendorConfig): boolean {
  return (vendor.config.videoApiFlavor ?? "").toLowerCase().includes("siliconflow");
}

function toSiliconflowImageSize(aspectRatio?: string): string {
  if (aspectRatio === "9:16") {
    return "720x1280";
  }
  if (aspectRatio === "1:1") {
    return "960x960";
  }
  return "1280x720";
}

function extractVideoTaskId(payload: Record<string, unknown>): string | undefined {
  const data = asRecord(payload.data);
  return (
    (payload.requestId as string | undefined) ??
    (payload.request_id as string | undefined) ??
    (payload.id as string | undefined) ??
    (payload.task_id as string | undefined) ??
    (data?.requestId as string | undefined) ??
    (data?.request_id as string | undefined) ??
    (data?.id as string | undefined)
  );
}

function extractVideoUrl(payload: Record<string, unknown>): string | undefined {
  const data = asRecord(payload.data);
  const content = asRecord(payload.content);
  const result = asRecord(payload.result);
  const results = asRecord(payload.results);
  const videosFromResults = asArray(results?.videos).map((item) => asRecord(item)).filter(Boolean) as Array<Record<string, unknown>>;

  return (
    (payload.video_url as string | undefined) ??
    (data?.video_url as string | undefined) ??
    (content?.video_url as string | undefined) ??
    (result?.video_url as string | undefined) ??
    (videosFromResults[0]?.url as string | undefined)
  );
}

function extractVideoStatus(payload: Record<string, unknown>): string {
  const data = asRecord(payload.data);
  const results = asRecord(payload.results);
  const result = asRecord(payload.result);
  const statusRaw = String(
    payload.status ??
      data?.status ??
      results?.status ??
      result?.status ??
      results?.state ??
      "",
  ).toLowerCase();
  return statusRaw;
}

function getLanguageModel(vendor: VendorConfig, modelName: string): LanguageModel {
  if (vendor.provider === "openai") {
    return createOpenAI({
      apiKey: vendor.apiKey,
      baseURL: vendor.baseUrl,
    }).chat(modelName);
  }

  if (vendor.provider === "google") {
    return createGoogleGenerativeAI({
      apiKey: vendor.apiKey,
      baseURL: vendor.baseUrl,
    }).chat(modelName);
  }

  return createOpenAICompatible({
    name: vendor.id,
    apiKey: vendor.apiKey,
    baseURL: vendor.baseUrl,
  }).languageModel(modelName);
}

function findVendorModel(type: VendorModelType, requested?: string): { vendor: VendorConfig; model: VendorModel } {
  const vendors = mvpStore.listVendors().filter((vendor) => vendor.enabled);
  if (vendors.length === 0) {
    throw new Error("没有可用的供应商配置");
  }

  if (requested) {
    const [vendorId, modelName] = requested.split(":");
    const vendor = vendors.find((item) => item.id === vendorId);
    if (!vendor) {
      throw new Error(`未找到供应商: ${vendorId}`);
    }
    const model = vendor.models.find((item) => item.modelName === modelName && item.type === type);
    if (!model) {
      throw new Error(`未找到模型: ${requested}`);
    }
    return { vendor, model };
  }

  const byKey = vendors.find((vendor) => vendor.apiKey && vendor.models.some((model) => model.type === type));
  if (byKey) {
    return {
      vendor: byKey,
      model: byKey.models.find((model) => model.type === type) as VendorModel,
    };
  }

  const fallback = vendors.find((vendor) => vendor.models.some((model) => model.type === type));
  if (!fallback) {
    throw new Error(`没有配置 ${type} 模型`);
  }

  return {
    vendor: fallback,
    model: fallback.models.find((model) => model.type === type) as VendorModel,
  };
}

export async function runTextModel(input: {
  prompt: string;
  system?: string;
  modelRef?: string;
  temperature?: number;
}): Promise<{ text: string; modelRef: string }> {
  const resolved = resolveTextModel(input.modelRef);

  const result = await generateText({
    model: resolved.languageModel,
    system: input.system,
    prompt: input.prompt,
    temperature: input.temperature ?? 0.4,
  });

  return {
    text: result.text,
    modelRef: resolved.modelRef,
  };
}

export function resolveTextModel(modelRef?: string): {
  vendor: VendorConfig;
  model: VendorModel;
  modelRef: string;
  languageModel: LanguageModel;
} {
  const { vendor, model } = findVendorModel("text", modelRef);
  if (!vendor.apiKey) {
    throw new Error(`供应商 ${vendor.name} 缺少 API Key`);
  }
  return {
    vendor,
    model,
    modelRef: `${vendor.id}:${model.modelName}`,
    languageModel: getLanguageModel(vendor, model.modelName),
  };
}

export async function testVendorModel(input: {
  modelRef: string;
  type: VendorModelType;
}): Promise<Record<string, unknown>> {
  const { vendor, model } = findVendorModel(input.type, input.modelRef);
  if (!vendor.apiKey) {
    throw new Error(`供应商 ${vendor.name} 缺少 API Key`);
  }

  if (input.type === "text") {
    const text = await runTextModel({
      modelRef: `${vendor.id}:${model.modelName}`,
      system: "你是模型连通性检测助手。",
      prompt: "请只返回：MODEL_OK",
      temperature: 0,
    });

    return {
      status: "ok",
      type: input.type,
      vendorId: vendor.id,
      modelName: model.modelName,
      response: text.text,
    };
  }

  if (input.type === "image") {
    const endpoint = vendor.config.imageEndpoint;
    if (!endpoint) {
      return {
        status: "skipped",
        reason: "当前供应商未配置 imageEndpoint，已完成接入但跳过连通性调用",
      };
    }

    const payload = {
      model: model.modelName,
      prompt: "A cinematic storyboard frame of a rainy harbor at dusk.",
      size: "1024x1024",
      response_format: "url",
    };

    const response = await fetch(buildUrl(vendor, endpoint), {
      method: "POST",
      headers: buildHeaders(vendor),
      body: JSON.stringify(payload),
    });
    const json = await response.json();

    return {
      status: response.ok ? "ok" : "failed",
      type: input.type,
      vendorId: vendor.id,
      modelName: model.modelName,
      responseStatus: response.status,
      responseBody: json,
    };
  }

  const createEndpoint = vendor.config.videoCreateEndpoint;
  if (!createEndpoint) {
    return {
      status: "skipped",
      reason: "当前供应商未配置 videoCreateEndpoint，已完成接入但跳过连通性调用",
    };
  }

  const payload = {
    model: model.modelName,
    prompt: "Generate a short cinematic establishing shot.",
    ...(isSiliconflowVideoApi(vendor)
      ? {
          image_size: "1280x720",
        }
      : {
          duration: 2,
          resolution: "720p",
          ratio: "16:9",
        }),
  };

  const response = await fetch(buildUrl(vendor, createEndpoint), {
    method: "POST",
    headers: buildHeaders(vendor),
    body: JSON.stringify(payload),
  });
  const json = await response.json();

  return {
    status: response.ok ? "ok" : "failed",
    type: input.type,
    vendorId: vendor.id,
    modelName: model.modelName,
    responseStatus: response.status,
    responseBody: json,
  };
}

export async function runVideoModel(input: {
  prompt: string;
  modelRef?: string;
  durationSeconds?: number;
  aspectRatio?: string;
  resolution?: string;
}): Promise<{ videoUrl?: string; taskId?: string; modelRef: string; raw: Record<string, unknown> }> {
  const { vendor, model } = findVendorModel("video", input.modelRef);
  if (!vendor.apiKey) {
    throw new Error(`供应商 ${vendor.name} 缺少 API Key`);
  }

  const createEndpoint = vendor.config.videoCreateEndpoint;
  const queryEndpoint = vendor.config.videoQueryEndpoint;
  const queryMethod = String(vendor.config.videoQueryMethod ?? "GET").toUpperCase();

  if (!createEndpoint || !queryEndpoint) {
    throw new Error(`供应商 ${vendor.name} 未配置视频生成端点`);
  }

  const createPayload = isSiliconflowVideoApi(vendor)
    ? {
        model: model.modelName,
        prompt: input.prompt,
        image_size: toSiliconflowImageSize(input.aspectRatio),
      }
    : {
        model: model.modelName,
        prompt: input.prompt,
        duration: input.durationSeconds ?? 3,
        resolution: input.resolution ?? "720p",
        ratio: input.aspectRatio ?? "16:9",
      };

  const createResp = await fetch(buildUrl(vendor, createEndpoint), {
    method: "POST",
    headers: buildHeaders(vendor),
    body: JSON.stringify(createPayload),
  });

  const createJson = (await createResp.json()) as Record<string, unknown>;
  if (!createResp.ok) {
    throw new Error(`视频任务创建失败: ${createResp.status}`);
  }

  const taskId = extractVideoTaskId(createJson);

  if (!taskId) {
    return {
      modelRef: `${vendor.id}:${model.modelName}`,
      raw: createJson,
    };
  }

  const queryUrl = buildUrl(vendor, queryEndpoint.includes("{id}") ? queryEndpoint.replace("{id}", taskId) : queryEndpoint);

  for (let i = 0; i < 8; i += 1) {
    const queryResp = await fetch(queryUrl, {
      method: queryMethod,
      headers: buildHeaders(vendor),
      body: queryMethod === "POST" ? JSON.stringify({ requestId: taskId }) : undefined,
    });
    const queryJson = (await queryResp.json()) as Record<string, unknown>;
    const status = extractVideoStatus(queryJson);
    const videoUrl = extractVideoUrl(queryJson);

    if (videoUrl) {
      return {
        videoUrl,
        taskId,
        modelRef: `${vendor.id}:${model.modelName}`,
        raw: queryJson,
      };
    }

    if (["failed", "error", "canceled", "cancelled"].includes(status)) {
      throw new Error(`视频任务失败: ${status}`);
    }

    if (["success", "completed", "succeeded", "succeed"].includes(status)) {
      return {
        taskId,
        modelRef: `${vendor.id}:${model.modelName}`,
        raw: queryJson,
      };
    }

    await new Promise((resolve) => setTimeout(resolve, 3000));
  }

  return {
    taskId,
    modelRef: `${vendor.id}:${model.modelName}`,
    raw: { timeout: true },
  };
}

export function getDefaultModelRef(type: VendorModelType): string | null {
  try {
    const { vendor, model } = findVendorModel(type);
    return `${vendor.id}:${model.modelName}`;
  } catch {
    return null;
  }
}
