# Task-051: Scheduler and Job Runner Baseline

Status: Complete
Implemented In: 0.4.36
Last Updated: 2026-07-28

## Objective

Create the baseline scheduler and job runner model for recurring system work.

## Context

Required reading: `docs/02_System_Architecture.md`, `docs/09_Operation_Deployment.md`.

## Scope

- Job definition model.
- Scheduled job metadata.
- Run status model.
- Basic locking rule.
- Failure and retry metadata.

## Out of Scope

- Cloud-specific scheduler deployment.
- Broker write jobs.

## Outputs

- Scheduler/job runner boundary.
- Tests for job state transitions.

## Acceptance Criteria

- Jobs cannot overlap when marked singleton.
- Failed jobs record safe error summaries.
- Trading jobs can be disabled by safety state.

## Tests Required

- Unit tests for job locking and state transitions.

## Safety Requirements

- Scheduler must not run live broker write jobs unless gates permit them.

## Implementation Notes

- Added `SchedulerJobRunner` for scheduled job definitions and run records.
- Added job run states for `PENDING`, `RUNNING`, `SUCCEEDED`, `FAILED`, and `SKIPPED`.
- Added singleton locking behavior to prevent overlapping runs.
- Added safe failure summaries with secret-like token redaction.
- Added trading-related job safety state checks for kill switch, reconciliation, stale data, and broker write gates.
- Cloud-specific scheduler deployment remains out of scope.

## Dependencies

- Task-041.
- Task-047.
