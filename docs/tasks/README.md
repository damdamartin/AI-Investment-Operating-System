# Implementation Task Index

Version: 0.3.1
Status: Draft
Last Updated: 2026-07-28

## Purpose

This folder contains implementation-ready task documents for Claude Code parallel development.

Each task is intentionally narrow. A Claude Code session should read the task file, the required architecture documents, and `docs/11_AI_RULES.md` before implementation.

## Phase 1: Foundation Tasks

| Task | Title | Primary Module | Status |
|---|---|---|---|
| [Task-001](Task-001_Project_Structure.md) | Project Structure | Foundation | Draft |
| [Task-002](Task-002_Runtime_Config_and_Secrets.md) | Runtime Config and Secrets | Foundation | Draft |
| [Task-003](Task-003_Core_Value_Objects.md) | Core Value Objects | Domain | Draft |
| [Task-004](Task-004_Market_and_Asset_Model.md) | Market and Asset Model | Domain | Draft |
| [Task-005](Task-005_Broker_Account_Model.md) | Broker Account Model | Domain | Draft |
| [Task-006](Task-006_Strategy_Signal_Model.md) | Strategy and Signal Model | Domain | Draft |
| [Task-007](Task-007_Order_State_Machines.md) | Order State Machines | Trading | Draft |
| [Task-008](Task-008_Risk_and_Money_Model.md) | Risk and Money Model | Trading | Draft |
| [Task-009](Task-009_Database_Migration_Framework.md) | Database Migration Framework | Database | Draft |
| [Task-010](Task-010_Core_Database_Schema.md) | Core Database Schema | Database | Draft |
| [Task-011](Task-011_Historical_Data_Schema.md) | Historical Data Schema | Database | Draft |
| [Task-012](Task-012_Outbox_Event_Schema.md) | Outbox Event Schema | Database | Draft |
| [Task-013](Task-013_Adapter_Interface_Contracts.md) | Adapter Interface Contracts | API | Draft |
| [Task-014](Task-014_Toss_Readonly_Capability_Discovery.md) | Toss Read-Only Capability Discovery | Broker API | Draft |
| [Task-015](Task-015_Naver_News_Adapter.md) | Naver News Adapter | News API | Draft |
| [Task-016](Task-016_Claude_Adapter_Schema_Validation.md) | Claude Adapter Schema Validation | AI API | Draft |
| [Task-017](Task-017_Compliance_Gate_Service.md) | Compliance Gate Service | Safety | Draft |
| [Task-018](Task-018_Audit_Log_Service.md) | Audit Log Service | Audit | Draft |
| [Task-019](Task-019_Safety_Regression_Test_Harness.md) | Safety Regression Test Harness | Testing | Draft |
| [Task-020](Task-020_CI_Baseline.md) | CI Baseline | DevOps | Draft |

## Phase 2: Engine and Validation Tasks

| Task | Title | Primary Module | Status |
|---|---|---|---|
| [Task-021](Task-021_Market_Data_Ingestion_Read_Model.md) | Market Data Ingestion Read Model | Market Data | Draft |
| [Task-022](Task-022_News_Event_Normalization.md) | News Event Normalization | News | Draft |
| [Task-023](Task-023_AI_Analysis_Persistence.md) | AI Analysis Persistence | AI | Draft |
| [Task-024](Task-024_Market_Engine_Baseline.md) | Market Engine Baseline | Strategy | Draft |
| [Task-025](Task-025_Fundamental_Engine_Interface.md) | Fundamental Engine Interface | Strategy | Draft |
| [Task-026](Task-026_News_Event_Engine_Baseline.md) | News Event Engine Baseline | Strategy | Draft |
| [Task-027](Task-027_Strategy_Scoring_Service.md) | Strategy Scoring Service | Strategy | Draft |
| [Task-028](Task-028_Risk_Engine_Baseline.md) | Risk Engine Baseline | Risk | Draft |
| [Task-029](Task-029_Money_Management_Engine_Baseline.md) | Money Management Engine Baseline | Money | Draft |
| [Task-030](Task-030_Order_Approval_Engine_Baseline.md) | Order Approval Engine Baseline | Trading | Draft |
| [Task-031](Task-031_Backtest_Engine_Baseline.md) | Backtest Engine Baseline | Validation | Draft |
| [Task-032](Task-032_Walk_Forward_Validation.md) | Walk-Forward Validation | Validation | Draft |
| [Task-033](Task-033_Shadow_Portfolio_Engine.md) | Shadow Portfolio Engine | Validation | Draft |
| [Task-034](Task-034_Paper_Trading_Engine.md) | Paper Trading Engine | Validation | Draft |
| [Task-035](Task-035_Strategy_Diversity_Engine.md) | Strategy Diversity Engine | Strategy Research | Draft |
| [Task-036](Task-036_Strategy_Promotion_Workflow.md) | Strategy Promotion Workflow | Governance | Draft |
| [Task-037](Task-037_AI_Health_Check_Baseline.md) | AI Health Check Baseline | AI Operations | Draft |
| [Task-038](Task-038_Reconciliation_Readonly_Baseline.md) | Reconciliation Read-Only Baseline | Trading Ops | Draft |
| [Task-039](Task-039_Dashboard_Readonly_Status.md) | Dashboard Read-Only Status | Dashboard | Draft |
| [Task-040](Task-040_Operational_Alerting_Baseline.md) | Operational Alerting Baseline | Operations | Draft |

## Execution Rule

Tasks that touch live broker write operations remain blocked until the related open questions in `docs/open_questions.md` are resolved and the compliance gate in `docs/13_Compliance_and_Legal_Review.md` is satisfied.
