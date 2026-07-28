import { DomainValidationError } from "../../shared/errors.js";
import { requireEntityId, type EntityId } from "../common/index.js";

export type StrategyStatus = "DRAFT" | "RESEARCH" | "VALIDATING" | "APPROVED" | "ACTIVE" | "RETIRED";
export type StrategyVersionStatus =
  | "DRAFT"
  | "BACKTESTED"
  | "WALK_FORWARD_VALIDATED"
  | "SHADOW"
  | "PAPER"
  | "SMALL_CAPITAL_LIVE"
  | "PRODUCTION_APPROVED"
  | "PRODUCTION_ACTIVE"
  | "RETIRED";

export interface StrategyProps {
  id: string;
  name: string;
  status?: StrategyStatus;
}

export class Strategy {
  readonly id: EntityId;
  readonly name: string;
  readonly status: StrategyStatus;

  constructor(props: StrategyProps) {
    this.id = requireEntityId(props.id, "Strategy id");
    this.name = requireEntityId(props.name, "Strategy name");
    this.status = props.status ?? "DRAFT";
  }
}

export interface StrategyVersionProps {
  id: string;
  strategyId: string;
  version: string;
  status?: StrategyVersionStatus;
  definitionHash: string;
}

export class StrategyVersion {
  readonly id: EntityId;
  readonly strategyId: EntityId;
  readonly version: string;
  readonly status: StrategyVersionStatus;
  readonly definitionHash: string;

  constructor(props: StrategyVersionProps) {
    this.id = requireEntityId(props.id, "Strategy version id");
    this.strategyId = requireEntityId(props.strategyId, "Strategy id");
    this.version = requireEntityId(props.version, "Strategy version");
    this.status = props.status ?? "DRAFT";
    this.definitionHash = requireEntityId(props.definitionHash, "Definition hash");
  }

  canTransitionTo(next: StrategyVersionStatus): boolean {
    return allowedStrategyTransitions[this.status].includes(next);
  }

  transitionTo(next: StrategyVersionStatus): StrategyVersion {
    if (!this.canTransitionTo(next)) {
      throw new DomainValidationError(`Invalid strategy version transition: ${this.status} -> ${next}.`);
    }

    return new StrategyVersion({
      id: this.id,
      strategyId: this.strategyId,
      version: this.version,
      status: next,
      definitionHash: this.definitionHash
    });
  }

  isProductionApprovedOrActive(): boolean {
    return this.status === "PRODUCTION_APPROVED" || this.status === "PRODUCTION_ACTIVE";
  }
}

const allowedStrategyTransitions: Record<StrategyVersionStatus, StrategyVersionStatus[]> = {
  DRAFT: ["BACKTESTED", "RETIRED"],
  BACKTESTED: ["WALK_FORWARD_VALIDATED", "RETIRED"],
  WALK_FORWARD_VALIDATED: ["SHADOW", "RETIRED"],
  SHADOW: ["PAPER", "RETIRED"],
  PAPER: ["SMALL_CAPITAL_LIVE", "RETIRED"],
  SMALL_CAPITAL_LIVE: ["PRODUCTION_APPROVED", "RETIRED"],
  PRODUCTION_APPROVED: ["PRODUCTION_ACTIVE", "RETIRED"],
  PRODUCTION_ACTIVE: ["RETIRED"],
  RETIRED: []
};
