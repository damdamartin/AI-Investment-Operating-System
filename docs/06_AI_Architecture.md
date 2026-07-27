# 06 AI Architecture

Version: 0.1.0  
Status: Draft  
Last Updated: 2026-07-27  
Related Docs: 01_Project_Vision.md, 02_System_Architecture.md, 03_Domain_Model.md, 04_Database_Architecture.md, 05_API_Architecture.md, 07_Trading_System.md, 08_Testing_Validation.md, 11_AI_RULES.md

## 1. Document Purpose

This document defines how AI is used inside AI Investment Operating System.

It focuses on Claude API, structured analysis, AI safety boundaries, news and event interpretation, strategy research, Strategy Diversity Engine, Shadow Portfolio, AI Health Check, continuous learning, and failure handling.

The central rule is:

> AI is an analyst, researcher, and auditor. AI is not the trader.

## 2. AI Design Goals

AI components must improve understanding and research without weakening execution safety.

AI should help the system:

- interpret news and events
- explain market and strategy behavior
- detect contradictions and uncertainty
- generate candidate strategy ideas
- analyze performance degradation
- compare strategies
- produce health check summaries
- support documentation and review

AI must not:

- call Toss Securities Open API
- place orders
- approve orders
- bypass Risk Engine
- bypass Money Management Engine
- bypass Order Approval Engine
- promote strategies without validation
- hide uncertainty
- treat one news article as sufficient trading evidence

## 3. AI Boundary

AI is separated from trading execution by hard architectural boundaries.

```text
Claude API
-> ClaudeAIAdapter
-> Structured AIAnalysis
-> Validation
-> Decision Engines
-> Risk Engine
-> Money Management Engine
-> Order Approval Engine
-> Toss Securities Adapter
```

Forbidden path:

```text
Claude API
-> Toss Securities API
```

AI never receives broker credentials, account secrets, access tokens, or direct execution authority.

## 4. AI Roles

### 4.1 Analyst

The analyst role interprets existing information.

Tasks:

- summarize news
- classify event type
- estimate possible impact
- detect positive and negative evidence
- identify uncertainty
- produce structured explanations

### 4.2 Researcher

The researcher role proposes and compares strategy ideas.

Tasks:

- generate candidate strategies
- suggest parameter changes
- analyze historical performance
- compare strategy families
- detect overfitting risk
- propose validation plans

### 4.3 Auditor

The auditor role evaluates whether the system is behaving correctly.

Tasks:

- run AI Health Check
- detect strategy drift
- identify abnormal order failure rates
- explain drawdowns
- compare live performance against backtest expectations
- flag suspicious API or data behavior

### 4.4 Documentation Assistant

The documentation role helps maintain system documents.

Tasks:

- draft architecture text
- summarize decisions
- generate development task descriptions
- support review checklists

Documentation assistance does not grant authority over production behavior.

## 5. Claude API Usage

Claude API is accessed only through:

```text
ClaudeAIAdapter
```

The adapter must:

- use approved prompt templates
- specify intended output schema
- validate structured output
- log token usage
- estimate cost
- store or reference raw responses where needed
- reject invalid output
- avoid sending secrets

Recommended use of Claude:

- low-temperature classification for structured analysis
- separate prompts for different analysis types
- explicit uncertainty fields
- explicit evidence and contradiction fields
- schema versioning
- prompt template versioning

## 6. Prompt Template Architecture

Prompts must be versioned.

Prompt template fields:

```text
prompt_template_id
name
version
purpose
input_contract
output_schema
system_instructions
user_template
safety_rules
created_at
status
```

Prompt template statuses:

```text
DRAFT
ACTIVE
RETIRED
BLOCKED
```

Rules:

- production AI workflows may use only `ACTIVE` templates
- changing a prompt requires a new version
- prompt changes used in production decisions must be auditable
- prompt output schemas must be tested with fixtures
- prompts must include explicit instruction to report uncertainty

## 7. Structured Output Standards

Claude outputs must be parsed into structured JSON-compatible records.

