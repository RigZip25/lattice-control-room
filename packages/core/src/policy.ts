import { deterministicId } from "./identity.js";
import type {
  CapitalDecision,
  ContentBrief,
  DistributionAuthorization,
} from "./model.js";

export interface DistributionPolicy {
  readonly version: string;
  readonly workspaceId: string;
  readonly mode: "DRY_RUN" | "NON_PRODUCTION" | "PRODUCTION";
  readonly allowedBrands: readonly string[];
  readonly allowedChannels: readonly string[];
  readonly maximumSpendUsd: number;
  readonly expiresAt?: string;
}

export function evaluateDistributionAuthorization(
  brief: ContentBrief,
  decision: CapitalDecision,
  policy: DistributionPolicy,
): DistributionAuthorization {
  const base = {
    contentBriefId: brief.id,
    workspaceId: brief.workspaceId,
    brandId: brief.brandId,
    marketCellId: brief.marketCellId,
    channel: brief.channel,
    maximumSpendUsd: Math.min(decision.approvedUsd, policy.maximumSpendUsd),
    policyVersion: policy.version,
  } as const;

  const reasons: string[] = [];
  if (decision.workspaceId !== brief.workspaceId) reasons.push("DECISION_WORKSPACE_MISMATCH");
  if (policy.workspaceId !== brief.workspaceId) reasons.push("WORKSPACE_NOT_ALLOWED");
  if (policy.mode !== "PRODUCTION") reasons.push("PRODUCTION_MODE_DISABLED");
  if (!policy.allowedBrands.includes(brief.brandId)) reasons.push("BRAND_NOT_ALLOWED");
  if (!policy.allowedChannels.includes(brief.channel)) reasons.push("CHANNEL_NOT_ALLOWED");
  if (decision.kind !== "APPROVE" && decision.kind !== "MODIFY") {
    reasons.push("CAPITAL_NOT_APPROVED");
  }
  if (decision.approvedUsd <= 0) reasons.push("NO_APPROVED_CAPITAL");

  const authorized = reasons.length === 0;
  const payload = {
    ...base,
    state: authorized ? ("AUTHORIZED" as const) : ("BLOCKED" as const),
    reason: authorized ? "POLICY_SCOPE_SATISFIED" : reasons.join("|"),
    ...(policy.expiresAt === undefined ? {} : { expiresAt: policy.expiresAt }),
  };

  return { id: deterministicId("distribution_auth", payload), ...payload };
}
