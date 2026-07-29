# Live Safety Review Evidence Template

Template Version: 0.1.0
Status: Blank Template
Covered Blockers: `LCB-007`, `LCB-008`
Human Owner: Engineering safety reviewer + independent senior reviewer

## Safety Notice

Do not write secrets, account numbers, raw broker payloads, raw headers,
local receipt contents, or executable broker command payloads in this
file.

This template does not approve a future write adapter. It only records
the safety evidence a human must review before that later review can
begin.

## Packet Metadata

- Packet ID:
- Prepared by:
- Prepared date:
- Engineering safety reviewer name:
- Independent senior reviewer name:
- Review date:
- Next review date or expiration:

## LCB-007 Live-Context Kill-Switch And Rollback Evidence

- Kill-switch rehearsal reference:
- Rollback rehearsal reference:
- Reconciliation rehearsal reference:
- Operator emergency procedure reviewed:
- Unresolved broker-state stop criteria:
- Incident return-to-paper condition:

### Seven-Step Rollback Rehearsal

Record only `PASS`, `FAIL`, or `UNKNOWN`.

- Stop scheduler:
- Engage kill switch:
- Block new intents:
- Freeze broker writes:
- Reconcile latest broker snapshot:
- Produce incident report:
- Resume only paper/simulation mode:

### Human-Reviewed Result

- Result:
  - `READY_FOR_HUMAN_REVIEW`
  - `HUMAN_REVIEWED_APPROVED_WITH_LIMITATIONS`
  - `HUMAN_REVIEWED_REJECTED`
  - `HUMAN_REVIEWED_UNVERIFIED`
  - `NEEDS_MORE_EVIDENCE`
- Limitations:
- Open questions:

## LCB-008 Future Write Adapter Review Evidence

This section can only identify the future review process. It cannot
approve code that does not exist yet.

- Future reviewer name/role:
- Review independence confirmed:
- Required review artifacts:
- Required test evidence:
- Required source scans:
- Current adapter status:
  - No callable write adapter exists
  - Future adapter exists and must be reviewed before any use
  - Unknown
- Human-reviewed result:
  - `READY_FOR_HUMAN_REVIEW`
  - `HUMAN_REVIEWED_APPROVED_WITH_LIMITATIONS`
  - `HUMAN_REVIEWED_REJECTED`
  - `HUMAN_REVIEWED_UNVERIFIED`
  - `NEEDS_MORE_EVIDENCE`
- Limitations:
- Open questions:

## Prohibited Content Confirmation

The human reviewers confirm this packet contains no secrets, account
identifiers, raw broker payloads, local receipt contents, or executable
broker command payloads.

- Engineering safety reviewer confirmation:
- Independent senior reviewer confirmation:
- Date:
