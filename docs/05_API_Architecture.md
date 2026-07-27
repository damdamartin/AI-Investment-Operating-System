# 05 API Architecture

Version: 0.1.0  
Status: Draft  
Last Updated: 2026-07-27  
Related Docs: 02_System_Architecture.md, 03_Domain_Model.md, 04_Database_Architecture.md, 06_AI_Architecture.md, 07_Trading_System.md, 08_Testing_Validation.md, 09_Operation_Deployment.md, 11_AI_RULES.md

## 1. Document Purpose

This document defines the API architecture for AI Investment Operating System.

It covers external API boundaries, internal interface contracts, adapter rules, authentication handling, error normalization, retry policy, rate limit behavior, and validation requirements.

The system initially integrates:

- Toss Securities Open API
- Naver News Search API
- Claude API

Exact endpoint payloads must be verified from official API specifications during implementation. This document defines how the system must integrate APIs safely, not every vendor field.

## 2. Official API Sources

The implementation team must verify final details from official provider documentation before coding production behavior.

Initial reference sources:

| Service | Official Source | Notes |
|---|---|---|
| Toss Securities Open API | `https://corp.tossinvest.com/ko/open-api` and developer documentation linked from it | Used for market data, account data, and order execution |
| Naver News Search API | `https://developers.naver.com/docs/serviceapi/search/news/news.md` | REST API returning news search results in JSON or XML; daily Search API limit is documented as 25,000 calls |
| Claude API | `https://platform.claude.com/docs/en/api/messages` | Messages API is the primary integration surface |

Non-official blogs, GitHub projects, and examples may help exploration but must not be treated as source of truth for production behavior.

## 3. API Architecture Principles

### 3.1 External APIs Are Never Called Directly by Domain Logic

All external API calls must go through adapter layers.

```text
Application Service
-> Internal Interface
-> Adapter
-> External API
```

Forbidden:

```text
Strategy Engine -> Toss API
Claude Prompt -> Toss API
Dashboard -> Toss API
News Engine -> raw Naver API fields
```

### 3.2 Adapters Normalize External Data

Adapters must convert provider-specific payloads into internal contracts.

The rest of the system should not depend on:

- vendor field names
- vendor error formats
- vendor market codes
- vendor pagination style
- vendor authentication headers
- raw HTTP response structure

### 3.3 API Uncertainty Blocks Production Trading

If a required API behavior is unknown, the implementation must mark it as `UNVERIFIED` and block production usage until tested.

Examples:

- U.S. ETF order support
- fractional order support
- extended-hours support
- market order availability
- order cancellation behavior
- fill id uniqueness
- account currency handling

### 3.4 Read APIs and Write APIs Have Different Risk Levels

Read APIs:

- market data
- account balances
- positions
- news
- AI analysis

Write APIs:

- order creation
- order correction
- order cancellation
- production configuration changes

Write APIs require stricter approval, logging, idempotency, and reconciliation.

### 3.5 No Secret Leakage

API keys, tokens, account secrets, and authorization headers must never be:

- committed to Git
- printed in logs
- stored in raw payloads
- included in prompts to Claude
- shown in dashboard error messages

## 4. External API Boundary Map

```text
Toss Securities Open API
  accessed only by TossSecuritiesAdapter

Naver News API
  accessed only by NaverNewsAdapter

Claude API
  accessed only by ClaudeAIAdapter
```

Internal services consume normalized interfaces:

```text
BrokerGateway
NewsProviderGateway
AIAnalysisGateway
```

## 5. Toss Securities API Architecture

### 5.1 Purpose

Toss Securities Open API is the broker integration for:

- Korean stock data
- Korean ETF data
- U.S. stock data
- U.S. ETF data
- account data
- balances
- positions
- order submission
- order correction
- order cancellation
- order status tracking
- fills and reconciliation

### 5.2 Adapter Name

Recommended implementation name:

```text
TossSecuritiesAdapter
```

Internal interface:

```text
BrokerGateway
```

### 5.3 Adapter Responsibilities

The adapter is responsible for:

