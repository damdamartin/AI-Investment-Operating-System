# Incident Runbooks

Version: 0.4.40
Status: Draft
Last Updated: 2026-07-28
Related Docs: ../09_Operation_Deployment.md, ../11_AI_RULES.md

## Core Incident Rule

Prefer no trade over uncertain trade.

If broker state, order state, data state, AI state, or safety state is uncertain, trading remains paused until the relevant verification gate passes.

## Broker API Failure

Trading Safety State: BLOCKED for broker-dependent trading.

Symptoms:

- Toss Securities API unavailable.
- Authentication or token refresh failures.
- Repeated timeout or 5xx responses.
- Broker account snapshot cannot be read.

Immediate Action:

- Stop broker-dependent jobs.
- Block new order approvals and broker write commands.
- Preserve API usage logs and alert payloads.
- Do not retry aggressively.

Investigation:

- Check provider status and maintenance notices.
- Review recent auth, rate limit, and latency records.
- Verify whether read-only account access still works.
- Check whether any order submission was in progress.

Recovery:

- Restore read-only broker access first.
- Run reconciliation.
- Confirm no unknown order state remains.
- Resume only after broker access and reconciliation are clean.

Postmortem Notes:

- Record start/end time, provider behavior, affected jobs, order exposure, and follow-up actions.

## Unknown Order State

Trading Safety State: BLOCKED.

Symptoms:

- Order submission returned unknown status.
- Network error after order request.
- Broker order state cannot be confirmed.
- Internal order state and broker state diverge.

Immediate Action:

- Stop dependent orders for the same account, strategy, and asset.
- Activate or maintain kill switch if capital is at risk.
- Do not submit corrective trades.
- Preserve idempotency key, request id, and outbox event id.

Investigation:

- Query broker order status through read-only API.
- Check outbox, execution simulation, and audit records.
- Verify duplicate order risk.
- Identify whether fills occurred.

Recovery:

- Resolve broker order status through reconciliation.
- Apply confirmed fills once through fill processing.
- Cancel only through approved cancel workflow when policy allows.
- Resume only after state is known and reconciliation is clean.

Postmortem Notes:

- Record cause, order ids, affected capital, reconciliation result, and prevention action.

## Reconciliation Mismatch

Trading Safety State: BLOCKED when mismatch severity is high, critical, stale, or unknown.

Symptoms:

- Internal positions do not match broker positions.
- Internal cash does not match broker cash.
- Missing internal or broker records.
- Reconciliation report is stale.

Immediate Action:

- Pause trading-dependent flows.
- Preserve reconciliation report.
- Do not auto-fix by placing trades.
- Notify operator for severe mismatch.

Investigation:

- Compare latest broker snapshot and internal ledger.
- Check recent fills, cancellations, and outbox events.
- Verify data freshness.
- Determine whether mismatch is timing-related or persistent.

Recovery:

- Refresh read-only broker snapshots.
- Apply confirmed fills idempotently.
- Re-run reconciliation workflow.
- Resume only when reconciliation no longer blocks trading.

Postmortem Notes:

- Record mismatch type, affected symbols, root cause, and control improvement.

## Claude API Failure

Trading Safety State: PAUSED for AI-dependent flows.

Symptoms:

- Claude API unavailable.
- Repeated schema validation failures.
- High latency or timeout.
- Cost or token budget anomaly.

Immediate Action:

- Pause AI-dependent signal generation and strategy research.
- Do not reuse stale Claude responses for new decisions.
- Preserve validation failure records.
- Continue deterministic non-AI checks only if policy allows.

Investigation:

- Review API usage monitor records.
- Check schema version and prompt template version.
- Inspect validation errors and recent model changes.
- Review AI Health Check status.

Recovery:

- Restore schema-valid Claude responses.
- Re-run failed analyses if inputs are still fresh.
- Confirm AI Health Check is green or acceptable.
- Resume AI-dependent flows only after validation passes.

Postmortem Notes:

- Record prompt/template version, failure examples, cost impact, and mitigation.

## Naver API Failure

Trading Safety State: PAUSED for news-driven flows.

Symptoms:

- Naver News API unavailable.
- Rate limit exceeded.
- News collection returns empty or malformed data.
- News data freshness degrades.

Immediate Action:

- Pause news-driven signal generation.
- Stop collection until rate limit budget recovers.
- Do not treat cached old news as fresh.
- Preserve API usage and data quality reports.

Investigation:

- Check Naver API status, credentials, and rate limit counters.
- Review query volume and scheduler frequency.
- Check normalized news event freshness.
- Identify affected markets and strategies.

Recovery:

- Restore valid news collection.
- Re-run normalization and data quality monitor.
- Resume only news-dependent flows whose data is fresh.

Postmortem Notes:

- Record limit usage, affected queries, stale period, and throttling change.

## Kill Switch Activation

Trading Safety State: BLOCKED in kill switch scope.

Symptoms:

- Operator activates kill switch.
- Automatic safety rule activates kill switch.
- Active kill switch appears in trading gate.
- Broker write guard rejects commands due to kill switch.

Immediate Action:

- Stop new order approvals in affected scope.
- Stop trading-related scheduled jobs in affected scope.
- Preserve activation audit record.
- Notify operator immediately.

Investigation:

- Identify actor, reason, scope, and activation time.
- Review related alerts, reconciliation, data quality, and broker state.
- Confirm whether open orders require separate approved cancellation workflow.

Recovery:

- Resolve the underlying incident.
- Verify reconciliation, data quality, risk state, and broker state.
- Deactivation requires explicit actor, reason, and audit metadata.
- Resume only after kill switch is inactive and all gates pass.

Postmortem Notes:

- Record trigger, duration, blocked actions, recovery approval, and prevention action.
