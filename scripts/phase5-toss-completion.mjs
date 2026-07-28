#!/usr/bin/env node

import { execFileSync } from "node:child_process";

const customPaths = process.argv.slice(2).filter(Boolean);
const callGate = runCallGate();
const reasonCodes = [];

if (callGate.readyToAttemptRealReadOnlyCall !== true) {
  reasonCodes.push("read_only_call_gate_not_ready");
}

const report = {
  phase5TossPreparationComplete: reasonCodes.length === 0,
  readyForFirstRealReadOnlyCall: callGate.readyToAttemptRealReadOnlyCall === true,
  reasonCodes: [...new Set([...reasonCodes, ...prefixReasons(callGate.reasonCodes ?? [])])].sort(),
  warnings: callGate.warnings ?? [],
  nextAction:
    reasonCodes.length === 0
      ? "Proceed to one scoped Toss read-only verification call in a separate task."
      : "Finish local .env setup, official endpoint verification, sanitized evidence intake, preflight, and call-gate approval first.",
  liveBrokerWriteAllowed: false,
  networkCallsPerformed: false,
  safetyType: "PHASE5_TOSS_COMPLETION_LOCAL_REPORT"
};

console.log(JSON.stringify(report, null, 2));
process.exit(report.phase5TossPreparationComplete ? 0 : 1);

function runCallGate() {
  try {
    return JSON.parse(execFileSync("npm", ["run", "phase5:toss:call-gate", "--silent", ...customPaths], {
      cwd: process.cwd(),
      env: process.env
    }).toString());
  } catch (error) {
    const output = String(error.stdout ?? "{}");
    return JSON.parse(output);
  }
}

function prefixReasons(reasons) {
  return reasons.map((reason) => `call_gate_${reason}`);
}
