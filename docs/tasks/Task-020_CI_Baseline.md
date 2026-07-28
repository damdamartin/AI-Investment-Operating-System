# Task-020: CI Baseline

Status: Partial
Implemented In: 0.4.0
Remaining: Include the dedicated safety regression suite after Task-019 is implemented.

## Objective

Create the initial continuous integration baseline for documentation and code quality checks.

## Context

Required reading: `docs/08_Testing_Validation.md`, `docs/09_Operation_Deployment.md`, `docs/10_Claude_Code_Guide.md`.

## Scope

- Configure CI for tests, linting, formatting, and basic documentation checks.
- Ensure CI does not require production secrets.
- Add placeholder workflow documentation if a CI provider is not selected.

## Out of Scope

- Production deployment.
- Cloud infrastructure provisioning.

## Outputs

- CI configuration or documented CI placeholder.
- Basic checks runnable by developers.

## Acceptance Criteria

- CI can run without real Toss, Naver, or Claude credentials.
- Failing tests block merge.
- Safety regression test suite is included once Task-019 exists.

## Tests Required

- CI self-check or local equivalent.

## Safety Requirements

- CI logs must not expose secrets.

## Dependencies

- Task-001.
- Task-002.
- Task-019.
