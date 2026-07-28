import { describe, expect, it } from "vitest";
import { FundamentalEngine, type FundamentalSnapshot } from "../../src/index.js";

const fullSnapshot: FundamentalSnapshot = {
  assetId: "asset-aapl",
  symbol: "AAPL",
  revenueGrowth: {
    value: 0.12,
    source: "TEST_FIXTURE",
    asOf: new Date("2026-01-01T00:00:00Z")
  },
  operatingMargin: {
    value: 0.22,
    source: "TEST_FIXTURE",
    asOf: new Date("2026-01-01T00:00:00Z")
  },
  debtToEquity: {
    value: 0.8,
    source: "TEST_FIXTURE",
    asOf: new Date("2026-01-01T00:00:00Z")
  },
  returnOnEquity: {
    value: 0.18,
    source: "TEST_FIXTURE",
    asOf: new Date("2026-01-01T00:00:00Z")
  },
  freeCashFlowPositive: true,
  inputReferences: ["fundamental:aapl:2026-q1"]
};

describe("FundamentalEngine", () => {
  it("returns versioned analysis scores for complete data", () => {
    const result = new FundamentalEngine().evaluate({
      snapshot: fullSnapshot,
      now: new Date("2026-01-02T00:00:00Z"),
      scoringVersion: "fundamental-engine-v1"
    });

    expect(result.ok).toBe(true);
    expect(result.ok && result.output.scoreSet.scoringVersion).toBe("fundamental-engine-v1");
    expect(result.ok && result.output.missingMetrics).toEqual([]);
    expect(result.ok && result.output.scoreSet.scores).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ engine: "FUNDAMENTAL_GROWTH" }),
        expect.objectContaining({ engine: "FUNDAMENTAL_QUALITY" }),
        expect.objectContaining({ engine: "FUNDAMENTAL_BALANCE_SHEET" })
      ])
    );
    expect(result.ok && result.output.safetyType).toBe("FUNDAMENTAL_ENGINE_ANALYSIS_ONLY");
    expect(result.ok && result.output).not.toHaveProperty("order");
  });

  it("allows partial data with lower confidence when complete data is not required", () => {
    const result = new FundamentalEngine().evaluate({
      snapshot: {
        ...fullSnapshot,
        returnOnEquity: undefined
      },
      now: new Date("2026-01-02T00:00:00Z"),
      scoringVersion: "fundamental-engine-v1"
    });

    expect(result.ok).toBe(true);
    expect(result.ok && result.output.missingMetrics).toContain("returnOnEquity");
    expect(result.ok && Math.min(...result.output.scoreSet.scores.map((score) => score.confidence))).toBeLessThan(0.75);
  });

  it("refuses partial data when complete data is required", () => {
    const result = new FundamentalEngine().evaluate({
      snapshot: {
        ...fullSnapshot,
        revenueGrowth: undefined
      },
      now: new Date("2026-01-02T00:00:00Z"),
      scoringVersion: "fundamental-engine-v1",
      requireCompleteData: true
    });

    expect(result.ok).toBe(false);
    expect(!result.ok && result.refusal.reasons).toContain("incomplete_fundamental_data");
    expect(!result.ok && result.refusal.missingMetrics).toContain("revenueGrowth");
  });

  it("refuses missing snapshots instead of inventing financial values", () => {
    const result = new FundamentalEngine().evaluate({
      now: new Date("2026-01-02T00:00:00Z"),
      scoringVersion: "fundamental-engine-v1"
    });

    expect(result.ok).toBe(false);
    expect(!result.ok && result.refusal.reasons).toContain("missing_fundamental_snapshot");
    expect(!result.ok && result.refusal.safetyType).toBe("FUNDAMENTAL_ENGINE_REFUSAL_ONLY");
  });

  it("refuses invalid numeric metrics", () => {
    const result = new FundamentalEngine().evaluate({
      snapshot: {
        ...fullSnapshot,
        operatingMargin: {
          value: Number.NaN,
          source: "TEST_FIXTURE",
          asOf: new Date("2026-01-01T00:00:00Z")
        }
      },
      now: new Date("2026-01-02T00:00:00Z"),
      scoringVersion: "fundamental-engine-v1"
    });

    expect(result.ok).toBe(false);
    expect(!result.ok && result.refusal.reasons).toContain("invalid_operatingMargin");
  });
});
