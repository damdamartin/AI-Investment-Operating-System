# 09 Operation Deployment

Version: 0.2.0
Status: Draft
Last Updated: 2026-07-28
Related Docs: 02_System_Architecture.md, 04_Database_Architecture.md, 05_API_Architecture.md, 06_AI_Architecture.md, 07_Trading_System.md, 08_Testing_Validation.md, 10_Claude_Code_Guide.md, 11_AI_RULES.md, 13_Compliance_and_Legal_Review.md

## 1. Document Purpose

This document defines production operation and deployment architecture for AI Investment Operating System.

It covers cloud runtime assumptions, environment strategy, deployment, monitoring, logging, alerting, dashboard operations, incident response, secrets management, backup, disaster recovery, and operational runbooks.

The central operating principle is:

> The system should run without the user's personal computer being on, and it should stay quiet unless something needs attention.

## 2. Operational Goals

The system must:

- run reliably in a cloud or always-on environment
- monitor market, strategy, order, broker, AI, and infrastructure state
- notify the user only for exceptions by default
- expose current status through dashboard
- preserve full audit trail
- protect secrets
- recover safely after failures
- stop trading when state is uncertain
- support controlled deployment and rollback

## 3. Target Runtime Architecture

Recommended production shape:

```text
Cloud Environment
|
|-- Web Dashboard
|-- Application API
|-- Scheduler
|-- Worker Processes
|-- Queue or Job System
|-- PostgreSQL Database
|-- Secret Manager
|-- Monitoring and Logs
|-- Backup Storage
```

The user's laptop may be used for development, but live automated operation should run in an always-on environment.

## 4. Environment Strategy

Required environments:

```text
local
development
staging
production
```

### 4.1 Local

Purpose:

- development
- unit tests
- mocked integration tests
- documentation work

Rules:

- no production secrets
- no live broker writes by default
- mock APIs preferred

### 4.2 Development

Purpose:

- shared integration testing
- adapter testing with non-production credentials where available
- early dashboard testing

Rules:

- isolated database
- no production capital
- limited API keys

### 4.3 Staging

Purpose:

- production-like validation
- paper trading
- final release verification

Rules:

- production-like configuration
- no unrestricted live orders
- may support tightly controlled broker verification

### 4.4 Production

Purpose:

- live operation
- small-capital live
- production trading

Rules:

- protected secrets
- full monitoring
- full audit
- backup enabled
- kill switch enabled
- deployment rollback available

## 5. Deployment Architecture

Recommended services:

- API service
- dashboard service
- scheduler service
- trading worker
- news worker
- AI analysis worker
- reconciliation worker
- health check worker
- alert worker

```text
Scheduler
  -> creates jobs

Workers
  -> process jobs
  -> update database
  -> emit events

Dashboard/API
  -> reads status
  -> exposes controls
```

Trading workers must be isolated from dashboard write actions.

## 6. Scheduler Policy

Scheduled jobs:

- market calendar refresh
- asset universe refresh
- market data collection
- account synchronization
- news collection
- AI event analysis
- signal generation
- reconciliation
- AI Health Check
- backup verification
- metric aggregation

Rules:

- jobs must be idempotent where possible
- overlapping jobs must be controlled
- missed jobs must be visible
- trading jobs must check market calendar
- trading jobs must check kill switch state
- trading jobs must stop when required data is stale

## 7. Queue and Worker Policy

Workers should process jobs through a queue or equivalent controlled job system.

Required job metadata:

- job id
- job type
- input reference
- scheduled time
- started time
- completed time
- status
- retry count
- error code

Rules:

- dangerous jobs require idempotency
- order submission jobs must not be blindly retried
- failed jobs must be visible
- repeated failures may trigger alert

## 8. CI/CD Strategy

Deployment pipeline should include:

```text
code pushed
-> formatting
-> linting
-> type checks
-> unit tests
-> integration tests
-> schema validation tests
-> migration tests
-> secret scanning
-> build
-> staging deploy
-> smoke tests
-> production approval
-> production deploy
```

Live broker write tests must not run automatically in normal CI.

Production deployment must be blocked if:

- critical tests fail
- migrations fail
- secret scan fails
- trading regression tests fail
- AI boundary tests fail
- kill switch tests fail

## 9. Release Strategy

Release types:

```text
documentation release
backend release
dashboard release
strategy release
risk policy release
infrastructure release
```

