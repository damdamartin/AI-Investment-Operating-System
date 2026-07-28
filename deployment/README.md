# Deployment Skeleton

Version: 0.4.41
Status: Draft
Last Updated: 2026-07-28

## Purpose

This folder contains the first deployment environment skeleton for AI Investment Operating System.

It does not provision cloud infrastructure and it does not enable live trading.

## Environments

- `local.env.example` - local development with mock or placeholder credentials
- `test.env.example` - automated tests without real external API credentials
- `staging.env.example` - production-like validation with live trading disabled
- `production.env.example` - production runtime placeholders with live trading disabled by default

## Safety Rules

- Do not commit real secrets.
- Do not commit real Toss, Naver, or Claude credentials.
- `LIVE_TRADING_ENABLED=false` is the default in every generated environment.
- Production live trading requires a separate readiness and approval process.
- Secret values must come from a secret manager or secure environment injection.
