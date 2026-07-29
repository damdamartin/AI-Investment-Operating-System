# Owner And Risk Evidence Template

Template Version: 0.1.0
Status: Blank Template
Covered Blockers: `LCB-004`, `LCB-006`
Human Owner: Project owner + risk owner/operator

## Safety Notice

Do not write account numbers, actual account balances, API credentials,
raw broker payloads, or local receipt contents in this file.

AI must not invent capital limits, order limits, strategy scope, or human
approval text. The human owner/risk reviewer must write those values and
decisions directly.

## Packet Metadata

- Packet ID:
- Prepared by:
- Prepared date:
- Project owner name:
- Risk owner/operator name:
- Review date:
- Next review date or expiration:

## LCB-004 Explicit Human Approval Evidence

- Human approval intent:
- Residual-risk acknowledgment:
- Scope of approval:
- Exclusions:
- Expiration or revocation condition:
- Human-reviewed result:
  - `READY_FOR_HUMAN_REVIEW`
  - `HUMAN_REVIEWED_APPROVED_WITH_LIMITATIONS`
  - `HUMAN_REVIEWED_REJECTED`
  - `HUMAN_REVIEWED_UNVERIFIED`
  - `NEEDS_MORE_EVIDENCE`

## LCB-006 Small-Capital Operating Limits

The human risk owner/operator must fill these values. There are no
defaults.

- Maximum total capital policy:
- Maximum per-order policy:
- Allowed strategy set:
- Allowed asset scope:
- Limit-order-only restriction:
- Regular-market-hours-only restriction:
- Extended-hours restriction:
- Fractional-trading restriction:
- Daily review commitment:
- Stop criteria:
- Incident rollback condition:
- Human-reviewed result:
  - `READY_FOR_HUMAN_REVIEW`
  - `HUMAN_REVIEWED_APPROVED_WITH_LIMITATIONS`
  - `HUMAN_REVIEWED_REJECTED`
  - `HUMAN_REVIEWED_UNVERIFIED`
  - `NEEDS_MORE_EVIDENCE`

## Human Review Statement

Write the human decision here in your own words. AI-generated text cannot
serve as this decision.

```text
[Human owner/risk reviewer writes decision here.]
```

## Prohibited Content Confirmation

The human reviewers confirm this packet contains no secrets, account
identifiers, actual account balances, raw broker payloads, or local
receipt contents.

- Project owner confirmation:
- Risk owner/operator confirmation:
- Date:
