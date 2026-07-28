# Task-059: Claude Worktree Orchestration Guide

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

## Tests Required

- Documentation review only.

## Safety Requirements

- The guide must instruct Claude sessions to read `docs/11_AI_RULES.md` before implementation.

## Dependencies

- Task-001 through Task-060 documents.
