import { describe, expect, it } from "vitest";
import { runDurableDryRun } from "./durable-dry-run.js";
import { buildExecutionHealthSnapshot } from "./execution-observability.js";

describe("execution observability", () => {
  it("reports a healthy zero-cost completed cycle", () => {
    const cycle = runDurableDryRun({ workspaceId: "lafwiron", brandId: "rigzip", cycleId: "cycle-1", initialInputRef: "evidence://v1", now: "2026-08-27T12:00:00.000Z" });
    const snapshot = buildExecutionHealthSnapshot({
      jobs: cycle.jobs,
      telemetry: cycle.trace.map((stage, index) => ({ jobId: stage.jobId, kind: stage.kind, durationMs: index + 1, provider: "internal-dry-run", externalCostUsd: 0, recordedAt: "2026-08-27T12:00:00.000Z" })),
      now: "2026-08-27T12:01:00.000Z",
      maximumRunnableLagMs: 30_000,
    });
    expect(snapshot.health).toBe("HEALTHY");
    expect(snapshot.completed).toBe(13);
    expect(snapshot.externalCostUsd).toBe(0);
  });

  it("fails closed if dry-run telemetry contains an external charge", () => {
    expect(() => buildExecutionHealthSnapshot({ jobs: [], telemetry: [{ jobId: "job", kind: "PROVIDER_EXECUTION", durationMs: 10, provider: "external", externalCostUsd: .01, recordedAt: "2026-08-27T12:00:00.000Z" }], now: "2026-08-27T12:00:00.000Z", maximumRunnableLagMs: 1000 })).toThrow("DRY_RUN_EXTERNAL_COST_DETECTED");
  });
});
