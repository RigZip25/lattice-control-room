import { registerCreativeAsset } from "./asset-library.js";
import {
  approveProducedAsset,
  prepareProviderRequest,
  queueApprovedAsset,
  type ProductionBrief,
} from "./content-production.js";
import {
  analyticsAgentReport,
  creatorAgentDraft,
  executorAgentReview,
  legalAgentAuthorizePrompt,
  seniorMarketingAllocate,
} from "./creative-agent-orchestration.js";
import { createExpansionThesis } from "./expansion-thesis.js";
import { evaluateMarketingAction, type MarketingPolicySnapshot } from "./marketing-compliance.js";
import { defineMetric, ingestCanonicalEvent } from "./metrics.js";
import type { DecisionPacket } from "./model.js";
import { createProductDiagnosis } from "./product-diagnosis.js";
import { assessProductIntelligence, recordProductEvidence, registerProductSource } from "./product-evidence.js";
import type { ProductDiagnosis } from "./product-diagnosis.js";
import type { ExpansionThesis } from "./expansion-thesis.js";
import type { ProductEvidence, ProductSource } from "./product-evidence.js";

/** A complete in-memory execution of the governed engine. It never calls a provider. */
export function runGovernedBrandCycle(packet: DecisionPacket,context?:{readonly sources:readonly ProductSource[];readonly evidence:readonly ProductEvidence[];readonly diagnosis:ProductDiagnosis;readonly expansionThesis:ExpansionThesis}) {
  const brandId = String(packet.brandPackage.brandId);
  const marketCellId = String(packet.marketCell.id);
  const now = packet.productSnapshot.capturedAt;
  const geography=packet.marketCell.geographyPath[0]??packet.marketCell.countryCode;
  const audience=packet.brandPackage.audiences[0]??packet.contentBrief.audience;
  const supportedClaim=packet.brandPackage.valueClaims.find((claim)=>claim.status==="SUPPORTED")?.statement??packet.contentBrief.message;
  const repository = registerProductSource({ brandId, kind: "REPOSITORY", title: `${brandId} product source`, locator: packet.productSnapshot.sourceRepository, capturedAt: now });
  const ownerBrief = registerProductSource({ brandId, kind: "OWNER_NOTE", title: `${brandId} owner brief`, locator: `profile://${brandId}/owner-brief`, capturedAt: now });
  const generatedEvidence = [
    recordProductEvidence({ brandId, sourceId: repository.id, statement: `Declared product: ${packet.productSnapshot.facts[0]?.value??packet.brandPackage.problem}`, classification: "FACT", confidence: .9, recordedAt: now }, repository),
    recordProductEvidence({ brandId, sourceId: repository.id, statement: `Declared value event: ${packet.hypothesis.successMetric}.`, classification: "FACT", confidence: .9, recordedAt: now }, repository),
    recordProductEvidence({ brandId, sourceId: ownerBrief.id, statement: `Declared initial geography: ${geography}.`, classification: "FACT", confidence: .9, recordedAt: now }, ownerBrief),
    recordProductEvidence({ brandId, sourceId: ownerBrief.id, statement: "The strongest acquisition channel remains to be validated.", classification: "UNKNOWN", confidence: .5, recordedAt: now }, ownerBrief),
  ];
  const sources=context?.sources??[repository,ownerBrief];
  const evidence=context?.evidence??generatedEvidence;
  const readiness = assessProductIntelligence(sources, evidence);
  if (readiness.state!=="READY_FOR_DIAGNOSIS") throw new Error(`Governed brand cycle evidence gate is blocked: ${readiness.blockers.join(",")}`);
  const diagnosis = context?.diagnosis??createProductDiagnosis({
    brandId,
    valueThesis: supportedClaim,
    priorityAudiences: [audience],
    customerProblems: [packet.brandPackage.problem],
    adoptionBarriers: ["Unverified demand", "Unverified channel-market fit"],
    competitiveAlternatives: ["Current customer behavior"],
    materialRisks: [...packet.brandPackage.hardConstraints,"Insufficient observed evidence"],
    unresolvedQuestions: ["which channel produces an incremental value event"],
    evidenceIds: evidence.slice(0, 3).map((item) => item.id),
    createdAt: now,
  }, sources, evidence);
  const expansionThesis = context?.expansionThesis??createExpansionThesis({ brandId, diagnosisId: diagnosis.id, createdAt: now, candidates: [
    { countryCode: packet.marketCell.countryCode, geographyName: geography, administrativeLevel: "REGION", demandScore: 50, supplyScore: 50, accessibilityScore: 50, regulatoryScore: 50, rationale: "Owner-declared initial geography; all market scores remain neutral priors until evidence is collected.", assumptions: ["the declared geography is addressable"], validationQuestions: ["does the proposed value event occur incrementally"] },
    { countryCode: packet.marketCell.countryCode, geographyName: `${geography} comparison`, administrativeLevel: "REGION", demandScore: 45, supplyScore: 45, accessibilityScore: 45, regulatoryScore: 45, rationale: "Synthetic comparison baseline used only to structure a future evidence-gathering decision.", assumptions: ["a comparable control geography can be identified"], validationQuestions: ["which real comparison geography is causally suitable"] },
  ] }, diagnosis);

  const creativePacket = creatorAgentDraft({ brandId, marketCellId, objective: packet.brandPackage.problem, audience, region: geography, winningAssetIds: [], citedResearchSourceIds: evidence.slice(0, 3).map((item) => item.id), supportedClaims: [supportedClaim], culturalContext: ["Use plain factual language",...packet.brandPackage.hardConstraints], capability: "GENERATE_SOCIAL_POST" });
  const legalPolicy: MarketingPolicySnapshot = { id: `policy_${brandId}_dry_run`, jurisdiction: packet.marketCell.countryCode, channel: packet.contentBrief.channel, version: "dry-run-v1", effectiveAt: now, reviewedAt: now, maximumAgeDays: 30, prohibitedCategories: [], prohibitedClaimPatterns: ["guaranteed"], requiredDisclosures: ["Simulated draft — not published"], requiresExplicitConsent: false, maximumAutomatedActionsPerDay: 1 };
  const legalDecision = evaluateMarketingAction(legalPolicy, { brandId, jurisdiction: packet.marketCell.countryCode, channel: packet.contentBrief.channel, category: "brand-validation", claims: [supportedClaim], disclosures: ["Simulated draft — not published"], hasContentRights: true, hasAudienceConsent: true, automatedActionsToday: 0, scheduledAt: now });
  const legallyCleared = legalAgentAuthorizePrompt(creativePacket, legalDecision);
  const brief: ProductionBrief = { brandId, marketCellId, format: "SOCIAL_POST", objective: packet.brandPackage.problem, audience, channel: packet.contentBrief.channel, supportedClaims: [supportedClaim], referenceAssetIds: evidence.slice(0, 2).map((item) => item.id), constraints: [...packet.brandPackage.hardConstraints,"Do not publish"], maximumProductionCostUsd: 5 };
  const providerRequest = prepareProviderRequest(brief, false);
  const asset = approveProducedAsset(brief, providerRequest, { requestId: providerRequest.id, brandId, format: "SOCIAL_POST", version: 1, providerId: "dry-run-simulator", storageRef: `memory://${brandId}/social-post-v1`, actualCostUsd: 0, usedClaims: [supportedClaim] });
  const qaPacket = executorAgentReview(legallyCleared, []);
  const libraryAsset = registerCreativeAsset({ asset, briefId: packet.contentBrief.id, objectKey: `${brandId}/dry-run/social-post-v1.txt`, contentHash: "a".repeat(64), mimeType: "text/plain", bytes: 128, locale: "en-US", territories: [packet.marketCell.countryCode], rightsOwner: "LAFWIRON", allowedUsage: ["DRY_RUN_EVALUATION"] });
  const requestedBudget=Math.max(1,packet.capitalDecision.requestedUsd);
  const marketingDecision = seniorMarketingAllocate({ packet: qaPacket, channel: packet.contentBrief.channel, requestedBudgetUsd: requestedBudget, availableBrandCapitalUsd: 0, delegatedLimitUsd: 0, ventureAvailableUsd: 0 });
  const distribution = queueApprovedAsset({ asset, channel: packet.contentBrief.channel, requestedPromotionUsd: requestedBudget, authorizedPromotionUsd: requestedBudget, compliance: legalDecision, productionMode: false });
  const metric = defineMetric({ workspaceId: packet.productSnapshot.workspaceId, brandId: packet.productSnapshot.brandId, key: `simulated_${packet.hypothesis.successMetric}`, version: 1, description: "Dry-run model output, not an observed customer event", unit: "value events", aggregation: "COUNT", valueEvent: false, allowedSemanticClasses: ["FORECAST"] });
  const metricEvent = ingestCanonicalEvent(metric, { workspaceId: packet.productSnapshot.workspaceId, brandId: packet.productSnapshot.brandId, marketCellId: packet.marketCell.id, occurredAt: now, ingestedAt: now, value: packet.capitalDecision.expectedIncrementalOutcome, semanticClass: "FORECAST", sourceProvider: "dry-run-simulator", sourceEventId: `${brandId}-${packet.marketCell.countryCode}-simulation`, quality: "USABLE", attributionMethod: "MODELLED", consentClass: "ANONYMOUS_AGGREGATE" });
  const report = analyticsAgentReport({ packet: qaPacket, spendUsd: 0, engagements: 0, impressions: 1, penetrationBefore: 0, penetrationAfter: 0, recommendedNextBudgetUsd: requestedBudget, availableCapitalUsd: 0 });

  return { mode: "DRY_RUN" as const, externalEffects: 0 as const, sources, evidence, readiness, diagnosis, expansionThesis, creativePacket, legalPolicy, legalDecision, providerRequest, qaPacket, asset, libraryAsset, marketingDecision, distribution, metric, metricEvent, report };
}

export const runGovernedRigZipCycle=runGovernedBrandCycle;
