# Phase 10 Claude Worktree Tasks

Version: 0.1.0
Status: Draft
Last Updated: 2026-07-29
Related Phase: `docs/phase10/README.md`

## Phase 10 Round 1 Boundary

Phase 10 round 1 is small-capital live operation readiness. It is still
no-write. It creates the final approval packet, operating protocol,
runtime lock checks, and integration review that humans need before a
later implementation phase can even be considered.

No task in this folder may implement a callable Toss broker-write adapter,
submit orders, cancel orders, replace orders, move money, read local
secrets, or mark human-only blockers as resolved.

## Task Index

| Task | Title | Recommended Branch | Status |
| --- | --- | --- | --- |
| [P10-001](P10-001_live_operation_approval_packet.md) | Live Operation Approval Packet | `phase10/p10-001-live-operation-approval-packet` | Planned |
| [P10-002](P10-002_first_trade_operating_protocol.md) | First-Trade Operating Protocol | `phase10/p10-002-first-trade-operating-protocol` | Planned |
| [P10-003](P10-003_runtime_lock_and_audit_gate.md) | Runtime Lock And Audit Gate | `phase10/p10-003-runtime-lock-and-audit-gate` | Planned |
| [P10-004](P10-004_phase10_integration_review.md) | Phase 10 Integration Review | `phase10/p10-004-integration-review` | Planned |

Use `PHASE10_FOUR_ENGINEER_ORCHESTRATOR_PROMPT.md` to start the four
parallel Claude Code engineers.

## Required Final Verification

After all branches are merged locally:

```bash
npm run check
```

Suggested no-write scans:

```bash
rg -n "submitOrder|cancelOrder|replaceOrder|placeOrder|TossSecuritiesAdapter|liveBrokerWriteAllowed: true|fetch\\(|axios|undici" src tests docs/phase10
rg -n "\\.env|tmp/phase5|client_secret|access_token|account_number" src tests docs/phase10
```

Matches are acceptable only when they are prohibitions, redaction tests,
or safety assertions.
