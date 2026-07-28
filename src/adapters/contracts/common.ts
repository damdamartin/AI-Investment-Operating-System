export type AdapterProvider = "TOSS_SECURITIES" | "NAVER_NEWS" | "CLAUDE";

export type AdapterCapabilityStatus = "SUPPORTED" | "UNSUPPORTED" | "PARTIAL" | "UNVERIFIED";

export interface AdapterMetadata {
  provider: AdapterProvider;
  requestId?: string;
  collectedAt: Date;
  latencyMs?: number;
  rateLimited?: boolean;
}

export interface AdapterError {
  provider: AdapterProvider;
  code: string;
  message: string;
  retryable: boolean;
  metadata?: AdapterMetadata;
}

export type AdapterResult<T> =
  | {
      ok: true;
      data: T;
      metadata: AdapterMetadata;
    }
  | {
      ok: false;
      error: AdapterError;
    };
