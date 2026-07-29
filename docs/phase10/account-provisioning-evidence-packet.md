# Account And Provisioning Evidence Packet (P10-006)

Version: 0.1.0
Status: Draft — template only, no evidence recorded yet
Last Updated: 2026-07-29
Related Task: `docs/tasks/phase10_claude_worktree_tasks/P10-006_account_provisioning_evidence_packet.md`
Related Workbook: `docs/phase10/human-blocker-evidence-workbook.md`
Covered Blockers: `LCB-002` (Toss Account Permission and Capability Evidence),
`LCB-003` (Production Credential/Provisioning Evidence) — both defined in
`docs/phase7/live-capable-blocker-register.md`
Related Docs: `docs/07_Trading_System.md` Section 15, Section 16, Section
16.1; `docs/08_Testing_Validation.md` Section 7.1, Section 12;
`docs/09_Operation_Deployment.md` Section 14 ("Secrets Management"),
Section 22 ("Access Control"); `docs/11_AI_RULES.md` Rule 18 ("Secrets
Must Not Enter Git")

## Purpose

This document is a sanitized, fill-in-the-blank evidence packet. It tells
a human reviewer — an operator plus an infrastructure/DevOps owner and a
security reviewer, per the workbook's ownership table — exactly what to
gather and record before `LCB-002` and `LCB-003` can move toward a human
decision.

This packet does not resolve `LCB-002` or `LCB-003`. It does not resolve
any entry in `docs/open_questions.md`. It does not edit
`docs/phase7/live-capable-blocker-register.md`, which remains the only
place a blocker can ever be marked `RESOLVED`, and only by a human
reviewer recording a reviewer name, reviewed date, and decision directly
in that file.

## This Packet Is Not Live-Trading Authorization

> Completing every field in this packet, even with a fully positive
> decision on both blockers, is **not** authorization to submit a live
> broker order. It is not equivalent to `RESOLVED` in
> `docs/phase7/live-capable-blocker-register.md`. It does not by itself
> satisfy any of the other six live-capable blockers (`LCB-001`,
> `LCB-004`, `LCB-005`, `LCB-006`, `LCB-007`, `LCB-008`), which remain
> separately blocking regardless of this packet's outcome. Live order
> submission additionally requires a real, callable, independently
> reviewed broker-write adapter, which does not exist yet and which no
> Phase 10 task may create (`docs/phase10/README.md`, "Boundary").

This statement must be reproduced verbatim in every filled-in instance of
this packet (see "Packet Record Template" below).

## Sanitization Rules (Inherited From The Workbook)

Every filled-in instance of this packet must follow
`docs/phase10/human-blocker-evidence-workbook.md`, "Sanitization Rules":

- No API keys, client secrets, tokens, passwords, certificate material,
  account numbers, raw broker payloads, raw headers, local receipt
  contents, balances, holdings quantities, or personally identifying
  contract text — for either `LCB-002` (account/permission evidence) or
  `LCB-003` (credential provisioning evidence).
- Use summaries, citations, masked references, reviewer names/roles,
  review dates, decisions, limitations, and expiration dates only.
- Any identifier that must appear at all (for example to distinguish one
  evidence artifact from another) must already be masked using this
  codebase's established convention (`src/config/redaction.ts`,
  `redactSecret`: first two and last two characters visible, the middle
  replaced with `****`, e.g. `ab****ef`). Never paste a real, unmasked
  identifier into this document or into any filled-in copy of it.
- Decisions use only the five values listed in "Allowed Decision Values"
  below. `RESOLVED` must never appear in this packet's output, in any
  field, in any filled-in instance.
- Any uncertainty remains blocking. A partially filled packet, or a
  packet where the human reviewer is unsure, stays at
  `NEEDS_MORE_EVIDENCE` or `HUMAN_REVIEWED_UNVERIFIED` — never rounded up
  to an approved state.

## Allowed Decision Values

Use only these values, exactly as written, for the `decision` field of
this packet or of either of its two blocker sections:

