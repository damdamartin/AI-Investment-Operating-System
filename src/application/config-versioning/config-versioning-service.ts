import type { AuditRecordProps } from "../audit/index.js";

export type ConfigCategory = "RISK" | "STRATEGY" | "MARKET" | "RUNTIME";
export type ConfigVersionStatus = "DRAFT" | "APPROVED" | "ACTIVE" | "RETIRED";

export interface ConfigVersionRecord {
  id: string;
  category: ConfigCategory;
  version: string;
  status: ConfigVersionStatus;
  payload: Readonly<Record<string, unknown>>;
  createdBy: string;
  createdAt: Date;
  approvedBy?: string | undefined;
  approvedAt?: Date | undefined;
  activatedBy?: string | undefined;
  activatedAt?: Date | undefined;
  retiredAt?: Date | undefined;
  previousVersionId?: string | undefined;
  changeReason: string;
  payloadHash: string;
  safetyType: "VERSIONED_CONFIG_RECORD_ONLY";
}

export interface ConfigVersionStore {
  records: ConfigVersionRecord[];
}

export interface ConfigVersionCommand {
  actor: string;
  reason: string;
  occurredAt: Date;
}

export interface CreateConfigVersionInput extends ConfigVersionCommand {
  id: string;
  category: ConfigCategory;
  version: string;
  payload: Record<string, unknown>;
  previousVersionId?: string | undefined;
}

export interface ConfigVersionCommandResult {
  ok: boolean;
  store: ConfigVersionStore;
  record?: ConfigVersionRecord | undefined;
  reasonCodes: string[];
  auditRecord?: AuditRecordProps | undefined;
  safetyType: "CONFIG_VERSIONING_COMMAND_RESULT_ONLY";
}

export class ConfigVersioningService {
  createDraft(store: ConfigVersionStore, input: CreateConfigVersionInput): ConfigVersionCommandResult {
    const reasonCodes = validateCommand(input);
    if (!input.id.trim()) reasonCodes.push("config_id_required");
    if (!input.version.trim()) reasonCodes.push("config_version_required");
    if (store.records.some((record) => record.id === input.id)) reasonCodes.push("config_id_already_exists");
    if (store.records.some((record) => record.category === input.category && record.version === input.version)) {
      reasonCodes.push("config_category_version_already_exists");
    }
    if (input.previousVersionId && !store.records.some((record) => record.id === input.previousVersionId)) {
      reasonCodes.push("previous_config_version_not_found");
    }

    if (reasonCodes.length > 0) return commandResult(false, cloneStore(store), undefined, reasonCodes);

    const record: ConfigVersionRecord = {
      id: input.id,
      category: input.category,
      version: input.version,
      status: "DRAFT",
      payload: freezePayload(input.payload),
      createdBy: input.actor,
      createdAt: input.occurredAt,
      previousVersionId: input.previousVersionId,
      changeReason: input.reason,
      payloadHash: payloadHash(input.payload),
      safetyType: "VERSIONED_CONFIG_RECORD_ONLY"
    };
    const nextStore = cloneStore(store);
    nextStore.records.push(record);

    return commandResult(true, nextStore, record, ["config_draft_created"], auditRecord(record, input, "CONFIG_VERSION_CREATED"));
  }

  approve(store: ConfigVersionStore, recordId: string, command: ConfigVersionCommand): ConfigVersionCommandResult {
    const nextStore = cloneStore(store);
    const record = nextStore.records.find((item) => item.id === recordId);
    const reasonCodes = validateCommand(command);

    if (!record) reasonCodes.push("config_version_not_found");
    if (record && record.status !== "DRAFT") reasonCodes.push("only_draft_config_can_be_approved");
    if (reasonCodes.length > 0) return commandResult(false, nextStore, record, reasonCodes);

    const approved = {
      ...record!,
      status: "APPROVED" as const,
      approvedBy: command.actor,
      approvedAt: command.occurredAt
    };
    replaceRecord(nextStore, approved);

    return commandResult(true, nextStore, approved, ["config_version_approved"], auditRecord(approved, command, "CONFIG_VERSION_APPROVED"));
  }

