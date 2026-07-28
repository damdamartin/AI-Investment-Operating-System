# Claude Structured Output Evaluation

Version: 0.1.0
Status: Active
Last Updated: 2026-07-28
Related Task: `docs/tasks/phase5_claude_worktree_tasks/P5-005_claude_structured_output_evaluation.md`

## Purpose

This note summarizes what the Claude structured-output evaluation fixtures cover in Phase 5, and confirms the boundary they enforce: Claude output is advisory-only evidence for later deterministic decision-making, never an executable broker command.

All evaluation described here runs against fixtures or injected `generate` functions. Nothing in this evaluation calls the real Claude API, the real Toss Securities API, or any other network endpoint.

## Scope

Covered code:

- `src/adapters/claude/analysis-schema.ts` (`validateClaudeAnalysis`)
- `src/adapters/claude/claude-adapter.ts` (`ValidatingClaudeAdapter`)
- `src/application/ai/ai-analysis-persistence.ts` (`buildAIAnalysisRecord`, `buildAIAnalysisValidationFailureRecord`, `extractUsageMetadata`, `estimateAnalysisCost`)

Covered tests:

- `tests/adapters/claude-adapter.test.ts`
- `tests/application/ai-analysis-persistence.test.ts`
- `tests/safety/safety-regression.test.ts` (AI-advisory-only cross-checks against `BrokerWriteCommandGuard`)

## Evaluation Matrix

### 1. Invalid JSON-like output rejection

- Raw string output (unparsed JSON text) is rejected with `analysis_must_be_object`.
- `null` and array-shaped output are rejected the same way.
- A `JSON.parse` failure surfaced from the injected `generate` function is caught by `ValidatingClaudeAdapter` and returned as a retryable `CLAUDE_ADAPTER_ERROR`, never as a validated analysis.

### 2. Missing confidence and unsupported enum values

- `confidence` entirely absent, `null`, or a string is rejected.
- Unsupported `sentiment` and `timeHorizon` values, including case-mismatched values, are rejected.

### 3. `requires_review`, contradictions, and unknown fields

- `requiresReview` is stored verbatim as a strict boolean; string coercions (`"true"`) are rejected.
- `contradictions` must be a string array; non-array and non-string entries are rejected.
- Unknown top-level fields that are not part of the schema are dropped silently and never persisted downstream.
- A forbidden broker-command key hidden inside an otherwise-unknown field, at any nesting depth or inside an array, causes the whole analysis to be rejected outright rather than partially trimmed. This mirrors the recursive AI-context scan already used by `BrokerWriteCommandGuard`.

### 4. Model and prompt template metadata references

- `model` comes from the validated Claude output; `promptTemplateId` and `promptTemplateVersion` come from the request that selected the template. These are kept distinct in `AIAnalysisRecord` so an audit can reconstruct exactly which template produced which model output.
- `schemaVersion` is required and persisted alongside the analysis.

### 5. Token usage and cost metadata (where available)

- `extractUsageMetadata` reads the `token_usage: { input, output }` shape documented in `docs/05_API_Architecture.md` section 7.5, returning `undefined` when usage is absent or malformed rather than guessing.
- `estimateAnalysisCost` computes a cost estimate from extracted usage and a locally supplied rate card. It refuses negative rate card values and returns `undefined` when usage is incomplete.
- This metadata never represents broker capital; it is Claude API cost accounting only and must not be confused with domain `Money` used for order sizing.

### 6. Advisory-only boundary

- `AIAnalysisRecord.safetyType` is always `"AI_ANALYSIS_ADVISORY_ONLY"`.
- Confidence is stored exactly as validated; nothing in the persistence layer boosts, clamps upward, or otherwise increases conviction for low-confidence output.
- A schema-valid, high-confidence, `requiresReview:false` analysis is still insufficient, by itself, to satisfy `BrokerWriteCommandGuard`. The guard requires a separately-approved `OrderApproval`, broker account, portfolio link, compliance gate, capability registry, environment policy, kill switch state, and reconciliation state, none of which AI output can supply.
- Invalid Claude output (including output smuggling a forbidden broker command) can never be built into a valid `AIAnalysisRecord`; `buildAIAnalysisRecord` throws `DomainValidationError` if given a failed validation result.

## Non-Goals

This evaluation does not:

- Call the real Claude API.
- Send Toss credentials, account identifiers, or raw broker payloads to any prompt or fixture.
- Implement strategy promotion automation.
- Change how `BrokerWriteCommandGuard` or `read-only-endpoint-catalog.ts` are implemented (those remain owned by other Phase 5 engineers).
