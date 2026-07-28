import type { AdapterCapabilityStatus, AdapterResult } from "./common.js";

export type TossCapability =
  | "KR_STOCK_LIMIT_ORDER"
  | "KR_ETF_LIMIT_ORDER"
  | "US_STOCK_LIMIT_ORDER"
  | "US_ETF_LIMIT_ORDER"
  | "ORDER_CANCEL"
  | "ORDER_STATUS_QUERY"
  | "FILL_QUERY"
  | "ACCOUNT_BALANCE_QUERY"
  | "POSITION_QUERY";

export interface TossCapabilityResult {
  capability: TossCapability;
  status: AdapterCapabilityStatus;
  checkedAt: Date;
  evidence?: string;
}

export interface TossAccountSnapshot {
  brokerAccountId: string;
  permissionStatus: "UNVERIFIED" | "READ_ONLY" | "PAPER_ONLY" | "LIVE_TRADING_ALLOWED" | "LIVE_TRADING_BLOCKED" | "SUSPENDED";
  readOnlyEnabled: boolean;
  liveTradingEnabled: boolean;
  checkedAt: Date;
}

export interface TossPositionSnapshot {
  brokerAccountId: string;
  brokerSymbol: string;
  market: "KR" | "US";
  assetType: "STOCK" | "ETF";
  quantity: string;
  averagePrice: string;
  currency: "KRW" | "USD";
  collectedAt: Date;
}

export interface TossReadOnlyAdapter {
  getCapabilities(): Promise<AdapterResult<TossCapabilityResult[]>>;
  getAccountSnapshot(): Promise<AdapterResult<TossAccountSnapshot>>;
  getPositions(): Promise<AdapterResult<TossPositionSnapshot[]>>;
}

export interface TossWriteAdapter {
  submitOrder(command: never): Promise<never>;
  cancelOrder(command: never): Promise<never>;
}
