"use client";

export type ApiResult<T> = {
  ok: boolean;
  data?: T;
  error?: string;
};

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);

  try {
    const response = await fetch(path, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
      signal: controller.signal,
      cache: "no-store",
    });

    let payload: ApiResult<T>;
    try {
      payload = (await response.json()) as ApiResult<T>;
    } catch {
      throw new Error(`接口返回非 JSON：${response.status}`);
    }

    if (!response.ok || !payload.ok || payload.data === undefined) {
      throw new Error(payload.error ?? `请求失败：${response.status}`);
    }

    return payload.data;
  } finally {
    clearTimeout(timeout);
  }
}

export async function apiGet<T>(path: string): Promise<T> {
  return requestJson<T>(path, { method: "GET" });
}

export async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  return requestJson<T>(path, {
    method: "POST",
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

