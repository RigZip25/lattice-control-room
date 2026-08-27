import { buildControlRoomReadModel } from "./control-room.js";
import { runDecisionLoop } from "./decision-loop.js";
import { defineFinancialAuthorityPolicy } from "./financial-authority.js";
import { runDurableDryRun } from "./durable-dry-run.js";
import type { BrandId, MarketCellId, WorkspaceId } from "./model.js";
import { defineGrowthContract, type ProductArchetype } from "./product-line.js";
import type { TreasuryWallet } from "./wallet.js";

export interface BrandScenarioProfile {
  readonly id:string;
  readonly name:string;
  readonly archetype:ProductArchetype|"OTHER";
  readonly offering:string;
  readonly audience:string;
  readonly businessModel:string;
  readonly objectives:readonly string[];
  readonly primaryValueEvent:string;
  readonly targetGeographies:readonly string[];
  readonly constraints:readonly string[];
}

function archetype(value:BrandScenarioProfile["archetype"]):ProductArchetype {
  return value==="OTHER"?"RECURRING_UTILITY":value;
}

/** Builds an evidence-honest, zero-spend scenario from a registered brand profile. */
export function runBrandDryRun(profile:BrandScenarioProfile,input:{cycleId:string;now:string;workspaceId?:string}) {
  const workspaceId=(input.workspaceId??"lafwiron") as WorkspaceId;
  const brandId=profile.id as BrandId;
  const geography=profile.targetGeographies[0] ?? "UNSPECIFIED";
  const countryCode=/^[A-Z]{2}$/.test(geography)?geography:"US";
  const marketCellId=`${profile.id}:${countryCode.toLowerCase()}:discovery` as MarketCellId;
  const outcomeMetric=`${profile.primaryValueEvent}_per_usd`;
  const packet=runDecisionLoop({
    productSnapshot:{id:`snapshot_${profile.id}_${input.cycleId}`,workspaceId,brandId,sourceRepository:`profile://${profile.id}`,sourceRevision:input.cycleId,capturedAt:input.now,facts:[
      {key:"declared_offering",value:profile.offering,sourcePath:"brand-profile/offering",semanticClass:"FACT"},
      {key:"declared_business_model",value:profile.businessModel,sourcePath:"brand-profile/business-model",semanticClass:"FACT"},
      {key:"declared_value_event",value:profile.primaryValueEvent,sourcePath:"brand-profile/value-event",semanticClass:"FACT"},
    ]},
    growthContract:defineGrowthContract({workspaceId,brandId,version:1,archetype:archetype(profile.archetype),valueEvent:profile.primaryValueEvent,marketCellDimensions:["geography","segment"],lifecycleStages:["DISCOVERY","PROVE","SCALE","MAINTAIN"],constraintMetrics:["evidence_readiness"],outcomeMetrics:[outcomeMetric],eligiblePlaybooks:["EVIDENCE_FIRST","CONTROLLED_VALIDATION"]}),
    brandPackageDraft:{problem:profile.objectives[0]??`Validate demand for ${profile.name}`,audiences:[profile.audience],claims:[{statement:profile.offering,evidenceFactKeys:["declared_offering"]}],hardConstraints:[...profile.constraints,"No publication or spend in DRY RUN"]},
    marketCell:{id:marketCellId,workspaceId,brandId,countryCode,geographyPath:[geography,"Discovery"],segment:"Initial validation",denominator:{kind:"declared_scope",value:1,observedAt:input.now,semanticClass:"FACT"}},
    hypothesis:{workspaceId,brandId,marketCellId,proposition:`A governed validation message can produce ${profile.primaryValueEvent}.`,counterHypothesis:"The proposed message does not create incremental value.",successMetric:outcomeMetric,minimumEffect:.01,priorConfidence:"LOW"},
    evidence:[],requestedUsd:100,policyVersion:"capital-dry-run-v1",
    content:{audience:profile.audience,message:profile.offering,channel:"simulation",stopCondition:"Stop until observed evidence and legal channel policy are available."},
    distributionPolicy:{version:"distribution-dry-run-v1",workspaceId,mode:"DRY_RUN",allowedBrands:[brandId],allowedChannels:["simulation"],maximumSpendUsd:0},
  });
  const wallet: TreasuryWallet={id:"wallet_lafwiron_usd",workspaceId,currency:"USD",settledUsd:0,pendingUsd:0,reservedUsd:0};
  const authorityPolicy=defineFinancialAuthorityPolicy({workspaceId,version:1,effectiveAt:input.now,currency:"USD",maximumAutonomousDecisionUsd:0,maximumAutonomousDailyUsd:0,maximumReservedExposureUsd:0,brandLimitsUsd:{[profile.id]:0},killSwitch:false});
  const durableCycle=runDurableDryRun({workspaceId,brandId,cycleId:input.cycleId,initialInputRef:`profile://${profile.id}/evidence`,now:input.now});
  return {packet,wallet,authorityPolicy,durableCycle,readModel:buildControlRoomReadModel({generatedAt:input.now,packet,wallet,authorityPolicy})};
}
