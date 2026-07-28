import { redactObject, redactText } from "../../config/index.js";
import type {
  TossEvidenceKind,
  TossEvidenceMode,
  TossReadOnlyEvidenceItem
} from "./read-only-evidence-plan.js";

export interface TossReadOnlyEvidenceRecordInput {
  id: string;
  kind: TossEvidenceKind;
  mode: TossEvidenceMode;
  relatedOpenQuestion: string;
  summary: string;
  payload: unknown;
  knownSecrets?: Array<string | undefined>;
  collectedAt?: Date | undefined;
}

export interface TossReadOnlyEvidenceRecord {
  item: TossReadOnlyEvidenceItem;
  sanitizedPreview: unknown;
  safetyType: "TOSS_READ_ONLY_EVIDENCE_RECORD_ONLY";
}

const credentialKeyPattern =
  /(authorization|access[_-]?token|refresh[_-]?token|client[_-]?secret|api[_-]?key|password|secret)/i;
const accountKeyPattern = /(account[_-]?number|account[_-]?ref|acct[_-]?no)/i;
const liveWritePattern = /(submitOrder|cancelOrder|placeOrder|modifyOrder|withdraw|transfer)/i;

export class TossReadOnlyEvidenceRecorder {
  record(input: TossReadOnlyEvidenceRecordInput): TossReadOnlyEvidenceRecord {
    const serializedPayload = JSON.stringify(input.payload) ?? "";
    const sanitizedPayload = redactObject(input.payload);
    const knownSecrets = input.knownSecrets ?? [];
    const sanitizedSummary = redactText(input.summary, knownSecrets);
    const payloadText = redactText(serializedPayload, knownSecrets);
    const containsCredential = this.containsCredential(input.payload, payloadText);
    const liveWriteOperation = this.containsLiveWriteOperation(input.payload, payloadText);
    const hasUnmaskedAccountIdentifier = this.containsAccountIdentifier(input.payload);

    return {
      item: {
        id: input.id,
        kind: input.kind,
        mode: input.mode,
        collectedAt: input.collectedAt ?? new Date(),
        relatedOpenQuestion: input.relatedOpenQuestion,
        summary: sanitizedSummary,
        sanitized: !containsCredential && !hasUnmaskedAccountIdentifier,
        containsCredential,
        liveWriteOperation
      },
      sanitizedPreview: sanitizedPayload,
      safetyType: "TOSS_READ_ONLY_EVIDENCE_RECORD_ONLY"
    };
  }

  private containsCredential(payload: unknown, payloadText: string): boolean {
    return this.containsMatchingKey(payload, credentialKeyPattern) || credentialKeyPattern.test(payloadText);
  }

  private containsAccountIdentifier(payload: unknown): boolean {
    return this.containsMatchingKey(payload, accountKeyPattern);
  }

  private containsLiveWriteOperation(payload: unknown, payloadText: string): boolean {
    return this.containsMatchingKey(payload, liveWritePattern) || liveWritePattern.test(payloadText);
  }

  private containsMatchingKey(payload: unknown, pattern: RegExp): boolean {
    if (Array.isArray(payload)) {
      return payload.some((item) => this.containsMatchingKey(item, pattern));
    }

    if (payload !== null && typeof payload === "object") {
      return Object.entries(payload).some(
        ([key, value]) => pattern.test(key) || this.containsMatchingKey(value, pattern)
      );
    }

    return false;
  }
}
