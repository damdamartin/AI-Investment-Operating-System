import { DomainValidationError } from "../../shared/errors.js";

export type AssetTypeCode = "STOCK" | "ETF";

export class AssetType {
  private constructor(public readonly code: AssetTypeCode) {}

  static from(code: string): AssetType {
    if (code !== "STOCK" && code !== "ETF") {
      throw new DomainValidationError("Unsupported asset type.");
    }

    return new AssetType(code);
  }
}
