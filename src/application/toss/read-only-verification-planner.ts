import {
  TossReadOnlyDryRunClient,
  type TossReadOnlyDryRunPreparedRequest,
  type TossReadOnlyOperation
} from "../../adapters/toss/index.js";
import type { AppConfig } from "../../config/index.js";
import {
  TossReadOnlyCredentialReadinessService
} from "./read-only-credential-readiness.js";
import {
  TossReadOnlyEndpointCatalogValidator,
  type TossReadOnlyEndpointCatalog
} from "./read-only-endpoint-catalog.js";
import {
  TossReadOnlyCallApprovalLedger,
  TossReadOnlyCallApprovalValidator,
  type TossReadOnlyCallApprovalRecord
} from "./read-only-evidence-intake.js";
import type { TossEvidenceKind } from "./read-only-evidence-plan.js";

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

export interface TossReadOnlyOneCallHarnessInput {
  config: AppConfig;
  catalog: TossReadOnlyEndpointCatalog;
  approval: TossReadOnlyCallApprovalRecord;
  /**
   * Optional shared ledger for enforcing single-use approval consumption across
   * multiple harness invocations. When omitted, a fresh in-memory ledger is
   * created for this call only, which means single-use enforcement can only be
   * observed by callers who share the same ledger instance across attempts.
   */
  ledger?: TossReadOnlyCallApprovalLedger;
}

export interface TossReadOnlyOneCallHarnessResult {
  ready: boolean;
  /** The single read-only operation this harness scoped a dry-run request to. */
  scopedOperation?: TossReadOnlyOperation;
  /** The evidence kind that recorded evidence for this call must match. */
  expectedEvidenceKind?: TossEvidenceKind;
  /** Exactly one prepared, sanitized, no-network dry-run request. */
  preparedRequest?: TossReadOnlyDryRunPreparedRequest;
  /** Whether the approval's single-use allowance was consumed by this attempt. */
  approvalConsumed: boolean;
  reasonCodes: string[];
  warnings: string[];
  liveBrokerWriteAllowed: false;
  networkCallsPerformed: false;
  safetyType: "TOSS_READ_ONLY_ONE_CALL_HARNESS_REVIEW_ONLY";
}

/**
 * Proves that the project can prepare exactly one future Toss read-only
 * verification call without ever calling Toss.
 *
 * This harness ties together, in a single reviewable flow:
 * - local credential readiness (`TossReadOnlyCredentialReadinessService`)
 * - endpoint catalog validation (`TossReadOnlyEndpointCatalogValidator`)
 * - a sanitized, single-use approval record (`TossReadOnlyCallApprovalValidator`
 *   and `TossReadOnlyCallApprovalLedger`)
 * - a sanitized dry-run prepared request (`TossReadOnlyDryRunClient`)
 * - the expected evidence kind the resulting evidence record must match
 *
 * It never performs a network call. It always resolves to at most one
 * prepared request, scoped to the single endpoint catalog entry the approval
 * references. A second attempt with the same approval id (against a shared
 * ledger) is rejected as an already-consumed approval, so the approval can
 * never function as an unbounded, reusable permission.
 */
export class TossReadOnlyOneCallHarness {
  prepare(input: TossReadOnlyOneCallHarnessInput): TossReadOnlyOneCallHarnessResult {
    const reasonCodes: string[] = [];
    const warnings: string[] = [];

    const credentialReadiness = new TossReadOnlyCredentialReadinessService().review(input.config);
    const catalogReview = new TossReadOnlyEndpointCatalogValidator().review(input.catalog);
    const approvalReview = new TossReadOnlyCallApprovalValidator().review(input.approval);

    reasonCodes.push(
      ...credentialReadiness.reasonCodes,
      ...catalogReview.reasonCodes,
      ...approvalReview.reasonCodes
    );
    warnings.push(...catalogReview.warnings, ...approvalReview.warnings);

    const matchedEndpoints = input.catalog.items.filter(
      (item) => item.id === input.approval.endpointCatalogReference
    );

    if (matchedEndpoints.length === 0) {
      reasonCodes.push("approval_endpoint_catalog_reference_not_found");
    } else if (matchedEndpoints.length > 1) {
      reasonCodes.push("approval_endpoint_catalog_reference_not_unique");
    }

    const endpoint = matchedEndpoints.length === 1 ? matchedEndpoints[0] : undefined;

    if (endpoint) {
      if (endpoint.operation !== input.approval.approvedOperation) {
        reasonCodes.push("approval_operation_does_not_match_endpoint");
      }

      if (endpoint.evidenceKind !== input.approval.expectedEvidenceKind) {
        reasonCodes.push("approval_expected_evidence_kind_does_not_match_endpoint");
      }

      if (!endpoint.verified) {
        reasonCodes.push("one_call_harness_endpoint_not_verified");
      }
    }

    const readyToConsumeApproval =
      credentialReadiness.ready &&
      catalogReview.valid &&
      approvalReview.approved &&
      endpoint !== undefined &&
      reasonCodes.length === 0;

    if (!readyToConsumeApproval || !endpoint) {
      return {
        ready: false,
        approvalConsumed: false,
        reasonCodes: [...new Set(reasonCodes)].sort(),
        warnings: [...new Set(warnings)].sort(),
        liveBrokerWriteAllowed: false,
        networkCallsPerformed: false,
        safetyType: "TOSS_READ_ONLY_ONE_CALL_HARNESS_REVIEW_ONLY"
      };
    }

    const ledger = input.ledger ?? new TossReadOnlyCallApprovalLedger();
    const consumption = ledger.consume(input.approval);

    if (!consumption.consumed) {
      return {
        ready: false,
        approvalConsumed: false,
        reasonCodes: [...new Set([...reasonCodes, ...consumption.reasonCodes])].sort(),
        warnings: [...new Set(warnings)].sort(),
        liveBrokerWriteAllowed: false,
        networkCallsPerformed: false,
        safetyType: "TOSS_READ_ONLY_ONE_CALL_HARNESS_REVIEW_ONLY"
      };
    }

    const client = new TossReadOnlyDryRunClient({
      baseUrl: input.config.externalApis.tossApiBaseUrl!,
      clientId: input.config.secrets.tossClientId!,
      clientSecret: input.config.secrets.tossClientSecret!,
      accountRef: input.config.secrets.tossAccountRef!
    });

    const prepared = client.prepare({
      operation: endpoint.operation,
      method: endpoint.method,
      path: endpoint.path
    });

    if (!prepared.ok) {
      return {
        ready: false,
        approvalConsumed: true,
        reasonCodes: [...new Set([...reasonCodes, prepared.error.code])].sort(),
        warnings: [...new Set(warnings)].sort(),
        liveBrokerWriteAllowed: false,
        networkCallsPerformed: false,
        safetyType: "TOSS_READ_ONLY_ONE_CALL_HARNESS_REVIEW_ONLY"
      };
    }

    return {
      ready: true,
      scopedOperation: endpoint.operation,
      expectedEvidenceKind: input.approval.expectedEvidenceKind,
      preparedRequest: prepared.data,
      approvalConsumed: true,
      reasonCodes: [],
      warnings: [...new Set(warnings)].sort(),
      liveBrokerWriteAllowed: false,
      networkCallsPerformed: false,
      safetyType: "TOSS_READ_ONLY_ONE_CALL_HARNESS_REVIEW_ONLY"
    };
  }
}
