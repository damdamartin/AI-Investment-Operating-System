# Task-002: Runtime Config and Secrets

## Objective

Create a configuration loading pattern that separates ordinary config from secrets.

## Context

Required reading: `docs/09_Operation_Deployment.md`, `docs/11_AI_RULES.md`, `docs/13_Compliance_and_Legal_Review.md`.

## Scope

- Define environment-based config loading.
- Define secret lookup names for Toss, Naver, and Claude credentials.
- Add redaction helpers for logs and errors.
- Add safe example config without real values.

## Out of Scope

- Real production secret manager integration.
- Real API calls.

## Outputs

- Config module.
- Secret redaction utility.
- Example environment file with placeholder values only.

## Acceptance Criteria

- Missing required secrets fail with safe errors.
- Logs never print secret values.
- Development, test, and production config are separable.

## Tests Required

- Unit tests for config validation.
- Unit tests for secret redaction.

## Safety Requirements

- Never commit real API keys, account numbers, tokens, or credentials.

## Dependencies

- Task-001.
