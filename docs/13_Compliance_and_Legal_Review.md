# 13 Compliance and Legal Review

Version: 0.2.0
Status: Draft
Last Updated: 2026-07-28
Related Docs: 01_Project_Vision.md, 05_API_Architecture.md, 07_Trading_System.md, 09_Operation_Deployment.md, 11_AI_RULES.md, 99_Development_Roadmap.md

## 1. Document Purpose

This document defines compliance, broker terms, data licensing, tax, and personal-use review requirements for AI Investment Operating System.

It is not legal, tax, or investment advice. It is an architecture gate that prevents the project from moving into live broker write operations before the relevant terms and obligations are reviewed.

## 2. Core Compliance Principle

The system may be technically correct and still be operationally invalid if it violates broker terms, market rules, data licenses, tax obligations, or personal-use boundaries.

Therefore:

> No live broker write operation is allowed until the required compliance and terms review is completed and documented.

## 3. Scope of Review

Before any live order submission, the following must be reviewed:

- Toss Securities Open API terms of use
- Toss account permissions and trading restrictions
- automated trading restrictions
- Korean stock and ETF trading requirements
- U.S. stock and ETF trading requirements
- overseas trading tax and reporting implications
- data provider licensing constraints
- Naver News API usage constraints
- Claude API usage and data handling constraints
- cloud hosting and credential storage risks
- personal-use boundary
- whether any output could be considered investment advice if shared

## 4. Personal-Use Boundary

Initial system scope:

```text
personal automated trading system
```

The system is not initially designed for:

- managing third-party funds
- public trading signals
- paid investment advice
- social trading
- copy trading
- multi-user investment service
- financial advisory product

If any of these use cases are introduced, development must stop for a new compliance review.

## 5. Broker Terms Review

Required questions:

- Does Toss Securities permit the intended API-based automated trading behavior?
- Does Toss distinguish between manual API use, algorithmic trading, and fully automated trading?
- Are there order frequency limits beyond technical API rate limits?
- Are there asset, market, or order type restrictions?
- Are overseas stock/ETF API orders subject to additional requirements?
- Are extended-hours, fractional orders, or automatic currency conversion supported and permitted?
- Does the API support cancellation and replacement in the intended way?
- Are there terms restricting cloud-hosted bots or unattended trading?

Result states:

```text
APPROVED
APPROVED_WITH_LIMITATIONS
REJECTED
UNVERIFIED
```

Default state is `UNVERIFIED`.

Production broker write operations require `APPROVED` or `APPROVED_WITH_LIMITATIONS` with matching system restrictions.

## 6. Data License Review

Required questions:

- Can Naver News API results be stored?
- Can Naver News API results be used for automated analysis?
- Can article metadata be retained long term?
- Can links, titles, and summaries be displayed in dashboard?
- Are there restrictions on redistributing news-derived analysis?
- Can historical market data from the selected provider be stored and used for backtesting?
- Are corporate action data sources licensed for this use?

If data retention is restricted, database retention policy must be updated.

## 7. AI Provider Review

Required questions:

- What data may be sent to Claude API?
- Are account identifiers or portfolio metrics allowed?
- What are provider data retention settings?
- Are there restrictions on automated financial analysis?
- Are prompts and outputs retained by the provider?
- Are additional privacy controls needed?

Default policy:

- no secrets in prompts
- minimal account data
- anonymized portfolio identifiers where possible
- no unnecessary personal information

## 8. Tax and Reporting Review

The system must not claim to provide tax advice.

Before production operation, determine how the system will record:

- Korean stock fees and taxes
- Korean ETF fees and taxes
- U.S. stock fees and taxes
- U.S. ETF fees and taxes
- dividend and distribution taxes
- withholding taxes
- realized gains and losses
- FX gains and losses
- KRW-converted performance

The system may estimate tax impact for internal performance analysis, but official tax reporting must be reviewed separately.

## 9. Compliance Gate for Live Trading

Required before small-capital live trading:

```text
Toss API terms reviewed
broker account permissions reviewed
data licensing reviewed
AI data handling reviewed
tax recording assumptions documented
personal-use boundary confirmed
operator accepts residual risk
```

If any item is `UNVERIFIED`, live broker writes remain blocked.

## 10. Required Records

Compliance review should produce records for:

- review date
- reviewer
- source documents reviewed
- result
- limitations
- required system restrictions
- expiration or next review date

Suggested future table:

```text
compliance_reviews
```

Suggested fields:

```text
id
review_type
subject
status
reviewed_sources
limitations
required_controls
reviewed_at
reviewed_by
next_review_at
```

## 11. Re-Review Triggers

Compliance must be re-reviewed when:

- Toss API terms change
- Naver API terms change
- Claude API terms change
- new broker is added
- new data provider is added
- new asset class is added
- third-party users are introduced
- public signals are introduced
- capital size materially increases
- system is deployed in a new jurisdiction
- tax handling assumptions change

## 12. Final Compliance Statement

Compliance is a production gate, not paperwork.

If broker terms, data rights, AI data handling, tax recording, or personal-use boundaries are unclear, the system must remain in research, backtest, Shadow Portfolio, or Paper Trading mode.

