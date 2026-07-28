# Task-058: Security Access Control Baseline

## Objective

Create the baseline access control model for operators, read-only views, and sensitive actions.

## Context

Required reading: `docs/09_Operation_Deployment.md`, `docs/11_AI_RULES.md`, `docs/13_Compliance_and_Legal_Review.md`.

## Scope

- Actor model.
- Role model.
- Permission model.
- Sensitive action authorization checks.
- Masking policy for account identifiers.

## Out of Scope

- Production identity provider integration.
- Multi-user advisory service.

## Outputs

- Access control module or specification.
- Tests for role and permission checks.

## Acceptance Criteria

- Read-only and sensitive actions are separated.
- Unknown actor or permission state fails closed.
- Account identifiers are masked.

## Tests Required

- Unit tests for roles, permissions, and masking.

## Safety Requirements

- No public or unauthenticated access to production control surfaces.

## Dependencies

- Task-048.
