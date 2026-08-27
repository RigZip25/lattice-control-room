import type { DurableJob, DurableJobKind } from "./durable-worker.js";

export interface ExecutionTelemetry {
  readonly jobId: string;
  readonly kind: DurableJobKind;
  readonly durationMs: number;
  readonly provider: string;
  readonly externalCostUsd: number;
  readonly recordedAt: string;
}

export interface ExecutionHealthSnapshot {
  readonly generatedAt: string;
  readonly health: "HEALTHY" | "DEGRADED" | "BLOCKED";
  readonly pending: number;
  readonly running: number;
  readonly retrying: number;
  readonly deadLetter: number;
  readonly expiredLeases: number;
  readonly oldestRunnableLagMs: number;
  readonly completed: number;
  readonly p95DurationMs: number;
  readonly externalCostUsd: 0;
  readonly reasonCodes: readonly string[];
}

function percentile95(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const ordered = [...values].sort((left, right) => left - right);
  return ordered[Math.ceil(ordered.length * .95) - 1] ?? 0;
}

export function buildExecutionHealthSnapshot(input: {
  readonly jobs: readonly DurableJob[];
  readonly telemetry: readonly ExecutionTelemetry[];
  readonly now: string;
  readonly maximumRunnableLagMs: number;
}): ExecutionHealthSnapshot {
  const nowMs = Date.parse(input.now);
  if (!Number.isFinite(nowMs) || input.maximumRunnableLagMs < 0) throw new Error("INVALID_HEALTH_SNAPSHOT_INPUT");
  if (input.telemetry.some((item) => item.externalCostUsd !== 0)) throw new Error("DRY_RUN_EXTERNAL_COST_DETECTED");
  if (input.telemetry.some((item) => item.durationMs < 0 || !Number.isFinite(item.durationMs))) throw new Error("INVALID_EXECUTION_DURATION");

  const runnable = input.jobs.filter((job) => (job.state === "PENDING" || job.state === "RETRY_WAIT") && Date.parse(job.availableAt) <= nowMs);
  const oldestRunnableLagMs = runnable.reduce((maximum, job) => Math.max(maximum, nowMs - Date.parse(job.availableAt)), 0);
  const expiredLeases = input.jobs.filter((job) => job.state === "LEASED" && job.lease && Date.parse(job.lease.expiresAt) <= nowMs).length;
  const deadLetter = input.jobs.filter((job) => job.state === "DEAD_LETTER").length;
  const reasons = [
    ...(deadLetter > 0 ? ["DEAD_LETTER_NOT_EMPTY"] : []),
    ...(expiredLeases > 0 ? ["EXPIRED_LEASES_PRESENT"] : []),
    ...(oldestRunnableLagMs > input.maximumRunnableLagMs ? ["RUNNABLE_QUEUE_LAG_EXCEEDED"] : []),
  ];
  const health = deadLetter > 0 ? "BLOCKED" : reasons.length > 0 ? "DEGRADED" : "HEALTHY";
  return {
    generatedAt: input.now,
    health,
    pending: input.jobs.filter((job) => job.state === "PENDING").length,
    running: input.jobs.filter((job) => job.state === "LEASED").length,
    retrying: input.jobs.filter((job) => job.state === "RETRY_WAIT").length,
    deadLetter,
    expiredLeases,
    oldestRunnableLagMs,
    completed: input.jobs.filter((job) => job.state === "SUCCEEDED").length,
    p95DurationMs: percentile95(input.telemetry.map((item) => item.durationMs)),
    externalCostUsd: 0,
    reasonCodes: reasons,
  };
}
