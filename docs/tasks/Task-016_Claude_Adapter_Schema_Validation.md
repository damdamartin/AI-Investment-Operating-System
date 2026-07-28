# Task-016: Claude Adapter Schema Validation

Status: Complete
Implemented In: 0.4.5

## Objective

Implement Claude API adapter boundaries with strict structured output validation.

## Context

Required reading: `docs/05_API_Architecture.md`, `docs/06_AI_Architecture.md`, `docs/11_AI_RULES.md`.

## Scope

- Claude adapter interface implementation or mock.
- JSON schema validation for AI outputs.
- Prompt template version references.
- AIAnalysis persistence-ready model.

## Out of Scope

- Strategy promotion automation.
- Broker API calls.

## Outputs

- Claude adapter boundary.
- Schema validators.
- Fixture tests.

## Acceptance Criteria

- Invalid Claude output is rejected and cannot influence order approval.
- Claude output cannot contain executable broker commands.
- Prompt version and model metadata are recorded.

## Tests Required

- Valid and invalid schema tests.
- Regression test that AI output is advisory only.

## Safety Requirements

- Claude must not hold broker credentials or call Toss APIs.

## Dependencies

- Task-002.
- Task-013.
