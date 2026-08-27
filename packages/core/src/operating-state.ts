import { deterministicId } from "./identity.js";
import { assessProductIntelligence, recordProductEvidence, registerProductSource, type ProductEvidence, type ProductSource } from "./product-evidence.js";
import { createProductDiagnosis, type ProductDiagnosis } from "./product-diagnosis.js";
import { createExpansionThesis, type ExpansionThesis } from "./expansion-thesis.js";
import { runGovernedRigZipCycle } from "./governed-cycle.js";
import { runRigZipDryRun } from "./rigzip-scenario.js";
import { runBrandDryRun } from "./brand-scenario.js";
import type { DurableJob } from "./durable-worker.js";
import { runDurableDryRun } from "./durable-dry-run.js";

export type OperatingFilter = "ВСЕ" | "RIGZIP" | "EVORIOS" | "TRAVEL";
export type OperatingLocale = "RU" | "EN";

export interface DiscoveryMarket {
  readonly countryCode: string;
  readonly worldCode?: string;
  readonly countryName: string;
  readonly slug: string;
  readonly brand: string;
  readonly activity: string;
  readonly status: "DISCOVERY";
}

export interface ExpansionArea {
  readonly countryCode: string;
  readonly adminUnitId: string;
  readonly name: string;
  readonly unitType: string;
  readonly route: string;
  readonly brand: string;
  readonly status: "DISCOVERY";
}

export interface BrandProfile {
  readonly id: string;
  readonly name: string;
  readonly archetype: "LOCAL_TWO_SIDED_MARKETPLACE" | "INTERNATIONAL_NEIGHBORHOOD_MARKETPLACE" | "CONTENT_IP_PORTFOLIO" | "TRAVEL_PLATFORM" | "RECURRING_UTILITY" | "OTHER";
  readonly offering: string;
  readonly audience: string;
  readonly businessModel: string;
  readonly objectives: readonly string[];
  readonly primaryValueEvent: string;
  readonly targetGeographies: readonly string[];
  readonly languages: readonly string[];
  readonly constraints: readonly string[];
  readonly status: "DISCOVERY";
}

export interface OperatingEvent {
  readonly id: string;
  readonly version: number;
  readonly kind: OperatingCommand["kind"];
  readonly occurredAt: string;
}

export interface ProductUnderstanding {
  readonly brandId: string;
  readonly website?: string;
  readonly ownerDescription: string;
  readonly materialNames: readonly string[];
  readonly productSummary: string;
  readonly customerSummary: string;
  readonly valueSummary: string;
  readonly assumptions: readonly string[];
  readonly criticalQuestions: readonly string[];
  readonly status: "DRAFT" | "CONFIRMED";
  readonly confirmedAt?: string;
}

export interface DryRunCycleRecord {
  readonly id: string;
  readonly cycleId: string;
  readonly brandId: string;
  readonly status: "COMPLETED";
  readonly mode: "DRY_RUN";
  readonly createdAt: string;
  readonly completedAt: string;
  readonly jobs: readonly DurableJob[];
  readonly artifacts: ReturnType<typeof runGovernedRigZipCycle>;
}

export interface OperatingState {
  readonly version: number;
  readonly executive: boolean;
  readonly locale: OperatingLocale;
  readonly selectedFilter: OperatingFilter;
  readonly openDecisions: number;
  readonly lastRefreshAt?: string;
  readonly discoveryMarkets: readonly DiscoveryMarket[];
  readonly expansionAreas: readonly ExpansionArea[];
  readonly brandProfiles: readonly BrandProfile[];
  readonly productUnderstandings: readonly ProductUnderstanding[];
  readonly productSources: readonly ProductSource[];
  readonly productEvidence: readonly ProductEvidence[];
  readonly productDiagnoses: readonly ProductDiagnosis[];
  readonly expansionTheses: readonly ExpansionThesis[];
  readonly executionCycles: readonly DryRunCycleRecord[];
  readonly events: readonly OperatingEvent[];
  readonly mode: "DRY_RUN";
}

