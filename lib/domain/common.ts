export type EntityId = string;
export type IsoDateString = string;

export type ApiErrorCode =
  | "bad_request"
  | "unauthorized"
  | "not_found"
  | "validation_error"
  | "rate_limited"
  | "upstream_error"
  | "server_error";

export type ApiError = {
  code: ApiErrorCode;
  message: string;
  details?: Record<string, unknown>;
};

export type ApiSuccess<T> = {
  ok: true;
  data: T;
};

export type ApiFailure = {
  ok: false;
  error: ApiError;
};

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

export type PaginationCursor = {
  limit?: number;
  cursor?: string | null;
};
