# AI Investment Operating System

Version: 0.1.0  
Status: Documentation Foundation Draft  
Last Updated: 2026-07-28

## Overview

AI Investment Operating System is a document-driven project for designing and building an automated stock and ETF trading platform.

The system is intended to use:

- Toss Securities Open API for Korean and U.S. stock/ETF market data, account data, and order execution
- Naver News API for news collection
- Claude API for AI analysis, strategy research, health checks, and structured reasoning

## Core Principle

The system must prioritize survival, risk control, verification, and auditability over short-term returns.

Claude or any AI component must not directly place orders. All orders must pass through deterministic risk, money management, and order approval layers before reaching the broker adapter.

## Documentation

The official project documentation lives in [docs](docs/README.md).

## Repository Status

This repository currently contains the first draft documentation foundation. Architecture review, development specifications, and implementation tasks will be produced iteratively from these documents.
