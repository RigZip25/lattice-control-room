import { deterministicId } from "./identity.js";
import type { ProductDiagnosis } from "./product-diagnosis.js";

export interface ExpansionCandidate {
  readonly countryCode: string;
  readonly geographyName: string;
  readonly administrativeLevel: "COUNTRY" | "STATE" | "REGION";
  readonly demandScore: number;
  readonly supplyScore: number;
  readonly accessibilityScore: number;
  readonly regulatoryScore: number;
  readonly rationale: string;
  readonly assumptions: readonly string[];
  readonly validationQuestions: readonly string[];
}

export interface ExpansionThesis {
  readonly id: string;
  readonly brandId: string;
  readonly diagnosisId: string;
  readonly candidates: readonly ExpansionCandidate[];
  readonly createdAt: string;
  readonly status: "DRAFT";
}

function validateCandidate(candidate:ExpansionCandidate):ExpansionCandidate {
  if (!/^[A-Z]{2}$/.test(candidate.countryCode)) throw new Error("Expansion candidate requires an ISO alpha-2 country code");
  if (candidate.geographyName.trim().length<2 || candidate.rationale.trim().length<12) throw new Error("Expansion candidate name and rationale are required");
  for (const score of [candidate.demandScore,candidate.supplyScore,candidate.accessibilityScore,candidate.regulatoryScore]) if (!Number.isFinite(score)||score<0||score>100) throw new Error("Expansion candidate scores must be between 0 and 100");
  if (!candidate.assumptions.some((item)=>item.trim()) || !candidate.validationQuestions.some((item)=>item.trim())) throw new Error("Expansion candidate assumptions and validation questions are required");
  return {...candidate,geographyName:candidate.geographyName.trim(),rationale:candidate.rationale.trim(),assumptions:candidate.assumptions.map((item)=>item.trim()).filter(Boolean),validationQuestions:candidate.validationQuestions.map((item)=>item.trim()).filter(Boolean)};
}

export function createExpansionThesis(input:Omit<ExpansionThesis,"id"|"status">,diagnosis:ProductDiagnosis):ExpansionThesis {
  if (input.brandId!==diagnosis.brandId || input.diagnosisId!==diagnosis.id) throw new Error("Expansion thesis must cite the same-brand product diagnosis");
  if (diagnosis.status!=="DRAFT") throw new Error("Expansion thesis requires a valid product diagnosis");
  if (!Number.isFinite(Date.parse(input.createdAt))) throw new Error("Expansion thesis timestamp is invalid");
  if (input.candidates.length<2) throw new Error("Expansion thesis requires at least two comparable geographies");
  const candidates=input.candidates.map(validateCandidate);
  if (new Set(candidates.map((item)=>`${item.countryCode}:${item.geographyName.toLowerCase()}`)).size!==candidates.length) throw new Error("Expansion candidates must be unique");
  const payload={...input,candidates,status:"DRAFT" as const};
  return {...payload,id:deterministicId("expansion_thesis",payload)};
}

export function expansionCandidateScore(candidate:ExpansionCandidate):number {
  return Math.round((candidate.demandScore*.35+candidate.supplyScore*.25+candidate.accessibilityScore*.2+candidate.regulatoryScore*.2)*10)/10;
}