- authentication
- token refresh
- request signing if required
- endpoint selection
- request serialization
- response parsing
- error normalization
- rate limit handling
- timeout handling
- retry coordination for safe read calls
- order status query
- mapping Toss asset identifiers to internal asset IDs
- raw payload redaction
- API call logging

The adapter is not responsible for:

- deciding what to buy
- deciding order size
- approving risk
- approving strategy changes
- interpreting AI analysis
- bypassing order approval

### 5.4 Required BrokerGateway Methods

The internal broker interface should expose capability-oriented methods.

```text
getBrokerStatus()
getAccountSummary()
getCashBalances()
getPositions()
getTradableAssets(market, assetType)
getAssetQuote(assetId)
getOrderBook(assetId)
getBuyingPower(assetId, side)
getSellableQuantity(assetId)
estimateOrderCost(orderPreviewRequest)
submitOrder(approvedOrderRequest)
cancelOrder(cancelOrderRequest)
replaceOrder(replaceOrderRequest)
getOrderStatus(brokerOrderReference)
getOpenOrders()
getFills(orderReference)
```

Methods that are not supported by Toss must return a typed `UNSUPPORTED_CAPABILITY` result, not fail silently.

### 5.5 Broker Capability Model

The system must store broker capability information.

Example capability fields:

```json
{
  "broker": "TOSS_SECURITIES",
  "market": "US",
  "asset_type": "ETF",
  "supports_order_submit": true,
  "supports_order_cancel": true,
  "supports_order_replace": "UNVERIFIED",
  "supports_market_order": "UNVERIFIED",
  "supports_limit_order": "UNVERIFIED",
  "supports_fractional_quantity": "UNVERIFIED",
  "supports_extended_hours": "UNVERIFIED",
  "supports_fee_estimate": "UNVERIFIED",
  "verified_at": null
}
```

Allowed capability states:

```text
SUPPORTED
UNSUPPORTED
UNVERIFIED
PARTIAL
```

Production trading may use only required capabilities marked `SUPPORTED`.

### 5.6 Order Submission Contract

The adapter must accept only an approved internal order request.

Example internal request:

```json
{
  "order_approval_id": "uuid",
  "client_order_id": "uuid-or-idempotency-key",
  "portfolio_id": "uuid",
  "asset_id": "uuid",
  "broker": "TOSS_SECURITIES",
  "market": "KR",
  "asset_type": "STOCK",
  "side": "BUY",
  "quantity": "10",
  "order_type": "LIMIT",
  "limit_price": {
    "amount": "70000",
    "currency": "KRW"
  },
  "time_in_force": "DAY",
  "approval_reference": {
    "risk_check_id": "uuid",
    "money_check_id": "uuid"
  }
}
```

Rules:

- `order_approval_id` is required.
- `asset_id` must resolve to a verified Toss broker mapping.
- order amount and quantity must match approval.
- adapter must reject unapproved request objects.
- adapter must persist or return enough broker response data for reconciliation.

### 5.7 Order Response Contract

Example normalized response:

```json
{
  "result": "ACCEPTED",
  "broker": "TOSS_SECURITIES",
  "broker_order_id": "provider-order-id",
  "client_order_id": "internal-idempotency-key",
  "normalized_state": "BROKER_ACCEPTED",
  "submitted_at": "2026-07-27T00:00:00Z",
  "raw_payload_id": "uuid",
  "warnings": []
}
```

Allowed results:

```text
ACCEPTED
REJECTED
UNKNOWN
UNSUPPORTED
FAILED
```

`UNKNOWN` must trigger reconciliation and block dependent orders.

### 5.8 Toss API Verification Checklist

Before live trading, verify:

1. Korean stock order submit
2. Korean stock order cancel
3. Korean stock order replace
4. Korean ETF order support
5. U.S. stock order submit
6. U.S. stock order cancel
7. U.S. stock order replace
8. U.S. ETF order support
9. fractional order support
10. market order support
11. limit order support
12. extended-hours support
13. account cash by currency
14. buying power calculation
15. sellable quantity calculation
16. fee and tax estimate support
17. broker order id stability
18. fill id stability
19. partial fill behavior
20. rate limits
21. token expiration behavior
22. API maintenance behavior
23. error response format
24. test or mock environment availability

