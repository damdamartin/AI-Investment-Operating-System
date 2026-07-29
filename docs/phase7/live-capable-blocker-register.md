# Phase 7 Live-Capable Blocker Register

Version: 0.1.0
Status: Draft
Last Updated: 2026-07-29
Task: P7-001 Live-Capable Blocker Audit
Assigned Engineer: Engineer 1
Related Docs: `docs/reviews/Codex_Phase7_Live_Capable_Blocker_Audit.md`,
`docs/phase7/README.md`, `docs/11_AI_RULES.md`, `docs/07_Trading_System.md`,
`docs/08_Testing_Validation.md`, `docs/13_Compliance_and_Legal_Review.md`,
`docs/open_questions.md`

## Purpose

This register converts the remaining Phase 6 live-capable blockers (listed
in `docs/reviews/Codex_Phase6_Simulation_Safety_Review.md`, "Remaining
Blockers Before Any Future Live-Capable Design Phase" and reconfirmed
unchanged in `docs/reviews/Codex_Phase6_Round2_Operational_Readiness_Review.md`,
"Remaining Blockers Before Phase 7 Live-Capable Design Review") into a
precise, trackable register.

This register does **not** resolve, close, or weaken any blocker. It does
not resolve any entry in `docs/open_questions.md`. It exists so a human
reviewer can see, for each blocker: what evidence is required, who must
provide or review it, where that evidence should be summarized, what must
never appear in that summary, and what happens to go/no-go status if the
blocker stays open.

Every blocker below defaults to blocking live trading. A blocker may only
be marked `RESOLVED` by a human reviewer recording a reviewer name,
reviewed date, and decision directly in this file (or in the artifact path
it points to) — never by an AI agent, and never implicitly by the mere
existence of evidence. This mirrors the seven-state evidence model in
`docs/phase5/open-question-evidence-policy.md`: evidence supports review,
evidence is not a decision, and a decision is not a live-trading
authorization.

## How To Read This Register

Each blocker entry has exactly these fields:

- **Blocker ID** — stable identifier (`LCB-0xx`), referenced elsewhere.
- **Title**
- **Current Status** — one of the values in "Status Values" below.
- **Source** — which Phase 6 review and/or project doc this blocker traces
  back to.
- **Required Evidence Type** — what kind of evidence would let a human
  reviewer make a decision. Not a description of evidence that already
  exists.
- **Human Owner / Reviewer Role** — who is accountable for producing or
  reviewing the evidence. Always a human role, never "AI" or "Claude".
- **Artifact Path** — where the evidence summary belongs once produced.
  Several of these paths point to files owned by other Phase 7 engineers
  (P7-002, P7-003) or to files that do not exist yet; this register
  references them without creating or editing them.
- **Prohibited Artifact Contents** — what must never appear in the artifact
  at that path, restated per blocker because the sensitive material differs
  by blocker type.
- **Go/No-Go Impact** — what remains blocked while this entry is not
  `RESOLVED`, and which rule/doc section makes that blocking mandatory.

## Status Values

```text
NOT_STARTED      no evidence-gathering or review activity has begun
EVIDENCE_PENDING evidence-gathering is expected but not yet produced
UNVERIFIED       the default state of any broker/compliance capability per
                 docs/11_AI_RULES.md Rule 14 and
                 docs/13_Compliance_and_Legal_Review.md Section 5
IN_REVIEW        a human reviewer is actively working the blocker
BLOCKED          a structural precondition prevents the blocker from being
                 worked yet (for example: Phase 7 forbids building the
                 artifact this blocker would review)
RESOLVED         a human reviewer has recorded a decision, reviewer name,
                 and reviewed date; even RESOLVED blockers may still carry
                 a permanent Go/No-Go impact (see LCB-004, LCB-008)
```

No blocker in this register is `RESOLVED` as of this audit. All are
`NOT_STARTED`, `UNVERIFIED`, or `BLOCKED` as recorded below.

