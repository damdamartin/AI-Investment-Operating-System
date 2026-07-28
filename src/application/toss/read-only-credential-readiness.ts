import type { AppConfig } from "../../config/index.js";

export interface TossReadOnlyCredentialReadiness {
  ready: boolean;
  missingFields: string[];
  reasonCodes: string[];
  liveBrokerWriteAllowed: boolean;
  safeToAttemptReadOnlyCalls: boolean;
  safetyType: "TOSS_READ_ONLY_CREDENTIAL_READINESS_ONLY";
}

const placeholderPrefix = "replace-with-";

export class TossReadOnlyCredentialReadinessService {
  review(config: AppConfig): TossReadOnlyCredentialReadiness {
    const missingFields: string[] = [];
    const reasonCodes: string[] = [];

    if (config.liveTradingEnabled) {
      reasonCodes.push("live_trading_enabled");
    }

    if (!config.externalApis.tossReadOnlyMode) {
      reasonCodes.push("toss_read_only_mode_disabled");
    }

    this.requireValue(config.externalApis.tossApiBaseUrl, "TOSS_API_BASE_URL", missingFields);
    this.requireValue(config.secrets.tossClientId, "TOSS_CLIENT_ID", missingFields);
    this.requireValue(config.secrets.tossClientSecret, "TOSS_CLIENT_SECRET", missingFields);
    this.requireValue(config.secrets.tossAccountRef, "TOSS_ACCOUNT_REF", missingFields);

    for (const field of missingFields) {
      reasonCodes.push(`missing_or_placeholder_${field.toLowerCase()}`);
    }

    return {
      ready: reasonCodes.length === 0,
      missingFields,
      reasonCodes: [...new Set(reasonCodes)].sort(),
      liveBrokerWriteAllowed: false,
      safeToAttemptReadOnlyCalls: reasonCodes.length === 0,
      safetyType: "TOSS_READ_ONLY_CREDENTIAL_READINESS_ONLY"
    };
  }

  private requireValue(
    value: string | undefined,
    fieldName: string,
    missingFields: string[]
  ): void {
    if (!value || value.startsWith(placeholderPrefix)) {
      missingFields.push(fieldName);
    }
  }
}