Unverified items must be documented in API test results.

## 6. Naver News API Architecture

### 6.1 Purpose

Naver News API is used for news search and article metadata collection.

It is an input source for News and Event Engine. It is not a trading signal by itself.

### 6.2 Adapter Name

Recommended implementation name:

```text
NaverNewsAdapter
```

Internal interface:

```text
NewsProviderGateway
```

### 6.3 Adapter Responsibilities

The adapter is responsible for:

- authentication headers
- query construction
- pagination
- sorting options
- JSON response parsing
- HTML tag cleanup
- timestamp normalization
- URL normalization
- provider error normalization
- rate limit tracking
- raw payload redaction
- API call logging

The adapter is not responsible for:

- deciding news impact
- approving trades
- linking ambiguous companies without validation
- multiplying importance because many duplicate articles exist

### 6.4 Search Request Contract

Example internal request:

```json
{
  "query": "삼성전자 실적",
  "display": 50,
  "start": 1,
  "sort": "date",
  "language": "ko",
  "requested_at": "2026-07-27T00:00:00Z"
}
```

Rules:

- query must be generated by an approved query builder
- display and pagination must respect provider limits
- rate limit budget must be checked before scheduled collection

### 6.5 Search Response Contract

Example normalized article:

```json
{
  "provider": "NAVER_NEWS",
  "title": "cleaned title",
  "summary": "cleaned summary",
  "original_url": "https://example.com/article",
  "source_name": "source",
  "published_at": "2026-07-27T00:00:00+09:00",
  "collected_at": "2026-07-27T00:01:00+09:00",
  "query": "삼성전자 실적",
  "raw_payload_id": "uuid"
}
```

### 6.6 News Processing Rules

After adapter normalization:

```text
normalized articles
-> deduplication
-> source reliability check
-> symbol mapping
-> clustering
-> Claude event assessment if needed
-> NewsEvent creation
```

Rules:

- duplicate articles must not amplify signal strength automatically
- old articles must not be treated as new
- search results alone do not prove event truth
- source uncertainty lowers confidence
- U.S. stock coverage through Naver may be incomplete

### 6.7 Naver API Verification Checklist

Before relying on news-driven strategies:

1. daily call limit behavior
2. pagination behavior
3. sort by date behavior
4. published date reliability
5. duplicate article rate
6. HTML cleanup requirements
7. source field consistency
8. rate limit error format
9. Korean company name ambiguity
10. U.S. company and ticker coverage quality
11. delayed article appearance
12. old article resurfacing behavior

## 7. Claude API Architecture

### 7.1 Purpose

Claude API is used for:

- news summarization
- event classification
- impact assessment
- contradiction detection
- AI Health Check
- strategy research
- strategy performance explanation
- candidate strategy generation
- documentation support

Claude is not used for direct order execution.

### 7.2 Adapter Name

Recommended implementation name:

```text
ClaudeAIAdapter
```

Internal interface:

```text
AIAnalysisGateway
```

### 7.3 Adapter Responsibilities

The adapter is responsible for:

- prompt template loading
- model selection
- Messages API request creation
- structured output instructions
- response parsing
- JSON extraction
- schema validation
- retry behavior for recoverable failures
- token usage logging
- cost estimation
- raw response storage or reference
- redaction before prompt submission

The adapter is not responsible for:

- placing orders
- holding broker credentials
- deciding risk approval
- promoting strategies alone
- silently reusing stale AI output

### 7.4 AI Request Contract

Example internal request:

```json
{
  "analysis_type": "NEWS_EVENT_ASSESSMENT",
  "prompt_template_id": "uuid",
  "model": "claude-selected-model",
  "input_references": [
    {
      "type": "NEWS_CLUSTER",
      "id": "uuid"
    }
  ],
  "output_schema_version": "news_event_assessment.v1",
  "max_tokens": 2000,
  "temperature": 0,
  "requested_at": "2026-07-27T00:00:00Z"
}
```

Rules:

- production analysis must use approved prompt templates
- temperature should be conservative for classification tasks
- prompts must not contain secrets
- input data freshness must be visible

