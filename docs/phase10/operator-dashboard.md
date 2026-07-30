# Phase 10 Operator Dashboard

Version: 0.1.0
Status: Draft
Last Updated: 2026-07-29
Dashboard: `docs/phase10/operator-dashboard.html`
Related Templates: `docs/phase10/human-evidence-templates/README.md`

## Purpose

`operator-dashboard.html` is a local, browser-only operator dashboard for
the user's personal AI investment operation workflow.

It exists because the project previously had validators, documents, and
templates, but no visible surface showing the operator what the system
state means.

The target product model is AI-led operation: the system monitors news,
builds AI candidates, selects buy/sell candidates, and eventually runs
orders according to the operator's approved principles. Human intervention
is intended for exceptions such as system errors, kill-switch decisions,
cash target needs, irregular deposits, or changes to the operating principles. The current
dashboard reflects that model while keeping live trading locked.

## How To Open

Open this file in a browser:

```text
docs/phase10/operator-dashboard.html
```

The dashboard works as a static file. It does not require a dev server.

## What It Does

- shows a traffic-light operation status first, including site health,
  error status, and automated-trading status
- provides an operator-facing principles section for the automated trading
  rules applied by this site, adapted from the automated-trading investment
  constitution for the current no-write, stock/ETF-focused version
- shows the principles, minimum first-trade pilot, and settings sections as exclusive pages instead
  of stacking them below the main dashboard
- hides the old live-trading authorization input tab from the operator
  workflow once the required gate evidence has been recorded elsewhere
- provides a simplified minimum-capital first-trade tab where the operator
  checks readiness items while the one limit-order candidate is populated
  automatically from the operator record
- generates a human-executed approved order ticket after the readiness
  checklist is complete; the ticket is a local JSON handoff for manual
  Toss order entry and does not call any broker API
- records the manual Toss execution result, including filled quantity,
  average fill price, reviewer, and notes
- calculates net cash from the execution result with fees/taxes treated as
  unavailable zero estimates and AI token cost automatically set to 10% of
  the filled amount
- provides two additional repeat-validation slots so the operator can run
  two more human-executed trades with local order tickets, execution
  records, and net-cash calculations before any automation review
- lets the user choose operation mode: aggressive, stable, or conservative
- lets the user choose incident behavior: pause activity, full sell
  candidate generation, or partial sell candidate generation
- shows weekly/monthly account status charts: net return rate as a line
  chart and balance as a bar chart
- defines net return as profit after trading fees, taxes, and estimated
  AI token usage costs
- treats brokerage deposits as investment principal, including irregular
  additional deposits
- lets the user record a cash target as an operating target, so the future
  AI operation can generate cash-raising sell candidates without executing
  transfers, withdrawals, or sell orders in this phase
- treats profit as reinvestment by default; cash raising is driven from
  the account status cash-target input
- exports local operational data as an Excel-readable `.xls` file,
  including net return, balance, candidate, simplified minimum first-trade
  records, and future trade-record rows
- includes settings for broker provider selection: Toss Securities,
  Korea Investment Securities, or both
- includes settings for AI provider/model policy selection
- includes a future user/login configuration section, kept disabled as an
  execution feature until legal/security review exists
- shows account summary placeholders without exposing account identifiers,
  balances, or holdings quantities
- shows news/AI candidate placeholders as review candidates, not orders
- stores settings drafts only in browser `localStorage`
- keeps live broker writes disabled with `liveBrokerWriteAllowed: false`

## What It Does Not Do

- no Toss API calls
- no order submission, order cancellation, or order replacement
- no unattended or approval-free broker order transmission
- no transfer, withdrawal, or currency conversion
- no `.env` or `tmp/phase5` reads
- no account numbers, credentials, raw broker payloads, balances, or
  holdings quantities
- no user-selected JSON import
- no blocker is marked `RESOLVED`
- no live-trading authorization tab entry by itself enables broker writes
- no minimum first-trade record submits an order or enables broker writes
- no withdrawal or transfer execution
- no automatic profit-threshold liquidation
- no actual Google login or member signup
- no raw broker or AI API key storage

The canonical blocker register remains
`docs/phase7/live-capable-blocker-register.md`, and only a human may
update it.

This dashboard is for the project owner's personal operation. Settings
may describe future invited users, but the current static dashboard is
not a public SaaS product and is not designed to manage other people's
money.