Free-form prose alone is not acceptable for trading-relevant decisions.

Every production-relevant AI output must include:

- schema version
- analysis type
- confidence
- evidence
- risks
- contradictions
- freshness indicator
- requires_review flag

If parsing or validation fails, the output is rejected.

## 8. News Event Assessment Schema

Example schema:

```json
{
  "schema_version": "news_event_assessment.v1",
  "analysis_type": "NEWS_EVENT_ASSESSMENT",
  "news_cluster_id": "uuid",
  "asset_impacts": [
    {
      "asset_id": "uuid",
      "market": "KR",
      "event_type": "EARNINGS",
      "sentiment": "POSITIVE",
      "impact_score": 0.0,
      "confidence": 0.0,
      "time_horizon": "SHORT",
      "evidence": [],
      "risks": [],
      "contradictions": [],
      "already_priced_in_risk": "UNKNOWN",
      "requires_review": false
    }
  ],
  "overall_summary": "",
  "unknowns": []
}
```

Allowed sentiment values:

```text
POSITIVE
NEGATIVE
MIXED
NEUTRAL
UNKNOWN
```

Allowed time horizons:

```text
INTRADAY
SHORT
MEDIUM
LONG
UNKNOWN
```

Rules:

- `UNKNOWN` sentiment cannot increase a trading score
- low confidence cannot increase a trading score
- `requires_review = true` blocks automatic use
- stale or unclear news cannot create a signal alone

## 9. Strategy Research Schema

Example schema:

```json
{
  "schema_version": "strategy_research.v1",
  "analysis_type": "STRATEGY_RESEARCH",
  "strategy_family": "MOMENTUM",
  "hypothesis": "",
  "target_markets": ["KR", "US"],
  "target_asset_types": ["STOCK", "ETF"],
  "entry_logic": [],
  "exit_logic": [],
  "risk_controls": [],
  "required_data": [],
  "expected_failure_modes": [],
  "overfitting_risks": [],
  "validation_plan": {
    "backtest_required": true,
    "walk_forward_required": true,
    "shadow_portfolio_required": true,
    "paper_trading_required": true
  },
  "promotion_recommendation": "RESEARCH_ONLY"
}
```

Allowed promotion recommendations:

```text
RESEARCH_ONLY
READY_FOR_BACKTEST
NEEDS_MORE_DATA
REJECT
```

AI cannot recommend direct production promotion.

## 10. AI Health Check Schema

Example schema:

```json
{
  "schema_version": "ai_health_check.v1",
  "analysis_type": "AI_HEALTH_CHECK",
  "period_start": "2026-07-27T00:00:00Z",
  "period_end": "2026-07-27T23:59:59Z",
  "status": "GREEN",
  "summary": "",
  "strategy_findings": [],
  "execution_findings": [],
  "risk_findings": [],
  "api_findings": [],
  "data_quality_findings": [],
  "cost_findings": [],
  "recommended_actions": [],
  "requires_trading_pause": false,
  "requires_human_review": false
}
```

Allowed statuses:

```text
GREEN
YELLOW
RED
BLOCKED
```

Rules:

- AI may recommend a pause
- deterministic operating policy decides whether to enforce pause
- `BLOCKED` status must trigger an operational alert

## 11. News Analysis Pipeline

```text
Naver News API
-> NaverNewsAdapter
-> normalized articles
-> deduplication
-> news clustering
-> symbol mapping
-> Claude event assessment
-> schema validation
-> NewsEvent
-> Strategy Engine input
```

Rules:

- news analysis cannot bypass price, volume, risk, and money checks
- duplicate news does not equal stronger signal
- old resurfaced news must be detected
- ambiguous company matching requires review
- U.S. news coverage from Naver must be measured before relying on it

## 12. Event Classification

Claude may classify event types, but event taxonomy must be controlled by the system.

Initial event taxonomy:

