# Phase 10 Human Evidence Templates

Version: 0.1.0
Status: Draft
Last Updated: 2026-07-29
Related Workbook: `docs/phase10/human-blocker-evidence-workbook.md`
Primary Register: `docs/phase7/live-capable-blocker-register.md`

## Purpose

These templates are blank, sanitized worksheets for the human-only
`LCB-001` through `LCB-008` evidence process.

They are not completed evidence. They are not live-trading approval. They
must not contain secrets, account numbers, raw broker payloads, balances,
holdings quantities, local receipt contents, or personally identifying
contract text.

## Templates

| Template | Blockers | Human Owner |
| --- | --- | --- |
| `toss-compliance-template.md` | `LCB-001`, `LCB-005` | Compliance/legal reviewer |
| `account-provisioning-template.md` | `LCB-002`, `LCB-003` | Operator + infrastructure/security reviewer |
| `owner-risk-template.md` | `LCB-004`, `LCB-006` | Project owner + risk owner/operator |
| `live-safety-review-template.md` | `LCB-007`, `LCB-008` | Engineering safety reviewer + independent senior reviewer |

## How To Use

1. Copy the relevant template to a new sanitized evidence document.
2. Fill it out manually as the human owner/reviewer.
3. Keep all sensitive values out of the document.
4. Run the matching validator/checklist where one exists.
5. Only after human review, update `docs/phase7/live-capable-blocker-register.md`
   directly according to that file's rules.

Do not let an AI agent mark any blocker `RESOLVED`.
