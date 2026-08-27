import { deterministicId } from "./identity.js";
import { expansionCandidateScore } from "./expansion-thesis.js";
import type { runGovernedRigZipCycle } from "./governed-cycle.js";

type GovernedArtifacts = ReturnType<typeof runGovernedRigZipCycle>;
export type EvidenceBoundStage = "PRODUCT_INTELLIGENCE" | "PRODUCT_DIAGNOSIS" | "EXPANSION_THESIS" | "EXPERIMENT_PLAN" | "CREATIVE_PROMPT" | "LEGAL_REVIEW" | "PROVIDER_EXECUTION" | "QA_REVIEW" | "LIBRARY_INGEST";

export interface AgentArtifactEnvelope<T> {
  readonly id: string;
  readonly cycleId: string;
  readonly stage: EvidenceBoundStage;
  readonly agent: { readonly role: string; readonly implementation: "LOCAL_EVIDENCE_BOUND"; readonly version: 1 };
  readonly evidenceRefs: readonly string[];
  readonly facts: readonly string[];
  readonly inferences: readonly string[];
  readonly unknowns: readonly string[];
  readonly payload: T;
  readonly createdAt: string;
  readonly mode: "DRY_RUN";
  readonly externalEffects: 0;
}

function envelope<T>(input: Omit<AgentArtifactEnvelope<T>, "id" | "mode" | "externalEffects">): AgentArtifactEnvelope<T> {
  const governed={...input,mode:"DRY_RUN" as const,externalEffects:0 as const};
  return {...governed,id:deterministicId("agent_artifact",governed)};
}

export function executeProductIntelligenceAgent(input:{cycleId:string;artifacts:GovernedArtifacts;createdAt:string}) {
  const facts=input.artifacts.evidence.filter((item)=>item.classification==="FACT");
  const unknowns=input.artifacts.evidence.filter((item)=>item.classification==="UNKNOWN");
  return envelope({
    cycleId:input.cycleId,stage:"PRODUCT_INTELLIGENCE",createdAt:input.createdAt,
    agent:{role:"Senior Product Intelligence Analyst",implementation:"LOCAL_EVIDENCE_BOUND",version:1},
    evidenceRefs:input.artifacts.sources.map((source)=>source.id),
    facts:facts.map((item)=>item.statement),inferences:[],unknowns:unknowns.map((item)=>item.statement),
    payload:{sources:input.artifacts.sources,evidence:input.artifacts.evidence,readiness:input.artifacts.readiness},
  });
}

export function executeProductDiagnosisAgent(input:{cycleId:string;artifacts:GovernedArtifacts;intelligence:ReturnType<typeof executeProductIntelligenceAgent>;createdAt:string}) {
  if (input.intelligence.payload.readiness.state!=="READY_FOR_DIAGNOSIS") throw new Error("Product diagnosis agent is blocked by intelligence readiness");
  const diagnosis=input.artifacts.diagnosis;
  return envelope({
    cycleId:input.cycleId,stage:"PRODUCT_DIAGNOSIS",createdAt:input.createdAt,
    agent:{role:"Senior Product Strategist",implementation:"LOCAL_EVIDENCE_BOUND",version:1},
    evidenceRefs:diagnosis.evidenceIds,
    facts:input.intelligence.facts,
    inferences:[diagnosis.valueThesis,...diagnosis.priorityAudiences.map((audience)=>`Priority audience: ${audience}`)],
    unknowns:diagnosis.unresolvedQuestions,
    payload:{diagnosis,readinessGate:input.intelligence.payload.readiness.state},
  });
}

export function executeExpansionThesisAgent(input:{cycleId:string;artifacts:GovernedArtifacts;diagnosis:ReturnType<typeof executeProductDiagnosisAgent>;createdAt:string}) {
  if (input.diagnosis.payload.diagnosis.id!==input.artifacts.expansionThesis.diagnosisId) throw new Error("Expansion thesis agent diagnosis provenance is invalid");
  const ranking=input.artifacts.expansionThesis.candidates.map((candidate)=>({candidate,score:expansionCandidateScore(candidate)})).sort((a,b)=>b.score-a.score);
  return envelope({
    cycleId:input.cycleId,stage:"EXPANSION_THESIS",createdAt:input.createdAt,
    agent:{role:"Global Expansion Strategist",implementation:"LOCAL_EVIDENCE_BOUND",version:1},
    evidenceRefs:[input.diagnosis.id,...input.diagnosis.evidenceRefs],
    facts:input.diagnosis.facts,
    inferences:ranking.map((item,index)=>`${index+1}. ${item.candidate.geographyName}: ${item.score}`),
    unknowns:ranking.flatMap((item)=>item.candidate.validationQuestions),
    payload:{thesis:input.artifacts.expansionThesis,ranking,recommendedCandidate:ranking[0]?.candidate.geographyName},
  });
}

