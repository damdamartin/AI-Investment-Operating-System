# Phase 5 Read-Only Evidence Plan

Version: 0.5.6
Status: Active
Last Updated: 2026-07-28

## Purpose

Phase 5 collects evidence from real external systems without enabling live trading.

The first target is Toss Securities Open API read-only validation.

## Non-Negotiable Boundary

Phase 5 may verify authentication, account reads, position reads, market data reads, documentation evidence, and sanitized recorded fixtures.

Phase 5 must not place, modify, or cancel real orders.

## Local Secret Handling

API keys must be entered only into a local `.env` file or a secret manager.

Do not paste API keys, client secrets, access tokens, account numbers, or raw API responses into chat, documentation, commits, screenshots, or logs.

The repository provides `.env.example` with placeholder names only.

Local setup checklist:

- `docs/phase5/toss-read-only-verification-checklist.md`

## Required Toss Evidence

Minimum evidence before read-only integration work is considered ready:

- API terms review evidence
- authentication read evidence
- account snapshot read evidence
- position query read evidence
- market data read evidence

Additional evidence to collect:

- order status query read evidence
- fill query read evidence
- Korean ETF support documentation
- U.S. ETF support documentation
- fractional support documentation
- extended-hours support documentation

## Evidence Rules

Every evidence record must be:

- sanitized
- free of credentials
- free of account numbers unless masked
- free of access tokens
- free of raw request headers
- marked with collection time
- linked to an open question such as OQ-001, OQ-002, OQ-003, or OQ-004

Evidence older than 30 days should be refreshed before it is used for an important decision.

## Read-Only Review Model

The codebase includes `TossReadOnlyEvidencePlan`.

It checks whether the minimum evidence set exists, whether any evidence contains credentials, whether any live write operation appears, and whether evidence is stale.

This model is review-only. It does not call Toss API and does not enable live trading.

## Evidence Recording

The codebase includes `TossReadOnlyEvidenceRecorder`.

It creates a sanitized evidence item from a read-only result summary and payload preview.

Rules:

- raw Toss API responses must not be committed
- raw request headers must not be committed
- access tokens must not be committed
- account numbers must not be committed
- client secrets must not be committed
- evidence containing live write command shapes must be rejected

The recorder produces:

- a review item for `TossReadOnlyEvidencePlan`
- a sanitized preview for local inspection
- safety flags for credentials, account identifiers, and live write operation shapes

If the recorder marks an item as not sanitized, that item must not be used as readiness evidence until the payload is manually cleaned.

## Evidence Manifest

Sanitized evidence summaries may be grouped into a manifest.

Template:

- `docs/phase5/evidence-manifest.example.json`

Rules:

- manifests must contain sanitized summaries only
- every evidence item must map to an open question such as `OQ-001`
- manifests must not contain credentials
- manifests must not contain live write operation evidence
- manifests must not contain raw Toss payloads

The codebase includes `TossReadOnlyEvidenceManifestValidator` to review these constraints.

## Credential Readiness

The codebase includes `TossReadOnlyCredentialReadinessService`.

It checks whether local configuration is ready for read-only Toss API verification without returning or logging secret values.

It verifies:

- Toss API base URL is configured
- Toss client ID is present
- Toss client secret is present
- Toss account reference is present
- live trading is disabled
- Toss read-only mode is enabled

The readiness service never approves live broker write operations.

Local command:

```bash
npm run phase5:toss:readiness
```

This command uses the local `.env` file and prints only a sanitized readiness report.

## Dry-Run Request Preparation

The codebase includes `TossReadOnlyDryRunClient`.

It prepares sanitized dry-run requests for allowed read-only operation types.

It does not perform network calls.

It rejects:

- non-normalized paths
- non-authentication `POST` requests
- write-shaped request bodies
- order creation or cancellation command shapes

Prepared requests mask client ID, client secret, and account reference headers.

## Read-Only Endpoint Catalog

The codebase includes `TossReadOnlyEndpointCatalogValidator`.

It validates a catalog of Toss read-only endpoints before those endpoints are used in dry-run or real read-only verification.

Template:

- `docs/phase5/toss-read-only-endpoints.example.json`

Rules:

- do not guess endpoint paths
- use only official Toss documentation, Toss developer console evidence, or local read-only verification
- every endpoint must map to an open question
- non-authentication `POST` endpoints are rejected
- live broker write operations remain blocked

## Phase 5 Exit Direction

Phase 5 can move forward only when read-only evidence is collected and open questions are updated with evidence.

Live trading remains blocked until later compliance, broker permission, data, strategy, and operational gates are explicitly resolved.
