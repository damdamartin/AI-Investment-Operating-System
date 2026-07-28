import { DomainValidationError } from "../../shared/errors.js";
import { requireEntityId, type EntityId } from "../common/index.js";
import { AssetType, Market } from "../value-objects/index.js";

export type BrokerCode = "TOSS_SECURITIES";

export interface BrokerAssetMappingProps {
  id: string;
  assetId: string;
  broker: BrokerCode;
  brokerSymbol: string;
  market: Market;
  assetType: AssetType;
  orderable?: boolean;
  verifiedAt?: Date;
}

export class BrokerAssetMapping {
  readonly id: EntityId;
  readonly assetId: EntityId;
  readonly broker: BrokerCode;
  readonly brokerSymbol: string;
  readonly market: Market;
  readonly assetType: AssetType;
  readonly orderable: boolean;
  readonly verifiedAt: Date | undefined;

  constructor(props: BrokerAssetMappingProps) {
    if (props.broker !== "TOSS_SECURITIES") {
      throw new DomainValidationError("Unsupported broker.");
    }

    this.id = requireEntityId(props.id, "Broker asset mapping id");
    this.assetId = requireEntityId(props.assetId, "Asset id");
    this.broker = props.broker;
    this.brokerSymbol = requireEntityId(props.brokerSymbol, "Broker symbol");
    this.market = props.market;
    this.assetType = props.assetType;
    this.orderable = props.orderable ?? false;
    this.verifiedAt = props.verifiedAt;
  }

  canBeUsedForOrders(): boolean {
    return this.orderable && this.verifiedAt !== undefined;
  }
}
