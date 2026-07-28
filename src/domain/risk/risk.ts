import { DomainValidationError } from "../../shared/errors.js";
import { requireEntityId, type EntityId } from "../common/index.js";
import { Money, Percent } from "../value-objects/index.js";

export type RiskLimitScope =
  | "ACCOUNT"
  | "PORTFOLIO"
  | "MARKET"
  | "STRATEGY"
  | "ASSET"
  | "SECTOR"
  | "CURRENCY"
  | "ORDER"
  | "DAY"
  | "WEEK"
  | "MONTH";

export type RiskLimitType =
  | "MAX_POSITION_SIZE"
  | "MAX_ORDER_AMOUNT"
  | "MAX_DAILY_LOSS"
  | "MAX_WEEKLY_LOSS"
  | "MAX_MONTHLY_LOSS"
  | "MAX_DRAWDOWN"
  | "MIN_CASH_RATIO"
  | "MAX_CORRELATION"
  | "MAX_CONSECUTIVE_LOSSES"
  | "MAX_TURNOVER";

export type RiskLimitAction = "WARN" | "REJECT" | "BLOCK";
export type RiskLimitStatus = "DRAFT" | "ACTIVE" | "RETIRED";
export type RiskCheckResult = "PASS" | "PASS_WITH_WARNING" | "FAIL" | "BLOCKED";
export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface RiskLimitProps {
  id: string;
  scope: RiskLimitScope;
  limitType: RiskLimitType;
  threshold: Money | Percent | number;
  action: RiskLimitAction;
  status?: RiskLimitStatus;
  version: string;
  effectiveFrom: Date;
  effectiveTo?: Date;
}

export class RiskLimit {
  readonly id: EntityId;
  readonly scope: RiskLimitScope;
  readonly limitType: RiskLimitType;
  readonly threshold: Money | Percent | number;
  readonly action: RiskLimitAction;
  readonly status: RiskLimitStatus;
  readonly version: string;
  readonly effectiveFrom: Date;
  readonly effectiveTo: Date | undefined;

  constructor(props: RiskLimitProps) {
    this.id = requireEntityId(props.id, "Risk limit id");
    this.scope = props.scope;
    this.limitType = props.limitType;
    this.threshold = props.threshold;
    this.action = props.action;
    this.status = props.status ?? "DRAFT";
    this.version = requireEntityId(props.version, "Risk limit version");
    this.effectiveFrom = props.effectiveFrom;
    this.effectiveTo = props.effectiveTo;

    if (Number.isNaN(this.effectiveFrom.getTime())) {
      throw new DomainValidationError("Risk limit effectiveFrom must be valid.");
    }

    if (this.effectiveTo && this.effectiveTo <= this.effectiveFrom) {
      throw new DomainValidationError("Risk limit effectiveTo must be after effectiveFrom.");
    }
  }

  isActiveAt(value: Date): boolean {
    return this.status === "ACTIVE" && value >= this.effectiveFrom && (!this.effectiveTo || value < this.effectiveTo);
  }
}

export interface RiskCheckProps {
  id: string;
  subjectType: string;
  subjectId: string;
  result: RiskCheckResult;
  riskLevel: RiskLevel;
  failedLimitIds?: string[];
  warnings?: string[];
  checkedAt: Date;
}

export class RiskCheck {
  readonly id: EntityId;
  readonly subjectType: string;
  readonly subjectId: EntityId;
  readonly result: RiskCheckResult;
  readonly riskLevel: RiskLevel;
  readonly failedLimitIds: EntityId[];
  readonly warnings: string[];
  readonly checkedAt: Date;

  constructor(props: RiskCheckProps) {
    this.id = requireEntityId(props.id, "Risk check id");
    this.subjectType = requireEntityId(props.subjectType, "Risk check subject type");
    this.subjectId = requireEntityId(props.subjectId, "Risk check subject id");
    this.result = props.result;
    this.riskLevel = props.riskLevel;
    this.failedLimitIds = (props.failedLimitIds ?? []).map((id) => requireEntityId(id, "Failed limit id"));
    this.warnings = [...(props.warnings ?? [])];
    this.checkedAt = props.checkedAt;

    if (Number.isNaN(this.checkedAt.getTime())) {
      throw new DomainValidationError("Risk check checkedAt must be valid.");
    }

    if ((this.result === "FAIL" || this.result === "BLOCKED") && this.failedLimitIds.length === 0) {
      throw new DomainValidationError("Failed or blocked risk checks require failed limits.");
    }
  }

  allowsApproval(): boolean {
    return this.result === "PASS" || this.result === "PASS_WITH_WARNING";
  }
}

export interface KillSwitchStateProps {
  id: string;
  scope: RiskLimitScope;
  active?: boolean;
  reason?: string;
  activatedAt?: Date;
  activatedBy?: string;
}

export class KillSwitchState {
  readonly id: EntityId;
  readonly scope: RiskLimitScope;
  readonly active: boolean;
  readonly reason: string | undefined;
  readonly activatedAt: Date | undefined;
  readonly activatedBy: string | undefined;

  constructor(props: KillSwitchStateProps) {
    this.id = requireEntityId(props.id, "Kill switch id");
    this.scope = props.scope;
    this.active = props.active ?? false;
    this.reason = props.reason;
    this.activatedAt = props.activatedAt;
    this.activatedBy = props.activatedBy;

    if (this.active && !this.reason) {
      throw new DomainValidationError("Active kill switch requires a reason.");
    }
  }

  blocksOrders(): boolean {
    return this.active;
  }
}