## Summary Table

| ID | Title | Current Status | Human Owner / Reviewer Role | Go/No-Go |
| --- | --- | --- | --- | --- |
| LCB-001 | Toss Automated Trading Permission Evidence | UNVERIFIED | Compliance/legal reviewer (human) | BLOCKING |
| LCB-002 | Toss Account Permission and Capability Evidence | NOT_STARTED | Operator + compliance/legal reviewer (human) | BLOCKING |
| LCB-003 | Production Credential/Provisioning Evidence | NOT_STARTED | Infrastructure/DevOps owner + security reviewer (human) | BLOCKING |
| LCB-004 | Human Approval Evidence | NOT_STARTED | Project owner / operator (human) | BLOCKING, permanent per Rule 12 |
| LCB-005 | Compliance/Legal Approval Evidence | UNVERIFIED | Compliance/legal reviewer (human) | BLOCKING |
| LCB-006 | Small-Capital Operating-Limit Evidence | NOT_STARTED | Risk owner / operator (human) | BLOCKING |
| LCB-007 | Kill-Switch and Rollback Evidence (Live Context) | EVIDENCE_PENDING | Engineering safety reviewer + operator (human) | BLOCKING |
| LCB-008 | Real Broker Write Adapter Review Evidence | BLOCKED | Senior engineer / independent code reviewer (human) | BLOCKING, permanent per Phase 7 boundary |

## LCB-001: Toss Automated Trading Permission Evidence

