import { describe, expect, it } from "vitest";
import {
  createWalkForwardWindows,
  WalkForwardValidationService,
  type BacktestResult,
  type WalkForwardWindow
} from "../../src/index.js";

describe("WalkForwardValidationService", () => {
  it("creates non-overlapping walk-forward windows", () => {
    const windows = createWalkForwardWindows({
      start: new Date("2026-01-01T00:00:00Z"),
      windowCount: 2,
      trainingDays: 3,
      validationDays: 2
    });

    expect(windows).toEqual([
      {
        id: "wf-1",
        trainingStart: new Date("2026-01-01T00:00:00Z"),
        trainingEnd: new Date("2026-01-03T00:00:00Z"),
        validationStart: new Date("2026-01-04T00:00:00Z"),
        validationEnd: new Date("2026-01-05T00:00:00Z")
      },
      {
        id: "wf-2",
        trainingStart: new Date("2026-01-03T00:00:00Z"),
        trainingEnd: new Date("2026-01-05T00:00:00Z"),
        validationStart: new Date("2026-01-06T00:00:00Z"),
        validationEnd: new Date("2026-01-07T00:00:00Z")
      }
    ]);
  });

  it("passes when validation degradation remains within thresholds", () => {
    const result = new WalkForwardValidationService().validate({
      strategyVersionId: "strategy-version-1",
      windows: [
        {
          window: window(),
          trainingResult: backtestResult({ totalReturnRatio: 0.2, maxDrawdownRatio: 0.1, inputReferences: ["train-1"] }),
          validationResult: backtestResult({ totalReturnRatio: 0.17, maxDrawdownRatio: 0.11, inputReferences: ["valid-1"] })
        }
      ],
      maxReturnDegradationRatio: 0.25,
      maxDrawdownIncreaseRatio: 0.25
    });

    expect(result.ok).toBe(true);
    expect(result.ok && result.output.passed).toBe(true);
    expect(result.ok && result.output.inputReferences).toEqual(["train-1", "valid-1"]);
    expect(result.ok && result.output.safetyType).toBe("WALK_FORWARD_VALIDATION_ONLY");
    expect(result.ok && result.output).not.toHaveProperty("promoteStrategy");
  });

  it("detects return degradation and drawdown increase", () => {
    const result = new WalkForwardValidationService().validate({
      strategyVersionId: "strategy-version-1",
      windows: [
        {
          window: window(),
          trainingResult: backtestResult({ totalReturnRatio: 0.2, maxDrawdownRatio: 0.1 }),
          validationResult: backtestResult({ totalReturnRatio: 0.05, maxDrawdownRatio: 0.2 })
        }
      ],
      maxReturnDegradationRatio: 0.25,
      maxDrawdownIncreaseRatio: 0.25
    });

    expect(result.ok).toBe(true);
    expect(result.ok && result.output.passed).toBe(false);
    expect(result.ok && result.output.degradedWindowCount).toBe(1);
    expect(result.ok && result.output.windows[0]?.degradationReasons).toEqual(
      expect.arrayContaining(["return_degradation_exceeded", "drawdown_increase_exceeded"])
    );
  });

  it("rejects validation windows that overlap training windows", () => {
    const result = new WalkForwardValidationService().validate({
      strategyVersionId: "strategy-version-1",
      windows: [
        {
          window: {
            ...window(),
            validationStart: new Date("2026-01-03T00:00:00Z")
          },
          trainingResult: backtestResult(),
          validationResult: backtestResult()
        }
      ],
      maxReturnDegradationRatio: 0.25,
      maxDrawdownIncreaseRatio: 0.25
    });

    expect(result.ok).toBe(false);
    expect(!result.ok && result.refusal.reasons).toContain("validation_window_overlaps_training_window");
  });

  it("rejects missing walk-forward windows", () => {
    const result = new WalkForwardValidationService().validate({
      strategyVersionId: "strategy-version-1",
      windows: [],
      maxReturnDegradationRatio: 0.25,
      maxDrawdownIncreaseRatio: 0.25
    });

    expect(result.ok).toBe(false);
    expect(!result.ok && result.refusal.reasons).toContain("missing_walk_forward_windows");
  });
});

function window(): WalkForwardWindow {
  return {
    id: "wf-1",
    trainingStart: new Date("2026-01-01T00:00:00Z"),
    trainingEnd: new Date("2026-01-03T00:00:00Z"),
    validationStart: new Date("2026-01-04T00:00:00Z"),
    validationEnd: new Date("2026-01-05T00:00:00Z")
  };
}

function backtestResult(overrides: Partial<BacktestResult> = {}): BacktestResult {
  return {
    strategyVersionId: "strategy-version-1",
    costModelVersion: "cost-v1",
    startedAt: new Date("2026-01-01T00:00:00Z"),
    endedAt: new Date("2026-01-03T00:00:00Z"),
    inputReferences: ["ref-1"],
    trades: [],
    finalEquity: 1100,
    totalReturnRatio: 0.1,
    maxDrawdownRatio: 0.1,
    warnings: [],
    blocked: false,
    blockReasons: [],
    safetyType: "BACKTEST_RESULT_ONLY",
    ...overrides
  };
}
