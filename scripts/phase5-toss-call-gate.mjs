#!/usr/bin/env node

import { execFileSync } from "node:child_process";

const customPaths = process.argv.slice(2).filter(Boolean);
const approvalFlag = process.env.PHASE5_TOSS_READ_ONLY_CALL_APPROVED;
const preflight = runPreflight();
const reasonCodes = [];

if (preflight.readyForReadOnlyCall !== true) {
  reasonCodes.push("preflight_not_ready");
}

if (approvalFlag !== "true") {
  reasonCodes.push("human_read_only_call_approval_missing");
}

const report = {
  readyToAttemptRealReadOnlyCall: reasonCodes.length === 0,
  preflightReady: preflight.readyForReadOnlyCall === true,
  humanApprovalPresent: approvalFlag === "true",
  reasonCodes: [...new Set([...reasonCodes, ...prefixReasons(preflight.reasonCodes ?? [])])].sort(),
  warnings: preflight.warnings ?? [],
  liveBrokerWriteAllowed: false,
  networkCallsPerformed: false,
  allowedNextAction:
    reasonCodes.length === 0
      ? "A single documented Toss read-only verification call may be attempted by the next task."
      : "Do not call Toss API yet.",
  safetyType: "PHASE5_TOSS_READ_ONLY_CALL_GATE_LOCAL_REPORT"
};

console.log(JSON.stringify(report, null, 2));
process.exit(report.readyToAttemptRealReadOnlyCall ? 0 : 1);

function runPreflight() {
  try {
    return JSON.parse(execFileSync("npm", ["run", "phase5:toss:preflight", "--silent", ...customPaths], {
      cwd: process.cwd(),
      env: process.env
    }).toString());
  } catch (error) {
    const output = String(error.stdout ?? "{}");
    return JSON.parse(output);
  }
}

function prefixReasons(reasons) {
  return reasons.map((reason) => `preflight_${reason}`);
}