### 7.5 AI Response Contract

Example normalized response:

```json
{
  "schema_valid": true,
  "analysis_type": "NEWS_EVENT_ASSESSMENT",
  "asset_impacts": [
    {
      "asset_id": "uuid",
      "event_type": "EARNINGS",
      "sentiment": "POSITIVE",
      "impact_score": 0.68,
      "confidence": 0.74,
      "time_horizon": "SHORT",
      "evidence": ["..."],
      "risks": ["..."],
      "contradictions": [],
      "requires_review": false
    }
  ],
  "raw_payload_id": "uuid",
  "token_usage": {
    "input": 1000,
    "output": 600
  }
}
```

Rules:

- schema invalid output is rejected
- low confidence output may be stored but not used for order approval
- `requires_review = true` blocks automatic usage
- contradictions reduce confidence or trigger review

### 7.6 Claude API Verification Checklist

Before production AI-assisted operation:

1. Messages API request format
2. model availability
3. rate limits
4. timeout behavior
5. retryable error types
6. token counting method
7. cost logging
8. structured output reliability
9. schema validation failure handling
10. data retention and privacy settings
11. prompt caching applicability
12. batch processing applicability

## 8. Internal API Standards

Internal APIs must use explicit contracts.

Required response envelope:

```json
{
  "ok": true,
  "result": {},
  "error": null,
  "metadata": {
    "request_id": "uuid",
    "created_at": "2026-07-27T00:00:00Z"
  }
}
```

Error response:

```json
{
  "ok": false,
  "result": null,
  "error": {
    "code": "BROKER_RATE_LIMITED",
    "message": "Rate limit exceeded",
    "retryable": true,
    "severity": "WARNING"
  },
  "metadata": {
    "request_id": "uuid",
    "created_at": "2026-07-27T00:00:00Z"
  }
}
```

## 9. Error Taxonomy

Standard error categories:

```text
AUTHENTICATION_ERROR
AUTHORIZATION_ERROR
RATE_LIMITED
TIMEOUT
NETWORK_ERROR
PROVIDER_UNAVAILABLE
INVALID_REQUEST
INVALID_RESPONSE
SCHEMA_VALIDATION_FAILED
UNSUPPORTED_CAPABILITY
STALE_DATA
UNKNOWN_ORDER_STATE
BROKER_REJECTED_ORDER
INSUFFICIENT_FUNDS
INSUFFICIENT_QUANTITY
RISK_BLOCKED
KILL_SWITCH_ACTIVE
CONFIGURATION_ERROR
SECRET_MISSING
INTERNAL_ERROR
```

Errors must include:

- provider
- operation
- retryable
- severity
- user-visible safe message
- internal diagnostic reference

## 10. Retry Policy

### 10.1 Safe to Retry

Generally safe:

- market data reads
- account reads
- news searches
- order status queries
- fill queries
- Claude analysis requests when idempotent and not duplicated in downstream use

### 10.2 Dangerous to Retry

Dangerous:

- order submission
- order cancellation
- order replacement
- cash reservation
- strategy promotion

Dangerous operations require idempotency keys, persisted command records, and reconciliation.

### 10.3 Retry Rules

Rules:

- use exponential backoff with jitter
- cap maximum attempts
- log every retry
- stop on non-retryable errors
- never retry order submission blindly
- after ambiguous order submission, query broker state before next action

## 11. Rate Limit and Budget Management

The system must track API usage.

For each provider:

- calls per minute
- calls per day
- failed calls
- rate limited calls
- retry count
- latency
- Claude token usage
- Claude estimated cost

Policies:

- Naver collection must respect daily search API limits.
- Claude analysis must use caching where appropriate.
- Repeated analysis of unchanged news clusters should be avoided.
- Broker API rate limiting must reduce trading activity, not create rushed retries.

## 12. Authentication and Secret Management

Secrets:

- Toss API credentials
- Naver client ID
- Naver client secret
- Claude API key

Storage rules:

- use environment variables or secret manager
- never commit secrets
- never put secrets in config files tracked by Git
- never send secrets to Claude
- redact secrets from logs
- separate development, test, and production credentials
- rotate credentials periodically