export type OperatingCommand =
  | { readonly kind: "SET_EXECUTIVE_VIEW"; readonly enabled: boolean }
  | { readonly kind: "SET_LOCALE"; readonly locale: OperatingLocale }
  | { readonly kind: "SET_FILTER"; readonly filter: OperatingFilter }
  | { readonly kind: "REFRESH_READ_MODELS" }
  | { readonly kind: "RESOLVE_DECISION"; readonly outcome: "APPROVED" | "REJECTED" }
  | { readonly kind: "ADD_DISCOVERY_MARKET"; readonly market: DiscoveryMarket }
  | { readonly kind: "ADD_EXPANSION_AREA"; readonly area: ExpansionArea }
  | { readonly kind: "ADD_BRAND_PROFILE"; readonly brand: BrandProfile }
  | { readonly kind: "DELETE_BRAND_PROFILE"; readonly brandId: string }
  | { readonly kind: "CAPTURE_PRODUCT_INTAKE"; readonly understanding: ProductUnderstanding }
  | { readonly kind: "CONFIRM_PRODUCT_UNDERSTANDING"; readonly brandId: string }
  | { readonly kind: "REGISTER_PRODUCT_SOURCE"; readonly source: Omit<ProductSource,"id"|"status"> }
  | { readonly kind: "RECORD_PRODUCT_EVIDENCE"; readonly evidence: Omit<ProductEvidence,"id"> }
  | { readonly kind: "CREATE_PRODUCT_DIAGNOSIS"; readonly diagnosis: Omit<ProductDiagnosis,"id"|"status"> }
  | { readonly kind: "CREATE_EXPANSION_THESIS"; readonly thesis: Omit<ExpansionThesis,"id"|"status"> }
  | { readonly kind: "START_RIGZIP_DRY_RUN"; readonly cycleId: string }
  | { readonly kind: "START_BRAND_DRY_RUN"; readonly cycleId: string; readonly brandId:string };

export function initialOperatingState(): OperatingState {
  return { version: 0, executive: false, locale: "RU", selectedFilter: "ВСЕ", openDecisions: 3, discoveryMarkets: [], expansionAreas: [], brandProfiles: [], productUnderstandings: [], productSources: [], productEvidence: [], productDiagnoses: [], expansionTheses: [], executionCycles: [], events: [], mode: "DRY_RUN" };
}

