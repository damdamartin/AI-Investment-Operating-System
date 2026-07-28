# Task-051: Scheduler and Job Runner Baseline

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

## Dependencies

- Task-041.
- Task-047.
