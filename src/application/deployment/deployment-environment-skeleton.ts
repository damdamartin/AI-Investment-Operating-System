import type { AppEnvironment, LogLevel } from "../../config/index.js";

export interface DeploymentEnvironmentSkeleton {
  name: AppEnvironment;
  logLevel: LogLevel;
  liveTradingEnabled: false;
  requiresRealSecrets: boolean;
  secretReferences: string[];
  notes: string[];
  safetyType: "DEPLOYMENT_ENVIRONMENT_SKELETON_ONLY";
}

export interface DeploymentSkeletonValidation {
  ok: boolean;
  reasonCodes: string[];
  safetyType: "DEPLOYMENT_SKELETON_VALIDATION_ONLY";
}

export const deploymentEnvironmentSkeletons: DeploymentEnvironmentSkeleton[] = [
  skeleton("development", "debug", false, [
    "mock APIs preferred",
    "no production secrets"
  ]),
  skeleton("test", "error", false, [
    "automated tests do not require real external API credentials",
    "mock or fixture data only"
  ]),
  skeleton("staging", "info", true, [
    "production-like validation",
    "paper trading and read-only broker checks only by default"
  ]),
  skeleton("production", "info", true, [
    "live trading disabled by default",
    "production enablement requires readiness review and approval"
  ])
];

export class DeploymentEnvironmentSkeletonService {
  list(): DeploymentEnvironmentSkeleton[] {
    return deploymentEnvironmentSkeletons.map((item) => ({
      ...item,
      secretReferences: [...item.secretReferences],
      notes: [...item.notes]
    }));
  }

  validate(skeletons: DeploymentEnvironmentSkeleton[] = deploymentEnvironmentSkeletons): DeploymentSkeletonValidation {
    const reasonCodes: string[] = [];
    const names = new Set(skeletons.map((item) => item.name));

    for (const required of ["development", "test", "staging", "production"] as const) {
      if (!names.has(required)) reasonCodes.push(`missing_${required}_environment`);
    }

    for (const skeleton of skeletons) {
      if (skeleton.liveTradingEnabled !== false) {
        reasonCodes.push(`${skeleton.name}_live_trading_enabled_by_default`);
      }
      if (skeleton.secretReferences.some((reference) => looksLikeSecretValue(reference))) {
        reasonCodes.push(`${skeleton.name}_secret_reference_looks_like_secret_value`);
      }
      if (skeleton.name === "test" && skeleton.requiresRealSecrets) {
        reasonCodes.push("test_environment_requires_real_secrets");
      }
    }

    return {
      ok: reasonCodes.length === 0,
      reasonCodes: reasonCodes.sort(),
      safetyType: "DEPLOYMENT_SKELETON_VALIDATION_ONLY"
    };
  }
}

function skeleton(
  name: AppEnvironment,
  logLevel: LogLevel,
  requiresRealSecrets: boolean,
  notes: string[]
): DeploymentEnvironmentSkeleton {
  return {
    name,
    logLevel,
    liveTradingEnabled: false,
    requiresRealSecrets,
    secretReferences: [
      `secret-ref:toss-client-id-${name}`,
      `secret-ref:toss-client-secret-${name}`,
      `secret-ref:toss-account-ref-${name}`,
      `secret-ref:naver-client-id-${name}`,
      `secret-ref:naver-client-secret-${name}`,
      `secret-ref:claude-api-key-${name}`
    ],
    notes,
    safetyType: "DEPLOYMENT_ENVIRONMENT_SKELETON_ONLY"
  };
}

function looksLikeSecretValue(value: string): boolean {
  return /sk-[A-Za-z0-9_-]+|token[=:]|password[=:]/i.test(value);
}
