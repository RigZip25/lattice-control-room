import { deterministicId } from "./identity.js";
import { assessProductIntelligence, type ProductEvidence, type ProductSource } from "./product-evidence.js";

export interface ProductDiagnosis {
  readonly id: string;
  readonly brandId: string;
  readonly valueThesis: string;
  readonly priorityAudiences: readonly string[];
  readonly customerProblems: readonly string[];
  readonly adoptionBarriers: readonly string[];
  readonly competitiveAlternatives: readonly string[];
  readonly materialRisks: readonly string[];
  readonly unresolvedQuestions: readonly string[];
  readonly evidenceIds: readonly string[];
  readonly createdAt: string;
  readonly status: "DRAFT";
  readonly confirmedAt?: string;
}

function nonEmpty(values: readonly string[], label: string): readonly string[] {
  const normalized = values.map((value)=>value.trim()).filter(Boolean);
  if (normalized.length === 0) throw new Error(`${label} is required`);
  return normalized;
}

export function createProductDiagnosis(input: Omit<ProductDiagnosis,"id"|"status">, sources:readonly ProductSource[], evidence:readonly ProductEvidence[]):ProductDiagnosis {
  if (!/^[a-z0-9][a-z0-9-]{1,62}$/.test(input.brandId)) throw new Error("Product diagnosis brand id is invalid");
  const brandSources=sources.filter((item)=>item.brandId===input.brandId);
  const brandEvidence=evidence.filter((item)=>item.brandId===input.brandId);
  const readiness=assessProductIntelligence(brandSources,brandEvidence);
  if (readiness.state!=="READY_FOR_DIAGNOSIS") throw new Error(`Product diagnosis is blocked: ${readiness.blockers.join(",")}`);
  if (input.valueThesis.trim().length<12) throw new Error("Product diagnosis value thesis is too short");
  if (!Number.isFinite(Date.parse(input.createdAt))) throw new Error("Product diagnosis timestamp is invalid");
  const evidenceIds=[...new Set(input.evidenceIds)];
  if (evidenceIds.length<3 || evidenceIds.some((id)=>!brandEvidence.some((item)=>item.id===id))) throw new Error("Product diagnosis must cite at least three same-brand evidence records");
  const payload={...input,valueThesis:input.valueThesis.trim(),priorityAudiences:nonEmpty(input.priorityAudiences,"Priority audiences"),customerProblems:nonEmpty(input.customerProblems,"Customer problems"),adoptionBarriers:nonEmpty(input.adoptionBarriers,"Adoption barriers"),competitiveAlternatives:nonEmpty(input.competitiveAlternatives,"Competitive alternatives"),materialRisks:nonEmpty(input.materialRisks,"Material risks"),unresolvedQuestions:nonEmpty(input.unresolvedQuestions,"Unresolved questions"),evidenceIds,status:"DRAFT" as const};
  return {...payload,id:deterministicId("product_diagnosis",payload)};
}

