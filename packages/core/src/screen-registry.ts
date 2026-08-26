export interface ProductScreen {
  readonly order: number;
  readonly key: string;
  readonly route: string;
  readonly title: string;
  readonly figmaNodeId: string;
  readonly domain: "COMMAND" | "MARKET" | "DISTRIBUTION" | "CAPITAL" | "OPERATIONS" | "INTELLIGENCE" | "CONFIGURATION";
  readonly linksTo: readonly string[];
}

export const productScreens: readonly ProductScreen[] = [
  { order: 1, key: "command", route: "/command", title: "Командный центр", figmaNodeId: "4:2", domain: "COMMAND", linksTo: ["factory", "markets", "venture", "owner-command"] },
  { order: 2, key: "factory", route: "/factory", title: "Цеха и потоки", figmaNodeId: "30:5", domain: "OPERATIONS", linksTo: ["campaigns", "content-factory", "distribution"] },
  { order: 3, key: "markets", route: "/markets", title: "Рынки и скауты", figmaNodeId: "30:253", domain: "MARKET", linksTo: ["nebraska", "czechia", "italy", "colombia"] },
  { order: 4, key: "campaigns", route: "/campaigns", title: "Кампании", figmaNodeId: "30:572", domain: "DISTRIBUTION", linksTo: ["channels", "assets", "experiments"] },
  { order: 5, key: "channels", route: "/channels", title: "Каналы", figmaNodeId: "30:832", domain: "DISTRIBUTION", linksTo: ["campaigns", "distribution"] },
  { order: 6, key: "assets", route: "/assets", title: "Библиотека креативов", figmaNodeId: "30:1099", domain: "DISTRIBUTION", linksTo: ["content-factory", "campaigns"] },
  { order: 7, key: "venture", route: "/venture", title: "Венчур", figmaNodeId: "30:1360", domain: "CAPITAL", linksTo: ["capital-allocator", "treasury", "experiments"] },
  { order: 8, key: "treasury", route: "/treasury", title: "Финансы и казначейство", figmaNodeId: "30:1516", domain: "CAPITAL", linksTo: ["venture", "capital-allocator", "audit"] },
  { order: 9, key: "operations", route: "/operations", title: "Операции", figmaNodeId: "52:6", domain: "OPERATIONS", linksTo: ["factory", "audit"] },
  { order: 10, key: "audit", route: "/audit", title: "Аудит и политики", figmaNodeId: "52:251", domain: "OPERATIONS", linksTo: ["treasury", "factory-config"] },
  { order: 11, key: "brands", route: "/brands", title: "Линии брендов", figmaNodeId: "52:449", domain: "CONFIGURATION", linksTo: ["markets", "factory-config"] },
  { order: 12, key: "nebraska", route: "/markets/nebraska", title: "Небраска — каунти", figmaNodeId: "40:857", domain: "MARKET", linksTo: ["markets", "experiments", "venture"] },
  { order: 13, key: "czechia", route: "/markets/czechia", title: "Чехия — крае", figmaNodeId: "40:1139", domain: "MARKET", linksTo: ["markets", "experiments", "venture"] },
  { order: 14, key: "italy", route: "/markets/italy", title: "Италия — регионы", figmaNodeId: "46:4", domain: "MARKET", linksTo: ["markets", "experiments", "venture"] },
  { order: 15, key: "colombia", route: "/markets/colombia", title: "Колумбия — департаменты", figmaNodeId: "79:4", domain: "MARKET", linksTo: ["markets", "experiments", "venture"] },
  { order: 16, key: "capital-allocator", route: "/capital-allocator", title: "Capital Allocator / Next Dollar", figmaNodeId: "82:4", domain: "CAPITAL", linksTo: ["venture", "treasury", "campaigns"] },
  { order: 17, key: "learning-engine", route: "/learning", title: "Learning Engine / Knowledge Graph", figmaNodeId: "83:4", domain: "INTELLIGENCE", linksTo: ["experiments", "markets", "content-factory"] },
  { order: 18, key: "owner-command", route: "/owner", title: "Командный центр владельца", figmaNodeId: "85:4", domain: "COMMAND", linksTo: ["command", "capital-allocator", "audit"] },
  { order: 19, key: "experiments", route: "/experiments", title: "Лаборатория экспериментов", figmaNodeId: "87:5", domain: "INTELLIGENCE", linksTo: ["venture", "learning-engine", "campaigns"] },
  { order: 20, key: "content-factory", route: "/content-factory", title: "Контент-фабрика", figmaNodeId: "88:4", domain: "DISTRIBUTION", linksTo: ["assets", "distribution", "campaigns"] },
  { order: 21, key: "distribution", route: "/distribution", title: "Распределение и каналы", figmaNodeId: "89:4", domain: "DISTRIBUTION", linksTo: ["channels", "campaigns", "learning-engine"] },
  { order: 22, key: "factory-config", route: "/factory-config", title: "Конфигурация фабрики", figmaNodeId: "91:4", domain: "CONFIGURATION", linksTo: ["brands", "audit", "operations"] },
] as const;

export function screenByRoute(route: string): ProductScreen | undefined {
  return productScreens.find((screen) => screen.route === route);
}

export function assertValidScreenRegistry(screens: readonly ProductScreen[]): void {
  if (screens.length !== 22) throw new Error("LATTICE product surface must contain exactly 22 screens");
  const keys = new Set(screens.map((screen) => screen.key));
  const routes = new Set(screens.map((screen) => screen.route));
  const nodes = new Set(screens.map((screen) => screen.figmaNodeId));
  if (keys.size !== screens.length || routes.size !== screens.length || nodes.size !== screens.length) {
    throw new Error("Screen keys, routes and Figma nodes must be unique");
  }
  for (const screen of screens) {
    for (const target of screen.linksTo) {
      if (!keys.has(target)) throw new Error(`Unknown screen link: ${screen.key} -> ${target}`);
    }
  }
}
