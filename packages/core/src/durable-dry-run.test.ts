import { describe, expect, it } from "vitest";
import { fullMarketingCycle, runDurableDryRun } from "./durable-dry-run.js";
import { durableQueueStats } from "./durable-worker.js";

describe("durable full-cycle dry run", () => {
  it("runs every governed stage in order without an external effect", () => {
    const result = runDurableDryRun({
      workspaceId: "lafwiron",
      brandId: "rigzip",
      cycleId: "rigzip-nebraska-001",
      initialInputRef: "brand://rigzip/evidence/v1",
      now: "2026-08-27T12:00:00.000Z",
    });

    expect(result.trace.map((stage) => stage.kind)).toEqual(fullMarketingCycle);
    expect(result.trace.slice(1).every((stage, index) => stage.inputRef === result.trace[index]?.resultRef)).toBe(true);
    expect(result.jobs.every((job) => job.state === "SUCCEEDED" && job.mode === "DRY_RUN")).toBe(true);
    expect(durableQueueStats(result.jobs).SUCCEEDED).toBe(fullMarketingCycle.length);
    expect(result.externalEffects).toBe(0);
  });
});
