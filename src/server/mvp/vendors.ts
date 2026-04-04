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
    duration: 2,
    resolution: "720p",
    ratio: "16:9",
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

  if (!createEndpoint || !queryEndpoint) {
    throw new Error(`供应商 ${vendor.name} 未配置视频生成端点`);
  }

  const createPayload = {
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

  const taskId =
    (createJson.id as string | undefined) ??
    (createJson.task_id as string | undefined) ??
    ((createJson.data as Record<string, unknown> | undefined)?.id as string | undefined);

  if (!taskId) {
    return {
      modelRef: `${vendor.id}:${model.modelName}`,
      raw: createJson,
    };
  }

  const queryUrl = buildUrl(vendor, queryEndpoint.replace("{id}", taskId));

  for (let i = 0; i < 8; i += 1) {
    const queryResp = await fetch(queryUrl, {
      method: "GET",
      headers: buildHeaders(vendor),
    });
    const queryJson = (await queryResp.json()) as Record<string, unknown>;
    const status = String(queryJson.status ?? (queryJson.data as Record<string, unknown> | undefined)?.status ?? "").toLowerCase();

    const videoUrl =
      (queryJson.video_url as string | undefined) ??
      ((queryJson.data as Record<string, unknown> | undefined)?.video_url as string | undefined) ??
      ((queryJson.content as Record<string, unknown> | undefined)?.video_url as string | undefined);

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

    if (["success", "completed", "succeeded"].includes(status)) {
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
