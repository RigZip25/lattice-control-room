export interface GeographyDefinition {
  readonly countryCode: string;
  readonly countryName: string;
  readonly slug: string;
  readonly administrativeLevels: readonly string[];
  readonly supportedActivityDimensions: readonly string[];
  readonly status: "REFERENCE" | "ENABLED" | "DISCOVERY";
}

export interface BoundaryDataset {
  readonly id: string;
  readonly countryCode: string;
  readonly sourceName: string;
  readonly sourceVersion: string;
  readonly license: string;
  readonly importedAt: string;
  readonly geometryFormat: "GEOJSON" | "VECTOR_TILES";
}

export interface AdminUnit {
  readonly id: string;
  readonly datasetId: string;
  readonly countryCode: string;
  readonly parentId?: string;
  readonly level: number;
  readonly unitType: string;
  readonly displayName: string;
  readonly localName: string;
  readonly geometryRef: string;
}

export interface MarketAreaOverlay {
  readonly id: string;
  readonly countryCode: string;
  readonly brandId: string;
  readonly activityDimension: string;
  readonly adminUnitIds: readonly string[];
  readonly kind: "ADMIN_UNIT" | "MULTI_UNIT_CLUSTER" | "CUSTOM_MARKET_CELL";
}

export interface DrillDownPolicy {
  readonly minimumObservations: number;
  readonly minimumPopulation?: number;
  readonly maximumLevel: number;
  readonly privacyThreshold: number;
}

export function evaluateDrillDown(input: {
  readonly unit: AdminUnit;
  readonly childCount: number;
  readonly observations: number;
  readonly population?: number;
  readonly policy: DrillDownPolicy;
}): { readonly state: "EXPAND" | "AGGREGATE" | "LEAF"; readonly reason: string } {
  if (input.unit.level >= input.policy.maximumLevel || input.childCount === 0) {
    return { state: "LEAF", reason: "MAXIMUM_DEPTH_OR_NO_CHILDREN" };
  }
  if (input.observations < Math.max(input.policy.minimumObservations, input.policy.privacyThreshold)) {
    return { state: "AGGREGATE", reason: "INSUFFICIENT_PRIVACY_SAFE_SIGNAL" };
  }
  if (input.policy.minimumPopulation !== undefined && (input.population ?? 0) < input.policy.minimumPopulation) {
    return { state: "AGGREGATE", reason: "POPULATION_BELOW_MARKET_RESOLUTION" };
  }
  return { state: "EXPAND", reason: "DEPTH_AND_SIGNAL_ALLOW_EXPANSION" };
}

export class GeographyRegistry {
  readonly #byCode = new Map<string, GeographyDefinition>();

  constructor(definitions: readonly GeographyDefinition[] = []) {
    for (const definition of definitions) this.register(definition);
  }

  register(definition: GeographyDefinition): void {
    if (!/^[A-Z]{2}$/.test(definition.countryCode)) throw new Error("Country code must be ISO alpha-2 shaped");
    if (!/^[a-z0-9-]+$/.test(definition.slug)) throw new Error("Geography slug is invalid");
    if (definition.administrativeLevels.length === 0) throw new Error("At least one administrative level is required");
    if (this.#byCode.has(definition.countryCode)) throw new Error(`Country already registered: ${definition.countryCode}`);
    this.#byCode.set(definition.countryCode, Object.freeze({ ...definition }));
  }

  get(countryCode: string): GeographyDefinition | undefined {
    return this.#byCode.get(countryCode.toUpperCase());
  }

  list(): readonly GeographyDefinition[] {
    return [...this.#byCode.values()];
  }
}

export const referenceGeographies = new GeographyRegistry([
  { countryCode: "US", countryName: "United States", slug: "united-states", administrativeLevels: ["state", "county"], supportedActivityDimensions: ["asset_vertical", "operator_segment"], status: "REFERENCE" },
  { countryCode: "CZ", countryName: "Czechia", slug: "czechia", administrativeLevels: ["region", "district", "municipality"], supportedActivityDimensions: ["category", "liquidity_segment"], status: "REFERENCE" },
  { countryCode: "IT", countryName: "Italy", slug: "italy", administrativeLevels: ["region", "province", "municipality"], supportedActivityDimensions: ["travel_intent", "season"], status: "REFERENCE" },
  { countryCode: "CO", countryName: "Colombia", slug: "colombia", administrativeLevels: ["department", "municipality"], supportedActivityDimensions: ["route_type", "utility_need"], status: "REFERENCE" },
]);

export function marketDrillDownRoute(countryCode: string, areaSlug?: string): string {
  const country = referenceGeographies.get(countryCode);
  const root = `/markets/${country?.slug ?? countryCode.toLowerCase()}`;
  return areaSlug === undefined ? root : `${root}/${areaSlug}`;
}
