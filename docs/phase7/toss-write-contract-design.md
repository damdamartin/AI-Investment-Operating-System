# Toss Write Contract Design

Version: 0.1.0
Status: Draft
Last Updated: 2026-07-29
Task: `docs/tasks/phase7_claude_worktree_tasks/P7-002_toss_write_contract_design.md`
Related Docs: `docs/05_API_Architecture.md`, `docs/07_Trading_System.md`,
`docs/11_AI_RULES.md`, `docs/phase7/README.md`
Related Code (read-only inputs to this design, not modified by this task):
`src/adapters/contracts/toss.ts`, `src/adapters/toss/toss-read-only-http-client.ts`,
`src/application/broker-write-guard/broker-write-command-guard.ts`

## 1. Purpose and Boundary

This document specifies the future write contract for `TossSecuritiesAdapter`:
the shape of the interface a later, separately reviewed implementation phase
must satisfy before it may submit, cancel, or replace a real broker order.

This document does **not** authorize live trading and does **not** describe a
working implementation. Per `docs/phase7/README.md`, Phase 7 forbids real Toss
order submission, cancellation, replacement, transfer, withdrawal, and
currency conversion, and forbids any real HTTP call to a Toss order endpoint.
Every command type described below has an uncallable, compile-time-enforced
placeholder in `src/adapters/toss-write-contract.ts` — see Section 10.

This design is additive to, and does not modify, the existing
`TossWriteAdapter` interface already established in
`src/adapters/contracts/toss.ts`:

```ts
export interface TossWriteAdapter {
  submitOrder(command: never): Promise<never>;
  cancelOrder(command: never): Promise<never>;
}
```

That interface is the minimal, already-shipped uncallable placeholder. This
document expands the *design* around it (a third operation, the required
input shape, idempotency, kill-switch re-check, retry policy, error
normalization, redaction, and audit/outbox requirements) without editing that
file, per the task instruction to coordinate before touching existing adapter
interfaces.

## 2. Allowed Future Operations (Types Only)

Per `docs/07_Trading_System.md` Section 18 and `docs/05_API_Architecture.md`
Section 5.4, the future `TossSecuritiesAdapter` write surface is limited to
exactly three operation types:

```text
SUBMIT_ORDER
CANCEL_ORDER
REPLACE_ORDER
```

`REPLACE_ORDER` support is `UNVERIFIED` per the Toss capability model
(`docs/05_API_Architecture.md` Section 5.5) and must be gated by capability
verification before any future implementation may offer it, exactly like
`SUBMIT_ORDER` and `CANCEL_ORDER`.

### 2.1 Explicitly Out of Scope Forever for This Adapter

The following are **not** part of the `TossSecuritiesAdapter` write contract,
now or in any later phase covered by this document, and must never appear as
a callable method, a command variant, or a capability on this adapter:

```text
TRANSFER
WITHDRAWAL
DEPOSIT
CURRENCY_EXCHANGE
```

Rationale: `11_AI_RULES.md` Rule 17 scopes `TossSecuritiesAdapter` to order
execution only; `07_Trading_System.md` Section 6 excludes margin, and no
document in this repository authorizes money-movement operations through this
adapter. If a future phase genuinely needs one of these, it requires a new,
separately reviewed design document and adapter — not an extension of this
contract.

## 3. Required Inputs From `OrderApproval`

A future write command must never be constructible from anything less than a
fully-formed, already-approved `OrderApproval` (`src/domain/orders/order.ts`).
The command envelope must carry, at minimum:

| Field | Source | Purpose |
| --- | --- | --- |
| `orderApprovalId` | `OrderApproval.id` | Links the write command to the approval record; required for audit reconstruction (`07_Trading_System.md` Section 28). |
| `orderApprovalStatus` | `OrderApproval.status` | Must be `"APPROVED"`; a command built from a `"REJECTED"` approval is invalid at construction time. |
| `riskCheckId` / `riskCheckPassed` | `OrderApproval.riskCheck` | Risk Engine has veto authority (`11_AI_RULES.md` Rule 5); the write path must not re-derive risk state, only carry the already-passed reference. |
| `moneyCheckId` / `moneyCheckApprovedQuantity` / `moneyCheckApprovedAmount` | `OrderApproval.moneyCheck` | The broker request quantity/amount must equal what Money Management already approved, never a value invented at the write layer. |
| `brokerAccountId` | Resolved `BrokerAccount` | Exactly one verified, active, live-trading-permitted account (`07_Trading_System.md` Section 16.1). |
| `portfolioBrokerAccountLinkId` | Resolved `PortfolioBrokerAccountLink` | Confirms the market/asset type is allowed for this link. |
| `assetId`, `market`, `assetType`, `side`, `quantity`, `orderType`, `limitPrice` | `OrderApproval.orderIntent` | Mirrors the existing internal order request shape documented in `05_API_Architecture.md` Section 5.6 — the adapter must not accept a shape richer than what the approval already fixed. |
| `guardDecision` | `BrokerWriteCommandGuard.evaluate(...)` result | See Section 4 — the command must carry proof that the guard already ran and returned `allowed: true`. |