  activate(store: ConfigVersionStore, recordId: string, command: ConfigVersionCommand): ConfigVersionCommandResult {
    const nextStore = cloneStore(store);
    const record = nextStore.records.find((item) => item.id === recordId);
    const reasonCodes = validateCommand(command);

    if (!record) reasonCodes.push("config_version_not_found");
    if (record && record.status !== "APPROVED") reasonCodes.push("only_approved_config_can_be_activated");
    if (record?.category === "RISK" && !record.approvedBy) reasonCodes.push("risk_config_activation_requires_approval");
    if (reasonCodes.length > 0) return commandResult(false, nextStore, record, reasonCodes);

    const activated = {
      ...record!,
      status: "ACTIVE" as const,
      activatedBy: command.actor,
      activatedAt: command.occurredAt
    };

    for (const existing of nextStore.records) {
      if (existing.category === activated.category && existing.status === "ACTIVE") {
        replaceRecord(nextStore, { ...existing, status: "RETIRED", retiredAt: command.occurredAt });
      }
    }
    replaceRecord(nextStore, activated);

    return commandResult(true, nextStore, activated, ["config_version_activated"], auditRecord(activated, command, "CONFIG_VERSION_ACTIVATED"));
  }

  activeVersion(store: ConfigVersionStore, category: ConfigCategory): ConfigVersionRecord | undefined {
    return store.records.find((record) => record.category === category && record.status === "ACTIVE");
  }
}

export function createConfigVersionStore(records: ConfigVersionRecord[] = []): ConfigVersionStore {
  return {
    records: records.map(cloneRecord)
  };
}

function validateCommand(command: ConfigVersionCommand): string[] {
  const reasonCodes: string[] = [];
  if (!command.actor.trim()) reasonCodes.push("config_actor_required");
  if (!command.reason.trim()) reasonCodes.push("config_change_reason_required");
  if (Number.isNaN(command.occurredAt.getTime())) reasonCodes.push("config_occurred_at_invalid");
  return reasonCodes;
}

function commandResult(
  ok: boolean,
  store: ConfigVersionStore,
  record: ConfigVersionRecord | undefined,
  reasonCodes: string[],
  auditRecord?: AuditRecordProps | undefined
): ConfigVersionCommandResult {
  const result: ConfigVersionCommandResult = {
    ok,
    store,
    record,
    reasonCodes: [...new Set(reasonCodes)].sort(),
    safetyType: "CONFIG_VERSIONING_COMMAND_RESULT_ONLY"
  };
  if (auditRecord) result.auditRecord = auditRecord;
  return result;
}

function auditRecord(
  record: ConfigVersionRecord,
  command: ConfigVersionCommand,
  action: "CONFIG_VERSION_CREATED" | "CONFIG_VERSION_APPROVED" | "CONFIG_VERSION_ACTIVATED"
): AuditRecordProps {
  return {
    id: `audit-${record.id}-${action.toLowerCase()}-${command.occurredAt.getTime()}`,
    actor: command.actor,
    action,
    resourceType: "CONFIG_VERSION",
    resourceId: record.id,
    reason: command.reason,
    metadata: {
      category: record.category,
      version: record.version,
      status: record.status,
      payloadHash: record.payloadHash,
      previousVersionId: record.previousVersionId
    },
    createdAt: command.occurredAt
  };
}

function replaceRecord(store: ConfigVersionStore, replacement: ConfigVersionRecord): void {
  const index = store.records.findIndex((record) => record.id === replacement.id);
  if (index >= 0) store.records[index] = cloneRecord(replacement);
}

function cloneStore(store: ConfigVersionStore): ConfigVersionStore {
  return {
    records: store.records.map(cloneRecord)
  };
}

function cloneRecord(record: ConfigVersionRecord): ConfigVersionRecord {
  return {
    ...record,
    payload: freezePayload(record.payload),
    safetyType: "VERSIONED_CONFIG_RECORD_ONLY"
  };
}

function freezePayload(payload: Record<string, unknown>): Readonly<Record<string, unknown>> {
  return Object.freeze(JSON.parse(JSON.stringify(payload)) as Record<string, unknown>);
}

function payloadHash(payload: Record<string, unknown>): string {
  const normalized = JSON.stringify(sortObject(payload));
  let hash = 0;
  for (let index = 0; index < normalized.length; index += 1) {
    hash = Math.imul(31, hash) + normalized.charCodeAt(index) | 0;
  }
  return `config-hash-${Math.abs(hash).toString(16)}`;
}

function sortObject(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortObject);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nested]) => [key, sortObject(nested)])
  );
}
