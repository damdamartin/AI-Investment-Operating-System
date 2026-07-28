# Toss Official API Source Notes

Version: 0.1.0
Status: Reference
Last Updated: 2026-07-28

## Purpose

This document records official Toss Securities Open API source locations used for Phase 5 read-only preparation.

It does not authorize live trading, order creation, order cancellation, order modification, transfers, withdrawals, or production capital use.

## Official Sources

- Human/interactive documentation: `https://developers.tossinvest.com/docs`
- LLM guidance: `https://developers.tossinvest.com/llms.txt`
- Overview markdown: `https://openapi.tossinvest.com/openapi-docs/overview.md`
- API reference markdown: `https://openapi.tossinvest.com/openapi-docs/latest/api-reference/README.md`
- OpenAPI JSON source of truth: `https://openapi.tossinvest.com/openapi-docs/latest/openapi.json`

The LLM guidance identifies the base API server as:

```text
https://openapi.tossinvest.com
```

## Read-Only Candidate Endpoints

The following endpoints are official-documentation candidates for Phase 5 read-only verification. They still require local operator review and a scoped approval artifact before use.

| Operation | Method | Path | Phase 5 Mapping | Notes |
|---|---:|---|---|---|
| OAuth2 token issuance | POST | `/oauth2/token` | `AUTHENTICATION_READ`, OQ-001 | Authentication only. Does not authorize broker writes. |
| Current price lookup | GET | `/api/v1/prices?symbols=005930` | `MARKET_DATA_READ`, OQ-004 | Market data only. Official docs require the `symbols` query parameter. The Phase 5 runner uses one public documentation-style symbol and records only item count, never raw symbols or prices. |
| Account list lookup | GET | `/api/v1/accounts` | `ACCOUNT_SNAPSHOT_READ`, OQ-002 | Account APIs require careful account identifier redaction. |
| Holdings lookup | GET | `/api/v1/holdings` | `POSITION_QUERY_READ`, OQ-002 | Record only sanitized position summary evidence. |

## Elevated-Risk Read-Only Candidates

Official docs also list read endpoints under order or conditional-order paths, such as:

- `GET /api/v1/orders`
- `GET /api/v1/orders/{orderId}`
- `GET /api/v1/conditional-orders`
- `GET /api/v1/conditional-orders/{conditionalOrderId}`

These are read operations in the official docs, but their paths contain order-related terms. The endpoint catalog validator intentionally treats mutation-looking order paths as elevated risk. Do not add or verify these endpoints until:

- official evidence confirms the operation is read-only
- the evidence kind matches `ORDER_STATUS_QUERY_READ` or `FILL_QUERY_READ`
- the endpoint is scoped to the appropriate open question
- the operator has a single-use approval artifact
- no write path, order creation, order modification, or order cancellation is added

## Officially Listed Write Endpoints Remain Blocked

The official docs list write-capable endpoints including:

- `POST /api/v1/orders`
- `POST /api/v1/orders/{orderId}/modify`
- `POST /api/v1/orders/{orderId}/cancel`
- conditional order create, modify, and cancel endpoints

These remain blocked in Phase 5.
