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

const writePathPattern = /(order|orders|cancel|modify|withdraw|transfer|exchange)/i;

export class TossReadOnlyEndpointCatalogValidator {
  review(catalog: TossReadOnlyEndpointCatalog): TossReadOnlyEndpointCatalogReview {
    const reasonCodes: string[] = [];
    const warnings: string[] = [];
    const seenIds = new Set<string>();

    if (catalog.catalogVersion !== "1") {
      reasonCodes.push("unsupported_endpoint_catalog_version");
    }

    for (const item of catalog.items) {
      if (seenIds.has(item.id)) {
        reasonCodes.push(`duplicate_endpoint_id_${item.id}`);
      }
      seenIds.add(item.id);

      if (!item.path.startsWith("/")) {
        reasonCodes.push(`endpoint_path_must_start_with_slash_${item.id}`);
      }

      if (item.method === "POST" && item.operation !== "AUTHENTICATION_READ") {
        reasonCodes.push(`post_allowed_only_for_authentication_${item.id}`);
      }

      if (writePathPattern.test(item.path) && !["ORDER_STATUS_QUERY_READ", "FILL_QUERY_READ"].includes(item.operation)) {
        reasonCodes.push(`endpoint_path_looks_write_scoped_${item.id}`);
      }

      if (!item.relatedOpenQuestion.startsWith("OQ-")) {
        reasonCodes.push(`endpoint_missing_open_question_${item.id}`);
      }

      if (!item.verified) {
        warnings.push(`endpoint_not_verified_${item.id}`);
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
