import { deterministicId } from "./identity.js";

export interface MarketingPolicySnapshot {
  readonly id: string;
  readonly jurisdiction: string;
  readonly channel: string;
  readonly version: string;
  readonly effectiveAt: string;
  readonly reviewedAt: string;
  readonly maximumAgeDays: number;
  readonly prohibitedCategories: readonly string[];
  readonly prohibitedClaimPatterns: readonly string[];
  readonly requiredDisclosures: readonly string[];
  readonly requiresExplicitConsent: boolean;
  readonly maximumAutomatedActionsPerDay: number;
}

export interface MarketingActionDraft {
  readonly brandId: string;
  readonly jurisdiction: string;
  readonly channel: string;
  readonly category: string;
  readonly claims: readonly string[];
  readonly disclosures: readonly string[];
  readonly hasContentRights: boolean;
  readonly hasAudienceConsent: boolean;
  readonly automatedActionsToday: number;
  readonly scheduledAt: string;
}

export interface ComplianceDecision {
  readonly id: string;
  readonly state: "ALLOW" | "BLOCK" | "REQUIRE_REVIEW";
  readonly reasonCodes: readonly string[];
  readonly policyId: string;
  readonly evidence: readonly string[];
}

const daysBetween = (left:string,right:string) => Math.floor(Math.abs(Date.parse(left)-Date.parse(right))/86_400_000);

export function evaluateMarketingAction(policy:MarketingPolicySnapshot,action:MarketingActionDraft):ComplianceDecision {
  const reasons:string[]=[];
  if (policy.jurisdiction!==action.jurisdiction || policy.channel!==action.channel) reasons.push("POLICY_SCOPE_MISMATCH");
  if (!Number.isFinite(Date.parse(action.scheduledAt)) || daysBetween(policy.reviewedAt,action.scheduledAt)>policy.maximumAgeDays) reasons.push("POLICY_STALE_OR_SCHEDULE_INVALID");
  if (policy.prohibitedCategories.includes(action.category)) reasons.push("PROHIBITED_CATEGORY");
  if (action.claims.some((claim)=>policy.prohibitedClaimPatterns.some((pattern)=>claim.toLowerCase().includes(pattern.toLowerCase())))) reasons.push("PROHIBITED_CLAIM");
  if (policy.requiredDisclosures.some((required)=>!action.disclosures.includes(required))) reasons.push("MISSING_DISCLOSURE");
  if (!action.hasContentRights) reasons.push("CONTENT_RIGHTS_MISSING");
  if (policy.requiresExplicitConsent && !action.hasAudienceConsent) reasons.push("AUDIENCE_CONSENT_MISSING");
  if (action.automatedActionsToday>=policy.maximumAutomatedActionsPerDay) reasons.push("CHANNEL_AUTOMATION_LIMIT_REACHED");
  const hardBlock=reasons.some((reason)=>["POLICY_SCOPE_MISMATCH","PROHIBITED_CATEGORY","PROHIBITED_CLAIM","CONTENT_RIGHTS_MISSING","AUDIENCE_CONSENT_MISSING","CHANNEL_AUTOMATION_LIMIT_REACHED"].includes(reason));
  const state=reasons.length===0?"ALLOW":hardBlock?"BLOCK":"REQUIRE_REVIEW";
  return {id:deterministicId("compliance_decision",{policy,action,reasons}),state,reasonCodes:reasons,policyId:policy.id,evidence:[policy.version,policy.reviewedAt]};
}