Strategy and risk policy releases require stricter review than dashboard read-only changes.

Production release checklist:

- changelog updated
- tests passed
- migration plan reviewed
- rollback plan exists
- monitoring dashboards healthy
- no unresolved critical incidents
- kill switch available

## 10. Monitoring

Monitoring must cover:

- system uptime
- scheduler health
- worker health
- queue backlog
- database health
- API latency
- API errors
- Toss API status
- Naver API status
- Claude API status
- order submission results
- order status uncertainty
- reconciliation mismatches
- strategy performance
- risk limit state
- AI Health Check status
- cost and token usage

Minimum dashboard status:

```text
System: OK / Warning / Error / Blocked
Trading: Enabled / Paused / Blocked
Kill Switch: Active / Inactive
Broker: OK / Degraded / Down
Data Freshness: Fresh / Stale
Reconciliation: Clean / Mismatch / Unknown
AI Health: Green / Yellow / Red / Blocked
Alerts: Open count
```

## 11. Logging

Logs must be structured.

Required log fields:

- timestamp
- level
- service
- environment
- request id
- job id
- portfolio id where safe
- strategy version id where applicable
- asset id where applicable
- event type
- error code

Forbidden in logs:

- API keys
- access tokens
- refresh tokens
- authorization headers
- account passwords
- certificate data
- unredacted sensitive identifiers

Log levels:

```text
DEBUG
INFO
WARNING
ERROR
CRITICAL
```

Production should minimize DEBUG logs unless diagnosing an incident.

## 12. Alerting Policy

The system should be quiet during normal operation.

Default no push/email alert for:

- normal buy
- normal sell
- normal fill
- normal daily profit
- normal daily loss within limits
- routine health check green

Alert for:

- API authentication failure
- broker unavailable
- order submission failure
- unknown broker order state
- reconciliation mismatch
- duplicate order risk
- kill switch activation
- daily loss limit breach
- monthly loss limit breach
- maximum drawdown breach
- stale market data affecting trading
- AI Health Check red or blocked
- repeated Claude schema failures
- database backup failure
- production worker down

Alert severity:

```text
INFO
WARNING
ERROR
CRITICAL
```

Only `ERROR` and `CRITICAL` should generally trigger immediate notification.

## 13. Dashboard Operations

Dashboard must provide:

- system status
- portfolio summary
- strategy status
- risk status
- order status
- reconciliation status
- AI Health Check
- alerts
- audit log access
- kill switch controls

Dashboard must not:

- bypass Order Approval Engine
- allow raw broker API calls
- expose secrets
- allow unaudited strategy changes
- hide critical alerts

Critical controls require confirmation:

- activate kill switch
- deactivate kill switch
- change risk limits
- promote strategy
- increase capital allocation
- enable production mode

### 13.1 Minimum Dashboard Security Requirements

The dashboard is an operational control surface, not only a reporting screen.

Minimum requirements:

- authenticated access is required
- production dashboard access is not public
- read-only views and sensitive controls use separate permissions
- sensitive controls require re-authentication or step-up confirmation
- all sensitive actions create audit records
- kill switch actions are logged with actor, time, reason, and resulting state
- strategy promotion actions are logged with evidence references
- capital allocation increases require explicit confirmation
- production mode enablement requires all readiness gates to be green
- broker account identifiers are masked
- secrets are never displayed

Sensitive actions include:

- activating or deactivating kill switch
- enabling live trading
- linking a portfolio to a BrokerAccount
- changing risk limits
- changing capital allocation
- promoting a strategy
- retiring a production strategy
- rotating or validating broker credentials

If authentication or authorization state is uncertain, the dashboard must fail closed for sensitive actions.

## 14. Secrets Management

Secrets include:

- Toss Securities API credentials
- Naver client ID
- Naver client secret
- Claude API key
- database password
- alert provider credentials

Rules:

- store secrets in secret manager or secure environment variables
- no secrets in Git
- no secrets in logs
- no secrets in Claude prompts
- separate secrets by environment
- rotate secrets periodically
- restrict access by role
- audit secret access where possible

If a secret is suspected leaked:

```text
activate affected integration pause
rotate secret
review logs and audit
resume only after validation
```

## 15. Backup Policy

Minimum requirements:

- daily database backups
- point-in-time recovery where available
- encrypted backups
- backup retention policy
- periodic restore test
- backup failure alerts

