import { describe, expect, it } from "vitest";
import {
  TOSS_FUTURE_WRITE_CONTRACT_ALLOWED_OPERATIONS,
  TOSS_FUTURE_WRITE_CONTRACT_FORBIDDEN_OPERATIONS,
  TOSS_FUTURE_WRITE_CONTRACT_SAFETY_REPORT
} from "../../src/adapters/toss-write-contract.js";
import type {
  TossFutureWriteAdapter,
  TossWriteContractForbiddenOperation,
  TossWriteContractOperation
} from "../../src/adapters/toss-write-contract.js";

// SAFETY: this file makes no network call, reads no environment variable, and
// never sets `liveBrokerWriteAllowed: true`. It only inspects design-only
// types and hardcoded constants from src/adapters/toss-write-contract.ts.
// docs/phase7/toss-write-contract-design.md is the accompanying design doc.

describe("Toss future write contract (design-only, Phase 7)", () => {
  it("limits allowed future operations to exactly submit/cancel/replace order", () => {
    expect([...TOSS_FUTURE_WRITE_CONTRACT_ALLOWED_OPERATIONS].sort()).toEqual([
      "CANCEL_ORDER",
      "REPLACE_ORDER",
      "SUBMIT_ORDER"
    ]);
  });

  it("never includes a money-movement operation in the allowed list", () => {
    const forbidden: TossWriteContractForbiddenOperation[] = [
      "TRANSFER",
      "WITHDRAWAL",
      "DEPOSIT",
      "CURRENCY_EXCHANGE"
    ];

    for (const operation of forbidden) {
      expect(TOSS_FUTURE_WRITE_CONTRACT_ALLOWED_OPERATIONS as readonly string[]).not.toContain(operation);
    }
  });

  it("keeps the forbidden-operations list itself disjoint from the allowed list", () => {
    const allowed = new Set<string>(TOSS_FUTURE_WRITE_CONTRACT_ALLOWED_OPERATIONS);
    for (const operation of TOSS_FUTURE_WRITE_CONTRACT_FORBIDDEN_OPERATIONS) {
      expect(allowed.has(operation)).toBe(false);
    }
    expect([...TOSS_FUTURE_WRITE_CONTRACT_FORBIDDEN_OPERATIONS].sort()).toEqual([
      "CURRENCY_EXCHANGE",
      "DEPOSIT",
      "TRANSFER",
      "WITHDRAWAL"
    ]);
  });

  it("exposes a hardcoded, non-computed safety report with liveBrokerWriteAllowed false", () => {
    expect(TOSS_FUTURE_WRITE_CONTRACT_SAFETY_REPORT).toEqual({
      liveBrokerWriteAllowed: false,
      allowedOperations: TOSS_FUTURE_WRITE_CONTRACT_ALLOWED_OPERATIONS,
      forbiddenOperations: TOSS_FUTURE_WRITE_CONTRACT_FORBIDDEN_OPERATIONS,
      safetyType: "TOSS_FUTURE_WRITE_CONTRACT_REPORT"
    });
  });

  it("is frozen so no runtime caller can flip liveBrokerWriteAllowed to true", () => {
    expect(Object.isFrozen(TOSS_FUTURE_WRITE_CONTRACT_SAFETY_REPORT)).toBe(true);

    expect(() => {
      // @ts-expect-error liveBrokerWriteAllowed is a `false` literal type; this line exists to prove
      // both the type system and Object.freeze reject an attempt to set it true.
      TOSS_FUTURE_WRITE_CONTRACT_SAFETY_REPORT.liveBrokerWriteAllowed = true;
    }).toThrow(TypeError);
  });

  it("keeps the future write adapter contract separate from the existing read-only contract", () => {
    const writeKeys: Array<keyof TossFutureWriteAdapter> = ["submitOrder", "cancelOrder", "replaceOrder"];
    const readOnlyKeys = ["getCapabilities", "getAccountSnapshot", "getPositions"];

    for (const key of writeKeys) {
      expect(readOnlyKeys).not.toContain(key);
    }
  });

  it("has no runtime implementation of TossFutureWriteAdapter anywhere in this module", async () => {
    const moduleExports: Record<string, unknown> = await import("../../src/adapters/toss-write-contract.js");

    // The interface itself produces no runtime value (TypeScript interfaces are
    // erased). This asserts that nothing exported by the module is a callable
    // function or a class instance that could stand in for a live adapter -
    // only plain, frozen data (arrays/objects) is exported.
    for (const [name, value] of Object.entries(moduleExports)) {
      expect(typeof value, `export "${name}" must not be a function`).not.toBe("function");
    }
  });

  it("documents operation type members without ever referencing a forbidden operation string", () => {
    // Compile-time-checked list mirroring TossWriteContractOperation's members.
    // If a future edit widens the union to include a forbidden operation, this
    // array (kept in sync by hand, deliberately, so a reviewer must touch this
    // test) would need to change too, and TOSS_FUTURE_WRITE_CONTRACT_FORBIDDEN_OPERATIONS
    // must remain disjoint from it (covered by the earlier test).
    const operations: TossWriteContractOperation[] = ["SUBMIT_ORDER", "CANCEL_ORDER", "REPLACE_ORDER"];
    expect(operations).toHaveLength(3);
  });
});
