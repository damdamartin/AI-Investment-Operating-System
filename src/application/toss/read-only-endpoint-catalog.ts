import type { TossReadOnlyOperation } from "../../adapters/toss/index.js";
import type { TossEvidenceKind } from "./read-only-evidence-plan.js";

export interface TossReadOnlyEndpointCatalogItem {
  id: string;
  operation: TossReadOnlyOperation;
  method: "GET" | "POST";
  path: string;
  evidenceKind: TossEvidenceKind;
  relatedOpenQuestion: string;
  source: "TOSS_OFFICIAL_DOCS" | "TOSS_DEVELOPER_CONSOLE" | "LOCAL_VERIFICATION";
  verified: boolean;
  notes: string;
}

export interface TossReadOnlyEndpointCatalog {
  catalogVersion: "1";
  updatedAt: Date;
  items: TossReadOnlyEndpointCatalogItem[];
}

export interface TossReadOnlyEndpointCatalogReview {
  valid: boolean;
  reasonCodes: string[];
  warnings: string[];
  verifiedEndpointCount: number;
  liveBrokerWriteAllowed: boolean;
  safetyType: "TOSS_READ_ONLY_ENDPOINT_CATALOG_REVIEW_ONLY";
}

/**
 * All read-only operation classes the catalog currently recognizes. Anything else
 * (including a missing value) fails closed rather than being treated as read-only
 * by default.
 */
const validOperations = new Set<TossReadOnlyOperation>([
  "AUTHENTICATION_READ",
  "ACCOUNT_SNAPSHOT_READ",
  "POSITION_QUERY_READ",
  "MARKET_DATA_READ",
  "ORDER_STATUS_QUERY_READ",
  "FILL_QUERY_READ",
  "CAPABILITY_METADATA_READ"
]);

const validSources = new Set([
  "TOSS_OFFICIAL_DOCS",
  "TOSS_DEVELOPER_CONSOLE",
  "LOCAL_VERIFICATION"
]);

const validMethods = new Set(["GET", "POST"]);

/**
 * Phase 5 evidence is only meaningful when it maps to one of the four tracked
 * open questions. An endpoint that cannot be tied to a tracked open question is
 * unrelated to Phase 5 evidence collection and must not be treated as catalog-ready.
 */
const validOpenQuestions = new Set(["OQ-001", "OQ-002", "OQ-003", "OQ-004"]);

/**
 * Operations that carry elevated audit risk because the catalog grants them a
 * special allowance elsewhere in this validator (POST for authentication, or a
 * write-shaped path for order-status/fill reads). For these operations, the
 * evidence kind must match the operation exactly - generic read evidence is not
 * enough to unlock the allowance.
 */
const elevatedOperationEvidenceKind: Partial<Record<TossReadOnlyOperation, TossEvidenceKind>> = {
  AUTHENTICATION_READ: "AUTHENTICATION_READ",
  ORDER_STATUS_QUERY_READ: "ORDER_STATUS_QUERY_READ",
  FILL_QUERY_READ: "FILL_QUERY_READ"
};

/**
 * Operations with no special method/path allowance. Evidence for these must still
 * be present and must not borrow an elevated evidence kind (authentication,
 * order-status, or fill evidence) that belongs to a different, more sensitive
 * operation class.
 */
const nonElevatedOperations = new Set<TossReadOnlyOperation>([
  "ACCOUNT_SNAPSHOT_READ",
  "POSITION_QUERY_READ",
  "MARKET_DATA_READ",
  "CAPABILITY_METADATA_READ"
]);

const nonElevatedEvidenceKinds = new Set<TossEvidenceKind>([
  "ACCOUNT_SNAPSHOT_READ",
  "POSITION_QUERY_READ",
  "MARKET_DATA_READ",
  "API_TERMS_REVIEW",
  "ETF_SUPPORT_DOCUMENTATION",
  "FRACTIONAL_SUPPORT_DOCUMENTATION",
  "EXTENDED_HOURS_DOCUMENTATION"
]);

/**
 * Operations allowed to keep a write-shaped path (e.g. "/v1/orders/{id}/status")
 * because they represent a read of order or fill state, not a mutation. This
 * allowance only applies when the evidence kind also proves the operation is a
 * genuine order-status or fill read (see elevatedOperationEvidenceKind above).
 */
const mutationLookingPathAllowedOperations = new Set<TossReadOnlyOperation>([
  "ORDER_STATUS_QUERY_READ",
  "FILL_QUERY_READ"
]);

/**
 * Unambiguous broker mutation verbs. These never describe a read operation, so a
 * path containing one is always rejected, even for an endpoint labeled as an
 * order-status or fill read. Word-boundary matching avoids false positives on
 * benign substrings (e.g. "marketplace" does not match "place").
 */
