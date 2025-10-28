export declare enum ErrorCode {
    UNAUTHORIZED = "UNAUTHORIZED",
    FORBIDDEN = "FORBIDDEN",
    INVALID_TOKEN = "INVALID_TOKEN",
    VALIDATION_ERROR = "VALIDATION_ERROR",
    INVALID_INPUT = "INVALID_INPUT",
    ASR_ERROR = "ASR_ERROR",
    RAG_ERROR = "RAG_ERROR",
    LLM_ERROR = "LLM_ERROR",
    TTS_ERROR = "TTS_ERROR",
    LIPSYNC_ERROR = "LIPSYNC_ERROR",
    NOT_FOUND = "NOT_FOUND",
    ALREADY_EXISTS = "ALREADY_EXISTS",
    RESOURCE_EXHAUSTED = "RESOURCE_EXHAUSTED",
    CONNECTION_ERROR = "CONNECTION_ERROR",
    TIMEOUT = "TIMEOUT",
    RATE_LIMIT_EXCEEDED = "RATE_LIMIT_EXCEEDED",
    INTERNAL_ERROR = "INTERNAL_ERROR",
    UNKNOWN_ERROR = "UNKNOWN_ERROR"
}
export interface ErrorDetails {
    code: ErrorCode;
    message: string;
    details?: Record<string, unknown>;
    recoverable: boolean;
}
//# sourceMappingURL=errors.d.ts.map