import { ConfigurationError } from "../shared/errors.js";

export type AppEnvironment = "development" | "test" | "staging" | "production";
export type LogLevel = "debug" | "info" | "warn" | "error";

export interface ExternalSecrets {
  tossClientId: string | undefined;
  tossClientSecret: string | undefined;
  tossAccountRef: string | undefined;
  naverClientId: string | undefined;
  naverClientSecret: string | undefined;
  claudeApiKey: string | undefined;
}

export interface AppConfig {
  appEnv: AppEnvironment;
  logLevel: LogLevel;
  liveTradingEnabled: boolean;
  secrets: ExternalSecrets;
}

export interface LoadConfigOptions {
  requireExternalSecrets?: boolean;
}

const appEnvironments = new Set<AppEnvironment>([
  "development",
  "test",
  "staging",
  "production"
]);

const logLevels = new Set<LogLevel>(["debug", "info", "warn", "error"]);

export function loadAppConfig(
  env: NodeJS.ProcessEnv = process.env,
  options: LoadConfigOptions = {}
): AppConfig {
  const appEnv = readEnum(env.APP_ENV ?? "development", appEnvironments, "APP_ENV");
  const logLevel = readEnum(env.LOG_LEVEL ?? "info", logLevels, "LOG_LEVEL");
  const liveTradingEnabled = readBoolean(env.LIVE_TRADING_ENABLED ?? "false", "LIVE_TRADING_ENABLED");
  const requireExternalSecrets = options.requireExternalSecrets ?? appEnv === "production";

  if (liveTradingEnabled && appEnv !== "production") {
    throw new ConfigurationError("LIVE_TRADING_ENABLED can only be true in production.");
  }

  const secrets: ExternalSecrets = {
    tossClientId: emptyToUndefined(env.TOSS_CLIENT_ID),
    tossClientSecret: emptyToUndefined(env.TOSS_CLIENT_SECRET),
    tossAccountRef: emptyToUndefined(env.TOSS_ACCOUNT_REF),
    naverClientId: emptyToUndefined(env.NAVER_CLIENT_ID),
    naverClientSecret: emptyToUndefined(env.NAVER_CLIENT_SECRET),
    claudeApiKey: emptyToUndefined(env.CLAUDE_API_KEY)
  };

  if (requireExternalSecrets) {
    requireSecret(secrets.tossClientId, "TOSS_CLIENT_ID");
    requireSecret(secrets.tossClientSecret, "TOSS_CLIENT_SECRET");
    requireSecret(secrets.tossAccountRef, "TOSS_ACCOUNT_REF");
    requireSecret(secrets.naverClientId, "NAVER_CLIENT_ID");
    requireSecret(secrets.naverClientSecret, "NAVER_CLIENT_SECRET");
    requireSecret(secrets.claudeApiKey, "CLAUDE_API_KEY");
  }

  return {
    appEnv,
    logLevel,
    liveTradingEnabled,
    secrets
  };
}

function readEnum<T extends string>(value: string, allowed: Set<T>, name: string): T {
  if (!allowed.has(value as T)) {
    throw new ConfigurationError(`${name} has unsupported value.`);
  }

  return value as T;
}

function readBoolean(value: string, name: string): boolean {
  if (value === "true") return true;
  if (value === "false") return false;
  throw new ConfigurationError(`${name} must be true or false.`);
}

function requireSecret(value: string | undefined, name: string): void {
  if (!value || value.startsWith("replace-with-")) {
    throw new ConfigurationError(`${name} is required.`);
  }
}

function emptyToUndefined(value: string | undefined): string | undefined {
  if (!value || value.trim() === "") return undefined;
  return value;
}
