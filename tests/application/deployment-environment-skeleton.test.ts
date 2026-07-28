import { describe, expect, it } from "vitest";
import {
  DeploymentEnvironmentSkeletonService,
  deploymentEnvironmentSkeletons,
  loadAppConfig
} from "../../src/index.js";

describe("DeploymentEnvironmentSkeletonService", () => {
  it("defines local, test, staging, and production environments", () => {
    const skeletons = new DeploymentEnvironmentSkeletonService().list();

    expect(skeletons.map((item) => item.name)).toEqual(["development", "test", "staging", "production"]);
    expect(skeletons.every((item) => item.safetyType === "DEPLOYMENT_ENVIRONMENT_SKELETON_ONLY")).toBe(true);
  });

  it("keeps live trading disabled in all generated environments", () => {
    const skeletons = new DeploymentEnvironmentSkeletonService().list();

    expect(skeletons.every((item) => item.liveTradingEnabled === false)).toBe(true);
    expect(new DeploymentEnvironmentSkeletonService().validate(skeletons).ok).toBe(true);
  });

  it("does not require real API credentials in test", () => {
    const test = deploymentEnvironmentSkeletons.find((item) => item.name === "test");
    const config = loadAppConfig({
      APP_ENV: "test",
      LIVE_TRADING_ENABLED: "false"
    }, { requireExternalSecrets: false });

    expect(test?.requiresRealSecrets).toBe(false);
    expect(config.appEnv).toBe("test");
    expect(config.liveTradingEnabled).toBe(false);
  });

  it("rejects unsafe skeletons with live trading enabled by default", () => {
    const unsafe = deploymentEnvironmentSkeletons.map((item) =>
      item.name === "production" ? { ...item, liveTradingEnabled: true as false } : item
    );
    const validation = new DeploymentEnvironmentSkeletonService().validate(unsafe);

    expect(validation.ok).toBe(false);
    expect(validation.reasonCodes).toContain("production_live_trading_enabled_by_default");
  });

  it("does not include raw secret-looking values in secret references", () => {
    const unsafe = deploymentEnvironmentSkeletons.map((item) =>
      item.name === "staging" ? { ...item, secretReferences: ["sk-real-looking-secret"] } : item
    );
    const validation = new DeploymentEnvironmentSkeletonService().validate(unsafe);

    expect(validation.ok).toBe(false);
    expect(validation.reasonCodes).toContain("staging_secret_reference_looks_like_secret_value");
  });
});
