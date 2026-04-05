export type ApiEnvelope<T> = {
  ok: boolean;
  data?: T;
  error?: string;
};

export function ok<T>(data: T): ApiEnvelope<T> {
  return { ok: true, data };
}

export function fail(error: string): ApiEnvelope<never> {
  return { ok: false, error };
}
