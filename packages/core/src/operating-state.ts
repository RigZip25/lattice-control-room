import { deterministicId } from "./identity.js";

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

export interface OperatingEvent {
  readonly id: string;
  readonly version: number;
  readonly kind: OperatingCommand["kind"];
  readonly occurredAt: string;
}

export interface OperatingState {
  readonly version: number;
  readonly executive: boolean;
  readonly locale: OperatingLocale;
  readonly selectedFilter: OperatingFilter;
  readonly openDecisions: number;
  readonly lastRefreshAt?: string;
  readonly discoveryMarkets: readonly DiscoveryMarket[];
  readonly events: readonly OperatingEvent[];
  readonly mode: "DRY_RUN";
}

export type OperatingCommand =
  | { readonly kind: "SET_EXECUTIVE_VIEW"; readonly enabled: boolean }
  | { readonly kind: "SET_LOCALE"; readonly locale: OperatingLocale }
  | { readonly kind: "SET_FILTER"; readonly filter: OperatingFilter }
  | { readonly kind: "REFRESH_READ_MODELS" }
  | { readonly kind: "RESOLVE_DECISION"; readonly outcome: "APPROVED" | "REJECTED" }
  | { readonly kind: "ADD_DISCOVERY_MARKET"; readonly market: DiscoveryMarket };

export function initialOperatingState(): OperatingState {
  return { version: 0, executive: false, locale: "RU", selectedFilter: "ВСЕ", openDecisions: 3, discoveryMarkets: [], events: [], mode: "DRY_RUN" };
}

export function applyOperatingCommand(state: OperatingState, command: OperatingCommand, occurredAt: string): OperatingState {
  if (!Number.isFinite(Date.parse(occurredAt))) throw new Error("Operating event timestamp is invalid");
  if (command === null || typeof command !== "object" || !["SET_EXECUTIVE_VIEW","SET_LOCALE","SET_FILTER","REFRESH_READ_MODELS","RESOLVE_DECISION","ADD_DISCOVERY_MARKET"].includes(command.kind)) {
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
    default: throw new Error("Operating command kind is invalid");
  }
}
