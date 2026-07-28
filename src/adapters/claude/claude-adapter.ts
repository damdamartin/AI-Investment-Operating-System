import type {
  AdapterMetadata,
  AdapterResult,
  ClaudeAIAdapter,
  ClaudeAnalysisRequest,
  ClaudeAnalysisResult
} from "../contracts/index.js";
import { validateClaudeAnalysis } from "./analysis-schema.js";

export type ClaudeGenerate = (request: ClaudeAnalysisRequest) => Promise<unknown>;

export interface ValidatingClaudeAdapterOptions {
  generate: ClaudeGenerate;
  now?: () => Date;
  model?: string;
}

export class ValidatingClaudeAdapter implements ClaudeAIAdapter {
  private readonly now: () => Date;

  constructor(private readonly options: ValidatingClaudeAdapterOptions) {
    this.now = options.now ?? (() => new Date());
  }

  async analyze(request: ClaudeAnalysisRequest): Promise<AdapterResult<ClaudeAnalysisResult>> {
    const collectedAt = this.now();
    const startedAt = Date.now();

    try {
      const raw = await this.options.generate(request);
      const validation = validateClaudeAnalysis(raw);
      const metadata = metadataFor(collectedAt, startedAt);

      if (!validation.ok || !validation.analysis) {
        return {
          ok: false,
          error: {
            provider: "CLAUDE",
            code: "CLAUDE_SCHEMA_VALIDATION_FAILED",
            message: validation.errors.join(", "),
            retryable: false,
            metadata
          }
        };
      }

      return {
        ok: true,
        data: validation.analysis,
        metadata
      };
    } catch (error) {
      return {
        ok: false,
        error: {
          provider: "CLAUDE",
          code: "CLAUDE_ADAPTER_ERROR",
          message: error instanceof Error ? error.message : "Unknown Claude adapter error.",
          retryable: true,
          metadata: metadataFor(collectedAt, startedAt)
        }
      };
    }
  }
}

function metadataFor(collectedAt: Date, startedAt: number): AdapterMetadata {
  return {
    provider: "CLAUDE",
    collectedAt,
    latencyMs: Date.now() - startedAt
  };
}
