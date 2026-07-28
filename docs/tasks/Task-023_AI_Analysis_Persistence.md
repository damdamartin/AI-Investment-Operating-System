# Task-023: AI Analysis Persistence

## Objective

Persist schema-validated AI analysis outputs with prompt, model, and evidence metadata.

## Context

Required reading: `docs/04_Database_Architecture.md`, `docs/06_AI_Architecture.md`, `docs/11_AI_RULES.md`.

## Scope

- AIAnalysis persistence model.
- Prompt template reference.
- Model metadata.
- Evidence and contradiction fields.
- Validation failure record.

## Out of Scope

- Strategy generation.
- Broker execution.

## Outputs

- AI analysis repository or persistence boundary.
- Tests for valid and invalid records.

## Acceptance Criteria

- Invalid AI output is not stored as valid analysis.
- Stored analysis includes schema version and prompt version.
- Analysis can be traced to input news or market data references.

## Tests Required

- Persistence tests.
- Schema validation tests.

## Safety Requirements

- AIAnalysis is advisory and must not contain executable broker commands.

## Dependencies

- Task-016.
- Task-010.
