import { deterministicId } from "./identity.js";
import type { BrandId, WorkspaceId } from "./model.js";

export interface FinancialAuthorityPolicy {
  readonly id: string;
  readonly workspaceId: WorkspaceId;
  readonly version: number;
  readonly effectiveAt: string;
  readonly expiresAt?: string;
  readonly currency: "USD";
  readonly maximumAutonomousDecisionUsd: number;
  readonly maximumAutonomousDailyUsd: number;
  readonly maximumReservedExposureUsd: number;
  readonly brandLimitsUsd: Readonly<Record<string, number>>;
  readonly killSwitch: boolean;
}

export interface FinancialAuthorityEvaluation {
  readonly id: string;
  readonly workspaceId: WorkspaceId;
  readonly policyId: string;
  readonly ventureDecisionId: string;
  readonly result: "AUTONOMOUSLY_AUTHORIZED" | "HUMAN_APPROVAL_REQUIRED" | "DENIED";
  readonly reasonCodes: readonly string[];
  readonly evaluatedAmountUsd: number;
}

export interface HumanFinancialApproval {
  readonly id: string;
  readonly workspaceId: WorkspaceId;
  readonly ventureDecisionId: string;
  readonly approvedAmountUsd: number;
  readonly approverId: string;
  readonly approvedAt: string;
  readonly policyVersion: number;
}

export type CapitalAuthority = FinancialAuthorityEvaluation | HumanFinancialApproval;

export function defineFinancialAuthorityPolicy(
  draft: Omit<FinancialAuthorityPolicy, "id">,
): FinancialAuthorityPolicy {
  const amounts = [
    draft.maximumAutonomousDecisionUsd,
    draft.maximumAutonomousDailyUsd,
    draft.maximumReservedExposureUsd,
    ...Object.values(draft.brandLimitsUsd),
  ];
  if (!Number.isInteger(draft.version) || draft.version < 1) {
    throw new Error("Authority policy version must be a positive integer");
  }
  if (amounts.some((amount) => !Number.isFinite(amount) || amount < 0)) {
    throw new Error("Authority limits must be finite non-negative amounts");
  }
  const payload = { ...draft, brandLimitsUsd: { ...draft.brandLimitsUsd } };
  return { id: deterministicId("financial_authority", payload), ...payload };
}

export function evaluateFinancialAuthority(input: {
  readonly policy: FinancialAuthorityPolicy;
  readonly workspaceId: WorkspaceId;
  readonly brandId: BrandId;
  readonly ventureDecisionId: string;
  readonly amountUsd: number;
  readonly autonomousSpendLast24HoursUsd: number;
  readonly currentReservedExposureUsd: number;
  readonly evaluatedAt: string;
}): FinancialAuthorityEvaluation {
  const { policy } = input;
  if (policy.workspaceId !== input.workspaceId) {
    throw new Error("Financial authority policy belongs to another workspace");
  }
  const denyReasons: string[] = [];
  if (policy.killSwitch) denyReasons.push("KILL_SWITCH_ACTIVE");
  if (input.amountUsd <= 0 || !Number.isFinite(input.amountUsd)) {
    denyReasons.push("INVALID_AMOUNT");
  }
  if (input.evaluatedAt < policy.effectiveAt) denyReasons.push("POLICY_NOT_EFFECTIVE");
  if (policy.expiresAt !== undefined && input.evaluatedAt >= policy.expiresAt) {
    denyReasons.push("POLICY_EXPIRED");
  }

  const approvalReasons: string[] = [];
  if (input.amountUsd > policy.maximumAutonomousDecisionUsd) {
    approvalReasons.push("PER_DECISION_LIMIT_EXCEEDED");
  }
  if (
    input.autonomousSpendLast24HoursUsd + input.amountUsd >
    policy.maximumAutonomousDailyUsd
  ) {
    approvalReasons.push("DAILY_LIMIT_EXCEEDED");
  }
  if (
    input.currentReservedExposureUsd + input.amountUsd >
    policy.maximumReservedExposureUsd
  ) {
    approvalReasons.push("RESERVED_EXPOSURE_LIMIT_EXCEEDED");
  }
  const brandLimit = policy.brandLimitsUsd[input.brandId];
  if (brandLimit !== undefined && input.amountUsd > brandLimit) {
    approvalReasons.push("BRAND_LIMIT_EXCEEDED");
  }

  const result =
    denyReasons.length > 0
      ? "DENIED"
      : approvalReasons.length > 0
        ? "HUMAN_APPROVAL_REQUIRED"
        : "AUTONOMOUSLY_AUTHORIZED";
  const reasons =
    denyReasons.length > 0
      ? denyReasons
      : approvalReasons.length > 0
        ? approvalReasons
        : ["WITHIN_DELEGATED_AUTHORITY"];
  const payload = {
    workspaceId: input.workspaceId,
    policyId: policy.id,
    ventureDecisionId: input.ventureDecisionId,
    result: result as FinancialAuthorityEvaluation["result"],
    reasonCodes: reasons,
    evaluatedAmountUsd: input.amountUsd,
  };
  return { id: deterministicId("authority_evaluation", payload), ...payload };
}
