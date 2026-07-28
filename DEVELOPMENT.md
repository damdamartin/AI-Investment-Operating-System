# Development Guide

Version: 0.4.0
Status: Active
Last Updated: 2026-07-28

## Purpose

This document explains how to run the local development checks for AI Investment Operating System.

## Requirements

- Node.js 22 or newer
- npm 11 or newer

## Setup

Install dependencies:

```bash
npm install
```

## Checks

Run type checks and tests:

```bash
npm run check
```

Run tests only:

```bash
npm test
```

Run migration smoke tests only:

```bash
npm run test:migrations
```

Run type checks only:

```bash
npm run typecheck
```

## Secrets

Use `.env.example` as a reference only.

Never commit real Toss Securities, Naver, Claude, broker account, token, or API key values.

## Live Trading

Live trading is disabled by default.

The current codebase contains no live broker write implementation.
