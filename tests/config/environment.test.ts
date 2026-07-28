import { describe, expect, it } from "vitest";
import { ConfigurationError, loadAppConfig } from "../../src/index.js";

describe("loadAppConfig", () => {
  it("loads safe development defaults without external secrets", () => {
    const config = loadAppConfig({}, { requireExternalSecrets: false });

    expect(config.appEnv).toBe("development");
    expect(config.liveTradingEnabled).toBe(false);
    expect(config.externalApis.tossReadOnlyMode).toBe(true);
  });

  it("blocks live trading outside production", () => {
    expect(() =>
      loadAppConfig({
        APP_ENV: "development",
        LIVE_TRADING_ENABLED: "true"
      })
    ).toThrow(ConfigurationError);
  });

  it("requires secrets when requested", () => {
    expect(() => loadAppConfig({}, { requireExternalSecrets: true })).toThrow(ConfigurationError);
  });

  it("keeps Toss API access in read-only mode until live gates are approved", () => {
    expect(() =>
      loadAppConfig({
        TOSS_READ_ONLY_MODE: "false"
      })
    ).toThrow(ConfigurationError);
  });

  it("accepts production config only when required secrets exist", () => {
    const config = loadAppConfig({
      APP_ENV: "production",
      LIVE_TRADING_ENABLED: "false",
      TOSS_READ_ONLY_MODE: "true",
      TOSS_API_BASE_URL: "https://official-toss-api.example",
      TOSS_CLIENT_ID: "toss-client-id",
      TOSS_CLIENT_SECRET: "toss-client-secret",
      TOSS_ACCOUNT_REF: "toss-account-ref",
      NAVER_CLIENT_ID: "naver-client-id",
      NAVER_CLIENT_SECRET: "naver-client-secret",
      CLAUDE_API_KEY: "claude-api-key"
    });

    expect(config.appEnv).toBe("production");
    expect(config.externalApis.tossApiBaseUrl).toBe("https://official-toss-api.example");
    expect(config.secrets.claudeApiKey).toBe("claude-api-key");
  });
});
