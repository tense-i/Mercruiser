import { NextResponse } from "next/server";
import { z } from "zod";
import { testVendorModel } from "@/server/mvp/vendors";

const bodySchema = z.object({
  modelRef: z.string().min(1),
  type: z.enum(["text", "image", "video"]),
});

export async function POST(request: Request) {
  try {
    const payload = bodySchema.parse(await request.json());
    const result = await testVendorModel(payload);
    return NextResponse.json({
      ok: true,
      data: result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "模型测试失败";
    return NextResponse.json(
      {
        ok: false,
        error: message,
      },
      { status: 400 },
    );
  }
}

