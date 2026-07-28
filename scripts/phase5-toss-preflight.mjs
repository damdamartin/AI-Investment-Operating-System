#!/usr/bin/env node

import { execFileSync } from "node:child_process";

const customPaths = process.argv.slice(2).filter(Boolean);
const endpointCatalogPath = customPaths[0];
const evidenceManifestPath = customPaths[1];
const evidenceIntakePath = customPaths[2];
const commands = [
  ["readiness", ["npm", ["run", "phase5:toss:readiness", "--silent"]]],
  ["endpoints", ["npm", withOptionalPath(["run", "phase5:toss:endpoints", "--silent"], endpointCatalogPath)]],
  ["evidence", ["npm", withOptionalPath(["run", "phase5:toss:evidence", "--silent"], evidenceManifestPath)]],
  ["intake", ["npm", withOptionalPath(["run", "phase5:toss:intake", "--silent"], evidenceIntakePath)]],
  ["openQuestions", ["npm", withOptionalPath(["run", "phase5:toss:open-questions", "--silent"], evidenceManifestPath)]],
  ["doctor", ["npm", ["run", "phase5:toss:doctor", "--silent", ...customPaths]]]
];

const reports = {};
const reasonCodes = [];
const warnings = [];

for (const [name, [command, args]] of commands) {
  const result = runJsonCommand(command, args);
  reports[name] = result.report;

  if (!result.ok) {
    reasonCodes.push(`${name}_command_failed`);
  }

  for (const reason of result.report.reasonCodes ?? result.report.blockingReasonCodes ?? []) {
    reasonCodes.push(`${name}_${reason}`);
  }

  for (const warning of result.report.warnings ?? []) {
    warnings.push(`${name}_${warning}`);
  }
}

const readyForReadOnlyCall =
  reports.readiness?.ready === true &&
  reports.endpoints?.valid === true &&
  reports.doctor?.readyForReadOnlyVerification === true;

const report = {
  readyForReadOnlyCall,
  readyForOpenQuestionReview: reports.openQuestions?.readyForOpenQuestionReview === true,
  commandCount: commands.length,
  reasonCodes: [...new Set(reasonCodes)].sort(),
  warnings: [...new Set(warnings)].sort(),
  liveBrokerWriteAllowed: false,
  networkCallsPerformed: false,
  safetyType: "PHASE5_TOSS_PREFLIGHT_LOCAL_REPORT"
};

console.log(JSON.stringify(report, null, 2));
process.exit(readyForReadOnlyCall ? 0 : 1);

function runJsonCommand(command, args) {
  try {
    const output = execFileSync(command, args, {
      cwd: process.cwd(),
      env: process.env
    }).toString();

    return {
      ok: true,
      report: JSON.parse(output)
    };
  } catch (error) {
    const output = String(error.stdout ?? "{}");

    return {
      ok: false,
      report: JSON.parse(output)
    };
  }
}

function withOptionalPath(args, path) {
  return path ? [...args, path] : args;
}
