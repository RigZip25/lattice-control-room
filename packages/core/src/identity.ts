import { createHash } from "node:crypto";

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }

  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, canonicalize(child)]),
    );
  }

  return value;
}

export function deterministicId(prefix: string, value: unknown): string {
  const payload = JSON.stringify(canonicalize(value));
  return `${prefix}_${createHash("sha256").update(payload).digest("hex").slice(0, 20)}`;
}

