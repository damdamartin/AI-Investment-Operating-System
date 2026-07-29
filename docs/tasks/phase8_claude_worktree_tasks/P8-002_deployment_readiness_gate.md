# P8-002 Deployment Readiness Gate

## Task ID

P8-002

## Goal

Define and implement a fail-closed deployment readiness gate that checks
whether an environment is safe to deploy into while keeping production and
live trading disabled by default.

## Assigned Engineer

Engineer 2

## Responsible Module

Deployment readiness, environment validation, release/rollback preflight.

## Files To Modify Or Create

- `src/application/deployment/deployment-readiness-gate.ts`
- `tests/application/deployment-readiness-gate.test.ts`
- `docs/phase8/deployment-readiness-gate.md`
- `src/application/deployment/index.ts`

Coordinate before changing `deployment-environment-skeleton.ts`.

## Inputs

- `src/application/deployment/deployment-environment-skeleton.ts`
- `docs/09_Operation_Deployment.md`
- `docs/phase7/live-capable-blocker-register.md`
- `docs/11_AI_RULES.md`

## Output

A pure evaluator that checks:

- environment skeleton exists and validates
- live trading is disabled by default
- production deployment has explicit blocker status
- required runbooks exist by reference
- rollback plan reference exists
- backup/restore gate reference exists
- observability/alerting status reference exists
- secrets are references only, not values

The evaluator may return `readyToDeploy: true` for no-write operational
deployment readiness, but it must never return or imply live-trading
authorization.

## Forbidden

- No real cloud deployment commands.
- No CI/CD secrets.
- No live trading enablement.
- No `process.env` secret reads.
- No network calls.
- No modifying production defaults to enabled.

## Test Criteria

Run:

```bash
npx vitest run tests/application/deployment-environment-skeleton.test.ts tests/application/deployment-readiness-gate.test.ts
npm run check
```

## Completion Criteria

- Deployment readiness fails closed on missing runbooks/rollback/backup
  references.
- Production/live trading remains disabled by default.
- Secret references are validated as references, not values.
- `npm run check` passes.

## Recommended Branch

`phase8/p8-002-deployment-readiness-gate`
