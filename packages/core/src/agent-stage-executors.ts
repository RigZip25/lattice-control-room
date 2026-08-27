import { deterministicId } from "./identity.js";
import { expansionCandidateScore } from "./expansion-thesis.js";
import type { runGovernedRigZipCycle } from "./governed-cycle.js";

type GovernedArtifacts = ReturnType<typeof runGovernedRigZipCycle>;
export type EvidenceBoundStage = "PRODUCT_INTELLIGENCE" | "PRODUCT_DIAGNOSIS" | "EXPANSION_THESIS";

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

export function executeEvidenceBoundAgentChain(input:{cycleId:string;artifacts:GovernedArtifacts;createdAt:string}) {
  const intelligence=executeProductIntelligenceAgent(input);
  const diagnosis=executeProductDiagnosisAgent({...input,intelligence});
  const expansion=executeExpansionThesisAgent({...input,diagnosis});
  return {intelligence,diagnosis,expansion};
}
