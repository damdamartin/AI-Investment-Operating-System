# Phase 10 Human Evidence Operator Runbook

Version: 0.1.0
Status: Draft
Last Updated: 2026-07-29
Related Templates: `docs/phase10/human-evidence-templates/README.md`
Primary Register: `docs/phase7/live-capable-blocker-register.md`

## Purpose

This runbook tells the human operator how to move from Phase 10 evidence
templates to a reviewed blocker register without exposing secrets or
letting AI resolve a blocker.

## Procedure

1. Read `docs/phase7/live-capable-blocker-register.md`.
2. Pick the template that covers the blocker group you are working on.
3. Create a new sanitized evidence document from that template.
4. Fill it out manually as the accountable human reviewer.
5. Do not paste secrets, account numbers, balances, holdings quantities,
   raw broker payloads, raw headers, local receipt contents, or personally
   identifying contract text.
6. Run any relevant validator/checklist already provided by the project.
7. If the result is still uncertain, keep the blocker open.
8. Only after human review, edit
   `docs/phase7/live-capable-blocker-register.md` directly and record the
   reviewer, reviewed date, decision, limitations, and next review date.
9. Run `npm run check`.
10. Commit the evidence template changes and register update together.

## Human-Only Boundary

An AI agent may organize evidence and run validators. It may not:

- decide whether Toss permits automated trading
- decide compliance/legal approval
- choose capital or per-order limits
- sign the owner approval
- mark any `LCB-*` blocker `RESOLVED`
- implement broker writes

## Stop Conditions

Stop and keep the blocker open if:

- a source is ambiguous
- a reviewer field is missing
- a decision is AI-generated rather than human-authored
- evidence is stale or cannot be verified
- any secret/account/raw payload appears in a draft
- any validation command fails

## Final Check Before Any Future Write-Capable Phase

Before asking for a future write-capable implementation phase, confirm:

- all eight `LCB-*` blockers have human decisions in the blocker register
- every decision has reviewer name, reviewer role, date, limitations, and
  next review date
- no evidence file contains secrets or account identifiers
- `npm run check` passes
- the future implementation phase has a new, explicit task plan