## 13. API Logging

Every external API call should create a safe log record.

Log fields:

- provider
- operation
- request id
- success
- latency
- retry count
- normalized error code
- rate limited flag
- raw payload reference if stored
- timestamp

Do not log:

- authorization headers
- access tokens
- refresh tokens
- full account identifiers unless required and protected
- API keys

## 14. Raw Payload Storage

Raw payloads are useful for debugging and audit, but they must be controlled.

Rules:

- redact secrets before storage
- store raw broker order responses used in production
- store AI responses used in production decisions
- store news payloads where useful for reproducibility
- use object storage for large payloads if needed
- link raw payloads to normalized domain records

## 15. Adapter Test Strategy

Each adapter requires:

- contract tests
- fixture-based parsing tests
- error normalization tests
- timeout tests
- rate limit tests
- authentication failure tests
- schema validation tests
- idempotency tests for write operations
- mock provider tests
- live sandbox or small-scope verification where available

No adapter should be considered production-ready only because it works once manually.

## 16. API Capability Registry

The system should maintain an API capability registry.

Purpose:

- track verified provider behavior
- prevent unverified features from being used
- document date and method of verification
- support future provider changes

Example:

```json
{
  "provider": "TOSS_SECURITIES",
  "capability": "US_ETF_LIMIT_ORDER",
  "status": "UNVERIFIED",
  "verified_at": null,
  "evidence": null,
  "notes": "Must verify before production use."
}
```

## 17. Internal API Versioning

Internal contracts should include versioning where changes could break components.

Examples:

- `broker_order_request.v1`
- `broker_order_response.v1`
- `news_article.v1`
- `news_event_assessment.v1`
- `ai_health_check.v1`
- `strategy_signal.v1`

Breaking changes require:

- new schema version
- migration strategy
- tests
- changelog entry

## 18. Failure Behavior Matrix

| Failure | Default Behavior |
|---|---|
| Toss auth failure | stop broker operations, raise alert |
| Toss market data stale | block live order approval |
| Toss order submit unknown | reconcile before dependent order |
| Toss order status unavailable | pause related execution, retry status reads |
| Naver API unavailable | pause news-driven signal generation |
| Naver rate limit hit | stop collection until budget resets |
| Claude API unavailable | pause AI-dependent decisions |
| Claude schema invalid | reject analysis |
| Secret missing | fail startup or disable affected integration |
| Rate limit unknown | use conservative throttle |

## 19. API Development Order

Recommended implementation order:

1. define internal interfaces
2. implement safe config and secret loading
3. implement API call logging
4. implement Claude adapter with schema validation
5. implement Naver adapter with fixtures
6. implement Toss read-only methods
7. implement Toss account and position methods
8. implement Toss order status and fill methods
9. implement Toss order submission in mock mode
10. verify order lifecycle with smallest possible scope
11. enable paper trading
12. enable small-capital live trading only after approval

## 20. Open API Questions

Toss Securities:

- exact developer documentation URL and OpenAPI specification location
- authentication flow
- token expiration and refresh behavior
- market data endpoint coverage
- Korean ETF order support
- U.S. ETF order support
- fractional order support
- extended-hours support
- fee estimate support
- tax estimate support
- stable client order id or idempotency support
- partial fill representation
- test environment availability

Naver:

- exact daily limit for current account and product configuration
- production quota increase process
- best query strategy for stock symbols and company names
- U.S. stock news coverage quality
- duplicate article handling

Claude:

- selected model for each analysis type
- rate limit tier
- token budget
- data retention settings
- prompt caching strategy
- batch processing strategy

## 21. Final API Statement

External APIs are powerful but unstable boundaries.

The system must never let provider-specific behavior leak into trading logic, and it must never let AI or news APIs bypass broker safety controls.

The safe pattern is:

```text
External API
-> Adapter
-> Normalized Contract
-> Validation
-> Domain Model
-> Deterministic Risk and Approval
-> Broker Adapter
```

Every API integration must be observable, testable, rate-limited, redacted, and reversible where possible.

