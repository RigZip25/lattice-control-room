import { deterministicId } from "./identity.js";

export const durableJobKinds = [
  "PRODUCT_INTELLIGENCE",
  "PRODUCT_DIAGNOSIS",
  "EXPANSION_THESIS",
  "EXPERIMENT_PLAN",
  "CREATIVE_PROMPT",
  "LEGAL_REVIEW",
  "PROVIDER_EXECUTION",
  "QA_REVIEW",
  "LIBRARY_INGEST",
  "DISTRIBUTION_PLAN",
  "METRIC_INGEST",
  "LEARNING_EVALUATION",
  "CAPITAL_RECOMMENDATION",
] as const;

export type DurableJobKind = (typeof durableJobKinds)[number];
export type DurableJobState = "PENDING" | "LEASED" | "RETRY_WAIT" | "SUCCEEDED" | "DEAD_LETTER";

export interface DurableJob {
  id: string;
  workspaceId: string;
  brandId: string;
  kind: DurableJobKind;
  mode: "DRY_RUN";
  payload: Readonly<Record<string, unknown>>;
  idempotencyKey: string;
  state: DurableJobState;
  attempts: number;
  maxAttempts: number;
  availableAt: string;
  createdAt: string;
  updatedAt: string;
  lease?: Readonly<{ owner: string; token: string; expiresAt: string }>;
  lastError?: Readonly<{ code: string; message: string; failedAt: string }>;
  resultRef?: string;
}

export interface EnqueueDurableJobInput {
  workspaceId: string;
  brandId: string;
  kind: DurableJobKind;
  mode: "DRY_RUN";
  payload: Readonly<Record<string, unknown>>;
  idempotencyKey: string;
  now: string;
  availableAt?: string;
  maxAttempts?: number;
}

export interface DurableQueueMutation {
  jobs: DurableJob[];
  job: DurableJob;
}

export interface EnqueueDurableJobResult extends DurableQueueMutation {
  deduplicated: boolean;
}

function validDate(value: string, field: string): number {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) throw new Error(`INVALID_${field.toUpperCase()}`);
  return timestamp;
}

function replaceJob(jobs: readonly DurableJob[], updated: DurableJob): DurableJob[] {
  return jobs.map((job) => (job.id === updated.id ? updated : job));
}

function requireLease(job: DurableJob, leaseToken: string): void {
  if (job.state !== "LEASED" || !job.lease || job.lease.token !== leaseToken) {
    throw new Error("STALE_OR_INVALID_LEASE");
  }
}

export function enqueueDurableJob(
  jobs: readonly DurableJob[],
  input: EnqueueDurableJobInput,
): EnqueueDurableJobResult {
  if (input.mode !== "DRY_RUN") throw new Error("DRY_RUN_REQUIRED");
  if (!input.workspaceId.trim() || !input.brandId.trim() || !input.idempotencyKey.trim()) {
    throw new Error("INVALID_JOB_IDENTITY");
  }
  validDate(input.now, "now");
  validDate(input.availableAt ?? input.now, "availableAt");
  const maxAttempts = input.maxAttempts ?? 3;
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 20) {
    throw new Error("INVALID_MAX_ATTEMPTS");
  }

  const existing = jobs.find(
    (job) => job.workspaceId === input.workspaceId && job.idempotencyKey === input.idempotencyKey,
  );
  if (existing) return { jobs: [...jobs], job: existing, deduplicated: true };

  const job: DurableJob = {
    id: deterministicId("job", {
      workspaceId: input.workspaceId,
      idempotencyKey: input.idempotencyKey,
    }),
    workspaceId: input.workspaceId,
    brandId: input.brandId,
    kind: input.kind,
    mode: "DRY_RUN",
    payload: input.payload,
    idempotencyKey: input.idempotencyKey,
    state: "PENDING",
    attempts: 0,
    maxAttempts,
    availableAt: input.availableAt ?? input.now,
    createdAt: input.now,
    updatedAt: input.now,
  };
  return { jobs: [...jobs, job], job, deduplicated: false };
}

