# Account And Provisioning Evidence Template

Template Version: 0.1.0
Status: Blank Template
Covered Blockers: `LCB-002`, `LCB-003`
Human Owner: Operator + infrastructure/security reviewer

## Safety Notice

Do not write `.env` contents, API keys, client secrets, access tokens,
account numbers, cash balances, holdings quantities, raw broker payloads,
raw headers, local receipt contents, or secret-manager values in this
file.

This template records process and sanitized evidence references only.

## Packet Metadata

- Packet ID:
- Prepared by:
- Prepared date:
- Operator reviewer name:
- Infrastructure/security reviewer name:
- Review date:
- Next review date or expiration:

## LCB-002 Account Permission And Capability Evidence

- Sanitized read-only evidence reference:
- Masked account reference:
- Broker account status reviewed:
- Permission status reviewed:
- Live trading flag reviewed:
- Capability registry reference:

### Blocking Condition Review

Record only `PASS`, `FAIL`, or `UNKNOWN`.

- Missing account:
- Multiple accounts resolved:
- Unverified permission status:
- Read-only account:
- Disabled portfolio/account link:
- Market not allowed:
- Asset type not allowed:
- Stale capability verification:

### Human-Reviewed Result

- Result:
  - `READY_FOR_HUMAN_REVIEW`
  - `HUMAN_REVIEWED_APPROVED_WITH_LIMITATIONS`
  - `HUMAN_REVIEWED_REJECTED`
  - `HUMAN_REVIEWED_UNVERIFIED`
  - `NEEDS_MORE_EVIDENCE`
- Limitations:
- Open questions:

## LCB-003 Production Credential/Provisioning Process

Do not write credential values. Describe only the process.

- Secret storage mechanism:
- Environment separation:
- Access-control roles:
- Rotation process:
- Rotation cadence:
- Leaked-secret response process:
- Audit trail location/reference:
- Reviewer result:
  - `READY_FOR_HUMAN_REVIEW`
  - `HUMAN_REVIEWED_APPROVED_WITH_LIMITATIONS`
  - `HUMAN_REVIEWED_REJECTED`
  - `HUMAN_REVIEWED_UNVERIFIED`
  - `NEEDS_MORE_EVIDENCE`
- Limitations:
- Open questions:

## Prohibited Content Confirmation

The human reviewers confirm this packet contains no credential values,
account identifiers, raw broker payloads, balances, holdings quantities,
or local receipt contents.

- Operator confirmation:
- Infrastructure/security reviewer confirmation:
- Date:
