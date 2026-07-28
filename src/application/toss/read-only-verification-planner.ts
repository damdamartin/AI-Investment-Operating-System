import {
  TossReadOnlyDryRunClient,
  type TossReadOnlyDryRunPreparedRequest
} from "../../adapters/toss/index.js";
import type { AppConfig } from "../../config/index.js";
import {
  TossReadOnlyCredentialReadinessService
} from "./read-only-credential-readiness.js";
import {
  TossReadOnlyEndpointCatalogValidator,
  type TossReadOnlyEndpointCatalog
} from "./read-only-endpoint-catalog.js";

export interface TossReadOnlyVerificationPlanInput {
  config: AppConfig;
  catalog: TossReadOnlyEndpointCatalog;
}

export interface TossReadOnlyVerificationPlan {
  ready: boolean;
  preparedRequests: TossReadOnlyDryRunPreparedRequest[];
  reasonCodes: string[];
  warnings: string[];
  liveBrokerWriteAllowed: boolean;
  networkCallsPerformed: false;
  safetyType: "TOSS_READ_ONLY_VERIFICATION_PLAN_ONLY";
}

export class TossReadOnlyVerificationPlanner {
  plan(input: TossReadOnlyVerificationPlanInput): TossReadOnlyVerificationPlan {
    const credentialReadiness = new TossReadOnlyCredentialReadinessService().review(input.config);
    const catalogReview = new TossReadOnlyEndpointCatalogValidator().review(input.catalog);
    const reasonCodes = [...credentialReadiness.reasonCodes, ...catalogReview.reasonCodes];
    const warnings = [...catalogReview.warnings];

    if (!credentialReadiness.ready || !catalogReview.valid) {
      return {
        ready: false,
        preparedRequests: [],
        reasonCodes: [...new Set(reasonCodes)].sort(),
        warnings: [...new Set(warnings)].sort(),
        liveBrokerWriteAllowed: false,
        networkCallsPerformed: false,
        safetyType: "TOSS_READ_ONLY_VERIFICATION_PLAN_ONLY"
      };
    }

    const client = new TossReadOnlyDryRunClient({
      baseUrl: input.config.externalApis.tossApiBaseUrl!,
      clientId: input.config.secrets.tossClientId!,
      clientSecret: input.config.secrets.tossClientSecret!,
      accountRef: input.config.secrets.tossAccountRef!
    });
    const preparedRequests: TossReadOnlyDryRunPreparedRequest[] = [];

    for (const endpoint of input.catalog.items.filter((item) => item.verified)) {
      const prepared = client.prepare({
        operation: endpoint.operation,
        method: endpoint.method,
        path: endpoint.path
      });

      if (prepared.ok) {
        preparedRequests.push(prepared.data);
      } else {
        reasonCodes.push(prepared.error.code);
      }
    }

    return {
      ready: reasonCodes.length === 0,
      preparedRequests,
      reasonCodes: [...new Set(reasonCodes)].sort(),
      warnings: [...new Set(warnings)].sort(),
      liveBrokerWriteAllowed: false,
      networkCallsPerformed: false,
      safetyType: "TOSS_READ_ONLY_VERIFICATION_PLAN_ONLY"
    };
  }
}
