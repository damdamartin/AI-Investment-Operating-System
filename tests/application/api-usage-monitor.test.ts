import { describe, expect, it } from "vitest";
import { ApiUsageMonitor } from "../../src/index.js";

describe("ApiUsageMonitor", () => {
  it("logs safe API usage records without exposing credentials", () => {
    const record = new ApiUsageMonitor().log({
      id: "api-call-1",
      provider: "NAVER_NEWS",
      operation: "searchNews",
      outcome: "SUCCESS",
      latencyMs: 123.4,
      occurredAt: now(),
      metadata: {
        clientSecret: "naver-secret",
        accessToken: "token-123",
        query: "AAPL"
      }
    });

    expect(record.latencyMs).toBe(123);
    expect(record.safeMetadata.query).toBe("AAPL");
    expect(JSON.stringify(record)).not.toContain("naver-secret");
    expect(JSON.stringify(record)).not.toContain("token-123");
    expect(record.safetyType).toBe("API_USAGE_RECORD_SAFE_LOG_ONLY");
  });

  it("summarizes calls by provider and time period", () => {
    const monitor = new ApiUsageMonitor();
    const summary = monitor.summarize(
      [
        monitor.log(call("toss-1", "TOSS_SECURITIES", "SUCCESS", 100)),
        monitor.log(call("toss-2", "TOSS_SECURITIES", "FAILURE", 200, { retryCount: 1 })),
        monitor.log(call("naver-1", "NAVER_NEWS", "SUCCESS", 50))
      ],
      period()
    );

    const toss = summary.providerSummaries.find((item) => item.provider === "TOSS_SECURITIES");

    expect(summary.totalCalls).toBe(3);
    expect(summary.totalFailures).toBe(1);
    expect(toss?.totalCalls).toBe(2);
    expect(toss?.averageLatencyMs).toBe(150);
    expect(toss?.retryCount).toBe(1);
  });

  it("tracks rate limit events as observable records", () => {
    const monitor = new ApiUsageMonitor();
    const summary = monitor.summarize(
      [
        monitor.log(call("naver-rate-limit", "NAVER_NEWS", "RATE_LIMITED", 80, { statusCode: 429 })),
        monitor.log(call("claude-ok", "CLAUDE", "SUCCESS", 120))
      ],
      period()
    );

    expect(summary.totalRateLimited).toBe(1);
    expect(summary.rateLimitEvents[0]?.id).toBe("naver-rate-limit");
    expect(summary.providerSummaries.find((item) => item.provider === "NAVER_NEWS")?.rateLimitedCount).toBe(1);
  });

  it("aggregates Claude token usage and estimated cost", () => {
    const monitor = new ApiUsageMonitor();
    const summary = monitor.summarize(
      [
        monitor.log({
          ...call("claude-1", "CLAUDE", "SUCCESS", 500),
          claudeUsage: { inputTokens: 1000, outputTokens: 200, estimatedCostUsd: 0.0123456 }
        }),
        monitor.log({
          ...call("claude-2", "CLAUDE", "SUCCESS", 600),
          claudeUsage: { inputTokens: 500, outputTokens: 100, estimatedCostUsd: 0.006 }
        })
      ],
      period()
    );

    const claude = summary.providerSummaries.find((item) => item.provider === "CLAUDE");

    expect(claude?.claudeInputTokens).toBe(1500);
    expect(claude?.claudeOutputTokens).toBe(300);
    expect(claude?.estimatedCostUsd).toBe(0.018346);
    expect(summary.totalEstimatedCostUsd).toBe(0.018346);
  });

  it("ignores records outside the requested period", () => {
    const monitor = new ApiUsageMonitor();
    const summary = monitor.summarize(
      [
        monitor.log(call("inside", "TOSS_SECURITIES", "SUCCESS", 100)),
        monitor.log({
          ...call("outside", "TOSS_SECURITIES", "FAILURE", 999),
          occurredAt: new Date("2025-12-31T23:59:00Z")
        })
      ],
      period()
    );

    expect(summary.totalCalls).toBe(1);
    expect(summary.totalFailures).toBe(0);
  });
});

function call(
  id: string,
  provider: "TOSS_SECURITIES" | "NAVER_NEWS" | "CLAUDE",
  outcome: "SUCCESS" | "FAILURE" | "RATE_LIMITED",
  latencyMs: number,
  overrides: Record<string, unknown> = {}
) {
  return {
    id,
    provider,
    operation: "operation",
    outcome,
    latencyMs,
    occurredAt: now(),
    ...overrides
  };
}

function period() {
  return {
    startedAt: new Date("2026-01-01T00:00:00Z"),
    endedAt: new Date("2026-01-01T23:59:59Z")
  };
}

function now(): Date {
  return new Date("2026-01-01T12:00:00Z");
}