Critical data:

- strategy versions
- risk limits
- order approvals
- broker orders
- fills
- positions
- cash balances
- audit records
- domain events
- AI analyses used in decisions

Backups are not useful until restore has been tested.

## 16. Disaster Recovery

Recovery scenarios:

- cloud service outage
- database failure
- worker crash
- failed deployment
- corrupted migration
- broker API outage
- unknown order state
- secret compromise
- data provider outage

Recovery principle:

> After a serious failure, trading remains disabled until state is reconciled.

Recovery steps:

```text
stop trading
preserve logs
identify affected components
restore or rollback
reconcile broker state
verify database consistency
run health checks
reactivate only after approval
```

## 17. Incident Response

Incident severity:

```text
SEV1: capital at risk or uncontrolled order risk
SEV2: trading disabled or broker state uncertain
SEV3: degraded data, AI, or dashboard function
SEV4: minor issue without trading impact
```

SEV1 examples:

- duplicate live order
- unknown broker state after submit
- kill switch failure
- risk engine unavailable during live trading
- unauthorized production config change

Every incident must record:

- start time
- severity
- affected component
- impact
- mitigation
- root cause
- follow-up action

## 18. Operational Runbooks

Required runbooks:

- activate global kill switch
- deactivate kill switch
- handle unknown broker order state
- handle duplicate order risk
- handle Toss API outage
- handle Naver API outage
- handle Claude API outage
- handle stale market data
- handle reconciliation mismatch
- rotate API secret
- restore database backup
- rollback deployment
- pause strategy
- retire strategy
- increase capital limit

Runbooks should be short, explicit, and executable under stress.

## 19. Production Startup Checklist

Before production startup:

1. database reachable
2. migrations applied
3. secrets loaded
4. Toss read APIs healthy
5. Toss order capability verified for enabled markets
6. Naver API healthy
7. Claude API healthy
8. market calendar loaded
9. asset universe loaded
10. risk limits active
11. kill switch available
12. reconciliation clean
13. alert channel working
14. dashboard status visible
15. backups enabled

If any critical item fails, production trading remains disabled.

## 20. Production Shutdown Checklist

Before planned shutdown:

1. stop new signal generation
2. stop new order approvals
3. check open orders
4. cancel open orders if policy requires
5. reconcile positions and cash
6. create final portfolio snapshot
7. record audit event
8. verify no worker is mid-order-submit

## 21. Configuration Management

Configuration categories:

- environment config
- market config
- API config
- risk config
- strategy config
- alert config
- schedule config

Rules:

- risk config is versioned
- strategy config is tied to strategy version
- production config changes are audited
- dangerous changes require review
- defaults are conservative

## 22. Access Control

Initial roles:

```text
OWNER
OPERATOR
VIEWER
SYSTEM
```

OWNER:

- all controls
- secret management
- production enablement

OPERATOR:

- view status
- activate kill switch
- acknowledge alerts
- run reconciliation

VIEWER:

- read-only dashboard

SYSTEM:

- scheduled jobs and automated actions

Sensitive actions must be audited.

## 23. Cost Monitoring

Track:

- cloud compute cost
- database cost
- storage cost
- backup cost
- Claude API cost
- Naver API usage
- Toss API usage if applicable
- alert provider cost

Alerts:

- Claude cost spike
- abnormal API retry volume
- storage growth spike
- database cost spike

## 24. Operational Metrics

Key metrics:

- orders submitted
- orders failed
- orders unknown
- reconciliation mismatches
- duplicate order blocks
- risk blocks
- kill switch activations
- API latency
- API failure rate
- AI schema failure rate
- strategy drawdown
- portfolio drawdown
- queue backlog
- worker failures

Metrics should be visible in dashboard or monitoring tools.

## 25. Open Operation Questions

Open questions:

- Which cloud provider will host production?
- Which queue system will be used?
- Which monitoring system will be used?
- Which alert channel will be used first?
- How will dashboard authentication be implemented?
- What is the first production database hosting option?
- What is the production backup retention period?
- How often should full restore drills run?
- What is the exact small-capital live operating schedule?

## 26. Final Operation Statement

Operation is not an afterthought.

The system can only trade automatically if it can also:

- observe itself
- explain itself
- stop itself
- recover itself
- alert only when needed
- preserve evidence

An automated trading system that cannot be operated safely should not be allowed to trade.
