import { DomainValidationError } from "../../shared/errors.js";
import { Market, TimeRange } from "../value-objects/index.js";

export type MarketSessionStatus = "UNKNOWN" | "OPEN" | "CLOSED" | "PRE_MARKET" | "AFTER_HOURS";

export interface MarketSessionProps {
  market: Market;
  status?: MarketSessionStatus;
  range?: TimeRange;
}

export class MarketSession {
  readonly market: Market;
  readonly status: MarketSessionStatus;
  readonly range: TimeRange | undefined;

  constructor(props: MarketSessionProps) {
    this.market = props.market;
    this.status = props.status ?? "UNKNOWN";
    this.range = props.range;
  }

  allowsRegularOrders(): boolean {
    return this.status === "OPEN";
  }

  assertKnown(): void {
    if (this.status === "UNKNOWN") {
      throw new DomainValidationError("Market session status is unknown.");
    }
  }
}