export function leaseNextDurableJob(
  jobs: readonly DurableJob[],
  input: { workerId: string; now: string; leaseMs: number; kinds?: readonly DurableJobKind[] },
): { jobs: DurableJob[]; job?: DurableJob } {
  const nowMs = validDate(input.now, "now");
  if (!input.workerId.trim() || !Number.isInteger(input.leaseMs) || input.leaseMs < 1) {
    throw new Error("INVALID_LEASE_REQUEST");
  }

  const eligible = jobs
    .filter((job) => {
      if (job.state === "SUCCEEDED" || job.state === "DEAD_LETTER") return false;
      if (input.kinds && !input.kinds.includes(job.kind)) return false;
      if (job.state === "LEASED") return Boolean(job.lease && Date.parse(job.lease.expiresAt) <= nowMs);
      return Date.parse(job.availableAt) <= nowMs;
    })
    .sort((left, right) =>
      left.availableAt.localeCompare(right.availableAt) || left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id),
    )[0];

  if (!eligible) return { jobs: [...jobs] };
  const attempts = eligible.attempts + 1;
  const lease = {
    owner: input.workerId,
    expiresAt: new Date(nowMs + input.leaseMs).toISOString(),
    token: deterministicId("lease", { jobId: eligible.id, workerId: input.workerId, attempts, now: input.now }),
  };
  const updated: DurableJob = { ...eligible, state: "LEASED", attempts, lease, updatedAt: input.now };
  return { jobs: replaceJob(jobs, updated), job: updated };
}

export function completeDurableJob(
  jobs: readonly DurableJob[],
  input: { jobId: string; leaseToken: string; resultRef: string; now: string },
): DurableQueueMutation {
  validDate(input.now, "now");
  const job = jobs.find((candidate) => candidate.id === input.jobId);
  if (!job) throw new Error("JOB_NOT_FOUND");
  requireLease(job, input.leaseToken);
  const { lease: _lease, lastError: _lastError, ...settledJob } = job;
  const updated: DurableJob = {
    ...settledJob,
    state: "SUCCEEDED",
    resultRef: input.resultRef,
    updatedAt: input.now,
  };
  return { jobs: replaceJob(jobs, updated), job: updated };
}

export function failDurableJob(
  jobs: readonly DurableJob[],
  input: { jobId: string; leaseToken: string; code: string; message: string; now: string; retryDelayMs: number },
): DurableQueueMutation {
  const nowMs = validDate(input.now, "now");
  if (!Number.isInteger(input.retryDelayMs) || input.retryDelayMs < 0) throw new Error("INVALID_RETRY_DELAY");
  const job = jobs.find((candidate) => candidate.id === input.jobId);
  if (!job) throw new Error("JOB_NOT_FOUND");
  requireLease(job, input.leaseToken);
  const exhausted = job.attempts >= job.maxAttempts;
  const { lease: _lease, ...releasedJob } = job;
  const updated: DurableJob = {
    ...releasedJob,
    state: exhausted ? "DEAD_LETTER" : "RETRY_WAIT",
    availableAt: exhausted ? job.availableAt : new Date(nowMs + input.retryDelayMs).toISOString(),
    updatedAt: input.now,
    lastError: { code: input.code, message: input.message, failedAt: input.now },
  };
  return { jobs: replaceJob(jobs, updated), job: updated };
}

export function durableQueueStats(jobs: readonly DurableJob[]): Record<DurableJobState, number> {
  return jobs.reduce<Record<DurableJobState, number>>(
    (stats, job) => ({ ...stats, [job.state]: stats[job.state] + 1 }),
    { PENDING: 0, LEASED: 0, RETRY_WAIT: 0, SUCCEEDED: 0, DEAD_LETTER: 0 },
  );
}