```text
EARNINGS
GUIDANCE
CONTRACT
MERGER_ACQUISITION
REGULATION
LITIGATION
DIVIDEND
BUYBACK
MANAGEMENT_CHANGE
PRODUCT
ACCIDENT
MACRO
SECTOR
OTHER
UNKNOWN
```

Rules:

- unsupported labels from Claude must map to `OTHER` or `UNKNOWN`
- event classification confidence must be stored
- event classification alone must not create an order

## 13. Continuous Learning Architecture

The system must learn from outcomes without mutating production strategy directly.

```text
production results
-> performance analysis
-> AI research
-> candidate strategy versions
-> backtest
-> walk-forward validation
-> Shadow Portfolio
-> Paper Trading
-> small-capital live
-> promotion review
```

AI may propose candidates. It may not skip validation.

## 14. Strategy Diversity Engine

Strategy Diversity Engine prevents overdependence on one idea.

Strategy families:

```text
VALUE
GROWTH
QUALITY
MOMENTUM
DIVIDEND
MEAN_REVERSION
EVENT_DRIVEN
SECTOR_ROTATION
LOW_VOLATILITY
ETF_ALLOCATION
MARKET_DEFENSE
CASH_EXPANSION
```

Responsibilities:

- maintain multiple strategy families
- compare strategy correlations
- detect strategy crowding
- evaluate market regime fit
- prevent recent winners from dominating allocation automatically
- identify complementary strategies
- retire redundant or overfit strategies

Inputs:

- strategy performance
- drawdown
- volatility
- correlation matrix
- market regime
- sector exposure
- asset overlap
- trading cost
- AI analysis

Outputs:

- strategy diversity report
- candidate strategy ideas
- allocation recommendations
- redundancy warnings
- overfit warnings

Rules:

- diversity recommendations are not orders
- allocation changes require Money Management and Risk approval
- recent performance alone cannot justify concentration

## 15. Shadow Portfolio Architecture

Shadow Portfolio allows realistic strategy testing without real capital.

```text
Candidate Strategy
-> Shadow Portfolio
-> simulated signals
-> simulated orders
-> realistic fill model
-> performance record
-> comparison against baseline
```

Shadow Portfolio must model:

- market hours
- tradability
- liquidity
- bid/ask spread
- slippage
- fees
- taxes
- exchange rate
- partial fills
- failed orders
- data latency
- order type restrictions

Rules:

- Shadow Portfolio must not call Toss order endpoints
- Shadow results must be separate from production performance
- Shadow performance must include costs
- Shadow success does not automatically approve production trading

## 16. Strategy Promotion AI Support

Claude may help prepare promotion reviews.

Claude may analyze:

- backtest results
- walk-forward results
- Shadow Portfolio results
- Paper Trading results
- small-capital live results
- baseline comparison
- failure modes
- overfitting signs

Claude may produce:

- promotion summary
- reasons for approval
- reasons against approval
- risk concerns
- recommended next validation stage

Claude may not:

- set strategy status to production active
- override validation failures
- approve risk limit increases
- hide negative evidence

## 17. Performance Degradation Analysis

When a strategy underperforms, AI may analyze:

- market regime change
- increased slippage
- increased transaction costs
- signal decay
- sector rotation
- currency impact
- news model error
- data quality issue
- execution failure
- overfitting

Possible AI outputs:

- keep strategy unchanged
- reduce allocation candidate
- pause candidate
- revise parameters candidate
- create replacement candidate
- retire candidate

Any action affecting production requires deterministic policy and audit trail.

## 18. Overfitting Control

AI must actively look for overfitting.

Warning signs:

- too many parameters
- strategy works only in one short period
- strategy works only for one sector
- small parameter changes destroy performance
- performance disappears after costs
- strong backtest but weak Shadow Portfolio
- strong recent performance but poor long-term robustness
- high overlap with existing strategies

AI strategy research prompts must ask for overfitting risks explicitly.

## 19. AI Cost Management

AI usage must be measured.

Track:

- provider
- model
- prompt template
- analysis type
- input tokens
- output tokens
- estimated cost
- cache hit rate
- retry count
- failed schema validations

