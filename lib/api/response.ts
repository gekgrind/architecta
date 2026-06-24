import { NextResponse } from "next/server";
import type { ApiErrorCode, ApiResponse } from "@/lib/domain";

const STATUS_BY_CODE: Record<ApiErrorCode, number> = {
  bad_request: 400,
  unauthorized: 401,
  not_found: 404,
  validation_error: 422,
  rate_limited: 429,
  upstream_error: 502,
  server_error: 500,
};

export function apiOk<T>(data: T, init?: ResponseInit) {
  return NextResponse.json<ApiResponse<T>>({ ok: true, data }, init);
}

export function apiError(
  code: ApiErrorCode,
  message: string,
  init?: ResponseInit & { details?: Record<string, unknown> }
) {
  const status = init?.status ?? STATUS_BY_CODE[code];
  return NextResponse.json<ApiResponse<never>>(
    {
      ok: false,
      error: {
        code,
        message,
        details: init?.details,
      },
    },
    { ...init, status }
  );
}

export async function parseJsonBody<T>(req: Request): Promise<T | null> {
  return ((await req.json().catch(() => null)) ?? null) as T | null;
}
