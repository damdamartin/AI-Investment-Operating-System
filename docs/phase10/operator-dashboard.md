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

## How To Open

Open this file in a browser:

```text
docs/phase10/operator-dashboard.html
```

The dashboard works as a static file. It does not require a dev server.

## What It Does

- shows the current operation mode first
- lets the user choose incident behavior: pause, conservative operation,
  or human review for full liquidation
- lets the user choose profit behavior: protect cash, review partial
  withdrawal, or review reinvestment
- lets the user record a daily withdrawal target as an operating target,
  without executing transfers, withdrawals, or sell orders
- includes settings for broker provider selection: Toss Securities,
  Korea Investment Securities, or both
- includes settings for AI provider/model policy selection
- includes a future user/login configuration section, kept disabled as an
  execution feature until legal/security review exists
- imports a user-selected sanitized JSON file for account summary,
  signals, and operator queue placeholders
- shows account summary placeholders without exposing account identifiers,
  balances, or holdings quantities
- shows news/AI candidate placeholders as review candidates, not orders
- shows today's operator queue and the remaining live-trading blockers
- stores drafts only in browser `localStorage`
- exports a local JSON draft with `liveBrokerWriteAllowed: false`

Example import file:

```text
docs/phase10/operator-dashboard.sample.json
```

## What It Does Not Do

- no Toss API calls
- no order submission, order cancellation, or order replacement
- no transfer, withdrawal, or currency conversion
- no `.env` or `tmp/phase5` reads
- no account numbers, credentials, raw broker payloads, balances, or
  holdings quantities
- no blocker is marked `RESOLVED`
- no withdrawal or transfer execution
- no actual Google login or member signup
- no raw broker or AI API key storage

The canonical blocker register remains
`docs/phase7/live-capable-blocker-register.md`, and only a human may
update it.

This dashboard is for the project owner's personal operation. Settings
may describe future invited users, but the current static dashboard is
not a public SaaS product and is not designed to manage other people's
money.
