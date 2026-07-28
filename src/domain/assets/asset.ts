import { requireEntityId, type EntityId } from "../common/index.js";
import { AssetType, Market } from "../value-objects/index.js";

export type TradingStatusCode =
  | "UNKNOWN"
  | "TRADABLE"
  | "HALTED"
  | "DELISTED"
  | "BLOCKED"
  | "UNVERIFIED";

export interface AssetProps {
  id: string;
  symbol: string;
  name: string;
  market: Market;
  assetType: AssetType;
  tradingStatus?: TradingStatusCode;
}

export class Asset {
  readonly id: EntityId;
  readonly symbol: string;
  readonly name: string;
  readonly market: Market;
  readonly assetType: AssetType;
  readonly tradingStatus: TradingStatusCode;

  constructor(props: AssetProps) {
    this.id = requireEntityId(props.id, "Asset id");
    this.symbol = requireEntityId(props.symbol, "Asset symbol");
    this.name = requireEntityId(props.name, "Asset name");
    this.market = props.market;
    this.assetType = props.assetType;
    this.tradingStatus = props.tradingStatus ?? "UNVERIFIED";
  }

  isTradable(): boolean {
    return this.tradingStatus === "TRADABLE";
  }
}
