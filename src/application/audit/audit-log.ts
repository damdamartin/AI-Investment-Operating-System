import { redactObject } from "../../config/index.js";
import { DomainValidationError } from "../../shared/errors.js";
import { requireEntityId, type EntityId } from "../../domain/common/index.js";

export interface AuditRecordProps {
  id: string;
  actor: string;
  action: string;
  resourceType: string;
  resourceId: string;
  reason?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

export class AuditRecord {
  readonly id: EntityId;
  readonly actor: string;
  readonly action: string;
  readonly resourceType: string;
  readonly resourceId: string;
  readonly reason: string | undefined;
  readonly metadata: Record<string, unknown>;
  readonly createdAt: Date;

  constructor(props: AuditRecordProps) {
    this.id = requireEntityId(props.id, "Audit record id");
    this.actor = requireEntityId(props.actor, "Audit actor");
    this.action = requireEntityId(props.action, "Audit action");
    this.resourceType = requireEntityId(props.resourceType, "Audit resource type");
    this.resourceId = requireEntityId(props.resourceId, "Audit resource id");
    this.reason = props.reason;
    this.metadata = redactObject(props.metadata ?? {});
    this.createdAt = props.createdAt;

    if (Number.isNaN(this.createdAt.getTime())) {
      throw new DomainValidationError("Audit createdAt must be valid.");
    }
  }
}

export interface AuditLogSink {
  append(record: AuditRecord): Promise<void>;
}

export class InMemoryAuditLogSink implements AuditLogSink {
  readonly records: AuditRecord[] = [];

  async append(record: AuditRecord): Promise<void> {
    this.records.push(record);
  }
}

export class AuditLogService {
  constructor(private readonly sink: AuditLogSink) {}

  async record(props: AuditRecordProps): Promise<AuditRecord> {
    const record = new AuditRecord(props);
    await this.sink.append(record);
    return record;
  }
}
