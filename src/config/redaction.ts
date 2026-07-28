const sensitiveKeyPattern = /(secret|token|api[_-]?key|password|account[_-]?ref|account[_-]?number|client[_-]?secret)/i;

export function redactSecret(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  if (value.length <= 4) return "****";
  return `${value.slice(0, 2)}****${value.slice(-2)}`;
}

export function redactText(input: string, secrets: Array<string | undefined> = []): string {
  let result = input;

  for (const secret of secrets) {
    if (!secret) continue;
    result = result.split(secret).join(redactSecret(secret) ?? "****");
  }

  return result;
}

export function redactObject<T>(input: T): T {
  return redactObjectInternal(input) as T;
}

function redactObjectInternal(input: unknown): unknown {
  if (Array.isArray(input)) {
    return input.map((item) => redactObjectInternal(item));
  }

  if (input !== null && typeof input === "object") {
    return Object.fromEntries(
      Object.entries(input).map(([key, value]) => [
        key,
        sensitiveKeyPattern.test(key) ? "****" : redactObjectInternal(value)
      ])
    );
  }

  return input;
}
