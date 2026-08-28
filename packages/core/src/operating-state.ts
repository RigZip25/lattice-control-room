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
  readonly founderExpertise?: string;
  readonly materialNames: readonly string[];
  readonly productSummary: string;
  readonly customerSummary: string;
  readonly valueSummary: string;
  readonly assumptions: readonly string[];
  readonly criticalQuestions: readonly string[];
  readonly maturity?: "IDEA" | "PROTOTYPE" | "MVP" | "LIVE" | "TRACTION" | "SCALE";
  readonly websiteResearch?: WebsiteResearch;
  readonly analystDialogue?: readonly BrandAnalystTurn[];
  readonly status: "DRAFT" | "CONFIRMED";
  readonly confirmedAt?: string;
}

export interface ActivationSprint {
  readonly sprintId: string;
  readonly brandId: string;
  readonly selectedRoute: string;
  readonly firstArtifact: string;
  readonly status: "ACTIVE" | "COMPLETED" | "PAUSED";
  readonly mode: "DRY_RUN";
  readonly externalEffects: 0;
  readonly startedAt: string;
}

export interface BrandAnalystTurn {
  readonly id: string;
  readonly createdAt: string;
  readonly ownerMessage: string;
  readonly analystResponse: string;
  readonly nextQuestion?: string;
  readonly questionRole?: "PRODUCT"|"MARKET"|"GROWTH"|"CREATIVE"|"FINANCE"|"LEGAL";
  readonly alternatives: readonly string[];
  readonly confidence?: "LOW"|"MEDIUM"|"HIGH";
  readonly supportingArguments?: readonly string[];
  readonly counterArguments?: readonly string[];
  readonly reversibleTest?: string;
  readonly councilViews?: readonly { readonly role: "PRODUCT"|"MARKET"|"GROWTH"|"CREATIVE"|"FINANCE"|"LEGAL"; readonly opinion: string }[];
  readonly readiness?: BrandMarketReadiness;
  readonly status: "ASKING" | "SUFFICIENT";
}

export type BrandMarketReadinessKey = "productStage"|"workingFunctions"|"primaryPayingCustomer"|"customerPain"|"valueEvent"|"businessModel"|"competitiveContour"|"evidence"|"constraints";
export type BrandMarketReadiness = Readonly<Record<BrandMarketReadinessKey,{readonly status:"CLEAR"|"MISSING";readonly summary:string}>>;
export const marketReadinessKeys:readonly BrandMarketReadinessKey[]=["productStage","workingFunctions","primaryPayingCustomer","customerPain","valueEvent","businessModel","competitiveContour","evidence","constraints"];

export function assessBrandMarketReadiness(understanding:ProductUnderstanding|undefined):{readonly ready:boolean;readonly blockers:readonly BrandMarketReadinessKey[]} {
  const latest=understanding?.analystDialogue?.at(-1);
  const blockers=marketReadinessKeys.filter((key)=>latest?.readiness?.[key]?.status!=="CLEAR");
  return {ready:Boolean(understanding?.status==="CONFIRMED"&&latest?.status==="SUFFICIENT"&&blockers.length===0),blockers};
}

export interface WebsiteResearchPage {
  readonly url: string;
  readonly title: string;
  readonly description: string;
  readonly headings: readonly string[];
}

export interface SemanticProductAnalysis {
  readonly generationId: string;
  readonly status: "COMPLETED";
  readonly model: string;
  readonly createdAt: string;
  readonly productName: string;
  readonly oneLineSummary: string;
  readonly companyContext: string;
  readonly customerSegments: readonly string[];
  readonly jobsToBeDone: readonly string[];
  readonly valuePropositions: readonly string[];
  readonly businessModelHypotheses: readonly string[];
  readonly productCapabilities: readonly string[];
  readonly claims: readonly {
    readonly statement: string;
    readonly classification: "OWNER_CLAIM" | "OBSERVED" | "UNKNOWN";
    readonly evidenceUrls: readonly string[];
  }[];
  readonly risks: readonly string[];
  readonly criticalQuestions: readonly string[];
  readonly recommendedNextResearch: readonly string[];
  readonly strategicVerdict?: string;
  readonly recommendedDisposition?: "HOLD" | "RESEARCH" | "IMPROVE" | "READY_FOR_MARKET_TEST";
  readonly primaryAudienceChoice?: string;
  readonly primaryAudienceRationale?: string;
  readonly marketPain?: readonly string[];
  readonly positioningThesis?: string;
  readonly competitorHypotheses?: readonly {
    readonly name: string;
    readonly whyRelevant: string;
    readonly productStrongerWhere: string;
    readonly productWeakerWhere: string;
    readonly verificationNeeded: string;
  }[];
  readonly differentiators?: readonly string[];
  readonly productWeaknesses?: readonly string[];
  readonly distributionHypotheses?: readonly string[];
  readonly improvementPhases?: readonly {
    readonly phase: string;
    readonly objective: string;
    readonly exitCriteria: string;
  }[];
  readonly marketEducationNeed?: string;
  readonly marketingGate?: "BLOCKED";
  readonly usage: {
    readonly inputTokens?: number;
    readonly outputTokens?: number;
    readonly totalTokens?: number;
  };
}

