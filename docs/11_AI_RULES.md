# 11 AI Rules

Version: 0.1.0  
Status: Placeholder  
Last Updated: 2026-07-27  
Related Docs: 01_Project_Vision.md, 06_AI_Architecture.md, 07_Trading_System.md

## Purpose

This document will define non-negotiable rules that all AI agents must follow when designing, reviewing, or implementing this system.

## Initial Non-Negotiable Rules

- AI must not directly place broker orders.
- Claude API must never call Toss Securities Open API directly.
- News analysis alone must never trigger an order.
- Every order must pass Risk Engine, Money Management Engine, and Order Approval Engine.
- Unverified strategies must not be promoted to live trading.
- Production strategy changes must be versioned, auditable, and reversible.
- Secrets must not be committed to Git.
- Any uncertainty in broker behavior must be tested, not assumed.

