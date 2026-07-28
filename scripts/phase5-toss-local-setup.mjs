#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import readline from "node:readline";

const args = new Set(process.argv.slice(2));
const force = args.has("--force");
const templatesOnly = args.has("--templates-only");
const dryRun = args.has("--dry-run");
const localDir = resolve(process.cwd(), "tmp/phase5");
const envPath = resolve(process.cwd(), ".env");
const endpointPath = resolve(localDir, "toss-read-only-endpoints.local.json");
const intakePath = resolve(localDir, "evidence-intake.local.json");
const manifestPath = resolve(localDir, "evidence-manifest.local.json");
const approvalPath = resolve(localDir, "read-only-call-approval.local.json");
const readmePath = resolve(localDir, "README.local.md");

const report = {
  localDir,
  envPath,
  filesPrepared: [],
  envWritten: false,
  templatesOnly,
  dryRun,
  reasonCodes: [],
  warnings: [],
  liveBrokerWriteAllowed: false,
  networkCallsPerformed: false,
  safetyType: "PHASE5_TOSS_LOCAL_SETUP_REPORT"
};

if (!dryRun) {
  mkdirSync(localDir, { recursive: true });
}

if (!templatesOnly) {
  if (existsSync(envPath) && !force) {
    report.reasonCodes.push("env_file_already_exists_use_force_to_overwrite");
  } else {
    const env = await collectEnv();
    const envContent = [
      "APP_ENV=development",
      "LOG_LEVEL=info",
      "LIVE_TRADING_ENABLED=false",
      "TOSS_READ_ONLY_MODE=true",
      `TOSS_API_BASE_URL=${escapeEnvValue(env.tossApiBaseUrl)}`,
      `TOSS_CLIENT_ID=${escapeEnvValue(env.tossClientId)}`,
      `TOSS_CLIENT_SECRET=${escapeEnvValue(env.tossClientSecret)}`,
      `TOSS_ACCOUNT_REF=${escapeEnvValue(env.tossAccountRef)}`,
      "",
      "# Optional provider credentials. Leave placeholders unless verifying these providers locally.",
      "NAVER_CLIENT_ID=replace-with-local-secret",
      "NAVER_CLIENT_SECRET=replace-with-local-secret",
      "CLAUDE_API_KEY=replace-with-local-secret",
      ""
    ].join("\n");

    writeLocalFile(envPath, envContent);
    report.envWritten = !dryRun;
  }
}

prepareTemplates();

console.log(JSON.stringify(report, null, 2));
process.exit(report.reasonCodes.length === 0 ? 0 : 1);

async function collectEnv() {
  console.error("Phase 5 Toss local setup");
  console.error("Secrets are written only to local .env. They are not printed in the JSON report.");
  console.error("LIVE_TRADING_ENABLED will be false and TOSS_READ_ONLY_MODE will be true.\n");

  return {
    tossApiBaseUrl: await promptText("Official Toss API base URL: "),
    tossClientId: await promptSecret("Toss client ID: "),
    tossClientSecret: await promptSecret("Toss client secret: "),
    tossAccountRef: await promptSecret("Toss account reference: ")
  };
}

function prepareTemplates() {
  const now = new Date().toISOString();
  const endpoint = readJson("docs/phase5/toss-read-only-endpoints.example.json");
  endpoint.updatedAt = now;
  endpoint.items = endpoint.items.map((item) => ({
    ...item,
    id: item.id === "account-snapshot-example" ? "replace-with-verified-read-only-endpoint-id" : item.id,
    path: item.path.startsWith("/pending-official-verification/")
      ? "/replace-with-official-read-only-path"
      : item.path,
    verified: false,
    notes: "Local working copy. Replace only after confirming the read-only endpoint in official Toss documentation or the developer console. Do not add write endpoints."
  }));

  const intake = readJson("docs/phase5/evidence-intake.example.json");
  intake.preparedAt = now;
  intake.preparedBy = "local-operator";

  const manifest = {
    manifestVersion: "1",
    generatedAt: now,
    environment: "LOCAL",
    evidence: [],
    notes: [
      "Local placeholder manifest. Generate this from reviewed intake with npm run phase5:toss:promote-intake.",
      "Do not add raw Toss payloads, secrets, account numbers, or screenshots containing secrets."
    ]
  };

  const approval = readJson("docs/phase5/read-only-call-approval.example.json");
  approval.id = `local-approval-${now.replaceAll(/[:.]/g, "-")}`;
  approval.approvedAt = now;
  approval.endpointCatalogReference = "replace-with-verified-read-only-endpoint-id";

  writeLocalFile(endpointPath, `${JSON.stringify(endpoint, null, 2)}\n`);
  writeLocalFile(intakePath, `${JSON.stringify(intake, null, 2)}\n`);
  writeLocalFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  writeLocalFile(approvalPath, `${JSON.stringify(approval, null, 2)}\n`);
  writeLocalFile(readmePath, localReadme());
}