```text
READY_FOR_HUMAN_REVIEW
HUMAN_REVIEWED_APPROVED_WITH_LIMITATIONS
HUMAN_REVIEWED_REJECTED
HUMAN_REVIEWED_UNVERIFIED
NEEDS_MORE_EVIDENCE
```

`RESOLVED` is never a valid value here. It belongs exclusively to
`docs/phase7/live-capable-blocker-register.md`.

## Part A — `LCB-002`: Toss Account Permission And Capability Evidence

Source requirement: `docs/07_Trading_System.md` Section 15 ("approval
requires exactly one verified BrokerAccount"), Section 16.1 ("Broker
Account Check"); `docs/08_Testing_Validation.md` Section 7.1 ("Toss
Securities API Validation" — "All capabilities must be recorded in the
capability registry.").

### A.1 What The Human Reviewer Must Record

For each item below, record a sanitized summary and a masked reference
(never the raw value):

| Item | What to record | Never record |
| --- | --- | --- |
| `BrokerAccount` existence | Whether a `BrokerAccount` record resolves for the candidate portfolio, and its broker field equals `TOSS_SECURITIES`. | Account number, account nickname tied to a real person. |
| `BrokerAccount` status | Whether status is `active` (or the sanitized equivalent your account-status query returns). | Raw status API payload. |
| Permission status | Whether the account's permission status allows the requested operation (read, or read+write once relevant). | Raw permission API payload. |
| `live_trading_enabled` flag | The boolean value of the local `live_trading_enabled` flag for this account, per Section 16.1. | Any other account flag not required by Section 16.1. |
| `PortfolioBrokerAccountLink` resolution count | How many `PortfolioBrokerAccountLink` records resolve for the candidate portfolio (Section 15 requires **exactly one** verified `BrokerAccount`). | Portfolio contents, holdings, balances. |
| `PortfolioBrokerAccountLink` status | Whether the link is active, and whether the requested market and asset type are allowed by the link (Section 16.1). | — |
| Capability verification freshness | The date the account capability was last verified, and whether that date is recent enough for the configured environment (Section 16.1, "stale capability verification"). | — |
| Capability registry entries | Confirmation that capability registry entries exist for the capabilities this account needs (Section 7.1: authentication, account query, order submit/cancel/replace, order status query, fill query, ETF support, U.S. market support, rate limits, error formats — record status per capability, not the raw response). | Raw API response bodies. |

### A.2 Blocking Conditions (Restated From Section 16.1)

If any of the following is true, `LCB-002` evidence must record it as a
blocking finding, regardless of how positive other fields look:

```text
missing broker account
multiple broker accounts resolved
unverified permission status
read-only account (when write capability is being evidenced)
disabled portfolio-account link
market not allowed
asset type not allowed
stale capability verification
```

### A.3 Read-Only Verification References

Record where the sanitized read-only verification evidence lives, using
masked references only, for example:

```text
- Sanitized account-status query output, evidence log ref: acct-status-2026-07-27-ab****ef
- Capability registry snapshot ref: capreg-2026-07-27-cd****gh
- PortfolioBrokerAccountLink count check ref: link-count-2026-07-27-ij****kl
```

These references are placeholders illustrating the masked-reference
format only. A real instance of this packet must replace them with real
masked references to real sanitized evidence, produced by the human
reviewer's own read-only verification process — never by this document,
and never by an AI agent.

### A.4 `LCB-002` Section Record

```text
Section: LCB-002
Evidence source references: [fill in — masked references only]
Broker account exists: [ yes / no / unverified ]
Broker account status: [ active / inactive / unverified ]
Permission status: [ verified / unverified ]
live_trading_enabled: [ true / false / unverified ]
PortfolioBrokerAccountLink resolution count: [ integer, must equal exactly 1 for approval ]
PortfolioBrokerAccountLink status: [ active / disabled / unverified ]
Market/asset type allowed by link: [ yes / no / unverified ]
Capability verification freshness: [ date verified, and whether within environment's freshness window ]
Capability registry entries recorded: [ yes / no / partial — list which capabilities from Section 7.1 are covered ]
Blocking conditions present (from A.2 list): [ none / list them ]
Limitations: [ required, non-blank — what this evidence does and does not cover ]
Human reviewer name: [ required — a real human name, never "AI", "Claude", "Codex", or similar ]
Human reviewer role: [ required — e.g. "Operator" or "Compliance/legal reviewer" ]
Review date: [ required — date evidence was actually reviewed, not in the future ]
Decision: [ one of the five Allowed Decision Values above ]
Expiration / next review date: [ required ]
Prohibited-content confirmation: [ required — reviewer confirms no secrets, account numbers, balances, holdings quantities, or raw payloads appear anywhere in this section ]
```

## Part B — `LCB-003`: Production Credential/Provisioning Evidence

Source requirement: `docs/09_Operation_Deployment.md` Section 14
("Secrets Management"), Section 22 ("Access Control");
`docs/11_AI_RULES.md` Rule 18 ("Secrets Must Not Enter Git").

This section evidences the **process**, never the credential values
themselves. Nothing in this section should ever require pasting a
secret, key, token, password, or certificate into this document, a
ticket, or any other artifact this packet references.

### B.1 Production Credential Storage Process

Record, as a process description only:

| Item | What to record | Never record |
| --- | --- | --- |
| Storage mechanism | Which secret manager or secure environment-variable mechanism will hold production Toss API credentials (per Section 14, "store secrets in secret manager or secure environment variables"). Name the mechanism/product category, not a connection string or credential. | The credential itself, a connection string containing a secret, a `.env` file's contents. |
| Environment separation | Confirmation that production secrets are stored separately from development/staging secrets (Section 14, "separate secrets by environment"). | — |
| Git exclusion | Confirmation that no secret has ever been committed to Git, and that `.gitignore`/secret-scanning coverage exists (Rule 18; `docs/09_Operation_Deployment.md` Section 8, "secret scanning"). | — |

### B.2 Access Control Process

Record, mapped to the roles already defined in
`docs/09_Operation_Deployment.md` Section 22 ("Access Control"):

```text
OWNER    — all controls, secret management, production enablement
OPERATOR — view status, activate kill switch, acknowledge alerts, run reconciliation
VIEWER   — read-only dashboard
SYSTEM   — scheduled jobs and automated actions
```

For each role that can reach the production Toss credential:

- who (by role, not by an unmasked personal identifier beyond what is
  needed for accountability) holds that role
- what that role can do with the credential (read, rotate, revoke)
- confirmation that access follows least-privilege (Section 14, "restrict
  access by role")

### B.3 Rotation Process

Record:

- rotation cadence (Section 14, "rotate secrets periodically" — record
  the actual interval chosen, e.g. "every 90 days", not just "periodically")
- who is authorized to perform a rotation
- the leaked-secret procedure actually in place, matching Section 14's
  sequence:

```text
activate affected integration pause
rotate secret
review logs and audit
resume only after validation
```

### B.4 Audit Trail Expectations

Record:

- how secret access is logged/audited (Section 14, "audit secret access
  where possible")
- how sensitive actions on credentials are audited (Section 22,
  "Sensitive actions must be audited")
- retention period for that audit trail
- who reviews the audit trail, and how often

### B.5 Read-Only Verification References

Record where the sanitized process documentation and audit configuration
evidence live, using masked references only, for example:

```text
- Secret manager access policy doc ref: sec-policy-2026-07-27-mn****op
- Rotation runbook ref: rotation-runbook-2026-07-27-qr****st
- Audit log retention config ref: audit-cfg-2026-07-27-uv****wx
```

As in Part A, these are placeholders illustrating the masked-reference
format only, not real evidence.

### B.6 `LCB-003` Section Record

```text
Section: LCB-003
Evidence source references: [fill in — masked references only]
Storage mechanism: [ fill in — process description only, never the credential ]
Environment separation confirmed: [ yes / no / unverified ]
Git exclusion / secret scanning confirmed: [ yes / no / unverified ]
Access control roles mapped (OWNER/OPERATOR/VIEWER/SYSTEM): [ yes / no / partial ]
Least-privilege confirmed: [ yes / no / unverified ]
Rotation cadence: [ fill in actual interval ]
Rotation authority: [ fill in role(s) authorized to rotate ]
Leaked-secret procedure documented: [ yes / no ]
Audit trail mechanism: [ fill in ]
Audit trail retention period: [ fill in ]
Audit trail review cadence: [ fill in ]
Blocking conditions present: [ none / list them, e.g. "no secret manager selected", "no rotation cadence defined", "no audit trail" ]
Limitations: [ required, non-blank ]
Human reviewer name: [ required — a real human name, never "AI", "Claude", "Codex", or similar ]
Human reviewer role: [ required — e.g. "Infrastructure/DevOps owner" or "Security reviewer" ]
Review date: [ required — date evidence was actually reviewed, not in the future ]
Decision: [ one of the five Allowed Decision Values above ]
Expiration / next review date: [ required ]
Prohibited-content confirmation: [ required — reviewer confirms no secrets, keys, tokens, passwords, or certificate material appear anywhere in this section ]
```

## Packet Record Template

A filled-in instance of this packet must record all of the following
top-level fields, in addition to the Part A and Part B section records
above:

```text
Packet id: ACCT-PROV-EVID-<YYYYMMDD>-<sequence, e.g. 01>
Covered blocker ids: LCB-002, LCB-003
Evidence source references: [union of A.3 and B.5 references, masked only]
Human reviewer name: [required]
Human reviewer role: [required — e.g. "Operator + infrastructure/security reviewer"]
Review date: [required]
Decision/result: [one of the five Allowed Decision Values — the packet-level
  decision must never be more positive than the weaker of the Part A and
  Part B section decisions, e.g. if Part A is HUMAN_REVIEWED_UNVERIFIED and
  Part B is HUMAN_REVIEWED_APPROVED_WITH_LIMITATIONS, the packet-level
  decision must be HUMAN_REVIEWED_UNVERIFIED or NEEDS_MORE_EVIDENCE, not
  the more positive value]
Limitations or restrictions: [required, non-blank]
Expiration or next review date: [required]
Prohibited-content confirmation: [required — explicit statement that this
  packet, in full, was checked against the Sanitization Rules above and
  contains no API keys, client secrets, tokens, passwords, certificate
  material, account numbers, raw broker payloads, raw headers, local
  receipt contents, balances, or holdings quantities]
Not-live-trading-authorization statement: [required — reproduce the
  statement in "This Packet Is Not Live-Trading Authorization" above,
  verbatim]
```

Until every one of these fields is filled in by a named human reviewer,
this packet stays at `READY_FOR_HUMAN_REVIEW` at best. A blank, partially
filled, or AI-authored-looking reviewer name/role/date/decision is a
blocking condition, not a warning — the packet must not be treated as
reviewed.

## What This Packet Does Not Do

- It does not resolve `LCB-002` or `LCB-003`. Only a human editing
  `docs/phase7/live-capable-blocker-register.md` directly can ever record
  `RESOLVED` there.
- It does not authorize live trading, under any combination of field
  values.
- It does not call any Toss API, read `.env`, read `tmp/phase5`, or read
  any secret store. It is a document only.
- It does not create, generate, or store any real production credential
  or cloud secret.
- It does not certify that evidence, once produced, is sufficient — that
  judgment belongs to the named human reviewer(s) for `LCB-002` and
  `LCB-003` per `docs/phase7/live-capable-blocker-register.md`'s "Human
  Owner / Reviewer Role" fields.
- It does not replace, and is not a substitute for, the final Phase 10
  round 2 integration review (P10-008), which confirms across all four
  round-2 packets that no blocker was resolved by AI.

## Next Review

This template document itself does not expire — it is process
documentation, not evidence. Any *filled-in instance* of this packet must
carry its own expiration or next-review date per the "Packet Record
Template" above, chosen by the human reviewer(s) who complete it.
