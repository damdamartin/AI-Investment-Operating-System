import { describe, expect, it } from "vitest";
import {
  ClaudeWorktreeOrchestrationGuide,
  type ClaudeWorktreeOrchestrationPlan,
  type ClaudeWorktreeSessionPlan
} from "../../src/index.js";

describe("ClaudeWorktreeOrchestrationGuide", () => {
  it("accepts a safe parallel worktree plan", () => {
    const guide = new ClaudeWorktreeOrchestrationGuide();
    const result = guide.validate({
      planId: "phase-4-wave-1",
      baseBranch: "main",
      integrationBranch: "integration/phase-4-wave-1",
      sessions: [
        session({
          sessionId: "session-a",
          branchName: "feature/foundation-project-skeleton",
          worktreePath: "../aios-session-a",
          taskIds: ["Task-001"],
          ownedPaths: ["src/domain/assets", "tests/domain/assets"]
        }),
        session({
          sessionId: "session-b",
          branchName: "feature/adapter-boundaries",
          worktreePath: "../aios-session-b",
          taskIds: ["Task-013"],
          ownedPaths: ["src/adapters/contracts", "tests/adapters/contracts"]
        })
      ]
    });

    expect(result.ok).toBe(true);
    expect(result.mergeReady).toBe(false);
    expect(result.safetyType).toBe("CLAUDE_WORKTREE_ORCHESTRATION_REVIEW_ONLY");
  });

  it("requires each session to read the AI rules and Claude guide", () => {
    const guide = new ClaudeWorktreeOrchestrationGuide();
    const result = guide.validate({
      planId: "missing-docs",
      baseBranch: "main",
      integrationBranch: "integration/missing-docs",
      sessions: [
        session({
          sessionId: "session-a",
          requiredDocs: ["docs/10_Claude_Code_Guide.md"]
        })
      ]
    });

    expect(result.ok).toBe(false);
    expect(result.reasonCodes).toContain(
      "missing_required_doc_session-a_docs/11_AI_RULES.md"
    );
  });

  it("blocks duplicate branches, worktrees, and task ownership", () => {
    const guide = new ClaudeWorktreeOrchestrationGuide();
    const result = guide.validate({
      planId: "duplicates",
      baseBranch: "main",
      integrationBranch: "integration/duplicates",
      sessions: [
        session({
          sessionId: "session-a",
          branchName: "feature/shared",
          worktreePath: "../shared",
          taskIds: ["Task-021"]
        }),
        session({
          sessionId: "session-b",
          branchName: "feature/shared",
          worktreePath: "../shared",
          taskIds: ["Task-021"]
        })
      ]
    });

    expect(result.ok).toBe(false);
    expect(result.reasonCodes).toContain("duplicate_branch_feature/shared");
    expect(result.reasonCodes).toContain("duplicate_worktree_path_../shared");
    expect(result.reasonCodes).toContain("task_assigned_to_multiple_sessions_Task-021");
  });

  it("blocks overlapping owned paths between sessions", () => {
    const guide = new ClaudeWorktreeOrchestrationGuide();
    const result = guide.validate({
      planId: "overlap",
      baseBranch: "main",
      integrationBranch: "integration/overlap",
      sessions: [
        session({
          sessionId: "session-a",
          ownedPaths: ["src/application/trading"]
        }),
        session({
          sessionId: "session-b",
          branchName: "feature/trading-detail",
          worktreePath: "../trading-detail",
          taskIds: ["Task-030"],
          ownedPaths: ["src/application/trading/order-approval"]
        })
      ]
    });

    expect(result.ok).toBe(false);
    expect(result.reasonCodes).toContain("overlapping_owned_paths_session-a_session-b");
  });

  it("blocks secret and live environment ownership", () => {
    const guide = new ClaudeWorktreeOrchestrationGuide();
    const result = guide.validate({
      planId: "secrets",
      baseBranch: "main",
      integrationBranch: "integration/secrets",
      sessions: [
        session({
          sessionId: "session-a",
          ownedPaths: [".env", "deployment/production.env"]
        })
      ]
    });

    expect(result.ok).toBe(false);
    expect(result.reasonCodes).toContain("sensitive_path_owned_session-a_.env");
    expect(result.reasonCodes).toContain(
      "sensitive_path_owned_session-a_deployment/production.env"
    );
  });

  it("marks a plan merge-ready only after every session is reviewable or merged", () => {
    const guide = new ClaudeWorktreeOrchestrationGuide();
    const plan: ClaudeWorktreeOrchestrationPlan = {
      planId: "merge-ready",
      baseBranch: "main",
      integrationBranch: "integration/merge-ready",
      sessions: [
        session({ sessionId: "session-a", status: "READY_FOR_REVIEW" }),
        session({
          sessionId: "session-b",
          branchName: "feature/merged",
          worktreePath: "../merged",
          taskIds: ["Task-060"],
          ownedPaths: ["docs/tasks/Task-060_Phase_4_Readiness_Review.md"],
          status: "MERGED"
        })
      ]
    };

    expect(guide.validate(plan).mergeReady).toBe(true);
    expect(guide.mergeChecklist(plan)).toContain("Run npm run check after each worktree merge.");
  });
});

function session(overrides: Partial<ClaudeWorktreeSessionPlan> = {}): ClaudeWorktreeSessionPlan {
  return {
    sessionId: "session-a",
    branchName: "feature/session-a",
    worktreePath: "../session-a",
    taskIds: ["Task-001"],
    ownedPaths: ["docs/tasks/Task-001_Project_Structure.md"],
    requiredDocs: [
      "docs/10_Claude_Code_Guide.md",
      "docs/11_AI_RULES.md",
      "docs/tasks/README.md"
    ],
    status: "PLANNED",
    ...overrides
  };
}