The adapter must **reject construction**, not merely reject submission, of any
command whose `orderApprovalStatus` is not `"APPROVED"` or whose quantity/
amount fields do not match the referenced `MoneyCheck`. This mirrors the
existing domain rule in `OrderApproval`'s constructor (an `APPROVED` status
already requires a passing `RiskCheck` and `MoneyCheck`) — the write layer
must not weaken that guarantee by accepting looser input.

## 4. Relationship to `BrokerWriteCommandGuard`

`src/application/broker-write-guard/broker-write-command-guard.ts` is treated
as read-only input to this design and is not modified by this task. The
future write contract must remain compatible with, and strictly downstream
of, that guard:

- A future `TossSecuritiesAdapter` write method must refuse to run unless it
  is handed a `BrokerWriteCommandGuardResult` with `allowed: true` for the
  exact `commandType` it is about to execute.
- The guard's `BrokerWriteCommandGuardInput.now` and `maxApprovalAgeMs`
  freshness check (Section 5 below expands on this) must be evaluated again,
  not cached, immediately before submission — see Section 5.
- Nothing in this design proposes changing `BrokerWriteEnvironmentPolicy`,
  `PHASE6_NO_LIVE_BROKER_WRITE_ENVIRONMENT_POLICY`, or any guard rejection
  reason. A future implementation phase is expected to supply its own
  environment policy through the existing `environment` field; this design
  does not pre-approve any environment for live writes.

If a future engineer believes the guard itself needs new fields (for example,
a `REPLACE_ORDER`-specific check), that is a guard change and is explicitly
out of scope for this task — flag it as a coordination item rather than
editing the guard.

## 5. Idempotency Key / Client Order ID Requirements

Per `07_Trading_System.md` Section 21 ("Duplicate Order Prevention") and
`05_API_Architecture.md` Section 10.2 ("Dangerous to Retry"):

- Every `SUBMIT_ORDER`, `CANCEL_ORDER`, and `REPLACE_ORDER` command must carry
  a `clientOrderId` that is:
  - deterministically derivable from `orderApprovalId` plus the operation
    type (e.g. one idempotency key per approval per operation, not per HTTP
    attempt), so a retried *construction* of the same logical command
    produces the same key; and
  - unique at the database level (a unique constraint on
    `(orderApprovalId, operation)` or equivalent), so a duplicate insert
    fails closed instead of silently double-submitting.
- The adapter must never generate a fresh `clientOrderId` per network attempt.
  A new `clientOrderId` implies a new logical order, which is exactly the
  duplicate-order risk this rule exists to prevent.
- The `clientOrderId` must be persisted in the outbox record (Section 9)
  *before* any network attempt, so that a crash between "decided to submit"
  and "attempted to submit" is recoverable by replaying the same idempotency
  key rather than inventing a new one.
- If the broker's write endpoint does not support idempotency keys for a
  given operation (`docs/07_Trading_System.md` Section 32 marks this
  `UNVERIFIED`), that operation must be treated as `UNSUPPORTED_CAPABILITY`
  for production use until verified, per `05_API_Architecture.md` Section 3.3.

## 6. Kill-Switch Re-Check Immediately Before Submission

`BrokerWriteCommandGuard` evaluates kill-switch state as of whenever it is
called. Because approved commands may sit in an outbox (Section 9) between
approval and actual network submission, the future adapter's write path must
re-evaluate kill-switch state a second time, immediately before the network
call, not rely solely on the guard decision that authorized enqueueing:

```text
load command from outbox
-> re-check kill switch state (fresh read, not cached)
-> if active: abort, do not submit, mark command blocked, alert
-> if inactive: proceed to submit
```

