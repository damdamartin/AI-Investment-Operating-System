# Implementation Task Index

Version: 0.4.20
Status: Active
Last Updated: 2026-07-28

## Purpose

This folder contains implementation-ready task documents for Claude Code parallel development.

Each task is intentionally narrow. A Claude Code session should read the task file, the required architecture documents, and `docs/11_AI_RULES.md` before implementation.

## Phase 1: Foundation Tasks

| Task | Title | Primary Module | Status |
|---|---|---|---|
| [Task-001](Task-001_Project_Structure.md) | Project Structure | Foundation | Complete |
| [Task-002](Task-002_Runtime_Config_and_Secrets.md) | Runtime Config and Secrets | Foundation | Complete |
| [Task-003](Task-003_Core_Value_Objects.md) | Core Value Objects | Domain | Complete |
| [Task-004](Task-004_Market_and_Asset_Model.md) | Market and Asset Model | Domain | Complete |
| [Task-005](Task-005_Broker_Account_Model.md) | Broker Account Model | Domain | Complete |
| [Task-006](Task-006_Strategy_Signal_Model.md) | Strategy and Signal Model | Domain | Complete |
| [Task-007](Task-007_Order_State_Machines.md) | Order State Machines | Trading | Complete |
| [Task-008](Task-008_Risk_and_Money_Model.md) | Risk and Money Model | Trading | Complete |
| [Task-009](Task-009_Database_Migration_Framework.md) | Database Migration Framework | Database | Complete |
| [Task-010](Task-010_Core_Database_Schema.md) | Core Database Schema | Database | Complete |
| [Task-011](Task-011_Historical_Data_Schema.md) | Historical Data Schema | Database | Complete |
| [Task-012](Task-012_Outbox_Event_Schema.md) | Outbox Event Schema | Database | Complete |
| [Task-013](Task-013_Adapter_Interface_Contracts.md) | Adapter Interface Contracts | API | Complete |
| [Task-014](Task-014_Toss_Readonly_Capability_Discovery.md) | Toss Read-Only Capability Discovery | Broker API | Complete |
| [Task-015](Task-015_Naver_News_Adapter.md) | Naver News Adapter | News API | Complete |
| [Task-016](Task-016_Claude_Adapter_Schema_Validation.md) | Claude Adapter Schema Validation | AI API | Complete |
| [Task-017](Task-017_Compliance_Gate_Service.md) | Compliance Gate Service | Safety | Complete |
| [Task-018](Task-018_Audit_Log_Service.md) | Audit Log Service | Audit | Complete |
| [Task-019](Task-019_Safety_Regression_Test_Harness.md) | Safety Regression Test Harness | Testing | Complete |
| [Task-020](Task-020_CI_Baseline.md) | CI Baseline | DevOps | Complete |

## Phase 2: Engine and Validation Tasks

| Task | Title | Primary Module | Status |
|---|---|---|---|
| [Task-021](Task-021_Market_Data_Ingestion_Read_Model.md) | Market Data Ingestion Read Model | Market Data | Complete |
| [Task-022](Task-022_News_Event_Normalization.md) | News Event Normalization | News | Complete |
| [Task-023](Task-023_AI_Analysis_Persistence.md) | AI Analysis Persistence | AI | Complete |
| [Task-024](Task-024_Market_Engine_Baseline.md) | Market Engine Baseline | Strategy | Complete |
| [Task-025](Task-025_Fundamental_Engine_Interface.md) | Fundamental Engine Interface | Strategy | Complete |
| [Task-026](Task-026_News_Event_Engine_Baseline.md) | News Event Engine Baseline | Strategy | Complete |
| [Task-027](Task-027_Strategy_Scoring_Service.md) | Strategy Scoring Service | Strategy | Complete |
| [Task-028](Task-028_Risk_Engine_Baseline.md) | Risk Engine Baseline | Risk | Complete |
| [Task-029](Task-029_Money_Management_Engine_Baseline.md) | Money Management Engine Baseline | Money | Complete |
| [Task-030](Task-030_Order_Approval_Engine_Baseline.md) | Order Approval Engine Baseline | Trading | Complete |
| [Task-031](Task-031_Backtest_Engine_Baseline.md) | Backtest Engine Baseline | Validation | Complete |
| [Task-032](Task-032_Walk_Forward_Validation.md) | Walk-Forward Validation | Validation | Complete |
| [Task-033](Task-033_Shadow_Portfolio_Engine.md) | Shadow Portfolio Engine | Validation | Complete |
| [Task-034](Task-034_Paper_Trading_Engine.md) | Paper Trading Engine | Validation | Complete |
| [Task-035](Task-035_Strategy_Diversity_Engine.md) | Strategy Diversity Engine | Strategy Research | Complete |
| [Task-036](Task-036_Strategy_Promotion_Workflow.md) | Strategy Promotion Workflow | Governance | Draft |
| [Task-037](Task-037_AI_Health_Check_Baseline.md) | AI Health Check Baseline | AI Operations | Draft |
| [Task-038](Task-038_Reconciliation_Readonly_Baseline.md) | Reconciliation Read-Only Baseline | Trading Ops | Draft |
| [Task-039](Task-039_Dashboard_Readonly_Status.md) | Dashboard Read-Only Status | Dashboard | Draft |
| [Task-040](Task-040_Operational_Alerting_Baseline.md) | Operational Alerting Baseline | Operations | Draft |

