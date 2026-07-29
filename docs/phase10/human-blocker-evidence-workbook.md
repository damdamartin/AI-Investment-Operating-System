# Phase 10 Human Blocker Evidence Workbook

Version: 0.1.0
Status: Draft
Last Updated: 2026-07-29
Related Phase: `docs/phase10/README.md`
Primary Register: `docs/phase7/live-capable-blocker-register.md`
Related Approval Packet: `docs/phase10/live-operation-approval-packet.md`
Related Tasks: `docs/tasks/phase10_claude_worktree_tasks/ROUND2_FOUR_ENGINEER_ORCHESTRATOR_PROMPT.md`
Human Templates: `docs/phase10/human-evidence-templates/README.md`
Human Runbook: `docs/phase10/human-evidence-operator-runbook.md`

## Purpose

This workbook defines the sanitized evidence packets that a human must
prepare before any future write-capable implementation phase can begin.

It does not resolve any blocker. It does not authorize live trading. It
does not ask for, store, or display secrets, account numbers, raw broker
payloads, balances, or local receipt contents.

The only source of truth for blocker resolution remains
`docs/phase7/live-capable-blocker-register.md`, and that file can only be
updated by a human reviewer following its own rules.

## Evidence Packet Groups

| Packet | Blockers | Human Owner | Purpose |
| --- | --- | --- | --- |
| Toss/compliance packet | `LCB-001`, `LCB-005` | Compliance/legal reviewer | Confirm Toss automated trading permission and compliance/legal approval boundaries. |
| Account/provisioning packet | `LCB-002`, `LCB-003` | Operator + infrastructure/security reviewer | Confirm account capability evidence and secure production credential provisioning process. |
| Owner/risk packet | `LCB-004`, `LCB-006` | Project owner + risk owner/operator | Record explicit human approval intent and small-capital operating limits. |
| Live-safety/review packet | `LCB-007`, `LCB-008` | Engineering safety reviewer + independent senior reviewer | Confirm live-context kill-switch/rollback evidence and future write-adapter review prerequisites. |

## Sanitization Rules

Every packet must follow these rules:

- Do not include API keys, client secrets, tokens, passwords, certificate
  material, account numbers, raw broker payloads, raw headers, local
  receipt contents, balances, holdings quantities, or personally
  identifying contract text.
- Use summaries, citations, masked references, reviewer names/roles,
  review dates, decisions, limitations, and expiration dates.
- Evidence may be `READY_FOR_HUMAN_REVIEW` or `HUMAN_REVIEWED`; it is not
  equivalent to `RESOLVED`.
- AI-generated summaries may help organize evidence, but they cannot be
  the human decision.
- Any uncertainty remains blocking.

## Required Fields Per Packet

Each packet should record:

- packet id
- covered blocker ids
- evidence source references
- human reviewer name
- human reviewer role
- review date
- decision/result
- limitations or restrictions
- expiration or next review date
- prohibited-content confirmation
- explicit statement that the packet is not live-trading authorization

## Suggested Decisions

Use only these decision values for evidence packets:

```text
READY_FOR_HUMAN_REVIEW
HUMAN_REVIEWED_APPROVED_WITH_LIMITATIONS
HUMAN_REVIEWED_REJECTED
HUMAN_REVIEWED_UNVERIFIED
NEEDS_MORE_EVIDENCE
```

Do not use `RESOLVED` in packet output. `RESOLVED` belongs only to the
canonical blocker register and only after a human updates that register.

## Round 2 Output

Phase 10 round 2 should produce:

- packet-specific sanitized workbook documents
- optional pure validators/checklists if useful
- a final integration review confirming no blocker was resolved by AI
- a clear list of what the human operator must still do manually

Round 2 must not implement any broker write path.

## Human Template Pack

After round 2, use the blank templates in
`docs/phase10/human-evidence-templates/` to draft sanitized human evidence
records. The operator procedure is
`docs/phase10/human-evidence-operator-runbook.md`.

The templates are intentionally blank. They are not evidence until a
human reviewer fills them out, and they are not `RESOLVED` decisions until
the human reviewer updates the canonical blocker register directly.
