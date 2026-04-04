import { NextResponse } from "next/server";
import { z } from "zod";
import { mvpStore } from "@/server/mvp/store";
import type { VendorConfig } from "@/server/mvp/types";
import { getDefaultModelRef } from "@/server/mvp/vendors";

const vendorModelSchema = z.object({
  name: z.string().min(1),
  modelName: z.string().min(1),
  type: z.enum(["text", "image", "video"]),
  supportsTools: z.boolean().optional(),
  mode: z.array(z.string()).optional(),
});

const vendorSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  provider: z.enum(["openai", "google", "openai-compatible"]),
  baseUrl: z.string().url(),
  apiKey: z.string(),
  enabled: z.boolean().default(true),
  models: z.array(vendorModelSchema).min(1),
  config: z.record(z.string(), z.string()).optional().default({}),
});

function maskApiKey(value: string): string {
  const normalized = value.replace(/^Bearer\s+/i, "");
  if (!normalized) {
    return "";
  }
  if (normalized.length <= 8) {
    return "********";
  }
  return `${normalized.slice(0, 4)}****${normalized.slice(-4)}`;
}

function toPublicVendor(vendor: VendorConfig) {
  return {
    id: vendor.id,
    name: vendor.name,
    provider: vendor.provider,
    baseUrl: vendor.baseUrl,
    enabled: vendor.enabled,
    models: vendor.models,
    config: vendor.config,
    hasApiKey: Boolean(vendor.apiKey),
    apiKeyMasked: maskApiKey(vendor.apiKey),
  };
}

export async function GET() {
  const vendors = mvpStore.listVendors();
  return NextResponse.json({
    ok: true,
    data: {
      vendors: vendors.map(toPublicVendor),
      defaults: {
        textModelRef: getDefaultModelRef("text"),
        imageModelRef: getDefaultModelRef("image"),
        videoModelRef: getDefaultModelRef("video"),
      },
    },
  });
}

export async function POST(request: Request) {
  try {
    const payload = vendorSchema.parse(await request.json());
    const saved = mvpStore.saveVendor(payload as VendorConfig);
    return NextResponse.json({
      ok: true,
      data: toPublicVendor(saved),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "保存供应商失败";
    return NextResponse.json(
      {
        ok: false,
        error: message,
      },
      { status: 400 },
    );
  }
}
