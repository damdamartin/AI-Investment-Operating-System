# Task-050: Config Versioning Service

Status: Complete
Implemented In: 0.4.35
Last Updated: 2026-07-28

## Objective

Implement versioned configuration management for risk, strategy, market, and runtime settings.

## Context

Required reading: `docs/02_System_Architecture.md`, `docs/09_Operation_Deployment.md`, `docs/11_AI_RULES.md`.

## Scope

- Config category model.
- Versioned config records.
- Activation workflow.
- Audit hooks.

## Out of Scope

- Full dashboard editor.
- Secret storage.

## Outputs

- Config versioning service.
- Tests for immutable versions and activation.

## Acceptance Criteria

- Active config versions are traceable.
- Risk config changes are auditable.
- Approved historical versions are not mutated in place.

## Tests Required

- Unit tests for version creation and activation.

## Safety Requirements

- Production config changes must not be silent.

## Implementation Notes

- Added `ConfigVersioningService` for versioned risk, strategy, market, and runtime configuration records.
- Added `DRAFT`, `APPROVED`, `ACTIVE`, and `RETIRED` config version states.
- Added creation, approval, activation, and active-version lookup workflows.
- Activation requires approved versions and retires the previous active version in the same category.
- Config payloads are cloned, frozen, and tracked by payload hash.
- All create, approve, and activate operations produce audit metadata.

## Dependencies

- Task-018.