This matches `07_Trading_System.md` Section 17 ("no submission if kill switch
activated after approval but before submission") and Section 22 ("kill switch
... block[s] not-yet-submitted approved orders"). A future implementation
must treat "guard said allowed at enqueue time" and "safe to submit right
now" as two different facts, never one.

## 7. No Blind Retry After Ambiguous Submit

Per `11_AI_RULES.md` Rule 15 and `05_API_Architecture.md` Section 10.3:

- `SUBMIT_ORDER`, `CANCEL_ORDER`, and `REPLACE_ORDER` are non-retryable at the
  transport layer. A timeout, connection error, or 5xx response after the
  request has plausibly reached the broker must never trigger an automatic
  second attempt of the same operation.
- On any ambiguous outcome (network error after the request was sent, a
  response that cannot be parsed, a timeout), the future adapter must:
  1. record the command's outbox state as requiring reconciliation, not as
     failed;
  2. return/normalize the result as `UNKNOWN` (Section 8);
  3. pause dependent trading for the affected portfolio/asset until
     reconciliation resolves it (`07_Trading_System.md` Section 20);
  4. query broker order/fill state through the read-only surface before any
     further action is taken for that `clientOrderId`.
- A human- or reconciliation-job-initiated re-submission is only permitted
  after reconciliation confirms the original command was never accepted by
  the broker, and even then it must go through the normal approval path
  again (new `OrderApproval`), not a raw retry of the ambiguous command.

## 8. Normalized Broker Error and Unknown-State Behavior

The future adapter's write responses must reuse the normalized shapes already
defined in `05_API_Architecture.md` Sections 5.7 and 9:

- Result values are restricted to `ACCEPTED | REJECTED | UNKNOWN |
  UNSUPPORTED | FAILED`.
- `UNKNOWN` is not a synonym for `FAILED`. It specifically means broker state
  could not be confirmed and must map to the domain's
  `UNKNOWN_REQUIRES_RECONCILIATION` state (`BrokerOrderStatus` in
  `src/domain/orders/order.ts` already has an analogous `"UNKNOWN"` state,
  and `BrokerOrder.blocksDependentTrading()` already returns `true` for it —
  the future write path must produce results that flow into that existing
  domain behavior, not bypass it).
- Errors must use the shared error taxonomy from `05_API_Architecture.md`
  Section 9 (`AUTHENTICATION_ERROR`, `RATE_LIMITED`, `BROKER_REJECTED_ORDER`,
  `UNKNOWN_ORDER_STATE`, `INSUFFICIENT_FUNDS`, `INSUFFICIENT_QUANTITY`, etc.),
  each carrying `retryable`, `severity`, and a `requiresReconciliation` flag
  that is forced `true` whenever `retryable` would otherwise suggest a retry
  is available for a write operation (write operations are never
  transport-level retryable regardless of the generic `retryable` flag —
  Section 7 governs retry, this field only governs whether reconciliation is
  mandatory).
- Every normalized error and every normalized response must carry a
  hardcoded, non-computed `liveBrokerWriteAllowed: false` field, matching the
  existing convention in `TossReadOnlyHttpClient`'s metadata/error shapes
  (`src/adapters/toss/toss-read-only-http-client.ts`), so that no downstream
  consumer can mistake a design-time or test response for a live write
  confirmation.

## 9. Redaction Requirements

Per `11_AI_RULES.md` Rules 18–21 and `05_API_Architecture.md` Sections 3.5,
13, and 14:

- Raw broker request/response payloads for write operations must never be
  logged in full. Logs may carry: provider, operation, `clientOrderId`,
  normalized result, normalized error code, retryable/requiresReconciliation
  flags, latency, and a reference id to a separately, access-controlled
  stored raw payload — never the payload itself inline in a log line.
- Authorization headers, access tokens, refresh tokens, API keys, and full
  account numbers must never appear in a normalized response, a normalized
  error, or an audit record. Account identifiers must be masked the same way
  `TossReadOnlyHttpClient.maskAccountNumber` already masks them (all but the
  last 4 characters) if an account identifier is exposed at all.
- Any stored raw payload must be redacted through the same mechanism the
  audit layer already uses (`redactObject`, imported by
  `src/application/audit/audit-log.ts`) before persistence — a future
  implementation must reuse that existing redaction path rather than invent a
  parallel one.
- Money amounts must always carry currency (`11_AI_RULES.md` Rule 20); a
  write command or response must never represent an order amount as a naked
  number.

## 10. Audit / Outbox Requirements

Per `11_AI_RULES.md` Rule 30, `07_Trading_System.md` Sections 17, 21, and 28,
and the existing `OutboxWorkerService` (`src/application/outbox/index.ts`):

- Every write command (`SUBMIT_ORDER`, `CANCEL_ORDER`, `REPLACE_ORDER`) must
  be persisted as an `OutboxEventRecord` (`eventType`, `aggregateType:
  "BROKER_ORDER"`, `aggregateId: orderApprovalId` or `brokerOrderId`,
  `idempotencyKey: clientOrderId`) *before* any network attempt, using the
  outbox pattern already implemented for state-transition safety in
  `OutboxWorkerService`. This task does not modify that service; a future
  implementation phase is expected to add a `process` callback for broker
  writes that satisfies its existing `OutboxProcessingResult` contract,
  including marking `unknownBrokerState: true` in
  `OutboxProcessingFailure` whenever Section 8's `UNKNOWN` applies — which
  `OutboxWorkerService.run` already treats as automatically non-retryable
  (dead-lettered) via `shouldDeadLetter`.
- Every write command must also produce an `AuditRecord`
  (`src/application/audit/audit-log.ts`) at minimum at these transitions:
  command constructed/enqueued, kill-switch re-check result, submission
  attempted, normalized result received, and (if applicable) reconciliation
  outcome. `AuditRecord.metadata` is already redacted through `redactObject`
  at construction time, so audit metadata for write commands must be built
  the same way, not bypass that constructor.
- If a write command cannot be reconstructed later from its `OrderApproval`,
  `RiskCheck`, `MoneyCheck`, guard decision, outbox record, and audit trail,
  the design is non-compliant with `07_Trading_System.md` Section 28
  ("If an order cannot be explained later, the trading system is not
  compliant with project architecture").

## 11. Summary Table

| Requirement | Design Source | Enforcement Point |
| --- | --- | --- |
| Allowed operations | Section 2 | Type union, no others constructible |
| Forbidden operations (transfer/withdraw/exchange) | Section 2.1 | Absent from every type in this contract |
| Required `OrderApproval` inputs | Section 3 | Command envelope fields, construction-time validation |
| Guard compatibility | Section 4 | Command requires a passing `BrokerWriteCommandGuardResult` |
| Idempotency / client order id | Section 5 | Deterministic key, unique constraint, persisted pre-submit |
| Kill-switch re-check | Section 6 | Second, fresh check immediately before network call |
| No blind retry | Section 7 | Ambiguous outcome -> `UNKNOWN`, pause, reconcile, no auto-retry |
| Normalized error / unknown state | Section 8 | Shared taxonomy, `liveBrokerWriteAllowed: false` always |
| Redaction | Section 9 | Reuse `redactObject`, mask account identifiers, currency-tagged money |
| Audit / outbox | Section 10 | `OutboxEventRecord` pre-submit, `AuditRecord` at every transition |

## 12. Uncallable Placeholder Types

`src/adapters/toss-write-contract.ts` (added by this task) provides the
compile-time-enforced placeholder for the design above:

- Every write operation's command parameter is typed `never`, so no value of
  any type can be passed to it — this is stricter than a narrow but
  non-`never` type, because it is not merely undocumented or unwired, it is
  structurally impossible to call with any argument, including `any`-cast
  values that would otherwise sneak past a merely-narrow type (`any` unifies
  with `never` only in the sense that TypeScript will still refuse `void`
  callers that try to use the return value as anything other than `never`,
  and no runtime body exists that could execute a request even if the type
  checker were bypassed).
- No HTTP client, `fetch` call, request body builder, or `process.env` read
  exists anywhere in that file.
- Forbidden operations (`TRANSFER`, `WITHDRAWAL`, `DEPOSIT`,
  `CURRENCY_EXCHANGE`) do not appear as members of any exported type, so they
  cannot be selected even by a future engineer extending the union carelessly
  without also reading this document.
- A frozen safety-report constant (mirroring the existing
  `TossReadOnlyHttpClient.getSafetyReport()` convention) hardcodes
  `liveBrokerWriteAllowed: false` as a literal, not a computed value.

## 13. Open Items for a Later Implementation Phase

These are explicitly deferred, not decided here:

- Exact Toss write endpoint paths and request/response payload shapes
  (`05_API_Architecture.md` Section 20 lists them as open).
- Whether Toss supports a native idempotency key parameter or whether
  idempotency must be enforced purely at this system's outbox/database layer.
- `REPLACE_ORDER` capability verification — must remain `UNVERIFIED` until a
  later phase tests it against a real or sandbox environment.
- The exact reconciliation job design that consumes `UNKNOWN` results
  (Section 7) — this document only specifies the contract those results must
  satisfy, not the reconciliation job itself, which is out of this task's
  scope.
