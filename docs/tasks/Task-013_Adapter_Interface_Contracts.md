# Task-013: Adapter Interface Contracts

Status: Complete
Implemented In: 0.4.3

## Objective

Define internal adapter interfaces for Toss Securities, Naver News, and Claude API.

## Context

Required reading: `docs/05_API_Architecture.md`, `docs/02_System_Architecture.md`, `docs/11_AI_RULES.md`.

## Scope

- TossSecuritiesAdapter interface.
- NewsProviderAdapter interface.
- ClaudeAIAdapter interface.
- Normalized error model.
- Rate limit and retry metadata models.

## Out of Scope

- Real external API calls.
- Production credentials.

## Outputs

- Interface definitions.
- Fixture-friendly fake adapter implementations if useful.

## Acceptance Criteria

- Domain and strategy code depend on interfaces, not provider SDKs.
- Toss write methods are clearly separated from read methods.
- Claude adapter cannot return executable broker requests.

## Tests Required

- Unit or type tests proving callers can use interfaces with fakes.

## Safety Requirements

- Direct provider calls outside adapters are prohibited.

## Dependencies

- Task-003.
- Task-004.
