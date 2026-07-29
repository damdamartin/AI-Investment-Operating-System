# Phase 10 Operator Dashboard

Version: 0.1.0
Status: Draft
Last Updated: 2026-07-29
Dashboard: `docs/phase10/operator-dashboard.html`
Related Templates: `docs/phase10/human-evidence-templates/README.md`

## Purpose

`operator-dashboard.html` is a local, browser-only operator dashboard for
the human-facing investment operation workflow.

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

- shows the current operation mode first: read-only / Paper-ready /
  live-trading locked
- shows account summary placeholders without exposing account identifiers,
  balances, or holdings quantities
- shows AI candidate placeholders as review candidates, not orders
- shows today's operator queue
- shows all eight `LCB-*` blockers in a secondary safety board
- links to the four human evidence templates
- lets the operator draft sanitized local notes per blocker
- stores drafts only in browser `localStorage`
- exports a local JSON draft with `liveBrokerWriteAllowed: false`

## What It Does Not Do

- no Toss API calls
- no order submission, order cancellation, or order replacement
- no transfer, withdrawal, or currency conversion
- no `.env` or `tmp/phase5` reads
- no account numbers, credentials, raw broker payloads, balances, or
  holdings quantities
- no blocker is marked `RESOLVED`

The canonical blocker register remains
`docs/phase7/live-capable-blocker-register.md`, and only a human may
update it.