export function executeExperimentPlannerAgent(input:{cycleId:string;artifacts:GovernedArtifacts;expansion:ReturnType<typeof executeExpansionThesisAgent>;createdAt:string}) {
  const geography=input.expansion.payload.recommendedCandidate;
  if (!geography) throw new Error("Experiment Planner requires a ranked expansion candidate");
  const primaryMetric=input.artifacts.metric;
  const hypothesis=`Showing verified nearby commercial asset availability in ${geography} increases qualified registrations.`;
  const payload={
    geography,
    hypothesis,
    primaryMetric:{id:primaryMetric.id,key:primaryMetric.key,semanticClass:"FORECAST" as const},
    design:{control:"Current generic marketplace message",treatment:"Local verified-availability message",unit:"market-cell",minimumObservations:500},
    channelCandidates:["meta_ads","seo_local_landing","regional_marketplace_partnership"],
    simulatedBudgetUsd:100,
    realSpendAuthorized:false,
    stopConditions:["Any legal decision other than ALLOW","Qualified registration lift is non-positive","Evidence quality falls below USABLE"],
  };
  return envelope({
    cycleId:input.cycleId,stage:"EXPERIMENT_PLAN",createdAt:input.createdAt,
    agent:{role:"Senior Growth Experiment Designer",implementation:"LOCAL_EVIDENCE_BOUND",version:1},
    evidenceRefs:[input.expansion.id,...input.expansion.evidenceRefs,primaryMetric.id],
    facts:input.expansion.facts,
    inferences:[hypothesis,`Test geography: ${geography}`],
    unknowns:["The strongest incremental acquisition channel remains unverified."],
    payload,
  });
}

export function executeCreativeBriefAgent(input:{cycleId:string;artifacts:GovernedArtifacts;experiment:ReturnType<typeof executeExperimentPlannerAgent>;createdAt:string}) {
  const packet=input.artifacts.creativePacket;
  if (!input.experiment.evidenceRefs.length || !packet.evidenceIds.length) throw new Error("Creative Brief Agent requires experiment and creative evidence");
  return envelope({
    cycleId:input.cycleId,stage:"CREATIVE_PROMPT",createdAt:input.createdAt,
    agent:{role:"Senior Creative Strategy Director",implementation:"LOCAL_EVIDENCE_BOUND",version:1},
    evidenceRefs:[input.experiment.id,...packet.evidenceIds],
    facts:input.experiment.facts,
    inferences:[`Creative treatment supports experiment ${input.experiment.id}`],
    unknowns:["No first-party winning creative exists yet; cited research is used as the starting prior."],
    payload:{
      experimentId:input.experiment.id,
      packet,
      supportedClaims:["Find nearby commercial assets"],
      requiredDisclosures:["Marketplace availability varies"],
      constraints:[...packet.culturalContext,"Do not publish","Do not claim guaranteed inventory"],
      providerDispatchAuthorized:false,
    },
  });
}

export function executeLegalReviewAgent(input:{cycleId:string;artifacts:GovernedArtifacts;creative:ReturnType<typeof executeCreativeBriefAgent>;createdAt:string}) {
  const decision=input.artifacts.legalDecision;
  if (decision.decidedBy!=="LEGAL_POLICY_AGENT") throw new Error("Legal review provenance is invalid");
  if (decision.state!=="ALLOW" || decision.executionAuthority!=="AUTONOMOUS") throw new Error(`Legal gate withheld provider execution: ${decision.reasonCodes.join(",")||decision.state}`);
  const policy=input.artifacts.legalPolicy;
  return envelope({
    cycleId:input.cycleId,stage:"LEGAL_REVIEW",createdAt:input.createdAt,
    agent:{role:"Autonomous Marketing Legal Counsel",implementation:"LOCAL_EVIDENCE_BOUND",version:1},
    evidenceRefs:[input.creative.id,decision.policyId,...decision.evidence],
    facts:[...input.creative.facts,`Policy ${policy.id} reviewed at ${policy.reviewedAt}.`],
    inferences:["Creative content is authorized inside the governed dry-run envelope."],
    unknowns:[],
    payload:{
      creativeArtifactId:input.creative.id,
      policy,
      decision,
      checks:{scope:true,claims:true,disclosures:true,contentRights:true,audienceConsent:true,automationLimit:true},
      gate:{contentAuthorized:true,providerDispatchAuthorized:false,reason:"DRY_RUN_EXTERNAL_EFFECTS_DISABLED" as const},
    },
  });
}

export function executeProviderSimulatorAgent(input:{cycleId:string;artifacts:GovernedArtifacts;legal:ReturnType<typeof executeLegalReviewAgent>;createdAt:string}) {
  if (!input.legal.payload.gate.contentAuthorized) throw new Error("Provider Simulator requires legal content authorization");
  const request=input.artifacts.providerRequest;
  if (request.externalExecution!=="BLOCKED") throw new Error("DRY RUN Provider Simulator refuses externally authorized requests");
  const output=input.artifacts.asset;
  if (output.requestId!==request.id || output.actualCostUsd!==0) throw new Error("Provider simulation provenance or cost is invalid");
  return envelope({
    cycleId:input.cycleId,stage:"PROVIDER_EXECUTION",createdAt:input.createdAt,
    agent:{role:"Content Production Capability Router",implementation:"LOCAL_EVIDENCE_BOUND",version:1},
    evidenceRefs:[input.legal.id,input.legal.payload.decision.id,request.id],
    facts:input.legal.facts,
    inferences:[`Capability ${request.providerCapability} can satisfy the governed brief in simulation.`],
    unknowns:["Real provider latency, quality and unit cost remain unobserved."],
    payload:{
      request,
      output,
      execution:{mode:"SIMULATED" as const,externalCallMade:false,binaryGenerated:false,actualCostUsd:0},
    },
  });
}

