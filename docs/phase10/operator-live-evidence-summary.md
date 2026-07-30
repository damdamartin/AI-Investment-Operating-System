# Operator Live Evidence Summary

Version: 0.1.0
Status: Evidence Recorded
Last Updated: 2026-07-29
Source Export: `operator-dashboard-operational-data (2).xls`

## Purpose

This document records the sanitized contents of the operator-provided
dashboard export. It is evidence intake only. It does not enable live
broker writes, does not submit a Toss order, and does not mark any
`LCB-*` blocker `RESOLVED`.

## Live-Trading Authorization Evidence

| Blocker | Recorded status | Review date | Reviewer role | Sanitized summary |
| --- | --- | --- | --- | --- |
| `LCB-001` Toss automated trading permission | `APPROVED` | 2026-07-29 | Owner | Owner states that the Toss Securities personal API was officially provided for the owner's personal account and is understood to permit AI-assisted automated stock trading for that account. |
| `LCB-002` Account permission and live capability | `VERIFIED` | 2026-07-29 | Owner | Owner states that the connected Toss Securities account exists, belongs to the owner, and currently contains domestic and overseas stock holdings. Account identifiers and balances are intentionally omitted. |
| `LCB-004` Human approval evidence | `APPROVED` | 2026-07-29 | Owner | Owner accepts that AI-assisted automated trading can cause losses and that the owner is responsible for those losses. |
| `LCB-005` Compliance/legal review | `REVIEWED` | 2026-07-29 | Owner | Owner states that no legal issue was identified for AI-assisted automated trading through the Toss Securities API for the owner's personal use. |
| Phase 5 Toss preparation | `COMPLETE` | 2026-07-29 | Owner | Owner states that trading records are designed to be recorded and exportable, and abnormal signals are designed to trigger immediate alerts. |

## Minimum-Capital First-Trade Record

| Field | Value |
| --- | --- |
| Checklist status | Complete |
| Capital mode | Limited capital confirmed |
| Order type policy | Limit order only |
| First-order scope | One order only |
| Kill-switch check | Confirmed by owner |
| Reconciliation/recovery check | Confirmed by owner |
| Post-trade manual review | Confirmed by owner |
| Market | US |
| Side | SELL |
| Order type | LIMIT |
| Symbol/ticker | TSLL |
| Quantity | 1 |
| Limit price | 7.05 |
| Maximum order amount | 7.1 |
| Currency | USD |
| Approval status | HUMAN_APPROVED |
| AI rationale | Test sale of one Tesla ETF-related share for pilot verification. |
| Stop condition | If the limit price falls more than 10%, expand the sell review to two shares. |
| Human approval memo | Owner states that they are personally leading this trading test. |
| Last saved in dashboard | 2026-07-29 22:54:01 KST |
| Actual order transmission | Blocked |

## Remaining Safety Boundary

The source export still records:

```text
Actual order transmission: Blocked
```

This means the evidence has been recorded, but the system still needs a
separately reviewed real Toss write adapter, Cloudflare secret binding
review, kill-switch/reconciliation runtime evidence, and a final
human-reviewed release decision before any broker write path can be
enabled.

## Official Read-Only Endpoint Catalog

The operator endpoint catalog is recorded in
`docs/phase5/toss-read-only-endpoints.operator.json`.

It includes only official, read-only or authentication endpoints:

| Endpoint | Purpose |
| --- | --- |
| `POST /oauth2/token` | OAuth 2.0 Client Credentials access token issuance |
| `GET /api/v1/accounts` | Account list lookup |
| `GET /api/v1/holdings` | Current holdings lookup |
| `GET /api/v1/stocks` | Stock market data lookup with a `symbols` query |

This catalog fixes the previous local blocker where the only catalog entry
was `account-snapshot-example` with `verified: false`.

## First Real Toss Read-Only Verification

| Field | Value |
| --- | --- |
| Target | `accounts` |
| Operation | `ACCOUNT_SNAPSHOT_READ` |
| Collected at | 2026-07-29 23:32:22 KST |
| Sanitized evidence path | `tmp/phase5/read-only-verify-account-snapshot-read-2026-07-29T14-32-22-439Z.json` |
| Item count | 1 |
| Network call performed | true |
| Raw payload stored | false |
| Live broker write allowed | false |
| Result | Passed |