export function applyOperatingCommand(state: OperatingState, command: OperatingCommand, occurredAt: string): OperatingState {
  if (!Number.isFinite(Date.parse(occurredAt))) throw new Error("Operating event timestamp is invalid");
  if (command === null || typeof command !== "object" || !["SET_EXECUTIVE_VIEW","SET_LOCALE","SET_FILTER","REFRESH_READ_MODELS","RESOLVE_DECISION","ADD_DISCOVERY_MARKET","ADD_EXPANSION_AREA","ADD_BRAND_PROFILE","DELETE_BRAND_PROFILE","CAPTURE_PRODUCT_INTAKE","CONFIRM_PRODUCT_UNDERSTANDING","REGISTER_PRODUCT_SOURCE","RECORD_PRODUCT_EVIDENCE","CREATE_PRODUCT_DIAGNOSIS","CREATE_EXPANSION_THESIS","START_RIGZIP_DRY_RUN","START_BRAND_DRY_RUN"].includes(command.kind)) {
    throw new Error("Operating command kind is invalid");
  }
  if (command.kind === "SET_EXECUTIVE_VIEW" && typeof command.enabled !== "boolean") throw new Error("Executive view command is invalid");
  if (command.kind === "SET_LOCALE" && !["RU","EN"].includes(command.locale)) throw new Error("Locale command is invalid");
  if (command.kind === "SET_FILTER" && !["ВСЕ","RIGZIP","EVORIOS","TRAVEL"].includes(command.filter)) throw new Error("Filter command is invalid");
  if (command.kind === "RESOLVE_DECISION" && !["APPROVED","REJECTED"].includes(command.outcome)) throw new Error("Decision outcome is invalid");
  if (command.kind === "ADD_DISCOVERY_MARKET") {
    if (!/^[A-Z]{2}$/.test(command.market.countryCode)) throw new Error("Discovery market requires an ISO alpha-2 country code");
    if (command.market.worldCode !== undefined && !/^[A-Z]{3}$/.test(command.market.worldCode)) throw new Error("Discovery market world code must be ISO alpha-3 shaped");
    if (state.discoveryMarkets.some((market) => market.countryCode === command.market.countryCode)) throw new Error("Discovery market already exists");
    if (command.market.status !== "DISCOVERY") throw new Error("New markets must start in DISCOVERY");
  }
  if (command.kind === "ADD_EXPANSION_AREA") {
    if (!/^[A-Z]{2}$/.test(command.area.countryCode)) throw new Error("Expansion area requires an ISO alpha-2 country code");
    if (!command.area.adminUnitId || !command.area.name || !command.area.unitType) throw new Error("Expansion area identity is incomplete");
    if (!command.area.route.startsWith("/markets/")) throw new Error("Expansion area route is invalid");
    if (command.area.status !== "DISCOVERY") throw new Error("New expansion areas must start in DISCOVERY");
    if (state.expansionAreas.some((area) => area.countryCode === command.area.countryCode && area.adminUnitId === command.area.adminUnitId)) throw new Error("Expansion area already exists");
  }
  if (command.kind === "ADD_BRAND_PROFILE") {
    if (!/^[a-z0-9][a-z0-9-]{1,62}$/.test(command.brand.id)) throw new Error("Brand id is invalid");
    if (command.brand.name.trim().length < 2 || command.brand.offering.trim().length < 3 || command.brand.audience.trim().length < 3) throw new Error("Brand identity, offering and audience are required");
    if (command.brand.primaryValueEvent.trim().length < 3 || command.brand.businessModel.trim().length < 3) throw new Error("Brand value event and business model are required");
    if (command.brand.targetGeographies.length === 0 || command.brand.languages.length === 0 || command.brand.objectives.length === 0) throw new Error("Brand geography, language and objectives are required");
    if (command.brand.status !== "DISCOVERY") throw new Error("New brands must start in DISCOVERY");
    if (state.brandProfiles.some((brand) => brand.id === command.brand.id || brand.name.toLowerCase() === command.brand.name.toLowerCase())) throw new Error("Brand already exists");
  }
  if (command.kind === "CAPTURE_PRODUCT_INTAKE") {
    const item=command.understanding;
    if (!state.brandProfiles.some((brand)=>brand.id===item.brandId)) throw new Error("Product intake brand is not registered");
    if (item.status!=="DRAFT" || item.ownerDescription.trim().length<8 || item.productSummary.trim().length<8) throw new Error("Product intake is incomplete");
    if (state.productUnderstandings.some((entry)=>entry.brandId===item.brandId)) throw new Error("Product intake already exists");
  }
  if (command.kind === "DELETE_BRAND_PROFILE") {
    if (!state.brandProfiles.some((brand)=>brand.id===command.brandId)) throw new Error("Brand profile is not registered");
    if (state.executionCycles.some((cycle)=>cycle.brandId===command.brandId)) throw new Error("A brand with governed execution history cannot be deleted");
  }
  if (command.kind === "CONFIRM_PRODUCT_UNDERSTANDING" && !state.productUnderstandings.some((item)=>item.brandId===command.brandId)) throw new Error("Product understanding is not registered");
  if (command.kind === "REGISTER_PRODUCT_SOURCE") {
    const source = registerProductSource(command.source);
    if (state.productSources.some((item) => item.id === source.id)) throw new Error("Product source already exists");
  }
  if (command.kind === "RECORD_PRODUCT_EVIDENCE") {
    const source = state.productSources.find((item) => item.id === command.evidence.sourceId);
    if (!source) throw new Error("Evidence source is not registered");
    recordProductEvidence(command.evidence,source);
  }
  if (command.kind === "CREATE_PRODUCT_DIAGNOSIS") {
    createProductDiagnosis(command.diagnosis,state.productSources,state.productEvidence);
    if (state.productDiagnoses.some((item)=>item.brandId===command.diagnosis.brandId)) throw new Error("Product diagnosis already exists");
  }
  if (command.kind === "CREATE_EXPANSION_THESIS") {
    const diagnosis=state.productDiagnoses.find((item)=>item.id===command.thesis.diagnosisId);
    if (!diagnosis) throw new Error("Expansion thesis product diagnosis is not registered");
    createExpansionThesis(command.thesis,diagnosis);
    if (state.expansionTheses.some((item)=>item.brandId===command.thesis.brandId)) throw new Error("Expansion thesis already exists");
  }
  if (command.kind === "START_RIGZIP_DRY_RUN") {
    if (!/^[a-z0-9][a-z0-9-]{2,80}$/.test(command.cycleId)) throw new Error("Dry-run cycle id is invalid");
    if (state.executionCycles.some((item)=>item.cycleId===command.cycleId)) throw new Error("Dry-run cycle already exists");
  }
  if (command.kind === "START_BRAND_DRY_RUN") {
    if (!/^[a-z0-9][a-z0-9-]{2,80}$/.test(command.cycleId)) throw new Error("Dry-run cycle id is invalid");
    if (state.executionCycles.some((item)=>item.cycleId===command.cycleId)) throw new Error("Dry-run cycle already exists");
    const profile=state.brandProfiles.find((item)=>item.id===command.brandId);
    if (!profile) throw new Error("Brand profile is not registered");
    const sources=state.productSources.filter((item)=>item.brandId===profile.id);
    const evidence=state.productEvidence.filter((item)=>item.brandId===profile.id);
    const readiness=assessProductIntelligence(sources,evidence);
    if (readiness.state!=="READY_FOR_DIAGNOSIS") throw new Error(`Brand evidence gate is blocked: ${readiness.blockers.join(",")}`);
    if (!state.productDiagnoses.some((item)=>item.brandId===profile.id)) throw new Error("Brand product diagnosis is required");
    if (!state.expansionTheses.some((item)=>item.brandId===profile.id)) throw new Error("Brand expansion thesis is required");
  }
  const version = state.version + 1;
  const event: OperatingEvent = { id: deterministicId("operating_event", { version, command, occurredAt }), version, kind: command.kind, occurredAt };
  const next: OperatingState = { ...state, version, events: [...state.events, event] };
  switch (command.kind) {
    case "SET_EXECUTIVE_VIEW": return { ...next, executive: command.enabled };
    case "SET_LOCALE": return { ...next, locale: command.locale };
    case "SET_FILTER": return { ...next, selectedFilter: command.filter };
    case "REFRESH_READ_MODELS": return { ...next, lastRefreshAt: occurredAt };
    case "RESOLVE_DECISION": return { ...next, openDecisions: Math.max(0, state.openDecisions - 1) };
    case "ADD_DISCOVERY_MARKET": return { ...next, discoveryMarkets: [...state.discoveryMarkets, command.market] };
    case "ADD_EXPANSION_AREA": return { ...next, expansionAreas: [...state.expansionAreas, command.area] };
    case "ADD_BRAND_PROFILE": return { ...next, brandProfiles: [...state.brandProfiles, command.brand] };
    case "DELETE_BRAND_PROFILE": return { ...next, brandProfiles:state.brandProfiles.filter((item)=>item.id!==command.brandId),productUnderstandings:state.productUnderstandings.filter((item)=>item.brandId!==command.brandId),productSources:state.productSources.filter((item)=>item.brandId!==command.brandId),productEvidence:state.productEvidence.filter((item)=>item.brandId!==command.brandId),productDiagnoses:state.productDiagnoses.filter((item)=>item.brandId!==command.brandId),expansionTheses:state.expansionTheses.filter((item)=>item.brandId!==command.brandId) };
    case "CAPTURE_PRODUCT_INTAKE": return { ...next, productUnderstandings:[...state.productUnderstandings,command.understanding] };
    case "CONFIRM_PRODUCT_UNDERSTANDING": return { ...next, productUnderstandings:state.productUnderstandings.map((item)=>item.brandId===command.brandId?{...item,status:"CONFIRMED",confirmedAt:occurredAt}:item) };
    case "REGISTER_PRODUCT_SOURCE": return { ...next, productSources:[...state.productSources,registerProductSource(command.source)] };
    case "RECORD_PRODUCT_EVIDENCE": {
      const source = state.productSources.find((item) => item.id === command.evidence.sourceId);
      if (!source) throw new Error("Evidence source is not registered");
      return { ...next, productEvidence:[...state.productEvidence,recordProductEvidence(command.evidence,source)] };
    }
    case "CREATE_PRODUCT_DIAGNOSIS": return { ...next, productDiagnoses:[...state.productDiagnoses,createProductDiagnosis(command.diagnosis,state.productSources,state.productEvidence)] };
    case "CREATE_EXPANSION_THESIS": {
      const diagnosis=state.productDiagnoses.find((item)=>item.id===command.thesis.diagnosisId);
      if (!diagnosis) throw new Error("Expansion thesis product diagnosis is not registered");
      return {...next,expansionTheses:[...state.expansionTheses,createExpansionThesis(command.thesis,diagnosis)]};
    }
    case "START_RIGZIP_DRY_RUN": {
      const scenario=runRigZipDryRun();
      const artifacts=runGovernedRigZipCycle(scenario.packet);
      const jobs=runDurableDryRun({workspaceId:"lafwiron",brandId:"rigzip",cycleId:command.cycleId,initialInputRef:"fixture://rigzip/product-evidence/v1",now:occurredAt}).jobs;
      const cycle:DryRunCycleRecord={id:deterministicId("dry_run_cycle",{cycleId:command.cycleId,occurredAt}),cycleId:command.cycleId,brandId:"rigzip",status:"COMPLETED",mode:"DRY_RUN",createdAt:occurredAt,completedAt:occurredAt,jobs,artifacts};
      return {...next,executionCycles:[...state.executionCycles,cycle]};
    }
    case "START_BRAND_DRY_RUN": {
      const profile=state.brandProfiles.find((item)=>item.id===command.brandId)!;
      const sources=state.productSources.filter((item)=>item.brandId===profile.id);
      const evidence=state.productEvidence.filter((item)=>item.brandId===profile.id);
      const diagnosis=state.productDiagnoses.find((item)=>item.brandId===profile.id)!;
      const expansionThesis=state.expansionTheses.find((item)=>item.brandId===profile.id)!;
      const scenario=runBrandDryRun(profile,{cycleId:command.cycleId,now:occurredAt});
      const artifacts=runGovernedRigZipCycle(scenario.packet,{sources,evidence,diagnosis,expansionThesis});
      const cycle:DryRunCycleRecord={id:deterministicId("dry_run_cycle",{cycleId:command.cycleId,occurredAt,brandId:profile.id}),cycleId:command.cycleId,brandId:profile.id,status:"COMPLETED",mode:"DRY_RUN",createdAt:occurredAt,completedAt:occurredAt,jobs:scenario.durableCycle.jobs,artifacts};
      return {...next,executionCycles:[...state.executionCycles,cycle]};
    }
    default: throw new Error("Operating command kind is invalid");
  }
}
