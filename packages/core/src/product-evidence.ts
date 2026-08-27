import { deterministicId } from "./identity.js";

export type ProductSourceKind = "WEBSITE" | "REPOSITORY" | "DOCUMENT" | "ANALYTICS" | "INTERVIEW" | "OWNER_NOTE";
export type EvidenceClassification = "FACT" | "INFERENCE" | "UNKNOWN";

export interface ProductSource {
  readonly id: string;
  readonly brandId: string;
  readonly kind: ProductSourceKind;
  readonly title: string;
  readonly locator: string;
  readonly capturedAt: string;
  readonly contentHash?: string;
  readonly status: "REGISTERED";
}

export interface ProductEvidence {
  readonly id: string;
  readonly brandId: string;
  readonly sourceId: string;
  readonly statement: string;
  readonly classification: EvidenceClassification;
  readonly confidence: number;
  readonly recordedAt: string;
}

export interface ProductIntelligenceReadiness {
  readonly state: "INSUFFICIENT_EVIDENCE" | "READY_FOR_DIAGNOSIS";
  readonly sources: number;
  readonly facts: number;
  readonly inferences: number;
  readonly unknowns: number;
  readonly blockers: readonly string[];
}

function timestamp(value: string, field: string): void {
  if (!Number.isFinite(Date.parse(value))) throw new Error(`${field} is invalid`);
}

export function registerProductSource(input: Omit<ProductSource, "id" | "status">): ProductSource {
  if (!/^[a-z0-9][a-z0-9-]{1,62}$/.test(input.brandId)) throw new Error("Product source brand id is invalid");
  if (!input.title.trim() || !input.locator.trim()) throw new Error("Product source title and locator are required");
  timestamp(input.capturedAt, "Product source timestamp");
  if (input.contentHash !== undefined && !/^[a-f0-9]{64}$/i.test(input.contentHash)) throw new Error("Product source hash must be SHA-256");
  return { ...input, id:deterministicId("product_source", input), status:"REGISTERED" };
}

export function recordProductEvidence(input: Omit<ProductEvidence, "id">, source: ProductSource): ProductEvidence {
  if (input.brandId !== source.brandId || input.sourceId !== source.id) throw new Error("Evidence must cite a source from the same brand");
  if (input.statement.trim().length < 8) throw new Error("Evidence statement is too short");
  if (!Number.isFinite(input.confidence) || input.confidence < 0 || input.confidence > 1) throw new Error("Evidence confidence must be between 0 and 1");
  if (input.classification === "FACT" && input.confidence < 0.7) throw new Error("A fact requires confidence of at least 0.7");
  timestamp(input.recordedAt, "Evidence timestamp");
  return { ...input, id:deterministicId("product_evidence", input) };
}

export function assessProductIntelligence(sources: readonly ProductSource[], evidence: readonly ProductEvidence[]): ProductIntelligenceReadiness {
  const sourceIds = new Set(sources.map((source) => source.id));
  if (evidence.some((item) => !sourceIds.has(item.sourceId))) throw new Error("Every evidence record must cite a registered source");
  const facts = evidence.filter((item) => item.classification === "FACT").length;
  const inferences = evidence.filter((item) => item.classification === "INFERENCE").length;
  const unknowns = evidence.filter((item) => item.classification === "UNKNOWN").length;
  const blockers = [
    ...(sources.length < 2 ? ["AT_LEAST_TWO_INDEPENDENT_SOURCES_REQUIRED"] : []),
    ...(facts < 3 ? ["AT_LEAST_THREE_PRODUCT_FACTS_REQUIRED"] : []),
    ...(unknowns === 0 ? ["OPEN_QUESTIONS_MUST_BE_RECORDED"] : []),
  ];
  return { state:blockers.length ? "INSUFFICIENT_EVIDENCE" : "READY_FOR_DIAGNOSIS", sources:sources.length, facts, inferences, unknowns, blockers };
}