This verification confirms that the local Toss Open API credentials can
authenticate and perform the account-list read-only call. It does not
authorize or perform any order submission, cancellation, replacement,
withdrawal, transfer, currency conversion, or other broker-write action.

## Second Real Toss Read-Only Verification

| Field | Value |
| --- | --- |
| Target | `holdings` |
| Operation | `POSITION_QUERY_READ` |
| Collected at | 2026-07-29 23:33:49 KST |
| Sanitized evidence path | `tmp/phase5/read-only-verify-position-query-read-2026-07-29T14-33-49-310Z.json` |
| Item count | 6 |
| Network call performed | true |
| Raw payload stored | false |
| Live broker write allowed | false |
| Result | Passed |

This verification confirms that the local Toss Open API credentials and
account reference can perform the holdings read-only call. It stores only
the number of returned items and does not store raw symbols, quantities,
balances, account identifiers, or broker payloads.

## Post-Manual-Trade Read-Only Verification

| Field | Value |
| --- | --- |
| Context | Owner reported that a manual Toss Securities trade was performed and the result was saved in the dashboard |
| Target | `holdings` |
| Operation | `POSITION_QUERY_READ` |
| Collected at | 2026-07-30 00:29:20 KST |
| Sanitized evidence path | `tmp/phase5/read-only-verify-position-query-read-2026-07-29T15-29-20-933Z.json` |
| Item count | 6 |
| Network call performed | true |
| Raw payload stored | false |
| Live broker write allowed | false |
| Result | Passed |

This post-trade read-only check confirms that the Toss holdings endpoint
is still reachable after the owner-reported manual trade. It does not
confirm the exact order, symbol, quantity, fill price, fee, tax, or cash
movement because raw broker payloads are intentionally not stored here.

## Post-Repeat-Validation Trades Read-Only Verification

| Field | Value |
| --- | --- |
| Context | Owner reported that two additional manual Toss Securities trades were performed |
| Target | `holdings` |
| Operation | `POSITION_QUERY_READ` |
| Collected at | 2026-07-30 00:37:29 KST |
| Sanitized evidence path | `tmp/phase5/read-only-verify-position-query-read-2026-07-29T15-37-29-022Z.json` |
| Item count | 6 |
| Network call performed | true |
| Raw payload stored | false |
| Live broker write allowed | false |
| Result | Passed |

This read-only check confirms that the Toss holdings endpoint is still
reachable after the owner-reported two repeat-validation manual trades.
The dashboard execution records remain the source for exact fill price,
quantity, fee, tax, AI token cost, and net-cash calculations.

## Post-Execution-Record Save Read-Only Verification

| Field | Value |
| --- | --- |
| Context | Owner reported that execution results were saved in the dashboard after the repeat-validation trades |
| Target | `holdings` |
| Operation | `POSITION_QUERY_READ` |
| Collected at | 2026-07-30 00:47:24 KST |
| Sanitized evidence path | `tmp/phase5/read-only-verify-position-query-read-2026-07-29T15-47-24-985Z.json` |
| Item count | 6 |
| Network call performed | true |
| Raw payload stored | false |
| Live broker write allowed | false |
| Result | Passed |

This read-only check confirms that the Toss holdings endpoint remains
reachable after the owner-reported dashboard execution-record save. It
does not read the dashboard browser localStorage; exact execution values
must be checked from the exported operational data file.

## Post-Second-Execution-Record Save Read-Only Verification

| Field | Value |
| --- | --- |
| Context | Owner reported that execution results were saved again in the dashboard |
| Target | `holdings` |
| Operation | `POSITION_QUERY_READ` |
| Collected at | 2026-07-30 00:51:51 KST |
| Sanitized evidence path | `tmp/phase5/read-only-verify-position-query-read-2026-07-29T15-51-51-729Z.json` |
| Item count | 6 |
| Network call performed | true |
| Raw payload stored | false |
| Live broker write allowed | false |
| Result | Passed |

This read-only check confirms that the Toss holdings endpoint remains
reachable after the latest owner-reported execution-record save. Exact
dashboard values still need to be verified from the exported operational
data file.
