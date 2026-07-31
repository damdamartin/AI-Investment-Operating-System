# AI Investment Operating System

Version: 0.6.0
Status: API Integration Phase (한국투자증권 + Claude + 네이버 뉴스)
Last Updated: 2026-07-30

## 🚀 진행 중인 작업

**현재 단계:** API 정보 설정 완료 → 코드 구현 중

**새 Claude Code 세션 시작 시:**
→ `NEW_SESSION_START.md` 파일 읽기
→ `MOBILE_IMPLEMENTATION_GUIDE.md` 참고
→ 단계별로 진행

---

## Overview

AI Investment Operating System is a document-driven project for designing and building an automated stock and ETF trading platform.

The system is intended to use:

- **Korea Investment & Securities (KIS) Open API** for Korean and U.S. stock/ETF market data, account data, and order execution
- **Naver News API** for news collection
- **Claude API** for AI analysis, strategy research, health checks, and structured reasoning

## Core Principle

The system must prioritize survival, risk control, verification, and auditability over short-term returns.

Claude or any AI component must not directly place orders. All orders must pass through deterministic risk, money management, and order approval layers before reaching the broker adapter.

Live broker write operations are blocked until compliance, broker terms, data licensing, account permission, and strategy promotion gates are explicitly satisfied.

## Documentation

The official project documentation lives in [docs](docs/README.md).

Local development commands are documented in [DEVELOPMENT.md](DEVELOPMENT.md).

## Repository Status

This repository currently contains the architecture documentation foundation, implementation task batches, safe foundation TypeScript implementation, Phase 4 readiness review baseline, and the first Phase 5 read-only evidence scaffolding.

## Automated Recommendation Pipeline

`src/application/pipeline/auto-recommendation-orchestrator.ts` runs a fully
unattended cycle on a GitHub Actions schedule
(`.github/workflows/trading-cycle.yml`): market data -> strategy scoring ->
risk check -> money management check -> recommendation. Results are written
to a Cloudflare D1 database (`migrations/d1/0001_pipeline_schema.sql`).

**This pipeline never places a real broker order.** Its only output is an
`order_recommendations` row with status `PENDING_HUMAN_SUBMISSION`. A human
reads it and decides whether to place the order themselves in the Toss app.
There is no code path in this repository that can submit, cancel, or replace
a real order - `src/adapters/toss-write-contract.ts` keeps that adapter
surface type-uncallable (`command: never`) on purpose. See
`docs/11_AI_RULES.md` Rule 1.

### Current scope and known limitations

- **Market data is a labeled placeholder** (`PlaceholderMarketDataProvider`
  in `src/application/pipeline/market-data-provider.ts`). It generates a
  deterministic synthetic price series, not real prices. This exists so the
  full pipeline can be proven end-to-end without silently wiring a new,
  unreviewed data source under your brokerage identity. Replace it with a
  real provider before treating any recommendation as meaningful - see the
  comment at the top of that file for why the existing Toss read-only client
  can't be reused as-is (it deliberately never extracts real prices).
- **News/AI-sentiment scoring is not wired in yet.** `NewsEventEngine`, the
  Naver adapter, and the Claude adapter all exist and are tested, but the
  orchestrator only uses the `MARKET` engine today. Wiring the news+AI leg in
  is a natural next step.
- **Kill switch and risk/money limits are real, not cosmetic** - see
  `PIPELINE_*` environment variables below. An active kill switch, or any
  failed risk/money check, blocks the recommendation for that asset; nothing
  needs to be "unlocked" to make this safety layer work.

### Required GitHub Actions secrets

Add these in the repo's Settings -> Secrets and variables -> Actions:

| Name | Purpose |
| --- | --- |
| `CLOUDFLARE_ACCOUNT_ID` | `87b29e119026eda88a305476a9c28adb` (already provisioned) |
| `CLOUDFLARE_D1_DATABASE_ID` | `9d287512-e226-4d7f-b739-d54098b36e0d` (database `aios-pipeline`, already provisioned) |
| `CLOUDFLARE_API_TOKEN` | Create this yourself: Cloudflare dashboard -> My Profile -> API Tokens -> Create Token -> permission `Account.D1:Edit`, scoped to this account only. Not something an automated agent should mint on your behalf. |
| `PIPELINE_WATCHLIST` (optional) | e.g. `005930:Samsung Electronics:KR:STOCK,000660:SK Hynix:KR:STOCK`. Defaults to those two if unset. |

Also add these as repo **variables** (Settings -> Secrets and variables ->
Actions -> Variables tab) - not secrets, so you can flip them without
re-entering a credential:

| Name | Purpose |
| --- | --- |
| `PIPELINE_KILL_SWITCH_ACTIVE` | `true` to immediately halt all new recommendations, `false` (or unset) otherwise. |
| `PIPELINE_KILL_SWITCH_REASON` | Free-text reason recorded when the kill switch is active. |

### What remains your responsibility, not this pipeline's

- Confirming Toss Securities' terms actually permit the kind of automated
  read/analysis activity you run here (`docs/phase7/live-capable-blocker-register.md`
  LCB-001 is still `UNVERIFIED`).
- Deciding on and building a real market data source, if you want
  recommendations based on real prices.
- Placing any real order yourself - this pipeline will never do it for you.
