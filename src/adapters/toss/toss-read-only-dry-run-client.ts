import type { AdapterMetadata, AdapterResult } from "../contracts/index.js";

export type TossReadOnlyOperation =
  | "AUTHENTICATION_READ"
  | "ACCOUNT_SNAPSHOT_READ"
  | "POSITION_QUERY_READ"
  | "MARKET_DATA_READ"
  | "ORDER_STATUS_QUERY_READ"
  | "FILL_QUERY_READ"
  | "CAPABILITY_METADATA_READ";

export interface TossReadOnlyDryRunRequest {
  operation: TossReadOnlyOperation;
  method: "GET" | "POST";
  path: string;
  query?: Record<string, string>;
  body?: Record<string, unknown>;
}

export interface TossReadOnlyDryRunPreparedRequest {
  operation: TossReadOnlyOperation;
  method: "GET" | "POST";
  url: string;
  headers: Record<string, string>;
  body: undefined;
  dryRun: true;
}

export interface TossReadOnlyDryRunClientOptions {
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  accountRef: string;
  now?: () => Date;
}

const forbiddenBodyKeys = new Set([
  "order",
  "orders",
  "submitOrder",
  "cancelOrder",
  "modifyOrder",
  "withdraw",
  "transfer",
  "quantity",
  "price"
]);

export class TossReadOnlyDryRunClient {
  private readonly now: () => Date;

  constructor(private readonly options: TossReadOnlyDryRunClientOptions) {
    this.now = options.now ?? (() => new Date());
  }

  prepare(request: TossReadOnlyDryRunRequest): AdapterResult<TossReadOnlyDryRunPreparedRequest> {
    const collectedAt = this.now();
    const validation = this.validate(request);
    const metadata = metadataFor(collectedAt);

    if (validation) {
      return {
        ok: false,
        error: {
          provider: "TOSS_SECURITIES",
          code: validation,
          message: "Toss read-only dry-run request was rejected.",
          retryable: false,
          metadata
        }
      };
    }

    return {
      ok: true,
      data: {
        operation: request.operation,
        method: request.method,
        url: buildUrl(this.options.baseUrl, request.path, request.query),
        headers: {
          "X-Toss-Client-Id": "****",
          "X-Toss-Client-Secret": "****",
          "X-Toss-Account-Ref": "****"
        },
        body: undefined,
        dryRun: true
      },
      metadata
    };
  }

  private validate(request: TossReadOnlyDryRunRequest): string | undefined {
    if (!request.path.startsWith("/")) {
      return "TOSS_READ_ONLY_PATH_MUST_START_WITH_SLASH";
    }

    if (request.method === "POST" && request.operation !== "AUTHENTICATION_READ") {
      return "TOSS_READ_ONLY_POST_ALLOWED_ONLY_FOR_AUTHENTICATION_READ";
    }

    if (request.body && Object.keys(request.body).some((key) => forbiddenBodyKeys.has(key))) {
      return "TOSS_READ_ONLY_FORBIDDEN_BODY_KEY";
    }

    return undefined;
  }
}

function buildUrl(baseUrl: string, path: string, query: Record<string, string> | undefined): string {
  const url = new URL(path, baseUrl);

  for (const [key, value] of Object.entries(query ?? {})) {
    url.searchParams.set(key, value);
  }

  return url.toString();
}

function metadataFor(collectedAt: Date): AdapterMetadata {
  return {
    provider: "TOSS_SECURITIES",
    collectedAt
  };
}
