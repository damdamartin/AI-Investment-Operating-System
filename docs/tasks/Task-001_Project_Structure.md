# Task-001: Project Structure

Status: Complete
Implemented In: 0.4.0

## Objective

Create the initial application folder structure and development workspace layout.

## Context

Required reading: `docs/02_System_Architecture.md`, `docs/10_Claude_Code_Guide.md`, `docs/11_AI_RULES.md`.

## Scope

- Create source, test, config, scripts, and infrastructure folders.
- Add placeholder package/module boundaries for domain, application, adapters, persistence, operations, and tests.
- Add a short root-level developer README if needed.

## Out of Scope

- Implementing trading logic.
- Connecting external APIs.
- Adding production secrets.

## Outputs

- Project skeleton that clearly separates domain logic, adapters, persistence, and operations.
- Placeholder files only where needed to preserve empty folders.

## Acceptance Criteria

- Folder structure matches the layered architecture.
- No module depends directly on Toss, Naver, or Claude implementation details.
- Repository remains buildable or at least structurally valid for the selected stack.

## Tests Required

- None beyond basic repository validation for this task.

## Safety Requirements

- Do not add secrets or sample real account identifiers.
- Do not add live trading code.

## Dependencies

- None.
