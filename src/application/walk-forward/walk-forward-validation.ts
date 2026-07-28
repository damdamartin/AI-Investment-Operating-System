import type { BacktestResult } from "../backtest/index.js";

export interface WalkForwardWindow {
  id: string;
  trainingStart: Date;
  trainingEnd: Date;
  validationStart: Date;
  validationEnd: Date;
}

export interface WalkForwardWindowResult {
  window: WalkForwardWindow;
  trainingResult: BacktestResult;
  validationResult: BacktestResult;
  returnDegradationRatio: number;
  drawdownIncreaseRatio: number;
  degraded: boolean;
  degradationReasons: string[];
}

export interface WalkForwardValidationInput {
  strategyVersionId: string;
  windows: Array<{
    window: WalkForwardWindow;
    trainingResult: BacktestResult;
    validationResult: BacktestResult;
  }>;
  maxReturnDegradationRatio: number;
  maxDrawdownIncreaseRatio: number;
}

export interface WalkForwardValidationOutput {
  strategyVersionId: string;
  windows: WalkForwardWindowResult[];
  degradedWindowCount: number;
  passed: boolean;
  inputReferences: string[];
  safetyType: "WALK_FORWARD_VALIDATION_ONLY";
}

export interface WalkForwardValidationRefusal {
  refused: true;
  reasons: string[];
  safetyType: "WALK_FORWARD_VALIDATION_REFUSAL_ONLY";
}

export type WalkForwardValidationResult =
  | {
      ok: true;
      output: WalkForwardValidationOutput;
    }
  | {
      ok: false;
      refusal: WalkForwardValidationRefusal;
    };

export class WalkForwardValidationService {
  validate(input: WalkForwardValidationInput): WalkForwardValidationResult {
    if (input.windows.length === 0) {
      return refused(["missing_walk_forward_windows"]);
    }

    const invalidReasons = input.windows.flatMap(({ window }) => validateWindow(window));
    if (invalidReasons.length > 0) {
      return refused([...new Set(invalidReasons)]);
    }

    const windowResults = input.windows.map(({ window, trainingResult, validationResult }) => {
      const returnDegradationRatio = calculateReturnDegradation(
        trainingResult.totalReturnRatio,
        validationResult.totalReturnRatio
      );
      const drawdownIncreaseRatio = calculateDrawdownIncrease(
        trainingResult.maxDrawdownRatio,
        validationResult.maxDrawdownRatio
      );
      const degradationReasons: string[] = [];

      if (returnDegradationRatio > input.maxReturnDegradationRatio) {
        degradationReasons.push("return_degradation_exceeded");
      }

      if (drawdownIncreaseRatio > input.maxDrawdownIncreaseRatio) {
        degradationReasons.push("drawdown_increase_exceeded");
      }

      return {
        window,
        trainingResult,
        validationResult,
        returnDegradationRatio,
        drawdownIncreaseRatio,
        degraded: degradationReasons.length > 0,
        degradationReasons
      };
    });

    return {
      ok: true,
      output: {
        strategyVersionId: input.strategyVersionId,
        windows: windowResults,
        degradedWindowCount: windowResults.filter((result) => result.degraded).length,
        passed: windowResults.every((result) => !result.degraded),
        inputReferences: windowResults.flatMap((result) => [
          ...result.trainingResult.inputReferences,
          ...result.validationResult.inputReferences
        ]),
        safetyType: "WALK_FORWARD_VALIDATION_ONLY"
      }
    };
  }
}

export function createWalkForwardWindows(input: {
  start: Date;
  windowCount: number;
  trainingDays: number;
  validationDays: number;
}): WalkForwardWindow[] {
  const windows: WalkForwardWindow[] = [];
  const dayMs = 24 * 60 * 60 * 1000;

  for (let index = 0; index < input.windowCount; index += 1) {
    const trainingStart = new Date(input.start.getTime() + index * input.validationDays * dayMs);
    const trainingEnd = new Date(trainingStart.getTime() + (input.trainingDays - 1) * dayMs);
    const validationStart = new Date(trainingEnd.getTime() + dayMs);
    const validationEnd = new Date(validationStart.getTime() + (input.validationDays - 1) * dayMs);

    windows.push({
      id: `wf-${index + 1}`,
      trainingStart,
      trainingEnd,
      validationStart,
      validationEnd
    });
  }

  return windows;
}

function validateWindow(window: WalkForwardWindow): string[] {
  const reasons: string[] = [];

  if (window.trainingStart > window.trainingEnd) reasons.push("invalid_training_window");
  if (window.validationStart > window.validationEnd) reasons.push("invalid_validation_window");
  if (window.validationStart <= window.trainingEnd) reasons.push("validation_window_overlaps_training_window");

  return reasons;
}

function calculateReturnDegradation(trainingReturn: number, validationReturn: number): number {
  if (trainingReturn <= 0) return validationReturn < trainingReturn ? 1 : 0;
  return Math.max(0, (trainingReturn - validationReturn) / Math.abs(trainingReturn));
}

function calculateDrawdownIncrease(trainingDrawdown: number, validationDrawdown: number): number {
  if (trainingDrawdown <= 0) return validationDrawdown > 0 ? 1 : 0;
  return Math.max(0, (validationDrawdown - trainingDrawdown) / trainingDrawdown);
}

function refused(reasons: string[]): WalkForwardValidationResult {
  return {
    ok: false,
    refusal: {
      refused: true,
      reasons,
      safetyType: "WALK_FORWARD_VALIDATION_REFUSAL_ONLY"
    }
  };
}
