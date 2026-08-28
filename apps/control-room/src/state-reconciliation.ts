import type { BrandProfile, OperatingState, ProductUnderstanding } from "@lattice/core";

export interface RegisteredBrandRow {
  readonly brand_id: string;
  readonly name: string;
  readonly profile?: unknown;
  readonly status: string;
}

function isBrandProfile(value:unknown,brandId:string):value is BrandProfile {
  if(!value||typeof value!=="object")return false;
  const profile=value as Partial<BrandProfile>;
  return profile.id===brandId
    && typeof profile.name==="string"
    && typeof profile.offering==="string"
    && typeof profile.audience==="string"
    && typeof profile.businessModel==="string"
    && typeof profile.primaryValueEvent==="string"
    && Array.isArray(profile.objectives)
    && Array.isArray(profile.targetGeographies)
    && Array.isArray(profile.languages)
    && Array.isArray(profile.constraints);
}

function recoveredUnderstanding(brand:BrandProfile):ProductUnderstanding {
  const website=brand.offering.match(/https?:\/\/[^\s]+/i)?.[0];
  return {
    brandId:brand.id,
    ...(website?{website}:{}),
    ownerDescription:brand.offering,
    materialNames:[],
    productSummary:brand.offering,
    customerSummary:brand.audience,
    valueSummary:"Требует повторного подтверждения владельца",
    assumptions:["Черновик безопасно восстановлен из канонического реестра брендов после рассинхронизации агрегированного состояния"],
    criticalQuestions:[],
    status:"DRAFT",
  };
}

/** The brand table owns brand identity; the aggregate owns working history for active brands. */
export function reconcileRegisteredBrands(state:OperatingState,rows:readonly RegisteredBrandRow[]):OperatingState {
  const profiles:BrandProfile[]=[];
  for(const row of rows){
    if(row.status==="PAUSED"||!isBrandProfile(row.profile,row.brand_id))continue;
    profiles.push(row.profile);
  }
  const activeIds=new Set(profiles.map((profile)=>profile.id));
  const understandings=(state.productUnderstandings??[]).filter((item)=>activeIds.has(item.brandId));
  for(const brand of profiles)if(!understandings.some((item)=>item.brandId===brand.id))understandings.push(recoveredUnderstanding(brand));
  const keepBrandScoped=<T extends {readonly brandId:string}>(items:readonly T[])=>items.filter((item)=>activeIds.has(item.brandId));
  return {
    ...state,
    brandProfiles:profiles,
    productUnderstandings:understandings,
    productSources:keepBrandScoped(state.productSources),
    productEvidence:keepBrandScoped(state.productEvidence),
    productDiagnoses:keepBrandScoped(state.productDiagnoses),
    expansionTheses:keepBrandScoped(state.expansionTheses),
  };
}
