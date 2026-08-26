import { deterministicId } from "./identity.js";

export type CreativeFlowStage = "EVIDENCE_GATHERING" | "PROMPT_DRAFTED" | "LEGAL_PREFLIGHT" | "PROVIDER_DISPATCHED" | "AUTOMATED_QA" | "REWORK" | "LIBRARY_APPROVED" | "MARKETING_QUEUED" | "MEASURING" | "REPORTED" | "FUNDING_REQUESTED" | "OWNER_APPROVAL_REQUIRED";

export interface CreativeAgentPacket {
  readonly id: string;
  readonly brandId: string;
  readonly marketCellId: string;
  readonly stage: CreativeFlowStage;
  readonly evidenceMode: "FIRST_PARTY_WINNERS" | "CITED_EXTERNAL_RESEARCH";
  readonly evidenceIds: readonly string[];
  readonly prompt: string;
  readonly culturalContext: readonly string[];
  readonly assignedCapability: string;
  readonly revision: number;
  readonly legalDecisionId?: string;
  readonly qaFindings: readonly string[];
}

export function creatorAgentDraft(input:{readonly brandId:string;readonly marketCellId:string;readonly objective:string;readonly audience:string;readonly region:string;readonly winningAssetIds:readonly string[];readonly citedResearchSourceIds:readonly string[];readonly supportedClaims:readonly string[];readonly culturalContext:readonly string[];readonly capability:string}):CreativeAgentPacket {
  const evidenceMode=input.winningAssetIds.length>0?"FIRST_PARTY_WINNERS":"CITED_EXTERNAL_RESEARCH";
  const evidenceIds=evidenceMode==="FIRST_PARTY_WINNERS"?input.winningAssetIds:input.citedResearchSourceIds;
  if (evidenceIds.length===0) throw new Error("Creator Agent requires winning creative history or cited external research");
  if (input.supportedClaims.length===0 || input.culturalContext.length===0) throw new Error("Creator Agent requires supported claims and regional cultural context");
  const prompt=[`Objective: ${input.objective}`,`Audience: ${input.audience}`,`Region: ${input.region}`,`Evidence: ${evidenceIds.join(", ")}`,`Supported claims: ${input.supportedClaims.join(" | ")}`,`Cultural safeguards: ${input.culturalContext.join(" | ")}`,"Do not publish. Return draft and provenance metadata."].join("\n");
  const payload={...input,evidenceMode,evidenceIds,prompt};
  return {id:deterministicId("creative_agent_packet",payload),brandId:input.brandId,marketCellId:input.marketCellId,stage:"PROMPT_DRAFTED",evidenceMode,evidenceIds:[...evidenceIds],prompt,culturalContext:[...input.culturalContext],assignedCapability:input.capability,revision:1,qaFindings:[]};
}

export function legalAgentAuthorizePrompt(packet:CreativeAgentPacket,decision:{readonly id:string;readonly state:"ALLOW"|"BLOCK"|"REQUIRE_REVIEW";readonly decidedBy:"LEGAL_POLICY_AGENT"}):CreativeAgentPacket {
  if (packet.stage!=="PROMPT_DRAFTED") throw new Error("Prompt is not ready for legal preflight");
  if (decision.decidedBy!=="LEGAL_POLICY_AGENT" || decision.state!=="ALLOW") throw new Error("Provider dispatch requires Legal Policy Agent ALLOW");
  return {...packet,stage:"PROVIDER_DISPATCHED",legalDecisionId:decision.id};
}

export function executorAgentReview(packet:CreativeAgentPacket,findings:readonly string[]):CreativeAgentPacket {
  if (packet.stage!=="PROVIDER_DISPATCHED" && packet.stage!=="REWORK") throw new Error("Executor QA requires provider output");
  if (findings.length>0) return {...packet,stage:"REWORK",revision:packet.revision+1,qaFindings:[...findings]};
  return {...packet,stage:"LIBRARY_APPROVED",qaFindings:[]};
}

export interface SeniorMarketingDecision {
  readonly id:string;
  readonly packetId:string;
  readonly channel:string;
  readonly budgetUsd:number;
  readonly state:"QUEUED"|"VENTURE_FUNDING_REQUIRED"|"OWNER_APPROVAL_REQUIRED";
  readonly reasonCodes:readonly string[];
}

