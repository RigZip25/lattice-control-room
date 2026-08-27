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

/** A complete in-memory execution of the governed engine. It never calls a provider. */
export function runGovernedRigZipCycle(packet: DecisionPacket) {
  const brandId = String(packet.brandPackage.brandId);
  const marketCellId = String(packet.marketCell.id);
  const now = "2026-08-27T12:00:00.000Z";
  const repository = registerProductSource({ brandId, kind: "REPOSITORY", title: "RigZip product repository", locator: "fixture://rigzip/repository", capturedAt: now });
  const ownerBrief = registerProductSource({ brandId, kind: "OWNER_NOTE", title: "RigZip owner brief", locator: "fixture://rigzip/owner-brief", capturedAt: now });
  const evidence = [
    recordProductEvidence({ brandId, sourceId: repository.id, statement: "RigZip is a commercial asset rental marketplace.", classification: "FACT", confidence: .98, recordedAt: now }, repository),
    recordProductEvidence({ brandId, sourceId: repository.id, statement: "The product supports location-scoped equipment discovery.", classification: "FACT", confidence: .9, recordedAt: now }, repository),
    recordProductEvidence({ brandId, sourceId: ownerBrief.id, statement: "The initial United States expansion focus includes Nebraska.", classification: "FACT", confidence: .9, recordedAt: now }, ownerBrief),
    recordProductEvidence({ brandId, sourceId: ownerBrief.id, statement: "The strongest acquisition channel remains to be validated.", classification: "UNKNOWN", confidence: .5, recordedAt: now }, ownerBrief),
  ];
  const readiness = assessProductIntelligence([repository, ownerBrief], evidence);
  const diagnosis = createProductDiagnosis({
    brandId,
    valueThesis: "Reduce commercial equipment idle time by matching local supply and qualified demand.",
    priorityAudiences: ["small fleet operators", "commercial equipment owners"],
    customerProblems: ["equipment unavailable when a job starts", "owned equipment sits idle"],
    adoptionBarriers: ["marketplace liquidity", "trust between counterparties"],
    competitiveAlternatives: ["dealer relationships", "manual broker calls"],
    materialRisks: ["insufficient local supply density", "unqualified registrations"],
    unresolvedQuestions: ["which channel produces incremental qualified matches"],
    evidenceIds: evidence.slice(0, 3).map((item) => item.id),
    createdAt: now,
  }, [repository, ownerBrief], evidence);
  const expansionThesis = createExpansionThesis({ brandId, diagnosisId: diagnosis.id, createdAt: now, candidates: [
    { countryCode: "US", geographyName: "Nebraska", administrativeLevel: "STATE", demandScore: 78, supplyScore: 71, accessibilityScore: 82, regulatoryScore: 86, rationale: "Focused test market with observable trailer demand and bounded geography.", assumptions: ["local demand can be measured"], validationQuestions: ["does verified availability improve qualified registrations"] },
    { countryCode: "US", geographyName: "Iowa", administrativeLevel: "STATE", demandScore: 69, supplyScore: 73, accessibilityScore: 80, regulatoryScore: 86, rationale: "Comparable adjacent state suitable as a validation and transfer market.", assumptions: ["market structure is comparable"], validationQuestions: ["does the Nebraska result transfer"] },
  ] }, diagnosis);

  const creativePacket = creatorAgentDraft({ brandId, marketCellId, objective: "Generate qualified trailer registrations", audience: "small fleet operators", region: "Nebraska", winningAssetIds: [], citedResearchSourceIds: evidence.slice(0, 3).map((item) => item.id), supportedClaims: ["Find nearby commercial assets"], culturalContext: ["Use plain operational language", "Avoid claims about guaranteed availability"], capability: "GENERATE_SOCIAL_POST" });
  const legalPolicy: MarketingPolicySnapshot = { id: "policy_us_meta_dry_run", jurisdiction: "US-NE", channel: "meta_ads", version: "2026-08-27", effectiveAt: now, reviewedAt: now, maximumAgeDays: 30, prohibitedCategories: [], prohibitedClaimPatterns: ["guaranteed availability"], requiredDisclosures: ["Marketplace availability varies"], requiresExplicitConsent: false, maximumAutomatedActionsPerDay: 100 };
  const legalDecision = evaluateMarketingAction(legalPolicy, { brandId, jurisdiction: "US-NE", channel: "meta_ads", category: "commercial-equipment", claims: ["Find nearby commercial assets"], disclosures: ["Marketplace availability varies"], hasContentRights: true, hasAudienceConsent: true, automatedActionsToday: 0, scheduledAt: now });
  const legallyCleared = legalAgentAuthorizePrompt(creativePacket, legalDecision);
  const brief: ProductionBrief = { brandId, marketCellId, format: "SOCIAL_POST", objective: "Generate qualified trailer registrations", audience: "small fleet operators", channel: "meta_ads", supportedClaims: ["Find nearby commercial assets"], referenceAssetIds: evidence.slice(0, 2).map((item) => item.id), constraints: ["No guaranteed inventory claims", "Do not publish"], maximumProductionCostUsd: 5 };
  const providerRequest = prepareProviderRequest(brief, false);
  const asset = approveProducedAsset(brief, providerRequest, { requestId: providerRequest.id, brandId, format: "SOCIAL_POST", version: 1, providerId: "dry-run-simulator", storageRef: "memory://rigzip/social-post-v1", actualCostUsd: 0, usedClaims: ["Find nearby commercial assets"] });
  const qaPacket = executorAgentReview(legallyCleared, []);
  const libraryAsset = registerCreativeAsset({ asset, briefId: packet.contentBrief.id, objectKey: `${brandId}/dry-run/social-post-v1.txt`, contentHash: "a".repeat(64), mimeType: "text/plain", bytes: 128, locale: "en-US", territories: ["US-NE"], rightsOwner: "LAFWIRON", allowedUsage: ["DRY_RUN_EVALUATION"] });
  const marketingDecision = seniorMarketingAllocate({ packet: qaPacket, channel: "meta_ads", requestedBudgetUsd: 100, availableBrandCapitalUsd: 500, delegatedLimitUsd: 250, ventureAvailableUsd: 0 });
  const distribution = queueApprovedAsset({ asset, channel: "meta_ads", requestedPromotionUsd: marketingDecision.budgetUsd, authorizedPromotionUsd: 250, compliance: legalDecision, productionMode: false });
  const metric = defineMetric({ workspaceId: packet.productSnapshot.workspaceId, brandId: packet.productSnapshot.brandId, key: "simulated_qualified_registrations", version: 1, description: "Dry-run model output, not an observed customer event", unit: "registrations", aggregation: "COUNT", valueEvent: false, allowedSemanticClasses: ["FORECAST"] });
  const metricEvent = ingestCanonicalEvent(metric, { workspaceId: packet.productSnapshot.workspaceId, brandId: packet.productSnapshot.brandId, marketCellId: packet.marketCell.id, occurredAt: now, ingestedAt: now, value: 8.7, semanticClass: "FORECAST", sourceProvider: "dry-run-simulator", sourceEventId: "rigzip-nebraska-001", quality: "USABLE", attributionMethod: "MODELLED", consentClass: "ANONYMOUS_AGGREGATE" });
  const report = analyticsAgentReport({ packet: qaPacket, spendUsd: 0, engagements: 87, impressions: 1000, penetrationBefore: .02, penetrationAfter: .027, recommendedNextBudgetUsd: 100, availableCapitalUsd: 500 });

  return { mode: "DRY_RUN" as const, externalEffects: 0 as const, sources: [repository, ownerBrief], evidence, readiness, diagnosis, expansionThesis, creativePacket, legalPolicy, legalDecision, providerRequest, qaPacket, asset, libraryAsset, marketingDecision, distribution, metric, metricEvent, report };
}
