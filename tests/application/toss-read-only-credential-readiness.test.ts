import { describe, expect, it } from "vitest";
import {
  loadAppConfig,
  TossReadOnlyCredentialReadinessService
} from "../../src/index.js";

describe("TossReadOnlyCredentialReadinessService", () => {
  it("approves sanitized readiness when read-only config is complete", () => {
    const config = loadAppConfig({
      APP_ENV: "development",
      LIVE_TRADING_ENABLED: "false",
      TOSS_READ_ONLY_MODE: "true",
      TOSS_API_BASE_URL: "https://official-toss-api.example",
      TOSS_CLIENT_ID: "client-id",
      TOSS_CLIENT_SECRET: "client-secret",
      TOSS_ACCOUNT_REF: "account-ref"
    }, { requireExternalSecrets: false });

    const result = new TossReadOnlyCredentialReadinessService().review(config);

    expect(result.ready).toBe(true);
    expect(result.safeToAttemptReadOnlyCalls).toBe(true);
    expect(result.liveBrokerWriteAllowed).toBe(false);
    expect(JSON.stringify(result)).not.toContain("client-secret");
  });

  it("requires Toss read-only fields before API verification", () => {
    const config = loadAppConfig({}, { requireExternalSecrets: false });
    const result = new TossReadOnlyCredentialReadinessService().review(config);

    expect(result.ready).toBe(false);
    expect(result.missingFields).toContain("TOSS_API_BASE_URL");
    expect(result.missingFields).toContain("TOSS_CLIENT_ID");
    expect(result.missingFields).toContain("TOSS_CLIENT_SECRET");
    expect(result.missingFields).toContain("TOSS_ACCOUNT_REF");
  });

  it("treats placeholder values as missing", () => {
    const config = loadAppConfig({
      TOSS_READ_ONLY_MODE: "true",
      TOSS_API_BASE_URL: "replace-with-official-api-base-url",
      TOSS_CLIENT_ID: "replace-with-local-secret",
      TOSS_CLIENT_SECRET: "replace-with-local-secret",
      TOSS_ACCOUNT_REF: "replace-with-local-secret"
    }, { requireExternalSecrets: false });

    const result = new TossReadOnlyCredentialReadinessService().review(config);

    expect(result.ready).toBe(false);
    expect(result.reasonCodes).toContain("missing_or_placeholder_toss_client_secret");
  });

  it("never approves live broker writes", () => {
    const config = loadAppConfig({
      APP_ENV: "production",
      LIVE_TRADING_ENABLED: "false",
      TOSS_READ_ONLY_MODE: "true",
      TOSS_API_BASE_URL: "https://official-toss-api.example",
      TOSS_CLIENT_ID: "client-id",
      TOSS_CLIENT_SECRET: "client-secret",
      TOSS_ACCOUNT_REF: "account-ref",
      NAVER_CLIENT_ID: "naver-client-id",
      NAVER_CLIENT_SECRET: "naver-client-secret",
      CLAUDE_API_KEY: "claude-api-key"
    });

    const result = new TossReadOnlyCredentialReadinessService().review(config);

    expect(result.ready).toBe(true);
    expect(result.liveBrokerWriteAllowed).toBe(false);
  });
});
