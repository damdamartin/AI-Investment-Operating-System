# Task-059: Claude Worktree Orchestration Guide

Status: Complete
Implemented In: 0.4.44
Last Updated: 2026-07-28

## Objective

Create a practical guide for assigning tasks to multiple Claude Code worktree sessions.

## Context

Required reading: `docs/10_Claude_Code_Guide.md`, `docs/tasks/README.md`.

## Scope

- Recommended session groups.
- Branch naming examples.
- Task dependency guidance.
- Merge order guidance.
- Conflict avoidance rules.

## Out of Scope

- Running Claude Code sessions automatically.
- Implementing code.

## Outputs

- Worktree orchestration guide.

## Acceptance Criteria

- Tasks can be grouped into safe parallel work streams.
- Risky dependency order is clearly identified.
- Live broker write work remains blocked.
- Worktree plans can be reviewed for duplicate branches, duplicate tasks, overlapping owned paths, missing safety documents, and accidental sensitive file ownership.

## Tests Required

- Documentation review only.

## Safety Requirements

- The guide must instruct Claude sessions to read `docs/11_AI_RULES.md` before implementation.
- Every session must also read `docs/10_Claude_Code_Guide.md` before implementation.
- Claude worktree sessions must not own `.env`, secret, or live production credential files.

## Dependencies

- Task-001 through Task-060 documents.

## Implementation Notes

- `docs/tasks/Claude_Worktree_Orchestration.md` defines recommended Claude Code worktree sessions, branch names, dependency order, merge order, and blocking rules.
- `ClaudeWorktreeOrchestrationGuide` provides a review-only validation service for worktree plans.
- The validation service does not create worktrees, run Claude Code, merge branches, or perform broker operations.
- The service marks a plan as merge-ready only when every session is `READY_FOR_REVIEW` or `MERGED`.
