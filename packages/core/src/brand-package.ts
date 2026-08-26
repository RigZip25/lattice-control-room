import { deterministicId } from "./identity.js";
import type { BrandPackage, ProductSnapshot, ValueClaim } from "./model.js";

export interface BrandPackageDraft {
  readonly problem: string;
  readonly audiences: readonly string[];
  readonly claims: readonly {
    readonly statement: string;
    readonly evidenceFactKeys: readonly string[];
  }[];
  readonly hardConstraints: readonly string[];
}

export function buildBrandPackage(
  snapshot: ProductSnapshot,
  draft: BrandPackageDraft,
): BrandPackage {
  const factKeys = new Set(snapshot.facts.map((fact) => fact.key));
  const valueClaims: ValueClaim[] = draft.claims.map((claim) => {
    const supported =
      claim.evidenceFactKeys.length > 0 &&
      claim.evidenceFactKeys.every((key) => factKeys.has(key));
    return {
      id: deterministicId("claim", {
        snapshot: snapshot.id,
        statement: claim.statement,
      }),
      statement: claim.statement,
      evidenceFactKeys: [...claim.evidenceFactKeys],
      status: supported ? "SUPPORTED" : "UNVERIFIED",
    };
  });

  const payload = {
    workspaceId: snapshot.workspaceId,
    brandId: snapshot.brandId,
    productSnapshotId: snapshot.id,
    version: 1,
    problem: draft.problem,
    audiences: [...draft.audiences],
    valueClaims,
    hardConstraints: [...draft.hardConstraints],
  } as const;

  return { id: deterministicId("brand_package", payload), ...payload };
}