- **Current Status:** `UNVERIFIED`
- **Source:** `docs/reviews/Codex_Phase6_Simulation_Safety_Review.md` item 2
  ("Phase 5 evidence and open-question resolution remain human-only
  steps"); `docs/open_questions.md` OQ-001; `docs/13_Compliance_and_Legal_Review.md`
  Section 5.
- **Required Evidence Type:** Written confirmation from Toss Securities
  (official API terms of use citation, developer console capability
  description, or written support/account-manager confirmation) stating
  whether Toss permits API-based automated trading, and specifically
  whether it distinguishes manual API use, algorithmic trading, and fully
  unattended/cloud-hosted trading. Result must be recorded as one of
  `APPROVED`, `APPROVED_WITH_LIMITATIONS`, `REJECTED`, or `UNVERIFIED` per
  `docs/13_Compliance_and_Legal_Review.md` Section 5.
- **Human Owner / Reviewer Role:** Compliance/legal reviewer (human account
  holder or designated reviewer). Not the same person as the implementing
  engineer, where practical.
- **Artifact Path:** Evidence intake stays in the existing Phase 5 sanitized
  evidence flow (`docs/phase5/toss-official-api-source-notes.md`,
  `docs/phase5/open-question-evidence-policy.md`). The human-reviewed
  decision belongs in `docs/open_questions.md` OQ-001 (`Evidence status:
  EVIDENCE_REVIEWED` plus reviewer/date/decision fields), which this
  register does not edit or resolve.
- **Prohibited Artifact Contents:** API keys, client secrets, account
  numbers, full contract text containing personal identifying information,
  raw broker payloads. Only clause summaries and the four-value result
  state are permitted.
- **Go/No-Go Impact:** BLOCKING. `docs/11_AI_RULES.md` Rule 14 states
  unverified broker capabilities cannot be used in production.
  `docs/13_Compliance_and_Legal_Review.md` Section 5 states production
  broker write operations require `APPROVED` or `APPROVED_WITH_LIMITATIONS`
  with matching system restrictions; default state is `UNVERIFIED`. Until a
  human reviewer records a non-`UNVERIFIED` result with reviewer and date,
  all live order submission remains categorically blocked, independent of
  code readiness.

## LCB-002: Toss Account Permission and Capability Evidence

- **Current Status:** `NOT_STARTED`
- **Source:** `docs/reviews/Codex_Phase6_Round2_Operational_Readiness_Review.md`
  item 3 ("No production credential, compliance, or broker-account
  provisioning work has occurred"); `docs/open_questions.md` OQ-002;
  `docs/07_Trading_System.md` Section 16.1 ("Broker Account Check").
- **Required Evidence Type:** Sanitized, read-only account/permission query
  evidence showing `BrokerAccount` status, permission status, and
  `live_trading_enabled` flag, plus confirmation of how many
  `PortfolioBrokerAccountLink` records would resolve for a candidate order
  (the Order Approval Engine requires exactly one verified `BrokerAccount`;
  see `docs/07_Trading_System.md` Section 15). Capability registry entries
  populated per `docs/08_Testing_Validation.md` Section 7.1.
- **Human Owner / Reviewer Role:** Operator performing the sanitized
  read-only verification, with compliance/legal reviewer sign-off on the
  resulting account permission mapping.
- **Artifact Path:** Evidence intake in the existing Phase 5 sanitized
  evidence flow; human-reviewed decision recorded in `docs/open_questions.md`
  OQ-002. A future broker capability registry document (referenced by
  `docs/07_Trading_System.md` Section 16 but not yet created in this
  repository) is the eventual home for the capability entries themselves —
  its absence is itself part of this blocker, not something this register
  creates.
- **Prohibited Artifact Contents:** Account numbers, cash balances, raw
  permission API payloads, any identifier not already masked per the
  reconciliation `redactSecret` convention used elsewhere in this codebase.
- **Go/No-Go Impact:** BLOCKING. `docs/07_Trading_System.md` Section 15
  requires "exactly one verified BrokerAccount" and Section 16.1 lists
  eight blocking conditions (missing account, multiple accounts resolved,
  unverified permission status, read-only account, disabled link, market
  not allowed, asset type not allowed, stale capability verification) —
  any one of which blocks order approval outright. Until this evidence
  exists and is reviewed, `OrderApproval` cannot legitimately be
  constructed for a live-mode candidate.

## LCB-003: Production Credential/Provisioning Evidence

- **Current Status:** `NOT_STARTED`
- **Source:** `docs/reviews/Codex_Phase6_Round2_Operational_Readiness_Review.md`
  item 3; `docs/11_AI_RULES.md` Rule 18 ("Secrets Must Not Enter Git").
- **Required Evidence Type:** A documented secure credential provisioning
  process — where production Toss API credentials will be stored (secrets
  manager or equivalent), who has access, how rotation works, and how
  access is audited. This is a description/attestation of the process, not
  the credentials themselves.
- **Human Owner / Reviewer Role:** Infrastructure/DevOps owner, with
  security reviewer sign-off.
- **Artifact Path:** A future operations/deployment document (Phase 7 does
  not create this; it is out of the files this task owns). Interim summary
  of "provisioning process reviewed: yes/no, date, reviewer" belongs in
  this register's status field once produced.
- **Prohibited Artifact Contents:** Any actual credential material,
  `.env` file contents, API keys, client secrets, tokens, certificate
  files, account passwords. This register and its artifact path must
  describe the *process*, never the *values*.
- **Go/No-Go Impact:** BLOCKING. No live order can be submitted without
  real, securely provisioned, access-controlled production credentials.
  This is a precondition independent of application code readiness and
  independent of every other blocker in this register.

## LCB-004: Human Approval Evidence

- **Current Status:** `NOT_STARTED`
- **Source:** `docs/11_AI_RULES.md` Rule 12 ("AI May Propose Strategy
  Changes, Not Apply Them Directly") and Section 10 ("Enforcement");
  `docs/reviews/Codex_Phase6_Simulation_Safety_Review.md` item 5 and
  `docs/reviews/Codex_Phase6_Round2_Operational_Readiness_Review.md`
  item 5 ("No load-bearing decision ... has been made by an AI agent
  alone").
- **Required Evidence Type:** A recorded, human-authored approval decision
  explicitly authorizing progression from Phase 7 live-capable design
  readiness toward a later, separately reviewed live implementation phase,
  including an explicit acknowledgment of residual risk. This must be
  written and signed off by a human; AI-generated summary text presented
  as if it were that approval does not satisfy this blocker.
- **Human Owner / Reviewer Role:** Project owner / operator (human).
- **Artifact Path:** `docs/phase7/manual-live-approval-record.md`. This
  file is owned by Engineer 3 under task P7-003; this register references
  it and does not create or edit it. If that file does not yet exist at
  the time this register is read, that absence itself means LCB-004 is
  `NOT_STARTED`.
- **Prohibited Artifact Contents:** Treating AI-generated output as
  sufficient human approval (explicitly forbidden by
  `docs/phase7/README.md`, "Forbidden in Phase 7"). No secrets, account
  numbers, or credentials.
- **Go/No-Go Impact:** BLOCKING, and permanent in kind — even once
  `RESOLVED`, this blocker's underlying rule (Rule 12, Section 10) applies
  to every future live-capability decision, not just this one. No AI
  agent, including this audit, can satisfy LCB-004 on a human's behalf.

## LCB-005: Compliance/Legal Approval Evidence

- **Current Status:** `UNVERIFIED`
- **Source:** `docs/13_Compliance_and_Legal_Review.md` Section 9
  ("Compliance Gate for Live Trading"); `docs/reviews/Codex_Phase6_Simulation_Safety_Review.md`
  item 2; `docs/reviews/Codex_Phase6_Round2_Operational_Readiness_Review.md`
  item 3.
- **Required Evidence Type:** A completed compliance review record covering
  all six items listed in `docs/13_Compliance_and_Legal_Review.md`
  Section 9 (Toss API terms reviewed; broker account permissions reviewed;
  data licensing reviewed; AI data handling reviewed; tax recording
  assumptions documented; personal-use boundary confirmed; operator accepts
  residual risk), recorded with the fields listed in Section 10 (review
  date, reviewer, source documents reviewed, result, limitations, required
  system restrictions, expiration/next review date).
- **Human Owner / Reviewer Role:** Compliance/legal reviewer (human). This
  document explicitly states it is an architecture gate, not legal advice,
  so the reviewer role must be a human capable of making that
  determination, not an AI agent.
- **Artifact Path:** A future `compliance_reviews` record as suggested in
  `docs/13_Compliance_and_Legal_Review.md` Section 10 (no such table or
  document exists yet in this repository — its absence is part of this
  blocker). Interim status summary belongs in this register.
- **Prohibited Artifact Contents:** AI-generated legal or tax advice
  presented as a completed review; secrets; account-specific identifiers
  beyond what is needed to state the review scope.
- **Go/No-Go Impact:** BLOCKING. `docs/13_Compliance_and_Legal_Review.md`
  Section 9 states explicitly: "If any item is `UNVERIFIED`, live broker
  writes remain blocked." All six sub-items are `UNVERIFIED` by default
  and none has documented human review evidence in this repository as of
  this audit.

## LCB-006: Small-Capital Operating-Limit Evidence

- **Current Status:** `NOT_STARTED`
- **Source:** `docs/07_Trading_System.md` Section 30 ("Small-Capital Live
  Rules"); `docs/08_Testing_Validation.md` Section 12 ("Small-Capital Live
  Validation"); `docs/reviews/Codex_Phase6_Round2_Operational_Readiness_Review.md`
  item 6 ("Small-capital live readiness ... remains entirely
  unaddressed").
- **Required Evidence Type:** Documented, human-approved numeric and
  procedural limits: strict maximum total capital, strict maximum
  per-order amount, limited number of strategies, limit-orders-only
  policy, no extended-hours/fractional trading unless separately verified,
  no automatic strategy promotion, and a daily reconciliation review
  commitment — matching the constraint list in
  `docs/07_Trading_System.md` Section 30.
- **Human Owner / Reviewer Role:** Risk owner / operator (human), with the
  same operator committing to the daily reconciliation review the section
  requires.
- **Artifact Path:** `docs/phase7/small-capital-readiness-gates.md`. This
  file is owned by Engineer 3 under task P7-003; this register references
  it and does not create or edit it.
- **Prohibited Artifact Contents:** Real account balances, real capital
  figures tied to an identifiable account, credentials.
- **Go/No-Go Impact:** BLOCKING. `docs/08_Testing_Validation.md` Section 12
  lists "kill switch tested," "reconciliation tested," "alerting tested,"
  and "operator emergency procedure understood" as entry requirements
  alongside these limits — Small-Capital Live Mode
  (`docs/07_Trading_System.md` Section 4.4) cannot begin without this
  evidence recorded and reviewed by a human.

## LCB-007: Kill-Switch and Rollback Evidence (Live Context)

- **Current Status:** `EVIDENCE_PENDING`
- **Source:** `docs/07_Trading_System.md` Section 22 ("Kill Switch");
  `docs/08_Testing_Validation.md` Section 5.3, Section 19 ("Disaster
  Recovery Testing"); `docs/11_AI_RULES.md` Rule 23 ("Kill Switch Must Not
  Be Bypassed").
- **Required Evidence Type:** Two distinct kinds of evidence, both needed:
  (1) test evidence — already partially present, see note below — that
  `KillSwitchControlService` blocks new order intents, approvals, and
  not-yet-submitted approved orders across all five scopes (`GLOBAL`,
  `MARKET`, `PORTFOLIO`, `STRATEGY`, `ASSET`); and (2) a documented,
  human-reviewed rollback/incident procedure specific to *real* broker
  orders — cancel-in-flight behavior, recovery after a crash mid-submission,
  and reconciliation-before-resume — none of which can be proven in
  simulation alone once a real adapter exists.
- **Note on current partial coverage:** `docs/reviews/Codex_Phase6_Simulation_Safety_Review.md`
  and `docs/reviews/Codex_Phase6_Round2_Operational_Readiness_Review.md`
  both confirm kill-switch behavior is tested end-to-end in simulation
  (`tests/safety/safety-regression.test.ts`, `KillSwitchControlService`,
  `BrokerWriteCommandGuard`) and that `docs/phase6/phase6-operator-runbook.md`
  documents operator-facing stop conditions. That is simulation-layer
  evidence only. It does not, and cannot yet, cover real-broker rollback
  behavior, because no real `TossSecuritiesAdapter` write path exists (see
  LCB-008). This blocker stays `EVIDENCE_PENDING`, not `NOT_STARTED`,
  because the simulation-layer half of the evidence already exists and is
  reviewable now; the live-context half cannot be produced until LCB-008 is
  addressed in a later phase.
- **Human Owner / Reviewer Role:** Engineering safety reviewer (human),
  with operator sign-off on the rollback procedure being followable under
  stress.
- **Artifact Path:** Existing simulation-layer evidence:
  `tests/safety/safety-regression.test.ts`,
  `docs/phase6/phase6-operator-runbook.md` (reference only, not owned by
  this task). Live-context rollback procedure: a future document, not yet
  created, to be linked from `docs/07_Trading_System.md` Section 22 once
  written.
- **Prohibited Artifact Contents:** Raw broker payloads or order
  identifiers from any real incident; secrets; account numbers.
- **Go/No-Go Impact:** BLOCKING. Rule 23 states no AI, user interface,
  strategy, or worker may bypass the kill switch, and
  `docs/08_Testing_Validation.md` Section 19 requires production trading to
  "remain disabled after recovery until state is confirmed." Small-capital
  live entry requires "kill switch tested" per Section 12 — read in the
  context of a real broker connection, not simulation alone, once one
  exists.

## LCB-008: Real Broker Write Adapter Review Evidence

- **Current Status:** `BLOCKED`
- **Source:** `docs/07_Trading_System.md` Section 18 ("Toss Securities
  Execution Adapter"); `docs/08_Testing_Validation.md` Section 20.1
  ("TossSecuritiesAdapter" acceptance criteria);
  `docs/reviews/Codex_Phase6_Simulation_Safety_Review.md` item 1 and
  `docs/reviews/Codex_Phase6_Round2_Operational_Readiness_Review.md`
  item 1 ("No real `TossSecuritiesAdapter` or broker-write implementation
  exists").
- **Required Evidence Type:** An independent, human-performed code review
  of the real write adapter implementation (once it exists, in a phase
  after Phase 7) against the full acceptance criteria in
  `docs/08_Testing_Validation.md` Section 20.1: read contract tests, write
  contract tests in a mock or verified-safe environment, error
  normalization tests, timeout tests, redaction tests, and capability
  registry tests. The review record itself — not just the passing test
  suite — is the required evidence, per Rule 27-30 auditability
  requirements.
- **Human Owner / Reviewer Role:** Senior engineer or independent code
  reviewer (human), distinct from whoever implements the adapter where
  practical.
- **Artifact Path:** A future `docs/reviews/Codex_<PhaseN>_Toss_Write_Adapter_Review.md`
  — this document does not exist yet and cannot exist yet, because Phase 7
  explicitly forbids building a callable real Toss write adapter (see
  `docs/phase7/README.md`, "Forbidden in Phase 7"). The interface-only
  design work for the future adapter belongs to
  `docs/phase7/toss-write-contract-design.md`, owned by Engineer 2 under
  task P7-002; this register references it and does not create or edit
  it.
- **Prohibited Artifact Contents:** Any actual callable order
  submit/cancel/replace implementation in Phase 7 (forbidden by the
  Phase 7 boundary itself, not just by this register); raw broker
  payloads; secrets.
- **Go/No-Go Impact:** BLOCKING, and structurally so within Phase 7: this
  blocker cannot be marked `RESOLVED` in this phase by design, because the
  thing it would review (a real write adapter) must not exist yet. Its
  status will remain `BLOCKED` until a later, separately scoped
  implementation phase produces a reviewable adapter. Recording it here
  ensures no future phase mistakes "the contract shape compiles" or "unit
  tests for a mock pass" for this review having happened.

## Cross-Reference to Open Questions

This register does not change the `Status` or `Evidence Status` of any
entry in `docs/open_questions.md`. For traceability only:

| Blocker | Related Open Question(s) |
| --- | --- |
| LCB-001 | OQ-001 |
| LCB-002 | OQ-002 |
| LCB-007 (partial) | OQ-003 (order/fill identifiers feed reconciliation, which feeds rollback evidence) |
| LCB-008 | OQ-004 (ETF/fractional/extended-hours scoping feeds what the future adapter must support) |
| LCB-005 | OQ-007 (tax/fee assumption source is one input to the compliance record) |
| LCB-006 | OQ-008 (strategy promotion thresholds inform, but do not set, small-capital operating limits) |

None of these relationships resolve, narrow, or change priority on the
referenced open questions. They exist so a human working one document
can find the related context in the other.

## What This Register Does Not Do

- It does not resolve any blocker. Every entry above defaults to blocking
  live trading.
- It does not resolve, advance, or change the `Status` field of any entry
  in `docs/open_questions.md`.
- It does not implement, enable, or make callable any real broker write
  path.
- It does not certify that evidence, once produced, is sufficient — that
  judgment belongs to the named human owner/reviewer role for each entry.
- It does not replace `docs/reviews/Codex_Phase7_Live_Capable_Design_Readiness_Review.md`
  (owned by Engineer 4 under P7-004), which performs the full Phase 7
  integration review after all four Phase 7 tasks are merged.