Cost controls:

- cache unchanged news clusters
- avoid repeated analysis of same inputs
- use smaller or cheaper model where appropriate after validation
- batch non-urgent analysis if useful
- set daily and monthly AI budget limits
- alert on abnormal cost growth

## 20. AI Data Privacy

Claude prompts must not include:

- Toss API keys
- Naver client secrets
- Claude API keys
- broker access tokens
- account passwords
- certificate data
- unnecessary personal data

Account-level data sent to AI must be minimized.

If portfolio data is needed for analysis, provide only fields required for the task, such as:

- anonymized portfolio id
- asset ids or symbols
- allocation percentages
- return metrics
- risk metrics

## 21. AI Failure Handling

### 21.1 Claude API Unavailable

Default behavior:

- pause AI-dependent analysis
- continue deterministic read-only monitoring where safe
- do not reuse stale AI output as current
- raise alert if outage affects required workflows

### 21.2 Invalid AI Output

Default behavior:

- reject output
- store validation error
- do not use output for trading
- optionally retry with repair prompt if non-production

### 21.3 Low Confidence

Default behavior:

- store analysis
- lower score contribution
- require review if threshold is below policy
- never increase trading conviction from low confidence

### 21.4 Contradictory Analysis

Default behavior:

- reduce confidence
- request additional evidence if needed
- mark `requires_review`
- block automatic trading use where material

### 21.5 Stale AI Output

Default behavior:

- reject for current trading decisions
- keep for historical audit only

## 22. AI Evaluation Standards

AI components must be evaluated.

Evaluation types:

- schema validity rate
- classification accuracy
- contradiction detection quality
- news-event-to-price-impact correlation
- false positive rate
- false negative rate
- prompt regression tests
- cost per useful analysis
- latency
- stability across model versions

AI evaluations must be separate from strategy performance. A profitable strategy does not prove the AI analysis was accurate.

## 23. Model Version Management

Claude model choice is a versioned configuration.

Store:

- provider
- model id
- use case
- prompt template version
- output schema version
- effective date
- evaluation status

Changing models for production workflows requires:

- fixture tests
- schema validation tests
- comparison with previous model outputs
- cost review
- changelog entry

## 24. Human Review Policy

Human review is required for:

- production strategy promotion in early phases
- risk limit increases
- allocation limit increases
- new asset class support
- large capital increase
- AI Health Check `RED` or `BLOCKED` unresolved state
- repeated schema failures
- unexplained strategy drift

Human review should not mean impulsive manual trading. It means controlled system governance.

## 25. AI Development Order

Recommended implementation order:

1. prompt template registry
2. ClaudeAIAdapter
3. output schema validation
4. AI analysis persistence
5. news event assessment
6. AI Health Check
7. strategy performance explanation
8. Strategy Diversity Engine reporting
9. Shadow Portfolio AI analysis
10. strategy candidate generation
11. strategy promotion review support

AI should not be used for live trading decisions until schema validation, persistence, and risk integration are complete.

## 26. Open AI Questions

The following questions remain open:

- Which Claude model should be used for each analysis type?
- What are the cost limits for daily and monthly Claude usage?
- What confidence thresholds should block automatic use?
- How much raw Claude output should be stored?
- Should prompt caching be used for repeated news and strategy analysis?
- Which eval dataset should be built first?
- How should U.S. stock news gaps from Naver be measured?
- When, if ever, can strategy promotion become partially automated?
- What minimum Shadow Portfolio duration is required by strategy family?

## 27. Final AI Statement

AI is valuable because it can interpret complex information, generate hypotheses, and audit system behavior.

AI is dangerous if it becomes an unchecked executor.

Therefore, AI Investment Operating System uses AI inside a controlled structure:

```text
AI observes
AI explains
AI researches
AI audits
AI proposes

Deterministic systems validate
Risk systems approve or reject
Broker adapters execute only approved orders
Audit systems remember everything
```

This structure allows the system to benefit from AI without handing it uncontrolled authority over capital.

