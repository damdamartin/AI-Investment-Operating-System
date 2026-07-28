import { DomainValidationError } from "../../shared/errors.js";
import { requireEntityId, type EntityId } from "../common/index.js";
import { AssetType, Market } from "../value-objects/index.js";
import type { BrokerCode } from "../assets/index.js";

export type BrokerPermissionStatus =
  | "UNVERIFIED"
  | "READ_ONLY"
  | "PAPER_ONLY"
  | "LIVE_TRADING_ALLOWED"
  | "LIVE_TRADING_BLOCKED"
  | "SUSPENDED";

export type BrokerAccountStatus = "ACTIVE" | "SUSPENDED" | "CLOSED";

export interface BrokerAccountProps {
  id: string;
  broker: BrokerCode;
  externalAccountRef: string;
  accountLabel: string;
  permissionStatus?: BrokerPermissionStatus;
  liveTradingEnabled?: boolean;
  readOnlyEnabled?: boolean;
  status?: BrokerAccountStatus;
}

export class BrokerAccount {
  readonly id: EntityId;
  readonly broker: BrokerCode;
  readonly externalAccountRef: string;
  readonly accountLabel: string;
  readonly permissionStatus: BrokerPermissionStatus;
  readonly liveTradingEnabled: boolean;
  readonly readOnlyEnabled: boolean;
  readonly status: BrokerAccountStatus;

  constructor(props: BrokerAccountProps) {
    this.id = requireEntityId(props.id, "Broker account id");
    this.broker = props.broker;
    this.externalAccountRef = requireEntityId(props.externalAccountRef, "External account reference");
    this.accountLabel = requireEntityId(props.accountLabel, "Account label");
    this.permissionStatus = props.permissionStatus ?? "UNVERIFIED";
    this.liveTradingEnabled = props.liveTradingEnabled ?? false;
    this.readOnlyEnabled = props.readOnlyEnabled ?? false;
    this.status = props.status ?? "ACTIVE";
  }

  canRead(): boolean {
    return this.status === "ACTIVE" && this.readOnlyEnabled;
  }

  canWriteLive(): boolean {
    return (
      this.status === "ACTIVE" &&
      this.liveTradingEnabled &&
      this.permissionStatus === "LIVE_TRADING_ALLOWED"
    );
  }

  maskedExternalRef(): string {
    if (this.externalAccountRef.length <= 4) return "****";
    return `${this.externalAccountRef.slice(0, 2)}****${this.externalAccountRef.slice(-2)}`;
  }
}

export type PortfolioBrokerAccountLinkStatus = "ACTIVE" | "DISABLED";

export interface PortfolioBrokerAccountLinkProps {
  id: string;
  portfolioId: string;
  brokerAccountId: string;
  allowedMarkets: Market[];
  allowedAssetTypes: AssetType[];
  status?: PortfolioBrokerAccountLinkStatus;
}

export class PortfolioBrokerAccountLink {
  readonly id: EntityId;
  readonly portfolioId: EntityId;
  readonly brokerAccountId: EntityId;
  readonly allowedMarkets: Market[];
  readonly allowedAssetTypes: AssetType[];
  readonly status: PortfolioBrokerAccountLinkStatus;

  constructor(props: PortfolioBrokerAccountLinkProps) {
    this.id = requireEntityId(props.id, "Portfolio broker account link id");
    this.portfolioId = requireEntityId(props.portfolioId, "Portfolio id");
    this.brokerAccountId = requireEntityId(props.brokerAccountId, "Broker account id");
    this.allowedMarkets = props.allowedMarkets;
    this.allowedAssetTypes = props.allowedAssetTypes;
    this.status = props.status ?? "DISABLED";

    if (this.allowedMarkets.length === 0) {
      throw new DomainValidationError("At least one allowed market is required.");
    }

    if (this.allowedAssetTypes.length === 0) {
      throw new DomainValidationError("At least one allowed asset type is required.");
    }
  }

  allows(market: Market, assetType: AssetType): boolean {
    return (
      this.status === "ACTIVE" &&
      this.allowedMarkets.some((allowed) => allowed.code === market.code) &&
      this.allowedAssetTypes.some((allowed) => allowed.code === assetType.code)
    );
  }
}
