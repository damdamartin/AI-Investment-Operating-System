import type { AdapterCapabilityStatus, TossCapability, TossCapabilityResult } from "../../adapters/contracts/index.js";

export class TossCapabilityRegistry {
  private readonly capabilities: Map<TossCapability, TossCapabilityResult>;

  constructor(results: TossCapabilityResult[] = []) {
    this.capabilities = new Map(results.map((result) => [result.capability, result]));
  }

  getStatus(capability: TossCapability): AdapterCapabilityStatus {
    return this.capabilities.get(capability)?.status ?? "UNVERIFIED";
  }

  requiresVerifiedSupport(capability: TossCapability): boolean {
    return this.getStatus(capability) === "SUPPORTED";
  }

  blockingReason(capability: TossCapability): string | undefined {
    const status = this.getStatus(capability);
    if (status === "SUPPORTED") return undefined;
    return `capability_${capability.toLowerCase()}_${status.toLowerCase()}`;
  }

  static fromAdapterResults(results: TossCapabilityResult[]): TossCapabilityRegistry {
    return new TossCapabilityRegistry(results);
  }
}
