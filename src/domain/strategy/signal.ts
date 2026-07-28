import { DomainValidationError } from "../../shared/errors.js";
import { requireEntityId, type EntityId } from "../common/index.js";
import type { Asset } from "../assets/index.js";
import type { StrategyVersion } from "./strategy.js";

export type SignalDirection = "BUY" | "SELL" | "HOLD";

export interface EngineScore {
  engine: string;
  score: number;
  confidence: number;
}

export class EngineScoreSet {
  readonly scores: EngineScore[];
  readonly scoringVersion: string;

  constructor(scores: EngineScore[], scoringVersion: string) {
    if (scores.length === 0) {
      throw new DomainValidationError("At least one engine score is required.");
    }

    for (const score of scores) {
      if (score.score < 0 || score.score > 100) {
        throw new DomainValidationError("Engine score must be between 0 and 100.");
      }

      if (score.confidence < 0 || score.confidence > 1) {
        throw new DomainValidationError("Engine confidence must be between 0 and 1.");
      }
    }

    this.scores = [...scores];
    this.scoringVersion = requireEntityId(scoringVersion, "Scoring version");
  }
}

export interface SignalProps {
  id: string;
  strategyVersion: StrategyVersion;
  asset: Asset;
  direction: SignalDirection;
  scoreSet: EngineScoreSet;
  generatedAt: Date;
}

export class Signal {
  readonly id: EntityId;
  readonly strategyVersion: StrategyVersion;
  readonly asset: Asset;
  readonly direction: SignalDirection;
  readonly scoreSet: EngineScoreSet;
  readonly generatedAt: Date;

  constructor(props: SignalProps) {
    this.id = requireEntityId(props.id, "Signal id");
    this.strategyVersion = props.strategyVersion;
    this.asset = props.asset;
    this.direction = props.direction;
    this.scoreSet = props.scoreSet;
    this.generatedAt = props.generatedAt;

    if (Number.isNaN(this.generatedAt.getTime())) {
      throw new DomainValidationError("Signal generatedAt must be valid.");
    }
  }
}