const hardBlockedWritePathPattern =
  /\b(cancel|modify|amend|replace|withdraw|transfer|exchange|deposit|buy|sell|place|submit|settle|close)\b/i;

/**
 * Nouns that are genuinely ambiguous: real broker APIs may expose read endpoints
 * whose paths include "orders" or "fills" for order-status/fill queries. A path
 * matching only this pattern is tolerated solely for ORDER_STATUS_QUERY_READ and
 * FILL_QUERY_READ operations, and only when backed by matching, verified evidence.
 */
const softBlockedOrderPathPattern = /\b(orders?|fills?)\b/i;

export class TossReadOnlyEndpointCatalogValidator {
  review(catalog: TossReadOnlyEndpointCatalog): TossReadOnlyEndpointCatalogReview {
    const reasonCodes: string[] = [];
    const warnings: string[] = [];
    const seenIds = new Set<string>();

    if (catalog.catalogVersion !== "1") {
      reasonCodes.push("unsupported_endpoint_catalog_version");
    }

    for (const item of catalog.items) {
      const id = typeof item.id === "string" && item.id.length > 0 ? item.id : "unknown";

      if (seenIds.has(id)) {
        reasonCodes.push(`duplicate_endpoint_id_${id}`);
      }
      seenIds.add(id);

      if (typeof item.path !== "string" || !item.path.startsWith("/")) {
        reasonCodes.push(`endpoint_path_must_start_with_slash_${id}`);
      }

      if (!validMethods.has(item.method)) {
        reasonCodes.push(`endpoint_invalid_method_${id}`);
      }

      const hasKnownOperation = item.operation != null && validOperations.has(item.operation);
      if (!hasKnownOperation) {
        reasonCodes.push(`endpoint_missing_operation_class_${id}`);
      }

      const hasKnownSource = item.source != null && validSources.has(item.source);
      if (!hasKnownSource) {
        reasonCodes.push(`endpoint_missing_source_evidence_${id}`);
      }

      if (item.method === "POST" && item.operation !== "AUTHENTICATION_READ") {
        reasonCodes.push(`post_allowed_only_for_authentication_${id}`);
      }

      if (hasKnownOperation) {
        const requiredElevatedKind = elevatedOperationEvidenceKind[item.operation];

        if (requiredElevatedKind) {
          if (item.evidenceKind !== requiredElevatedKind) {
            reasonCodes.push(`endpoint_operation_evidence_mismatch_${id}`);
          }
        } else if (nonElevatedOperations.has(item.operation)) {
          if (!item.evidenceKind || !nonElevatedEvidenceKinds.has(item.evidenceKind)) {
            reasonCodes.push(`endpoint_operation_evidence_mismatch_${id}`);
          }
        }
      }

      const path = typeof item.path === "string" ? item.path : "";
      const hasHardBlockedKeyword = hardBlockedWritePathPattern.test(path);
      const hasAmbiguousOrderKeyword = softBlockedOrderPathPattern.test(path);
      const isSafeOrderOrFillRead =
        hasKnownOperation && mutationLookingPathAllowedOperations.has(item.operation);

      if (hasHardBlockedKeyword) {
        // Unambiguous mutation verbs (cancel, modify, withdraw, ...) are never
        // tolerated, regardless of the declared operation or evidence.
        reasonCodes.push(`endpoint_path_looks_write_scoped_${id}`);
      } else if (hasAmbiguousOrderKeyword) {
        if (!isSafeOrderOrFillRead) {
          reasonCodes.push(`endpoint_path_looks_write_scoped_${id}`);
        } else {
          // A write-shaped path is only tolerated for order-status/fill reads when
          // it is backed by real, matching, verified evidence.
          const hasMatchingEvidence = item.evidenceKind === elevatedOperationEvidenceKind[item.operation];

          if (!item.verified || !hasKnownSource || !hasMatchingEvidence) {
            reasonCodes.push(`endpoint_mutation_looking_path_requires_verified_evidence_${id}`);
          }
        }
      }

      const hasKnownOpenQuestion =
        typeof item.relatedOpenQuestion === "string" && validOpenQuestions.has(item.relatedOpenQuestion);
      if (!hasKnownOpenQuestion) {
        reasonCodes.push(`endpoint_missing_open_question_${id}`);
      }

      if (!item.verified) {
        warnings.push(`endpoint_not_verified_${id}`);
      }
    }

    return {
      valid: reasonCodes.length === 0,
      reasonCodes: [...new Set(reasonCodes)].sort(),
      warnings: [...new Set(warnings)].sort(),
      verifiedEndpointCount: catalog.items.filter((item) => item.verified).length,
      liveBrokerWriteAllowed: false,
      safetyType: "TOSS_READ_ONLY_ENDPOINT_CATALOG_REVIEW_ONLY"
    };
  }
}
