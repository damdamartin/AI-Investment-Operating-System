# Task-018: Audit Log Service

Status: Complete
Implemented In: 0.4.4

## Objective

Create the audit logging foundation for safety-relevant decisions and operator actions.

## Context

Required reading: `docs/04_Database_Architecture.md`, `docs/09_Operation_Deployment.md`, `docs/11_AI_RULES.md`.

## Scope

- Audit record model.
- Safe actor/action/resource schema.
- Redaction before audit storage.
- Initial audit service interface.

## Out of Scope

- Full dashboard.
- External SIEM integration.

## Outputs

- Audit service interface and implementation stub.
- Tests for redaction and required fields.

## Acceptance Criteria

- Safety-relevant actions can be recorded with actor, action, resource, timestamp, and reason.
- Secrets and raw account numbers are redacted.
- Audit records are append-only at the service level.

## Tests Required

- Unit tests for required fields.
- Secret and account identifier redaction tests.

## Safety Requirements

- Audit logs must not become a source of credential leakage.

## Dependencies

- Task-002.
- Task-010.
