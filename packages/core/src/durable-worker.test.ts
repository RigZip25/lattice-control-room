import { describe, expect, it } from "vitest";
import {
  completeDurableJob,
  durableQueueStats,
  enqueueDurableJob,
  failDurableJob,
  leaseNextDurableJob,
  type DurableJob,
} from "./durable-worker.js";

const now = "2026-08-27T12:00:00.000Z";

function enqueue(jobs: readonly DurableJob[] = [], maxAttempts = 3) {
  return enqueueDurableJob(jobs, {
    workspaceId: "lafwiron",
    brandId: "rigzip",
    kind: "PRODUCT_INTELLIGENCE",
    mode: "DRY_RUN",
    payload: { product: "RigZip" },
    idempotencyKey: "rigzip:intelligence:v1",
    maxAttempts,
    now,
  });
}

describe("durable worker", () => {
  it("deduplicates jobs within a workspace", () => {
    const first = enqueue();
    const second = enqueue(first.jobs);
    expect(second.deduplicated).toBe(true);
    expect(second.jobs).toHaveLength(1);
    expect(second.job.id).toBe(first.job.id);
  });

  it("leases and completes a job with an immutable result reference", () => {
    const queued = enqueue();
    const leased = leaseNextDurableJob(queued.jobs, { workerId: "worker-1", now, leaseMs: 30_000 });
    expect(leased.job?.attempts).toBe(1);
    const completed = completeDurableJob(leased.jobs, {
      jobId: leased.job!.id,
      leaseToken: leased.job!.lease!.token,
      resultRef: "evidence:rigzip:v1",
      now: "2026-08-27T12:00:05.000Z",
    });
    expect(completed.job.state).toBe("SUCCEEDED");
    expect(completed.job.resultRef).toBe("evidence:rigzip:v1");
    expect(durableQueueStats(completed.jobs).SUCCEEDED).toBe(1);
  });

  it("reclaims an expired lease and rejects the stale worker token", () => {
    const firstLease = leaseNextDurableJob(enqueue().jobs, { workerId: "worker-1", now, leaseMs: 1_000 });
    const reclaimed = leaseNextDurableJob(firstLease.jobs, {
      workerId: "worker-2",
      now: "2026-08-27T12:00:02.000Z",
      leaseMs: 1_000,
    });
    expect(reclaimed.job?.attempts).toBe(2);
    expect(() =>
      completeDurableJob(reclaimed.jobs, {
        jobId: reclaimed.job!.id,
        leaseToken: firstLease.job!.lease!.token,
        resultRef: "stale",
        now: "2026-08-27T12:00:02.500Z",
      }),
    ).toThrow("STALE_OR_INVALID_LEASE");
  });

  it("retries with backoff and enters dead letter after the final attempt", () => {
    let jobs = enqueue([], 2).jobs;
    const first = leaseNextDurableJob(jobs, { workerId: "worker", now, leaseMs: 1_000 });
    jobs = failDurableJob(first.jobs, {
      jobId: first.job!.id,
      leaseToken: first.job!.lease!.token,
      code: "PROVIDER_TIMEOUT",
      message: "simulated timeout",
      now,
      retryDelayMs: 10_000,
    }).jobs;
    expect(jobs[0]?.state).toBe("RETRY_WAIT");
    expect(leaseNextDurableJob(jobs, { workerId: "worker", now, leaseMs: 1_000 }).job).toBeUndefined();

    const second = leaseNextDurableJob(jobs, {
      workerId: "worker",
      now: "2026-08-27T12:00:10.000Z",
      leaseMs: 1_000,
    });
    const failed = failDurableJob(second.jobs, {
      jobId: second.job!.id,
      leaseToken: second.job!.lease!.token,
      code: "PROVIDER_TIMEOUT",
      message: "simulated timeout",
      now: "2026-08-27T12:00:10.000Z",
      retryDelayMs: 10_000,
    });
    expect(failed.job.state).toBe("DEAD_LETTER");
    expect(durableQueueStats(failed.jobs).DEAD_LETTER).toBe(1);
  });

  it("fails closed when a caller attempts a non-dry-run job", () => {
    expect(() =>
      enqueueDurableJob([], {
        workspaceId: "lafwiron",
        brandId: "rigzip",
        kind: "DISTRIBUTION_PLAN",
        mode: "LIVE" as "DRY_RUN",
        payload: {},
        idempotencyKey: "forbidden",
        now,
      }),
    ).toThrow("DRY_RUN_REQUIRED");
  });
});
