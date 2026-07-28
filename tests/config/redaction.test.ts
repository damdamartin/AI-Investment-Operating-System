import { describe, expect, it } from "vitest";
import { redactObject, redactSecret, redactText } from "../../src/index.js";

describe("redaction", () => {
  it("masks individual secrets", () => {
    expect(redactSecret("abcdef")).toBe("ab****ef");
  });

  it("redacts secret values from text", () => {
    expect(redactText("token is abcdef", ["abcdef"])).toBe("token is ab****ef");
  });

  it("redacts sensitive object keys recursively", () => {
    const redacted = redactObject({
      safe: "visible",
      apiKey: "hidden",
      nested: {
        accountRef: "account-123"
      }
    });

    expect(redacted).toEqual({
      safe: "visible",
      apiKey: "****",
      nested: {
        accountRef: "****"
      }
    });
  });
});
