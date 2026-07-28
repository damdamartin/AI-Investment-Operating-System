export type ClaudeWorktreeSessionStatus =
  | "PLANNED"
  | "IN_PROGRESS"
  | "READY_FOR_REVIEW"
  | "MERGED"
  | "BLOCKED";

export interface ClaudeWorktreeSessionPlan {
  sessionId: string;
  branchName: string;
  worktreePath: string;
  taskIds: string[];
  ownedPaths: string[];
  requiredDocs: string[];
  status: ClaudeWorktreeSessionStatus;
}

export interface ClaudeWorktreeOrchestrationPlan {
  planId: string;
  baseBranch: string;
  integrationBranch: string;
  sessions: ClaudeWorktreeSessionPlan[];
}

export interface ClaudeWorktreeValidationResult {
  ok: boolean;
  reasonCodes: string[];
  warnings: string[];
  mergeReady: boolean;
  safetyType: "CLAUDE_WORKTREE_ORCHESTRATION_REVIEW_ONLY";
}

const requiredSafetyDocs = ["docs/10_Claude_Code_Guide.md", "docs/11_AI_RULES.md"];

export class ClaudeWorktreeOrchestrationGuide {
  validate(plan: ClaudeWorktreeOrchestrationPlan): ClaudeWorktreeValidationResult {
    const reasonCodes: string[] = [];
    const warnings: string[] = [];

    if (plan.baseBranch !== "main") {
      reasonCodes.push("base_branch_must_be_main");
    }

    if (!plan.integrationBranch.startsWith("integration/")) {
      warnings.push("integration_branch_should_use_integration_prefix");
    }

    this.validateUniqueSessionFields(plan.sessions, reasonCodes);
    this.validateRequiredDocs(plan.sessions, reasonCodes);
    this.validatePathOwnership(plan.sessions, reasonCodes, warnings);
    this.validateTaskOwnership(plan.sessions, reasonCodes);

    return {
      ok: reasonCodes.length === 0,
      reasonCodes: [...new Set(reasonCodes)].sort(),
      warnings: [...new Set(warnings)].sort(),
      mergeReady: this.isMergeReady(plan.sessions) && reasonCodes.length === 0,
      safetyType: "CLAUDE_WORKTREE_ORCHESTRATION_REVIEW_ONLY"
    };
  }

  mergeChecklist(plan: ClaudeWorktreeOrchestrationPlan): string[] {
    return [
      `Confirm base branch is ${plan.baseBranch}.`,
      `Merge approved worktrees into ${plan.integrationBranch} before main.`,
      "Run npm run check after each worktree merge.",
      "Run git diff --check before each commit.",
      "Confirm docs/11_AI_RULES.md remains unchanged unless the task explicitly updates safety policy.",
      "Confirm live broker write work remains blocked.",
      "Confirm no secrets, production credentials, or local environment files were committed."
    ];
  }

  private validateUniqueSessionFields(
    sessions: ClaudeWorktreeSessionPlan[],
    reasonCodes: string[]
  ): void {
    const seenBranches = new Set<string>();
    const seenWorktrees = new Set<string>();
    const seenSessionIds = new Set<string>();

    for (const session of sessions) {
      if (seenSessionIds.has(session.sessionId)) {
        reasonCodes.push(`duplicate_session_id_${session.sessionId}`);
      }
      if (seenBranches.has(session.branchName)) {
        reasonCodes.push(`duplicate_branch_${session.branchName}`);
      }
      if (seenWorktrees.has(session.worktreePath)) {
        reasonCodes.push(`duplicate_worktree_path_${session.worktreePath}`);
      }
      if (!session.branchName.startsWith("feature/")) {
        reasonCodes.push(`branch_must_use_feature_prefix_${session.sessionId}`);
      }
      seenSessionIds.add(session.sessionId);
      seenBranches.add(session.branchName);
      seenWorktrees.add(session.worktreePath);
    }
  }

  private validateRequiredDocs(
    sessions: ClaudeWorktreeSessionPlan[],
    reasonCodes: string[]
  ): void {
    for (const session of sessions) {
      for (const doc of requiredSafetyDocs) {
        if (!session.requiredDocs.includes(doc)) {
          reasonCodes.push(`missing_required_doc_${session.sessionId}_${doc}`);
        }
      }
    }
  }

  private validatePathOwnership(
    sessions: ClaudeWorktreeSessionPlan[],
    reasonCodes: string[],
    warnings: string[]
  ): void {
    const ownership = sessions.flatMap((session) =>
      session.ownedPaths.map((path) => ({
        sessionId: session.sessionId,
        path: normalizePath(path)
      }))
    );

    for (const owned of ownership) {
      if (isSensitivePath(owned.path)) {
        reasonCodes.push(`sensitive_path_owned_${owned.sessionId}_${owned.path}`);
      }
      if (owned.path === "docs/11_AI_RULES.md") {
        warnings.push(`ai_rules_policy_touch_requires_architecture_review_${owned.sessionId}`);
      }
    }

    for (let leftIndex = 0; leftIndex < ownership.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < ownership.length; rightIndex += 1) {
        const left = ownership[leftIndex];
        const right = ownership[rightIndex];
        if (!left || !right || left.sessionId === right.sessionId) continue;

        if (pathsOverlap(left.path, right.path)) {
          reasonCodes.push(`overlapping_owned_paths_${left.sessionId}_${right.sessionId}`);
        }
      }
    }
  }

  private validateTaskOwnership(
    sessions: ClaudeWorktreeSessionPlan[],
    reasonCodes: string[]
  ): void {
    const ownerByTask = new Map<string, string>();

    for (const session of sessions) {
      for (const taskId of session.taskIds) {
        const owner = ownerByTask.get(taskId);
        if (owner && owner !== session.sessionId) {
          reasonCodes.push(`task_assigned_to_multiple_sessions_${taskId}`);
        }
        ownerByTask.set(taskId, session.sessionId);
      }
    }
  }

  private isMergeReady(sessions: ClaudeWorktreeSessionPlan[]): boolean {
    return sessions.every((session) =>
      ["READY_FOR_REVIEW", "MERGED"].includes(session.status)
    );
  }
}

function normalizePath(path: string): string {
  return path.replace(/^\.\//, "").replace(/\/+$/, "");
}

function pathsOverlap(left: string, right: string): boolean {
  return left === right || left.startsWith(`${right}/`) || right.startsWith(`${left}/`);
}

function isSensitivePath(path: string): boolean {
  if (path === ".env" || path.startsWith(".env.")) return true;
  if (path.startsWith("secrets/")) return true;
  if (path.includes("/secrets/")) return true;
  if (path.endsWith(".env") && !path.endsWith(".env.example")) return true;

  return false;
}
