import { DomainValidationError } from "../../shared/errors.js";
import { requireEntityId, type EntityId } from "../common/index.js";
import { Price, Quantity } from "../value-objects/index.js";

export type PositionStatus = "OPEN" | "CLOSED";
export type PositionCloseReason = "STOP_LOSS" | "TAKE_PROFIT" | "SIGNAL" | "MANUAL" | "PARTIAL";

export interface PositionProps {
  id: string;
  assetId: string;
  orderRecommendationId: string;
  quantity: Quantity;
  entryPrice: Price;
  stopLoss: Price;
  takeProfit: Price;
  entryDate: Date;
  status?: PositionStatus | undefined;
  closeReason?: PositionCloseReason | undefined;
  closedAt?: Date | undefined;
  lastCheckAt?: Date | undefined;
}

export class Position {
  readonly id: EntityId;
  readonly assetId: string;
  readonly orderRecommendationId: string;
  readonly quantity: Quantity;
  readonly entryPrice: Price;
  readonly stopLoss: Price;
  readonly takeProfit: Price;
  readonly entryDate: Date;
  readonly status: PositionStatus;
  readonly closeReason: PositionCloseReason | undefined;
  readonly closedAt: Date | undefined;
  readonly lastCheckAt: Date | undefined;

  constructor(props: PositionProps) {
    this.id = requireEntityId(props.id, "Position id");
    this.assetId = props.assetId;
    this.orderRecommendationId = props.orderRecommendationId;
    this.quantity = props.quantity;
    this.entryPrice = props.entryPrice;
    this.stopLoss = props.stopLoss;
    this.takeProfit = props.takeProfit;
    this.entryDate = props.entryDate;
    this.status = props.status ?? "OPEN";
    this.closeReason = props.closeReason;
    this.closedAt = props.closedAt;
    this.lastCheckAt = props.lastCheckAt;

    this.validateInvariants();
  }

  private validateInvariants(): void {
    if (this.quantity.isZero()) {
      throw new DomainValidationError("Position quantity must be greater than zero.");
    }

    const entryPriceMajor = Number(this.entryPrice.toString().split(" ")[0]);
    const slMajor = Number(this.stopLoss.toString().split(" ")[0]);
    const tpMajor = Number(this.takeProfit.toString().split(" ")[0]);

    if (slMajor >= entryPriceMajor) {
      throw new DomainValidationError("Stop loss price must be lower than entry price.");
    }

    if (tpMajor <= entryPriceMajor) {
      throw new DomainValidationError("Take profit price must be higher than entry price.");
    }

    if (this.status === "CLOSED" && !this.closedAt) {
      throw new DomainValidationError("Closed position must have closedAt timestamp.");
    }

    if (this.status === "CLOSED" && !this.closeReason) {
      throw new DomainValidationError("Closed position must have closeReason.");
    }

    if (this.status === "OPEN" && this.closedAt) {
      throw new DomainValidationError("Open position must not have closedAt timestamp.");
    }
  }

  isOpen(): boolean {
    return this.status === "OPEN";
  }

  isClosed(): boolean {
    return this.status === "CLOSED";
  }

  /**
   * Check if stop loss is triggered by current price
   */
  isStopLossTriggered(currentPrice: Price): boolean {
    const currentMajor = Number(currentPrice.toString().split(" ")[0]);
    const slMajor = Number(this.stopLoss.toString().split(" ")[0]);
    return currentMajor <= slMajor;
  }

  /**
   * Check if take profit is triggered by current price
   */
  isTakeProfitTriggered(currentPrice: Price): boolean {
    const currentMajor = Number(currentPrice.toString().split(" ")[0]);
    const tpMajor = Number(this.takeProfit.toString().split(" ")[0]);
    return currentMajor >= tpMajor;
  }

  /**
   * Calculate unrealized P&L
   */
  calculateUnrealizedPnL(currentPrice: Price): {
    pnlMajor: string;
    pnlPercent: string;
  } {
    const entryPriceMajor = Number(this.entryPrice.toString().split(" ")[0]);
    const currentMajor = Number(currentPrice.toString().split(" ")[0]);
    const quantityNum = Number(this.quantity.toString());

    const pnlMajor = (currentMajor - entryPriceMajor) * quantityNum;
    const pnlPercent = ((currentMajor - entryPriceMajor) / entryPriceMajor) * 100;

    return {
      pnlMajor: pnlMajor.toFixed(2),
      pnlPercent: pnlPercent.toFixed(2)
    };
  }

  /**
   * Create a closed position with stop loss trigger
   */
  closeWithStopLoss(closedAt: Date): Position {
    return new Position({
      id: this.id,
      assetId: this.assetId,
      orderRecommendationId: this.orderRecommendationId,
      quantity: this.quantity,
      entryPrice: this.entryPrice,
      stopLoss: this.stopLoss,
      takeProfit: this.takeProfit,
      entryDate: this.entryDate,
      status: "CLOSED",
      closeReason: "STOP_LOSS",
      closedAt: closedAt,
      lastCheckAt: this.lastCheckAt ?? undefined
    });
  }

  /**
   * Create a closed position with take profit trigger
   */
  closeWithTakeProfit(closedAt: Date): Position {
    return new Position({
      id: this.id,
      assetId: this.assetId,
      orderRecommendationId: this.orderRecommendationId,
      quantity: this.quantity,
      entryPrice: this.entryPrice,
      stopLoss: this.stopLoss,
      takeProfit: this.takeProfit,
      entryDate: this.entryDate,
      status: "CLOSED",
      closeReason: "TAKE_PROFIT",
      closedAt: closedAt,
      lastCheckAt: this.lastCheckAt ?? undefined
    });
  }

  /**
   * Create a closed position with signal-based close
   */
  closeWithSignal(closedAt: Date): Position {
    return new Position({
      id: this.id,
      assetId: this.assetId,
      orderRecommendationId: this.orderRecommendationId,
      quantity: this.quantity,
      entryPrice: this.entryPrice,
      stopLoss: this.stopLoss,
      takeProfit: this.takeProfit,
      entryDate: this.entryDate,
      status: "CLOSED",
      closeReason: "SIGNAL",
      closedAt: closedAt,
      lastCheckAt: this.lastCheckAt ?? undefined
    });
  }

  /**
   * Update last check timestamp
   */
  updateLastCheck(checkedAt: Date): Position {
    return new Position({
      id: this.id,
      assetId: this.assetId,
      orderRecommendationId: this.orderRecommendationId,
      quantity: this.quantity,
      entryPrice: this.entryPrice,
      stopLoss: this.stopLoss,
      takeProfit: this.takeProfit,
      entryDate: this.entryDate,
      status: this.status,
      closeReason: this.closeReason,
      closedAt: this.closedAt,
      lastCheckAt: checkedAt
    });
  }
}
