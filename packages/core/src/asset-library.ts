import { deterministicId } from "./identity.js";
import type { ContentFormat, ProducedAsset } from "./content-production.js";

export interface CreativeAssetRecord {
  readonly id: string;
  readonly brandId: string;
  readonly format: ContentFormat;
  readonly objectKey: string;
  readonly contentHash: string;
  readonly mimeType: string;
  readonly bytes: number;
  readonly version: number;
  readonly parentAssetId?: string;
  readonly locale: string;
  readonly territories: readonly string[];
  readonly rights: { readonly owner: string; readonly usage: readonly string[]; readonly expiresAt?: string };
  readonly lineage: { readonly briefId: string; readonly requestId: string; readonly providerId: string };
  readonly state: "APPROVED" | "ARCHIVED";
}

export interface DailyProductionPlan {
  readonly date: string;
  readonly requestedUnits: number;
  readonly admittedUnits: number;
  readonly deferredUnits: number;
  readonly estimatedCostUsd: number;
  readonly autonomous: boolean;
  readonly reasonCodes: readonly string[];
}

export function registerCreativeAsset(input: { readonly asset: ProducedAsset; readonly briefId: string; readonly objectKey: string; readonly contentHash: string; readonly mimeType: string; readonly bytes: number; readonly locale: string; readonly territories: readonly string[]; readonly rightsOwner: string; readonly allowedUsage: readonly string[] }): CreativeAssetRecord {
  if (input.asset.status !== "APPROVED") throw new Error("Only approved output may enter the brand library");
  if (!input.objectKey.startsWith(`${input.asset.brandId}/`) || !/^[a-f0-9]{32,128}$/.test(input.contentHash)) throw new Error("Asset storage identity is invalid");
  if (input.bytes <= 0 || input.allowedUsage.length === 0 || !input.rightsOwner.trim()) throw new Error("Asset size and usage rights are required");
  const payload = { assetId:input.asset.id, objectKey:input.objectKey, contentHash:input.contentHash };
  return { id:deterministicId("creative_asset",payload), brandId:input.asset.brandId, format:input.asset.format, objectKey:input.objectKey, contentHash:input.contentHash, mimeType:input.mimeType, bytes:input.bytes, version:input.asset.version, locale:input.locale, territories:[...input.territories], rights:{owner:input.rightsOwner,usage:[...input.allowedUsage]}, lineage:{briefId:input.briefId,requestId:input.asset.requestId,providerId:input.asset.providerId}, state:"APPROVED" };
}

export function planDailyProduction(input: { readonly date: string; readonly requestedUnits: number; readonly unitCostUsd: number; readonly dailyBudgetUsd: number; readonly providerCapacity: number; readonly reviewAutomationCoverage: number; readonly failureRate: number }): DailyProductionPlan {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date) || input.requestedUnits < 0 || input.unitCostUsd < 0) throw new Error("Production planning input is invalid");
  const budgetCapacity = input.unitCostUsd === 0 ? input.requestedUnits : Math.floor(input.dailyBudgetUsd / input.unitCostUsd);
  const admittedUnits = Math.max(0,Math.min(input.requestedUnits,input.providerCapacity,budgetCapacity));
  const reasons:string[] = [];
  if (admittedUnits < input.requestedUnits) reasons.push("CAPACITY_OR_BUDGET_LIMIT");
  if (input.reviewAutomationCoverage < 0.98) reasons.push("QA_AUTOMATION_BELOW_THRESHOLD");
  if (input.failureRate > 0.05) reasons.push("PROVIDER_FAILURE_RATE_TOO_HIGH");
  return { date:input.date, requestedUnits:input.requestedUnits, admittedUnits, deferredUnits:input.requestedUnits-admittedUnits, estimatedCostUsd:admittedUnits*input.unitCostUsd, autonomous:reasons.length===0, reasonCodes:reasons };
}