export interface WebsiteResearch {
  readonly status: "COMPLETED";
  readonly researchedAt: string;
  readonly pages: readonly WebsiteResearchPage[];
  readonly observedClaims: readonly string[];
  readonly unresolvedQuestions: readonly string[];
  readonly analysis?: SemanticProductAnalysis;
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
  readonly activationSprints?: readonly ActivationSprint[];
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
  | { readonly kind: "UPDATE_BRAND_PROFILE"; readonly brand: BrandProfile }
  | { readonly kind: "DELETE_BRAND_PROFILE"; readonly brandId: string }
  | { readonly kind: "CAPTURE_PRODUCT_INTAKE"; readonly understanding: ProductUnderstanding }
  | { readonly kind: "UPDATE_PRODUCT_INTAKE"; readonly understanding: ProductUnderstanding }
  | { readonly kind: "RECORD_WEBSITE_RESEARCH"; readonly brandId: string; readonly research: WebsiteResearch }
  | { readonly kind: "RECORD_ANALYST_TURN"; readonly brandId: string; readonly turn: BrandAnalystTurn }
  | { readonly kind: "RESET_ANALYST_DIALOGUE"; readonly brandId: string }
  | { readonly kind: "START_ACTIVATION_SPRINT"; readonly brandId:string; readonly sprintId:string; readonly selectedRoute:string; readonly firstArtifact:string }
  | { readonly kind: "CONFIRM_PRODUCT_UNDERSTANDING"; readonly brandId: string }
  | { readonly kind: "REGISTER_PRODUCT_SOURCE"; readonly source: Omit<ProductSource,"id"|"status"> }
  | { readonly kind: "RECORD_PRODUCT_EVIDENCE"; readonly evidence: Omit<ProductEvidence,"id"> }
  | { readonly kind: "CREATE_PRODUCT_DIAGNOSIS"; readonly diagnosis: Omit<ProductDiagnosis,"id"|"status"> }
  | { readonly kind: "CONFIRM_PRODUCT_DIAGNOSIS"; readonly brandId: string }
  | { readonly kind: "CREATE_EXPANSION_THESIS"; readonly thesis: Omit<ExpansionThesis,"id"|"status"> }
  | { readonly kind: "START_RIGZIP_DRY_RUN"; readonly cycleId: string }
  | { readonly kind: "START_BRAND_DRY_RUN"; readonly cycleId: string; readonly brandId:string };

export function initialOperatingState(): OperatingState {
  return { version: 0, executive: false, locale: "RU", selectedFilter: "ВСЕ", openDecisions: 3, discoveryMarkets: [], expansionAreas: [], brandProfiles: [], productUnderstandings: [], productSources: [], productEvidence: [], productDiagnoses: [], expansionTheses: [], executionCycles: [], activationSprints:[], events: [], mode: "DRY_RUN" };
}

export function applyOperatingCommand(state: OperatingState, command: OperatingCommand, occurredAt: string): OperatingState {
  if (!Number.isFinite(Date.parse(occurredAt))) throw new Error("Operating event timestamp is invalid");
  if (command === null || typeof command !== "object" || !["SET_EXECUTIVE_VIEW","SET_LOCALE","SET_FILTER","REFRESH_READ_MODELS","RESOLVE_DECISION","ADD_DISCOVERY_MARKET","UPDATE_BRAND_PROFILE","DELETE_BRAND_PROFILE","ADD_EXPANSION_AREA","ADD_BRAND_PROFILE","CAPTURE_PRODUCT_INTAKE","UPDATE_PRODUCT_INTAKE","RECORD_WEBSITE_RESEARCH","RECORD_ANALYST_TURN","RESET_ANALYST_DIALOGUE","START_ACTIVATION_SPRINT","CONFIRM_PRODUCT_UNDERSTANDING","REGISTER_PRODUCT_SOURCE","RECORD_PRODUCT_EVIDENCE","CREATE_PRODUCT_DIAGNOSIS","CONFIRM_PRODUCT_DIAGNOSIS","CREATE_EXPANSION_THESIS","START_RIGZIP_DRY_RUN","START_BRAND_DRY_RUN"].includes(command.kind)) {
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
  if (command.kind === "UPDATE_BRAND_PROFILE") {
    if (!state.brandProfiles.some((brand)=>brand.id===command.brand.id)) throw new Error("Brand profile is not registered");
    if (command.brand.name.trim().length<2 || command.brand.offering.trim().length<3) throw new Error("Updated brand profile is incomplete");
  }
  if (command.kind === "CAPTURE_PRODUCT_INTAKE") {
    const item=command.understanding;
    if (!state.brandProfiles.some((brand)=>brand.id===item.brandId)) throw new Error("Product intake brand is not registered");
    if (item.status!=="DRAFT" || item.ownerDescription.trim().length<8 || item.productSummary.trim().length<8) throw new Error("Product intake is incomplete");
  }
  if (command.kind === "UPDATE_PRODUCT_INTAKE") {
    if (!state.productUnderstandings.some((item)=>item.brandId===command.understanding.brandId)) throw new Error("Product intake is not registered");
    if (command.understanding.ownerDescription.trim().length<8 || command.understanding.productSummary.trim().length<8) throw new Error("Updated product intake is incomplete");
  }
  if (command.kind === "RECORD_WEBSITE_RESEARCH") {
    if (!state.productUnderstandings.some((item)=>item.brandId===command.brandId)) throw new Error("Product intake is not registered");
    if (command.research.status!=="COMPLETED" || command.research.pages.length===0 || !Number.isFinite(Date.parse(command.research.researchedAt))) throw new Error("Website research is incomplete");
  }
  if (command.kind === "RECORD_ANALYST_TURN") {
    if (!state.productUnderstandings.some((item)=>item.brandId===command.brandId)) throw new Error("Product intake is not registered");
    if (!command.turn.id || !Number.isFinite(Date.parse(command.turn.createdAt)) || command.turn.ownerMessage.trim().length<1 || command.turn.analystResponse.trim().length<1) throw new Error("Analyst dialogue turn is incomplete");
    if (!['ASKING','SUFFICIENT'].includes(command.turn.status)) throw new Error("Analyst dialogue status is invalid");
    if (command.turn.status==='ASKING' && !command.turn.nextQuestion?.trim()) throw new Error("Analyst must ask exactly one next question");
  }
  if (command.kind === "RESET_ANALYST_DIALOGUE" && !state.productUnderstandings.some((item)=>item.brandId===command.brandId)) throw new Error("Product intake is not registered");
  if(command.kind==="START_ACTIVATION_SPRINT") {
    const marketReadiness=assessBrandMarketReadiness(state.productUnderstandings.find((item)=>item.brandId===command.brandId));
    if(!marketReadiness.ready) throw new Error(`Activation sprint is blocked by market readiness: ${marketReadiness.blockers.join(",")||"owner confirmation required"}`);
    if(!/^[a-z0-9][a-z0-9-]{2,80}$/.test(command.sprintId)||command.selectedRoute.trim().length<8||command.firstArtifact.trim().length<5) throw new Error("Activation sprint is incomplete");
    if((state.activationSprints??[]).some((item)=>item.sprintId===command.sprintId)) throw new Error("Activation sprint already exists");
  }
  if (command.kind === "DELETE_BRAND_PROFILE") {
    if (!state.brandProfiles.some((brand)=>brand.id===command.brandId)) throw new Error("Brand profile is not registered");
  }
  if (command.kind === "CONFIRM_PRODUCT_UNDERSTANDING") {
    const understanding=state.productUnderstandings.find((item)=>item.brandId===command.brandId);
    if(!understanding) throw new Error("Product understanding is not registered");
    const latest=understanding.analystDialogue?.at(-1);
    const blockers=marketReadinessKeys.filter((key)=>latest?.readiness?.[key]?.status!=="CLEAR");
    if(latest?.status!=="SUFFICIENT"||blockers.length>0) throw new Error(`Product understanding cannot be confirmed before council readiness: ${blockers.join(",")||"council interview incomplete"}`);
  }
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
  if (command.kind === "CONFIRM_PRODUCT_DIAGNOSIS") {
    if (!state.productDiagnoses.some((item)=>item.brandId===command.brandId)) throw new Error("Product diagnosis is not registered");
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
    const marketReadiness=assessBrandMarketReadiness(state.productUnderstandings.find((item)=>item.brandId===profile.id));
    if(!marketReadiness.ready) throw new Error(`Brand market-readiness gate is blocked: ${marketReadiness.blockers.join(",")||"owner confirmation required"}`);
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
    case "UPDATE_BRAND_PROFILE": return { ...next, brandProfiles:state.brandProfiles.map((item)=>item.id===command.brand.id?command.brand:item) };
    case "DELETE_BRAND_PROFILE": return { ...next, brandProfiles:state.brandProfiles.filter((item)=>item.id!==command.brandId),productUnderstandings:state.productUnderstandings.filter((item)=>item.brandId!==command.brandId),productSources:state.productSources.filter((item)=>item.brandId!==command.brandId),productEvidence:state.productEvidence.filter((item)=>item.brandId!==command.brandId),productDiagnoses:state.productDiagnoses.filter((item)=>item.brandId!==command.brandId),expansionTheses:state.expansionTheses.filter((item)=>item.brandId!==command.brandId) };
    case "CAPTURE_PRODUCT_INTAKE": return { ...next, productUnderstandings:state.productUnderstandings.some((item)=>item.brandId===command.understanding.brandId)?state.productUnderstandings.map((item)=>item.brandId===command.understanding.brandId?command.understanding:item):[...state.productUnderstandings,command.understanding] };
    case "UPDATE_PRODUCT_INTAKE": return { ...next, productUnderstandings:state.productUnderstandings.map((item)=>item.brandId===command.understanding.brandId?command.understanding:item) };
    case "RECORD_WEBSITE_RESEARCH": return { ...next, productUnderstandings:state.productUnderstandings.map((item)=>{ if(item.brandId!==command.brandId)return item; const {confirmedAt:_,...unconfirmed}=item; return {...unconfirmed,websiteResearch:command.research,productSummary:command.research.analysis?.oneLineSummary??command.research.observedClaims[0]??item.productSummary,customerSummary:command.research.analysis?.customerSegments.join(" · ")??item.customerSummary,valueSummary:command.research.analysis?.valuePropositions.join(" · ")??item.valueSummary,criticalQuestions:command.research.analysis?.criticalQuestions??command.research.unresolvedQuestions,status:"DRAFT"}; }) };
    case "RECORD_ANALYST_TURN": return { ...next, productUnderstandings:state.productUnderstandings.map((item)=>{if(item.brandId!==command.brandId)return item;const {confirmedAt:_,...unconfirmed}=item;return {...unconfirmed,analystDialogue:[...(item.analystDialogue??[]),command.turn],status:"DRAFT"};}) };
    case "RESET_ANALYST_DIALOGUE": return { ...next, productUnderstandings:state.productUnderstandings.map((item)=>{if(item.brandId!==command.brandId)return item;const {analystDialogue:_,confirmedAt:__,...reset}=item;return {...reset,status:"DRAFT"};}) };
    case "START_ACTIVATION_SPRINT": return {...next,activationSprints:[...(state.activationSprints??[]),{sprintId:command.sprintId,brandId:command.brandId,selectedRoute:command.selectedRoute,firstArtifact:command.firstArtifact,status:"ACTIVE",mode:"DRY_RUN",externalEffects:0,startedAt:occurredAt}]};
    case "CONFIRM_PRODUCT_UNDERSTANDING": return { ...next, productUnderstandings:state.productUnderstandings.map((item)=>item.brandId===command.brandId?{...item,status:"CONFIRMED",confirmedAt:occurredAt}:item) };
    case "REGISTER_PRODUCT_SOURCE": return { ...next, productSources:[...state.productSources,registerProductSource(command.source)] };
    case "RECORD_PRODUCT_EVIDENCE": {
      const source = state.productSources.find((item) => item.id === command.evidence.sourceId);
      if (!source) throw new Error("Evidence source is not registered");
      return { ...next, productEvidence:[...state.productEvidence,recordProductEvidence(command.evidence,source)] };
    }
    case "CREATE_PRODUCT_DIAGNOSIS": return { ...next, productDiagnoses:[...state.productDiagnoses,createProductDiagnosis(command.diagnosis,state.productSources,state.productEvidence)] };
    case "CONFIRM_PRODUCT_DIAGNOSIS": return { ...next, productDiagnoses:state.productDiagnoses.map((item)=>item.brandId===command.brandId?{...item,confirmedAt:occurredAt}:item) };
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