export function executeQaReviewAgent(input:{cycleId:string;artifacts:GovernedArtifacts;provider:ReturnType<typeof executeProviderSimulatorAgent>;createdAt:string}) {
  const {request,output}=input.provider.payload;
  const briefClaims=input.artifacts.creativePacket.prompt;
  const unsupportedClaims=output.usedClaims.filter((claim)=>!briefClaims.includes(claim));
  const findings:string[]=[];
  if (output.requestId!==request.id) findings.push("REQUEST_LINEAGE_MISMATCH");
  if (output.brandId!==input.artifacts.creativePacket.brandId) findings.push("BRAND_LINEAGE_MISMATCH");
  if (unsupportedClaims.length) findings.push("UNSUPPORTED_CLAIM");
  if (input.artifacts.legalDecision.state!=="ALLOW") findings.push("LEGAL_CLEARANCE_MISSING");
  if (output.actualCostUsd>request.maximumCostUsd) findings.push("PRODUCTION_COST_LIMIT_EXCEEDED");
  if (findings.length) throw new Error(`Automated QA requires rework: ${findings.join(",")}`);
  return envelope({
    cycleId:input.cycleId,stage:"QA_REVIEW",createdAt:input.createdAt,
    agent:{role:"Autonomous Creative Quality Director",implementation:"LOCAL_EVIDENCE_BOUND",version:1},
    evidenceRefs:[input.provider.id,request.id,output.id,input.artifacts.legalDecision.id],
    facts:input.provider.facts,
    inferences:["The simulated output preserves approved claims, legal clearance and production lineage."],
    unknowns:["Visual and audiovisual quality require provider-specific analyzers when binary generation is enabled."],
    payload:{
      providerArtifactId:input.provider.id,
      output,
      checks:{requestLineage:true,brandLineage:true,supportedClaims:true,legalClearance:true,costAuthority:true},
      findings:[],
      disposition:"PASS" as const,
      reworkRequired:false,
    },
  });
}

export function executeLibraryIngestAgent(input:{cycleId:string;artifacts:GovernedArtifacts;qa:ReturnType<typeof executeQaReviewAgent>;createdAt:string}) {
  if (input.qa.payload.disposition!=="PASS" || input.qa.payload.reworkRequired) throw new Error("Creative Library accepts only QA-approved output");
  const record=input.artifacts.libraryAsset;
  if (record.lineage.requestId!==input.qa.payload.output.requestId || record.state!=="APPROVED") throw new Error("Creative Library lineage is invalid");
  if (!record.rights.usage.includes("DRY_RUN_EVALUATION")) throw new Error("Creative Library usage rights do not allow dry-run evaluation");
  return envelope({
    cycleId:input.cycleId,stage:"LIBRARY_INGEST",createdAt:input.createdAt,
    agent:{role:"Brand Asset Librarian",implementation:"LOCAL_EVIDENCE_BOUND",version:1},
    evidenceRefs:[input.qa.id,input.qa.payload.output.id,record.lineage.briefId,record.lineage.requestId],
    facts:input.qa.facts,
    inferences:["The approved metadata record is reusable for governed dry-run evaluation."],
    unknowns:["No binary creative has been generated or uploaded in DRY RUN."],
    payload:{
      qaArtifactId:input.qa.id,
      record,
      storage:{metadataPersisted:true,binaryUploaded:false,objectKeyReserved:record.objectKey},
      rightsGate:{ownerVerified:Boolean(record.rights.owner),usageAuthorized:true,territories:record.territories},
    },
  });
}

export function executeEvidenceBoundAgentChain(input:{cycleId:string;artifacts:GovernedArtifacts;createdAt:string}) {
  const intelligence=executeProductIntelligenceAgent(input);
  const diagnosis=executeProductDiagnosisAgent({...input,intelligence});
  const expansion=executeExpansionThesisAgent({...input,diagnosis});
  const experimentPlan=executeExperimentPlannerAgent({...input,expansion});
  const creativeBrief=executeCreativeBriefAgent({...input,experiment:experimentPlan});
  const legalReview=executeLegalReviewAgent({...input,creative:creativeBrief});
  const providerExecution=executeProviderSimulatorAgent({...input,legal:legalReview});
  const qaReview=executeQaReviewAgent({...input,provider:providerExecution});
  const libraryIngest=executeLibraryIngestAgent({...input,qa:qaReview});
  return {intelligence,diagnosis,expansion,experimentPlan,creativeBrief,legalReview,providerExecution,qaReview,libraryIngest};
}
