import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Source-level (static) regression lock, complementing the behavioral tests
 * in the other tests/scripts/*phase5* and tests/scripts/*toss* files.
 *
 * P5-006 requires proof that Phase 5 Toss local preparation scripts never
 * perform network calls and never enable live broker writes. Behavioral
 * tests exercise the scripts end-to-end, but a static scan additionally
 * guards against a future edit silently introducing a network client or
 * turning a hardcoded `false` safety flag into a computed value.
 */

const testDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(testDir, "..", "..");
const scriptsDir = join(repoRoot, "scripts");

const forbiddenNetworkPatterns: RegExp[] = [
  /\bfetch\s*\(/,
  /require\(["']node:https?["']\)/,
  /from\s+["']node:https?["']/,
  /\bhttps?\.request\s*\(/,
  /\bhttps?\.get\s*\(/,
  /\baxios\b/,
  /\bnet\.connect\s*\(/,
  /\bnet\.createConnection\s*\(/,
  /\btls\.connect\s*\(/,
  /\bWebSocket\b/,
  /\bXMLHttpRequest\b/,
  /\bdns\.(resolve|lookup)\w*\s*\(/
];

const forbiddenBrokerWritePatterns: RegExp[] = [
  /\bsubmitOrder\s*\(/,
  /\bcancelOrder\s*\(/,
  /\breplaceOrder\s*\(/
];

// Every Phase 5 Toss local preparation script, regardless of whether it is
// the direct P5-006 focus (preflight, doctor, completion, call-gate) or a
// supporting readiness/catalog/evidence script that other engineers own the
// implementation of. Static safety scanning of implementation files is
// read-only and does not modify those files.
const allPhase5TossScripts = [
  "check-toss-readiness.mjs",
  "phase5-toss-call-gate.mjs",
  "phase5-toss-completion.mjs",
  "phase5-toss-doctor.mjs",
  "phase5-toss-local-setup.mjs",
  "phase5-toss-preflight.mjs",
  "plan-toss-read-only-verification.mjs",
  "promote-toss-evidence-intake.mjs",
  "report-toss-open-questions.mjs",
  "validate-toss-endpoints.mjs",
  "validate-toss-evidence-intake.mjs",
  "validate-toss-evidence-manifest.mjs"
];

describe("Phase 5 Toss scripts perform no network calls (static source scan)", () => {
  it.each(allPhase5TossScripts)("%s does not reference any network call API", (fileName) => {
    const source = readScript(fileName);

    for (const pattern of forbiddenNetworkPatterns) {
      expect(pattern.test(source), `${fileName} must not match ${pattern}`).toBe(false);
    }
  });

  it.each(allPhase5TossScripts)("%s never calls a broker order write function", (fileName) => {
    const source = readScript(fileName);

    for (const pattern of forbiddenBrokerWritePatterns) {
      expect(pattern.test(source), `${fileName} must not match ${pattern}`).toBe(false);
    }
  });
});

describe("Phase 5 Toss scripts hardcode fail-safe defaults (static source scan)", () => {
  const scriptsWithLiveBrokerWriteFlag = [
    "check-toss-readiness.mjs",
    "phase5-toss-call-gate.mjs",
    "phase5-toss-completion.mjs",
    "phase5-toss-doctor.mjs",
    "phase5-toss-local-setup.mjs",
    "phase5-toss-preflight.mjs",
    "plan-toss-read-only-verification.mjs",
    "promote-toss-evidence-intake.mjs",
    "report-toss-open-questions.mjs",
    "validate-toss-endpoints.mjs",
    "validate-toss-evidence-intake.mjs",
    "validate-toss-evidence-manifest.mjs"
  ];

  it.each(scriptsWithLiveBrokerWriteFlag)(
    "%s hardcodes liveBrokerWriteAllowed as the literal false (not a computed value)",
    (fileName) => {
      const source = readScript(fileName);

      expect(/liveBrokerWriteAllowed:\s*false\b/.test(source)).toBe(true);
    }
  );

  const scriptsWithNetworkCallsFlag = [
    "phase5-toss-call-gate.mjs",
    "phase5-toss-completion.mjs",
    "phase5-toss-doctor.mjs",
    "phase5-toss-local-setup.mjs",
    "phase5-toss-preflight.mjs",
    "plan-toss-read-only-verification.mjs",
    "promote-toss-evidence-intake.mjs",
    "validate-toss-evidence-intake.mjs"
  ];

  it.each(scriptsWithNetworkCallsFlag)(
    "%s hardcodes networkCallsPerformed as the literal false (not a computed value)",
    (fileName) => {
      const source = readScript(fileName);

      expect(/networkCallsPerformed:\s*false\b/.test(source)).toBe(true);
    }
  );
});

function readScript(fileName: string): string {
  return readFileSync(join(scriptsDir, fileName), "utf8");
}