export function seniorMarketingAllocate(input:{readonly packet:CreativeAgentPacket;readonly channel:string;readonly requestedBudgetUsd:number;readonly availableBrandCapitalUsd:number;readonly delegatedLimitUsd:number;readonly ventureAvailableUsd:number}):SeniorMarketingDecision {
  if (input.packet.stage!=="LIBRARY_APPROVED") throw new Error("Senior Marketing Agent may queue only library-approved creative");
  if (input.requestedBudgetUsd<=0) throw new Error("Promotion budget must be positive");
  const state=input.requestedBudgetUsd>input.delegatedLimitUsd?"OWNER_APPROVAL_REQUIRED":input.requestedBudgetUsd>input.availableBrandCapitalUsd+input.ventureAvailableUsd?"OWNER_APPROVAL_REQUIRED":input.requestedBudgetUsd>input.availableBrandCapitalUsd?"VENTURE_FUNDING_REQUIRED":"QUEUED";
  const reasons=state==="QUEUED"?["WITHIN_BRAND_CAPITAL_AND_AUTHORITY"]:state==="VENTURE_FUNDING_REQUIRED"?["BRAND_CAPITAL_SHORTFALL","VENTURE_CAPITAL_AVAILABLE"]:["AUTHORITY_OR_TOTAL_CAPITAL_INSUFFICIENT"];
  return {id:deterministicId("senior_marketing_decision",{input,state,reasons}),packetId:input.packet.id,channel:input.channel,budgetUsd:input.requestedBudgetUsd,state,reasonCodes:reasons};
}

export interface CommandCenterGrowthReport {
  readonly id:string;
  readonly brandId:string;
  readonly marketCellId:string;
  readonly spendUsd:number;
  readonly engagementRate:number;
  readonly penetrationDelta:number;
  readonly capitalNeededUsd:number;
  readonly destination:"COMMAND_CENTER";
}

export function analyticsAgentReport(input:{readonly packet:CreativeAgentPacket;readonly spendUsd:number;readonly engagements:number;readonly impressions:number;readonly penetrationBefore:number;readonly penetrationAfter:number;readonly recommendedNextBudgetUsd:number;readonly availableCapitalUsd:number}):CommandCenterGrowthReport {
  if (input.impressions<=0 || input.engagements<0 || input.spendUsd<0) throw new Error("Analytics observations are invalid");
  const payload={...input,engagementRate:input.engagements/input.impressions,penetrationDelta:input.penetrationAfter-input.penetrationBefore,capitalNeededUsd:Math.max(0,input.recommendedNextBudgetUsd-input.availableCapitalUsd)};
  return {id:deterministicId("command_center_growth_report",payload),brandId:input.packet.brandId,marketCellId:input.packet.marketCellId,spendUsd:input.spendUsd,engagementRate:payload.engagementRate,penetrationDelta:payload.penetrationDelta,capitalNeededUsd:payload.capitalNeededUsd,destination:"COMMAND_CENTER"};
}

export interface CreativePortfolioPlan {
  readonly id:string;
  readonly totalBudgetUsd:number;
  readonly exploitationBudgetUsd:number;
  readonly explorationBudgetUsd:number;
  readonly stoppedCreativeIds:readonly string[];
  readonly eligibleScaleCreativeIds:readonly string[];
  readonly autonomous:boolean;
  readonly reasonCodes:readonly string[];
}

export function planCreativePortfolio(input:{readonly totalBudgetUsd:number;readonly explorationShare:number;readonly minimumObservationsForScale:number;readonly creatives:readonly {readonly id:string;readonly observations:number;readonly incrementalLift:number;readonly frequency:number;readonly fatigueThreshold:number;readonly policyAllowed:boolean}[];readonly killSwitch:boolean}):CreativePortfolioPlan {
  if (input.totalBudgetUsd<0 || input.explorationShare<0 || input.explorationShare>0.5 || input.minimumObservationsForScale<1) throw new Error("Creative portfolio policy is invalid");
  const stoppedCreativeIds=input.creatives.filter((item)=>!item.policyAllowed || item.frequency>=item.fatigueThreshold || item.incrementalLift<=0).map((item)=>item.id);
  const eligibleScaleCreativeIds=input.creatives.filter((item)=>item.policyAllowed && item.observations>=input.minimumObservationsForScale && item.incrementalLift>0 && item.frequency<item.fatigueThreshold).map((item)=>item.id);
  const explorationBudgetUsd=input.totalBudgetUsd*input.explorationShare;
  const reasons:string[]=[];
  if (input.killSwitch) reasons.push("PORTFOLIO_KILL_SWITCH_ACTIVE");
  if (eligibleScaleCreativeIds.length===0) reasons.push("NO_CAUSALLY_SUPPORTED_CREATIVE_TO_SCALE");
  return {id:deterministicId("creative_portfolio_plan",input),totalBudgetUsd:input.totalBudgetUsd,exploitationBudgetUsd:input.totalBudgetUsd-explorationBudgetUsd,explorationBudgetUsd,stoppedCreativeIds,eligibleScaleCreativeIds,autonomous:reasons.length===0,reasonCodes:reasons};
}