## Phase 3: Operations and Controlled Execution Tasks

| Task | Title | Primary Module | Status |
|---|---|---|---|
| [Task-041](Task-041_Outbox_Worker_Baseline.md) | Outbox Worker Baseline | Execution | Draft |
| [Task-042](Task-042_Broker_Write_Command_Guard.md) | Broker Write Command Guard | Safety | Draft |
| [Task-043](Task-043_Order_Execution_Simulation.md) | Order Execution Simulation | Execution | Draft |
| [Task-044](Task-044_Order_Cancel_Simulation.md) | Order Cancel Simulation | Execution | Draft |
| [Task-045](Task-045_Fill_Processing_and_Position_Update.md) | Fill Processing and Position Update | Portfolio | Draft |
| [Task-046](Task-046_Reconciliation_Workflow.md) | Reconciliation Workflow | Trading Ops | Draft |
| [Task-047](Task-047_Kill_Switch_Control_Service.md) | Kill Switch Control Service | Safety | Draft |
| [Task-048](Task-048_Dashboard_Sensitive_Control_Gate.md) | Dashboard Sensitive Control Gate | Dashboard | Draft |
| [Task-049](Task-049_Strategy_Promotion_Dashboard_Workflow.md) | Strategy Promotion Dashboard Workflow | Dashboard | Draft |
| [Task-050](Task-050_Config_Versioning_Service.md) | Config Versioning Service | Operations | Draft |
| [Task-051](Task-051_Scheduler_and_Job_Runner_Baseline.md) | Scheduler and Job Runner Baseline | Operations | Draft |
| [Task-052](Task-052_Data_Quality_Monitor.md) | Data Quality Monitor | Data Ops | Draft |
| [Task-053](Task-053_API_Usage_and_Cost_Monitor.md) | API Usage and Cost Monitor | Operations | Draft |
| [Task-054](Task-054_Backup_and_Restore_Runbook.md) | Backup and Restore Runbook | Operations | Draft |
| [Task-055](Task-055_Incident_Runbook_Set.md) | Incident Runbook Set | Operations | Draft |
| [Task-056](Task-056_Deployment_Environment_Skeleton.md) | Deployment Environment Skeleton | Infrastructure | Draft |
| [Task-057](Task-057_Observability_Metrics_Baseline.md) | Observability Metrics Baseline | Operations | Draft |
| [Task-058](Task-058_Security_Access_Control_Baseline.md) | Security Access Control Baseline | Security | Draft |
| [Task-059](Task-059_Claude_Worktree_Orchestration_Guide.md) | Claude Worktree Orchestration Guide | Development | Draft |
| [Task-060](Task-060_Phase_4_Readiness_Review.md) | Phase 4 Readiness Review | Governance | Draft |

## Execution Rule

Tasks that touch live broker write operations remain blocked until the related open questions in `docs/open_questions.md` are resolved and the compliance gate in `docs/13_Compliance_and_Legal_Review.md` is satisfied.

## Implementation Planning

- [Claude_Worktree_Orchestration.md](Claude_Worktree_Orchestration.md) defines recommended parallel Claude Code worktree sessions.
- [Phase_4_Readiness_Review.md](Phase_4_Readiness_Review.md) defines the implementation readiness decision and recommended implementation waves.
