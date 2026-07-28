# Toss Read-Only Call Gate

Version: 0.5.18
Status: Active
Last Updated: 2026-07-28

## Purpose

This document defines the final local gate before any real Toss Securities read-only API call is attempted.

It does not authorize live trading, order creation, order cancellation, money movement, currency conversion, or production capital use.

## Gate Principle

Real API access starts with exactly one documented read-only verification call.

The system must not move from local preparation to real read-only verification unless all of the following are true:

- local secret configuration is present
- live trading remains disabled
- Toss read-only mode is enabled
- endpoint catalog entries are validated
- evidence intake is public-safe
- open questions have enough sanitized evidence for review
- preflight passes
- the operator explicitly approves the read-only verification attempt

## Local Command

Run the final gate:

```bash
npm run phase5:toss:call-gate
```

By default, this command fails closed.

To allow a later task to attempt one real read-only verification call, run it only after preflight passes and set:

```bash
PHASE5_TOSS_READ_ONLY_CALL_APPROVED=true npm run phase5:toss:call-gate
```

This command performs no network calls. It only confirms whether the next task is allowed to attempt a real read-only call.

## Approval Artifact

Passing the call gate is necessary but not sufficient. Before the next task attempts a real read-only call, the operator should also produce a sanitized approval artifact that records the decision.

The codebase includes `TossReadOnlyCallApprovalValidator` and `TossReadOnlyCallApprovalLedger` in `src/application/toss/read-only-evidence-intake.ts`.

Template:

- `docs/phase5/read-only-call-approval.example.json`

### Approval Artifact Shape

An approval record contains:

- `approvedOperation`: the single read-only operation this approval authorizes (for example `ACCOUNT_SNAPSHOT_READ`). Only read-only operations are accepted. Anything that looks write-scoped is rejected.
- `approvedAt`: the approval timestamp.
- `operatorNote`: a short, public-safe rationale. It must never contain secrets, tokens, or account identifiers.
- `endpointCatalogReference`: the endpoint catalog item this approval is scoped to.
- `expectedEvidenceKind`: the evidence kind the resulting recorded evidence must match.
- `singleUseAcknowledged`: must be `true`, an explicit operator acknowledgement that this approval is single-use.
- `liveBrokerWritesRemainBlocked`: must be `true`, an explicit statement that this approval never unlocks live broker writes.

### Approval Rules

- Approval records containing secret-like text (tokens, client secrets, authorization headers) in `operatorNote` or `endpointCatalogReference` are rejected.
- Approval records containing account-identifier-like content (long digit runs, `account_number`, `계좌번호`) are rejected.
- Approval records for operations outside the fixed read-only allow-list, or whose operation string looks write-scoped (order submit/cancel/modify, withdraw, transfer), are rejected.
- Approval records missing the single-use acknowledgement or the live-write-blocked statement are rejected.
- `TossReadOnlyCallApprovalLedger` tracks consumed approval ids in memory. A given approval id can be consumed at most once; a second consumption attempt is rejected with `approval_already_consumed`. This makes single-use enforcement an explicit, testable behavior rather than a convention.
- An approval never performs a network call and never authorizes more than one scoped call.

### Linking Approval To Recorded Evidence

`TossReadOnlyEvidenceRecorder` (in `src/application/toss/read-only-evidence-recorder.ts`) optionally accepts an `approval` record when recording evidence. When provided:

- the recorder validates the approval using the same rules above,
- the recorder checks that the recorded evidence `kind` matches `approval.expectedEvidenceKind`,
- the result includes an `approvalScope` field and a `readyForManifest` flag that is only `true` when the evidence is sanitized, contains no live write shape, and matches the approved scope.

Evidence recorded without a matching valid approval is never marked `readyForManifest`. This does not weaken the recorder's existing credential, account-identifier, or live-write-shape rejection checks.

## Allowed Next Action

If the gate passes, the next task may attempt one documented read-only call such as:

- authentication validation
- account snapshot read
- position read
- market data read

The call must be recorded as sanitized evidence.

## Blocked Actions

The gate never permits:

- order creation
- order cancellation
- order modification
- transfer
- withdrawal
- currency conversion that moves money
- unbounded API exploration
- raw response commits
- secret disclosure

## Stop Conditions

Stop immediately if:

- preflight does not pass
- the call gate does not pass
- any value looks like a token, secret, account number, or raw credential-bearing response
- the endpoint path or body suggests broker state mutation
- an API response cannot be safely summarized

## Final Rule

Passing this gate permits only a single scoped read-only verification attempt in the next task.

It does not unlock live trading.
