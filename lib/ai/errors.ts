export type AIErrorCode =
  | "unauthenticated"
  | "unavailable"
  | "rate_limited"
  | "invalid_request"
  | "not_found"
  | "conflict"
  | "validation";

export class CashioAIError extends Error {
  readonly code: AIErrorCode;
  readonly status: number;

  constructor(code: AIErrorCode, message: string, status = 400) {
    super(message);
    this.name = "CashioAIError";
    this.code = code;
    this.status = status;
  }
}

export const USER_UNAVAILABLE_MESSAGE = "Cashio AI is temporarily unavailable. Please try again.";

export function toPublicAIError(error: unknown): { message: string; status: number } {
  if (error instanceof CashioAIError) {
    return { message: error.message, status: error.status };
  }
  console.error("[cashio-ai]", error);
  return { message: USER_UNAVAILABLE_MESSAGE, status: 503 };
}
