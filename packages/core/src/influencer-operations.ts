import { deterministicId } from "./identity.js";

export interface InfluencerProfile {
  readonly id: string;
  readonly handle: string;
  readonly platform: string;
  readonly territories: readonly string[];
  readonly audienceTopics: readonly string[];
  readonly followers: number;
  readonly verifiedEngagementRate: number;
  readonly riskFlags: readonly string[];
  readonly contactState: "DISCOVERED" | "CONTACTABLE" | "DO_NOT_CONTACT";
}

export interface InfluencerEngagement {
  readonly id: string;
  readonly brandId: string;
  readonly influencerId: string;
  readonly campaignId: string;
  readonly stage: "SHORTLISTED" | "OUTREACH_QUEUED" | "NEGOTIATING" | "CONTRACTED" | "CONTENT_REVIEW" | "LIVE" | "MEASURED";
  readonly compensation: { readonly model: "FIXED" | "AFFILIATE" | "HYBRID"; readonly maximumUsd: number };
  readonly deliverables: readonly string[];
  readonly rights: readonly string[];
  readonly disclosureRequired: boolean;
  readonly ownerApprovalRequired: boolean;
}

export function createInfluencerEngagement(input: Omit<InfluencerEngagement,"id"|"stage"|"ownerApprovalRequired"> & { readonly profile:InfluencerProfile; readonly autonomousSpendLimitUsd:number }):InfluencerEngagement {
  if (input.profile.contactState!=="CONTACTABLE" || input.profile.riskFlags.length>0) throw new Error("Influencer is not eligible for autonomous outreach");
  if (input.deliverables.length===0 || input.rights.length===0 || !input.disclosureRequired) throw new Error("Influencer engagement requires deliverables, rights and disclosure controls");
  const ownerApprovalRequired=input.compensation.maximumUsd>input.autonomousSpendLimitUsd;
  const payload={...input,ownerApprovalRequired};
  return {id:deterministicId("influencer_engagement",payload),brandId:input.brandId,influencerId:input.influencerId,campaignId:input.campaignId,stage:"SHORTLISTED",compensation:input.compensation,deliverables:[...input.deliverables],rights:[...input.rights],disclosureRequired:true,ownerApprovalRequired};
}
