import {
  completeDurableJob,
  enqueueDurableJob,
  leaseNextDurableJob,
  type DurableJob,
  type DurableJobKind,
} from "./durable-worker.js";

export interface DryRunStage {
  readonly kind: DurableJobKind;
  readonly inputRef: string;
}

export interface DurableDryRunResult {
  readonly jobs: readonly DurableJob[];
  readonly trace: readonly {
    jobId: string;
    kind: DurableJobKind;
    inputRef: string;
    resultRef: string;
    mode: "DRY_RUN";
  }[];
  readonly externalEffects: 0;
}

export const fullMarketingCycle: readonly DurableJobKind[] = [
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
];

/**
 * Runs the complete contract as durable, deterministic work without invoking a
 * provider, publishing endpoint, payment rail, or human communication channel.
 */
export function runDurableDryRun(input: {
  readonly workspaceId: string;
  readonly brandId: string;
  readonly cycleId: string;
  readonly initialInputRef: string;
  readonly now: string;
}): DurableDryRunResult {
  let jobs: DurableJob[] = [];
  let inputRef = input.initialInputRef;
  const trace: DurableDryRunResult["trace"][number][] = [];

  for (const [index, kind] of fullMarketingCycle.entries()) {
    const queued = enqueueDurableJob(jobs, {
      workspaceId: input.workspaceId,
      brandId: input.brandId,
      kind,
      mode: "DRY_RUN",
      payload: { cycleId: input.cycleId, inputRef, simulation: true },
      idempotencyKey: `${input.cycleId}:${index}:${kind}`,
      now: input.now,
    });
    jobs = queued.jobs;
    const leased = leaseNextDurableJob(jobs, {
      workerId: `dry-run:${kind.toLowerCase()}`,
      now: input.now,
      leaseMs: 60_000,
      kinds: [kind],
    });
    if (!leased.job) throw new Error(`DRY_RUN_STAGE_NOT_LEASED:${kind}`);

    const resultRef = `dry-run://${input.workspaceId}/${input.brandId}/${input.cycleId}/${index + 1}-${kind.toLowerCase()}`;
    const completed = completeDurableJob(leased.jobs, {
      jobId: leased.job.id,
      leaseToken: leased.job.lease!.token,
      resultRef,
      now: input.now,
    });
    jobs = completed.jobs;
    trace.push({ jobId: completed.job.id, kind, inputRef, resultRef, mode: "DRY_RUN" });
    inputRef = resultRef;
  }

  return { jobs, trace, externalEffects: 0 };
}