function localReadme() {
  return `# Local Phase 5 Toss Read-Only Workspace

This directory is ignored by Git through \`tmp/\`.

Suggested local checks:

\`\`\`bash
npm run phase5:toss:readiness
npm run phase5:toss:endpoints -- tmp/phase5/toss-read-only-endpoints.local.json
npm run phase5:toss:plan -- tmp/phase5/toss-read-only-endpoints.local.json
npm run phase5:toss:intake -- tmp/phase5/evidence-intake.local.json
npm run phase5:toss:evidence -- tmp/phase5/evidence-manifest.local.json
npm run phase5:toss:open-questions -- tmp/phase5/evidence-manifest.local.json
npm run phase5:toss:doctor -- tmp/phase5/toss-read-only-endpoints.local.json tmp/phase5/evidence-manifest.local.json tmp/phase5/evidence-intake.local.json
npm run phase5:toss:preflight -- tmp/phase5/toss-read-only-endpoints.local.json tmp/phase5/evidence-manifest.local.json tmp/phase5/evidence-intake.local.json
PHASE5_TOSS_READ_ONLY_CALL_APPROVED=true npm run phase5:toss:call-gate -- tmp/phase5/toss-read-only-endpoints.local.json tmp/phase5/evidence-manifest.local.json tmp/phase5/evidence-intake.local.json
npm run phase5:toss:completion -- tmp/phase5/toss-read-only-endpoints.local.json tmp/phase5/evidence-manifest.local.json tmp/phase5/evidence-intake.local.json
\`\`\`

Expected default state:

- \`preflight\` and \`completion\` fail closed until credentials, verified endpoints, reviewed intake, valid evidence, and human approval exist.
- \`liveBrokerWriteAllowed\` must remain \`false\`.
- \`networkCallsPerformed\` must remain \`false\`.

Never commit this directory, secrets, raw Toss payloads, raw request headers, account numbers, or screenshots containing secrets.
`;
}

function readJson(path) {
  return JSON.parse(readFileSync(resolve(process.cwd(), path), "utf8"));
}

function writeLocalFile(path, content) {
  report.filesPrepared.push(path);
  if (dryRun) return;
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content, { encoding: "utf8", mode: path.endsWith(".env") ? 0o600 : 0o644 });
}

function escapeEnvValue(value) {
  if (/^[A-Za-z0-9._~:/?#[\]@!$&'()*+,;=%-]+$/.test(value)) return value;
  return JSON.stringify(value);
}

function promptText(question) {
  return new Promise((resolvePrompt) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stderr });
    rl.question(question, (answer) => {
      rl.close();
      resolvePrompt(answer.trim());
    });
  });
}

function promptSecret(question) {
  if (!process.stdin.isTTY) {
    return promptText(question);
  }

  return new Promise((resolvePrompt, rejectPrompt) => {
    let value = "";
    const onData = (chunk) => {
      for (const char of chunk.toString("utf8")) {
        if (char === "\u0003") {
          cleanup();
          rejectPrompt(new Error("Input cancelled."));
          return;
        }

        if (char === "\r" || char === "\n") {
          cleanup();
          process.stderr.write("\n");
          resolvePrompt(value);
          return;
        }

        if (char === "\u007f" || char === "\b") {
          value = value.slice(0, -1);
          continue;
        }

        value += char;
      }
    };

    const cleanup = () => {
      process.stdin.off("data", onData);
      process.stdin.setRawMode(false);
      process.stdin.pause();
    };

    process.stderr.write(question);
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.on("data", onData);
  });
}
