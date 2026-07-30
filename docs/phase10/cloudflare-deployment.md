# Cloudflare Deployment Plan

Version: 0.1.0
Status: Deployed
Last Updated: 2026-07-29

## Purpose

This document records the first real web deployment shape for AI Investment
Operating System using the user's existing Cloudflare account.

The deployment is intentionally split:

- Cloudflare Pages hosts the static operator dashboard from `public/`.
- Cloudflare Workers runs a 24-hour monitoring-only scheduler via Cron
  Triggers.

This deployment does not enable live broker writes.

The dashboard is protected by Cloudflare Pages `_worker.js` Basic Auth until
Cloudflare Access can be configured with `Access: Apps and Policies Write`
permissions.

## Deployed Endpoints

- Dashboard: https://ai-investment-operating-system.pages.dev/
- Pages preview deployment:
  https://c75e284f.ai-investment-operating-system.pages.dev/
- Worker: https://ai-investment-operating-system-worker.junkim-life360.workers.dev/
- Worker health:
  https://ai-investment-operating-system-worker.junkim-life360.workers.dev/health
- Worker operation status:
  https://ai-investment-operating-system-worker.junkim-life360.workers.dev/operation-status

Dashboard authentication:

```text
Username: owner
Password source: Cloudflare Pages secret AIOS_DASHBOARD_PASSWORD
```

Deployment account:

```text
junkim.life360@gmail.com
```

Worker version:

```text
5272e1ab-1d38-4ca7-a035-2915e0e42a5e
```

## Deployment Units

### Web Dashboard

Source:

```text
public/index.html
public/_worker.js
public/_routes.json
```

Deploy command:

```text
npm run deploy:cloudflare:pages
```

### 24-Hour Operation Worker

Source:

```text
cloudflare/aios-worker.mjs
cloudflare/wrangler.jsonc
```

The Worker exposes:

- `/health`
- `/operation-status`

It also runs scheduled monitoring heartbeats using Cloudflare Cron
Triggers.

Deploy command:

```text
npm run deploy:cloudflare:worker
```

## Safety Boundary

The Worker always reports:

```text
liveBrokerWriteAllowed: false
```

It does not submit Toss orders, cancel orders, transfer money, withdraw
cash, convert currency, or read local secrets.

Actual live trading still requires the human blocker gates, broker-write
adapter review, secret binding review, kill switch verification, and
reconciliation readiness described elsewhere in Phase 7 through Phase 10.
