import { blueprints } from "/screen-blueprints.js";
import { renderChoropleths } from "/map.js";

const state = { executive:false, locale:"RU", notice:"", decisions:3, selectedFilter:"ВСЕ", selectedRegion:"WORLD", mobileNav:false, welcome:location.pathname==="/", factoryStatus:null, backendStatus:null, authOpen:false, session:null, cloudContext:null, addCountry:false, addBrand:false, addSource:false, addDiagnosis:false, addThesis:false, pendingCountry:null, pendingArea:null, addedMarkets:[], expansionAreas:[], brandProfiles:[], productSources:[], productEvidence:[], productDiagnoses:[], expansionTheses:[], version:0 };
const isLocalRuntime = ["localhost", "127.0.0.1", "::1"].includes(location.hostname);
let screens = [];
let control = null;
let geographies = [];
let countryCatalog = [];

const referenceMapAssets = {
  command: "/assets/maps/us-1.png",
  markets: "/assets/maps/us-1.png",
  nebraska: "/assets/maps/nebraska-1.png",
  czechia: "/assets/maps/czechia-1.png",
  italy: "/assets/maps/italy-1.png",
  colombia: "/assets/maps/colombia-1.png",
};
const interactiveMaps = {
  command: { source:"/data/maps/world-countries.geojson", mode:"countries", base:"/markets", attribution:"world.geo.json · Natural Earth" },
  markets: { source:"/data/maps/us-states.geojson", mode:"states", base:"/markets/united-states", attribution:"US Census Bureau · 2024" },
  nebraska: { source:"/data/maps/nebraska-counties.geojson", mode:"counties", base:"/markets/nebraska", attribution:"US Census Bureau · 2024" },
  czechia: { source:"/data/maps/czechia-regions.geojson", mode:"regions", country:"CZ", base:"/markets/czechia", attribution:"geoBoundaries · 2021 · CC BY 4.0" },
  italy: { source:"/data/maps/italy-regions.geojson", mode:"regions", country:"IT", base:"/markets/italy", attribution:"geoBoundaries · 2023 · CC BY 3.0" },
  colombia: { source:"/data/maps/colombia-departments.geojson", mode:"regions", country:"CO", base:"/markets/colombia", attribution:"geoBoundaries · 2017 · ODbL 1.0" },
};
const mapPanelConfig = {
  command: { title:"ГЛОБАЛЬНАЯ ТОПОЛОГИЯ РЫНОЧНЫХ СИГНАЛОВ", segment:"МИР / МАКРОРЕГИОН", pills:["Весь мир","Северная Америка","Европа","Латинская Америка","Азия","Африка","Ближний Восток","Океания"], regions:["WORLD","NORTH_AMERICA","EUROPE","LATAM","ASIA","AFRICA","MIDDLE_EAST","OCEANIA"] },
  markets: { title:"ТОПОЛОГИЯ ПРОНИКНОВЕНИЯ ПО ШТАТАМ", segment:"ВСЕ НАПРАВЛЕНИЯ", pills:["RigZip","Evorios","Travel","Navigator"] },
  nebraska: { title:"ТОПОЛОГИЯ ПРОНИКНОВЕНИЯ ПО КАУНТИ", segment:"Construction / Logistics", pills:["Trailers","Agriculture","Equipment","Contractors","Fleet"] },
  czechia: { title:"ТОПОЛОГИЯ ПРОНИКНОВЕНИЯ ПО КРАЯМ", segment:"Товары для дома / Маркетплейсы", pills:["Товары для дома","Маркетплейсы","Логистика","Фуд","Финансы"] },
  italy: { title:"ТОПОЛОГИЯ ПРОНИКНОВЕНИЯ ПО РЕГИОНАМ", segment:"Delivery / Logistics", pills:["Delivery","Логистика","Ритейл","Ф&Б","HoReCa"] },
  colombia: { title:"ТОПОЛОГИЯ ПРОНИКНОВЕНИЯ ПО ДЕПАРТАМЕНТАМ", segment:"Продукты питания / Фреш-доставка", pills:["Продукты питания","Фреш-доставка","Ритейл","Фарма","Агро"] },
};
const demoExpansionMarkets = [
  { country:"USA", brand:"RIGZIP", penetration:8.7 },
  { country:"CZE", brand:"EVORIOS", penetration:6.4 },
  { country:"ITA", brand:"TRAVEL", penetration:4.9 },
  { country:"COL", brand:"NAVIGATOR", penetration:5.4 },
];
const activeCountrySpec = () => [...demoExpansionMarkets,...state.addedMarkets.filter((market)=>market.worldCode).map((market)=>({country:market.worldCode,brand:market.brand.toUpperCase(),penetration:0.2}))].filter((market)=>state.selectedFilter === "ВСЕ" || market.brand === state.selectedFilter).map((market)=>`${market.country}:${market.penetration}`).join(",");

const esc = (value) => String(value).replace(/[&<>'"]/g, (char) => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"})[char]);
const tr = (ru, en) => state.locale === "RU" ? ru : en;
const coreBrands = ["RigZip","Evorios","Books","Travel","Smart Navigator"];
const brandOptions = () => [...new Set([...coreBrands,...state.brandProfiles.map((brand)=>brand.name)])].map((brand)=>`<option>${esc(brand)}</option>`).join("");
const pendingDecisionLabel = (count) => state.locale === "EN" ? `${count} ${count === 1 ? "decision" : "decisions"} pending` : `${count} ${count === 1 ? "решение ожидает" : count < 5 ? "решения ожидают" : "решений ожидают"}`;
function applyRuntime(runtime) {
  state.executive = runtime.executive;
  state.locale = runtime.locale;
  state.decisions = runtime.openDecisions;
  state.selectedFilter = runtime.selectedFilter;
  state.addedMarkets = runtime.discoveryMarkets.map((market) => ({ ...market, administrativeLevels:["country","subdivision"], supportedActivityDimensions:[market.activity] }));
  state.expansionAreas = runtime.expansionAreas ?? [];
  state.brandProfiles = runtime.brandProfiles ?? [];
  state.productSources = runtime.productSources ?? [];
  state.productEvidence = runtime.productEvidence ?? [];
  state.productDiagnoses = runtime.productDiagnoses ?? [];
  state.expansionTheses = runtime.expansionTheses ?? [];
  state.version = runtime.version;
}
async function sendCommand(command) {
  const headers = { "Content-Type":"application/json" };
  if (state.session?.access_token) headers.Authorization = `Bearer ${state.session.access_token}`;
  if (state.cloudContext?.workspace?.workspace_id) headers["X-Lattice-Workspace-Id"] = state.cloudContext.workspace.workspace_id;
  const currentState = {
    version:state.version,
    mode:"DRY_RUN",
    executive:state.executive,
    locale:state.locale,
    selectedFilter:state.selectedFilter,
    openDecisions:state.decisions,
    discoveryMarkets:state.addedMarkets.map(({ administrativeLevels, supportedActivityDimensions, ...market })=>market),
    expansionAreas:state.expansionAreas,
    brandProfiles:state.brandProfiles,
    productSources:state.productSources,
    productEvidence:state.productEvidence,
    productDiagnoses:state.productDiagnoses,
    expansionTheses:state.expansionTheses,
    events:[],
  };
  const response = await fetch("/api/v1/commands", { method:"POST", headers, body:JSON.stringify({command,currentState}) });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error ?? "Command rejected");
  applyRuntime(payload);
}
const byKey = (key) => screens.find((screen) => screen.key === key);
function current() {
  const exact = screens.find((screen) => screen.route === location.pathname);
  if (exact) return exact;
  if (location.pathname.startsWith("/markets/")) {
    const [, , encodedCountrySlug = "market", encodedAreaSlug] = location.pathname.split("/");
    const countrySlug = decodeURIComponent(encodedCountrySlug);
    const areaSlug = encodedAreaSlug ? decodeURIComponent(encodedAreaSlug) : undefined;
    const geography = [...geographies,...state.addedMarkets].find((item) => item.slug === countrySlug);
    const label = (value) => value.replaceAll("-", " ").replace(/\b\w/g, (character) => character.toUpperCase());
    return {
      order: 12,
      key: "markets",
      route: location.pathname,
      title: `${geography?.countryName ?? label(countrySlug)}${areaSlug ? ` / ${label(areaSlug)}` : ""}`,
      figmaNodeId: "PARAMETERIZED_GEOGRAPHIC_DRILLDOWN",
      domain: "MARKET",
      linksTo: ["markets", "experiments", "venture"],
    };
  }
  if (location.pathname.startsWith("/brands/") && location.pathname.endsWith("/onboarding")) {
    const brandId = location.pathname.split("/")[2];
    const brand = state.brandProfiles.find((item)=>item.id===brandId);
    return { order:11, key:"brand-onboarding", route:location.pathname, title:brand?.name ?? "Brand onboarding", figmaNodeId:"PARAMETERIZED_BRAND_ONBOARDING", domain:"CONFIGURATION", linksTo:["brands","markets","experiments","content-factory","distribution","learning-engine"] };
  }
  return screens.find((screen) => screen.key === "command");
}

function navGroups() {
  return [
    ["ОСНОВНОЕ",["command","factory","markets","campaigns","channels","assets"]],
    ["КАПИТАЛ",["venture","treasury","capital-allocator"]],
    ["КОНТРОЛЬ",["operations","audit","brands","learning-engine","owner-command","experiments","content-factory","distribution","factory-config"]],
  ];
}

function panelMarkup(panel, screen) {
  const rows = panel.rows.map((row,index) => `<button class="data-row" data-route="${esc(byKey(screen.linksTo[index % screen.linksTo.length])?.route ?? screen.route)}"><span class="row-dot"></span><span>${esc(row)}</span><b>↗</b></button>`).join("");
  if (panel.kind === "flow") {
    const flowLabels = {"Product Intel":["Аналитика продукта","Product intelligence"],"Market Scout":["Разведка рынков","Market scouting"],"Experiment":["Эксперименты","Experiments"],"Creative":["Производство контента","Content production"],"Distribution":["Дистрибуция","Distribution"],"Learning":["Обучение системы","System learning"],"Market":["Рынок","Market"],"Audience":["Аудитория","Audience"],"Claim":["Утверждение","Claim"],"Channel":["Канал","Channel"],"Outcome":["Результат","Outcome"]};
    const flowTitle = screen.key === "factory" ? tr("ПРОИЗВОДСТВЕННЫЙ КОНТУР","FACTORY FLOW") : screen.key === "learning-engine" ? tr("КОНТУР ЗНАНИЙ","KNOWLEDGE FLOW") : panel.title;
    return `<article class="module module-wide flow-module"><div class="module-title">${esc(flowTitle)}<span>${tr("РАБОТАЕТ","LIVE")}</span></div><div class="flowline">${panel.rows.map((row,index)=>`<button data-route="${esc(byKey(screen.linksTo[index % screen.linksTo.length])?.route ?? screen.route)}"><i>${String(index+1).padStart(2,"0")}</i><b>${esc(flowLabels[row]?.[state.locale === "RU" ? 0 : 1] ?? row)}</b><small>${index === 0 ? tr("в работе","active") : tr("следующий этап","next stage")}</small></button>`).join("<em>→</em>")}</div></article>`;
  }
  if (panel.kind === "map") {
    const dynamicMarket = screen.figmaNodeId === "PARAMETERIZED_GEOGRAPHIC_DRILLDOWN"
      ? state.addedMarkets.find((market)=>location.pathname.split("/")[2] && market.slug===decodeURIComponent(location.pathname.split("/")[2]))
      : null;
    const interactive = dynamicMarket
      ? { source:"/data/maps/world-countries.geojson", mode:"country-focus", country:dynamicMarket.countryCode, focus:dynamicMarket.worldCode, base:location.pathname, attribution:"world.geo.json · Natural Earth" }
      : screen.figmaNodeId === "PARAMETERIZED_GEOGRAPHIC_DRILLDOWN" ? null : interactiveMaps[screen.key];
    const asset = screen.figmaNodeId === "PARAMETERIZED_GEOGRAPHIC_DRILLDOWN" ? null : referenceMapAssets[screen.key];
    const map = interactive
      ? `<div class="geo-vector" data-geo-source="${interactive.source}" data-geo-mode="${interactive.mode}" data-geo-country="${interactive.country ?? (interactive.mode === "states" || interactive.mode === "counties" ? "US" : "")}" data-geo-focus="${interactive.focus ?? ""}" data-geo-base="${interactive.base}" data-geo-attribution="${interactive.attribution}" data-geo-region="${screen.key === "command" ? state.selectedRegion : "ALL"}" data-active-countries="${screen.key === "command" ? activeCountrySpec() : ""}" data-active-areas="${state.expansionAreas.map((area)=>`${area.countryCode}:${area.adminUnitId}`).join(",")}"></div>`
      : asset
      ? `<img src="${asset}" alt="${esc(panel.title)}: административные границы" loading="eager">`
      : `<div class="boundary-pending"><b>ГРАНИЦЫ ЗАГРУЖАЮТСЯ</b><span>Система определяет принятый административный уровень и проверяет набор полигонов перед публикацией.</span><small>DISCOVERY · NO SYNTHETIC CELLS</small></div>`;
    const config = dynamicMarket
      ? { title:`КОНТУР РЫНКА: ${dynamicMarket.countryName.toUpperCase()}`, segment:dynamicMarket.activity, pills:[dynamicMarket.brand] }
      : mapPanelConfig[screen.key] ?? { title:panel.title, segment:"ALL MARKETCELLS", pills:[] };
    const controls = interactive ? `<div class="map-controls"><div class="map-control-block"><b>АНАЛИТИЧЕСКИЙ СЛОЙ: OPPORTUNITY</b><div>${["Opportunity","Evidence","Traction","Penetration","Marginal Response","Liquidity","Saturation"].map((label,index)=>`<button class="map-chip ${index===0?"selected":""}" type="button">${label}</button>`).join("")}</div></div><div class="map-control-block ${config.regions?"region-control":"segment-control"}"><b>${config.regions?"ГЕОГРАФИЧЕСКИЙ ОХВАТ":`СЕГМЕНТ MARKETCELL: ${esc(config.segment)}`}</b><div>${config.pills.map((label,index)=>`<button class="map-chip ${(config.regions?config.regions[index]===state.selectedRegion:index===0)?"selected":""}" type="button" ${config.regions?`data-region="${config.regions[index]}"`:""}>${esc(label)}</button>`).join("")}</div></div></div>` : "";
    return `<article class="module map-module"><div class="map-panel-head"><h2>${esc(config.title)}</h2>${controls}</div><div class="geo-map">${map}</div></article>`;
  }
  if (panel.kind === "bars") return `<article class="module"><div class="module-title">${esc(panel.title)}<span>FORECAST</span></div><div class="bars">${panel.rows.map((row,index)=>`<div><label>${esc(row)}</label><i><b class="bar-${Math.min(index,5)}"></b></i></div>`).join("")}</div></article>`;
  if (panel.kind === "decisions") return `<article class="module decisions"><div class="module-title">${esc(panel.title)}<span>${state.decisions}</span></div>${panel.rows.map((row,index)=>`<div class="decision"><small>REQUIRES AUTHORITY</small><b>${esc(row)}</b><div><button data-action="approve" data-index="${index}">ОДОБРИТЬ</button><button data-action="reject" data-index="${index}">ОТКЛОНИТЬ</button><button data-route="${esc(byKey(screen.linksTo[index % screen.linksTo.length])?.route ?? screen.route)}">ПОДРОБНЕЕ</button></div></div>`).join("")}</article>`;
  return `<article class="module"><div class="module-title">${esc(panel.title)}<span>FACT</span></div><div class="module-rows">${rows}</div></article>`;
}

function commandCenterMarkup(screen, blueprint) {
  const wallet = control?.wallet ?? { settledUsd:1000000, availableUsd:316000, reservedUsd:684000 };
  const authority = control?.authority ?? { maximumDecisionUsd:2500, maximumDailyUsd:5000, killSwitch:false };
  const active = control?.activeDecision ?? { brandId:"rigzip", marketCell:"nebraska", requestedUsd:100, decision:"APPROVE", distributionState:"BLOCKED", evidenceCount:3 };
  const money = (value) => new Intl.NumberFormat("en-US", { style:"currency", currency:"USD", maximumFractionDigits:0 }).format(value);
  const stages = [["01","MARKET INTELLIGENCE","18 signals","markets"],["02","EXPERIMENTS","7 running","experiments"],["03","CONTENT","48 jobs","content-factory"],["04","DISTRIBUTION","24 live","distribution"],["05","LEARNING","1,806 findings","learning-engine"],["06","CAPITAL","3 proposals","capital-allocator"]];
  return `<section class="command-overview" aria-label="Factory operating overview">
    <article class="command-map">${panelMarkup(blueprint.panels[0],screen)}</article>
    <article class="command-spine module"><div class="module-title">АВТОНОМНЫЙ ОПЕРАЦИОННЫЙ ЦИКЛ <span>LIVE / GOVERNED</span></div><div class="spine-list">${stages.map(([number,label,status,key])=>`<button data-route="${esc(byKey(key)?.route ?? "/command")}"><i>${number}</i><span><b>${label}</b><small>${status}</small></span><em>→</em></button>`).join("")}</div></article>
    <article class="module command-decision"><div class="module-title">СЛЕДУЮЩЕЕ РЕШЕНИЕ <span>${esc(active.distributionState)}</span></div><div class="decision-summary"><span class="decision-amount">${money(active.requestedUsd)}</span><div><p class="eyebrow">${esc(active.brandId)} / ${esc(active.marketCell)}</p><h2>Экспериментальный транш</h2></div></div><p>Модель рекомендует <b>${esc(active.decision)}</b> на основе ${esc(active.evidenceCount)} доказательств. Внешнее размещение останется заблокировано до production-authority.</p><div class="decision-facts"><span>ЛИМИТ РЕШЕНИЯ <b>${money(authority.maximumDecisionUsd)}</b></span><span>ДНЕВНОЙ ЛИМИТ <b>${money(authority.maximumDailyUsd)}</b></span></div><div class="decision-actions"><button data-action="approve" data-index="0">ЗАПИСАТЬ РЕШЕНИЕ</button><button data-route="/experiments">ПРОВЕРИТЬ ДОКАЗАТЕЛЬСТВА</button></div></article>
    <article class="module capital-position"><div class="module-title">ПОЗИЦИЯ КАПИТАЛА <span>${authority.killSwitch?"KILL SWITCH":"POLICY ACTIVE"}</span></div><div class="capital-total"><small>SETTLED WALLET</small><b>${money(wallet.settledUsd)}</b></div><div class="capital-track"><i style="width:${Math.min(100, wallet.reservedUsd / Math.max(1,wallet.settledUsd) * 100)}%"></i></div><div class="capital-split"><span>ДОСТУПНО <b>${money(wallet.availableUsd)}</b></span><span>ЗАРЕЗЕРВИРОВАНО <b>${money(wallet.reservedUsd)}</b></span></div><button class="text-link" data-route="/treasury">ОТКРЫТЬ TREASURY →</button></article>
  </section>`;
}

const productionScreens = {
  experiments: {
    label:"EXPERIMENT OPERATING SYSTEM", primary:"RUNNING", primaryValue:"7",
    tabs:["ВСЕ 37","RUNNING 7","EVALUATING 3","QUEUED 12","DECIDED 15"],
    columns:["ЭКСПЕРИМЕНТ","ГИПОТЕЗА / MARKETCELL","FORECAST","EVIDENCE","СТАТУС"],
    rows:[
      ["EXP-RGZ-014","Verified availability raises trailer requests / Nebraska","+87 reg.","STRONG · 83%","RUNNING"],
      ["EXP-EVR-008","Neighbor proof reduces trust friction / Praha","+312 matches","USABLE · 79%","EVALUATING"],
      ["EXP-TRV-003","48-hour itinerary creates qualified intent / Lombardia","+104 leads","LIMITED · 61%","QUEUED"],
    ],
    detailTitle:"FROZEN DECISION CONTRACT", detail:["Primary metric","Qualified registration rate" ,"Stop condition","CPA > $42 after 40 conversions","Capital at risk","$100 / policy-authorized"],
    next:"content-factory", nextLabel:"ОТКРЫТЬ CONTENT BRIEF"
  },
  "content-factory": {
    label:"AUTONOMOUS CONTENT PRODUCTION", primary:"DAILY CAPACITY", primaryValue:"500",
    tabs:["EVIDENCE 248","PROMPTS 96","LEGAL 74","EXECUTION 61","QA / REWORK 18","LIBRARY 143"],
    columns:["JOB / ASSET","RECIPE","CLAIM COVERAGE","QUALITY","СТАТУС"],
    rows:[
      ["CNT-RGZ-042","SHORT_VIDEO_v3 / Trailer availability","4/4 VERIFIED","92 / 100","QA"],
      ["CNT-EVR-018","META_STATIC_v4 / Neighbor proof","3/3 VERIFIED","89 / 100","GENERATING"],
      ["CNT-TRV-011","SEO_ARTICLE_v2 / 48-hour city guide","5/6 VERIFIED","84 / 100","REVIEW"],
    ],
    detailTitle:"AGENT CONTROL CHAIN", detail:["Creator Agent","Winners → cited research fallback","Legal Agent","Claims · culture · channel policy","Executor + Critic","Generate → QA → rework → library"],
    next:"distribution", nextLabel:"ПЕРЕДАТЬ В DISTRIBUTION"
  },
  distribution: {
    label:"AUTHORIZED DISTRIBUTION", primary:"LIVE PLACEMENTS", primaryValue:"24",
    tabs:["ALL 31","AUTHORIZED 24","PACING 4","BLOCKED 3","RECONCILE 2"],
    columns:["PLACEMENT","CHANNEL / MARKETCELL","ENVELOPE","PACING","AUTHORIZATION"],
    rows:[
      ["DST-RGZ-8821","Meta / Nebraska / Trailers","$100","82%","DRY-RUN BLOCKED"],
      ["DST-EVR-7714","TikTok / Praha / Home","$780","64%","DRY-RUN BLOCKED"],
      ["DST-TRV-6612","Google / Lombardia / Travel","$410","43%","DRY-RUN BLOCKED"],
    ],
    detailTitle:"POLICY GATE", detail:["Production mode","DISABLED","Maximum autonomous decision","$2,500","External side effect","BLOCKED BEFORE PROVIDER"],
    next:"learning-engine", nextLabel:"ОТКРЫТЬ LEARNING LOOP"
  }
};

function productionSurfaceMarkup(screen) {
  const spec = productionScreens[screen.key];
  if (!spec) return "";
  return `<section class="production-surface">
    <div class="production-toolbar"><div><small>${esc(spec.label)}</small><b>${esc(spec.primaryValue)}</b><span>${esc(spec.primary)}</span></div><nav>${spec.tabs.map((tab,index)=>`<button class="${index===0?"active":""}">${esc(tab)}</button>`).join("")}</nav></div>
    <article class="module production-table"><div class="production-head">${spec.columns.map(column=>`<b>${esc(column)}</b>`).join("")}</div>${spec.rows.map((row,rowIndex)=>`<button class="production-row" data-route="${rowIndex===0?screen.route:esc(byKey(screen.linksTo[rowIndex % screen.linksTo.length])?.route ?? screen.route)}">${row.map((cell,index)=>`<span class="cell-${index}">${index===0?`<i>${String(rowIndex+1).padStart(2,"0")}</i>`:""}${esc(cell)}</span>`).join("")}</button>`).join("")}</article>
    <aside class="module production-detail"><div class="module-title">${esc(spec.detailTitle)} <span>IMMUTABLE</span></div><dl>${Array.from({length:spec.detail.length/2},(_,index)=>`<div><dt>${esc(spec.detail[index*2])}</dt><dd>${esc(spec.detail[index*2+1])}</dd></div>`).join("")}</dl><div class="policy-seal"><i></i><span><b>GOVERNED DRY RUN</b><small>No money moved · no content published</small></span></div><button data-route="${esc(byKey(spec.next)?.route ?? "/command")}">${esc(spec.nextLabel)} →</button></aside>
  </section>`;
}

const strategyScreens = {
  "owner-command": {
    eyebrow:"КОНТРОЛЬ ВЛАДЕЛЬЦА ПО ИСКЛЮЧЕНИЯМ", status:"2 РЕШЕНИЯ ОЖИДАЮТ", action:"ОТКРЫТЬ АУДИТ", next:"audit",
    stages:[["Портфель","5","Продуктов"],["Капитал","$684K","В работе"],["Риски","2","Исключения"],["Политики","100%","Проверены"],["Горизонт","14 мес.","Runway"]],
    title:"РЕШЕНИЯ ВЛАДЕЛЬЦА", columns:["ПРИОРИТЕТ","РЕШЕНИЕ","ПОСЛЕДСТВИЕ","СРОК"], rows:[["Высокий","Повысить лимит RigZip до $2 500","Дополнительный транш Nebraska","Сегодня"],["Средний","Разрешить проверку Video Provider B","Canary без публикации","48 часов"],["Низкий","Оставить фабрику в DRY RUN","Внешние действия заблокированы","До подключения данных"]],
    sideTitle:"ПОЗИЦИЯ ПОРТФЕЛЯ", side:[["Доступный капитал","$316 000"],["Резерв","15%"],["Открытые решения","2"],["Kill switch","Готов"]]
  },
  brands: {
    eyebrow:"КОНТРАКТЫ РОСТА ПРОДУКТОВ", status:"5 БРЕНДОВ · 2 ГОТОВЫ К ТЕСТАМ", action:"ОТКРЫТЬ КОНФИГУРАЦИЮ", next:"factory-config",
    stages:[["Продукт","5","Зарегистрированы"],["Метрики","2","Утверждены"],["Рынки","4","В экспансии"],["Утверждения","87%","С доказательствами"],["Готовность","40%","Портфель"]],
    title:"ЛИНИИ БРЕНДОВ", columns:["БРЕНД","МОДЕЛЬ ЦЕННОСТИ","СТАДИЯ","ГОТОВНОСТЬ"], rows:[["RigZip","Успешная аренда транспорта","Проверка","100%"],["Evorios","Ликвидная сделка между соседями","Исследование","72%"],["Books","Покупка и удержание читателя","Исследование","41%"],["Travel","Забронированная поездка","Исследование","36%"],["Smart Navigator","Завершённый полезный маршрут","Исследование","29%"]],
    sideTitle:"ОБЯЗАТЕЛЬНЫЙ КОНТРАКТ", side:[["Ценностное событие","Версия и семантика"],["Рынок","География и аудитория"],["Доказательства","Утверждения и источники"],["Бюджет","Конверт и пределы"]]
  },
  "factory-config": {
    eyebrow:"БЕЗОПАСНАЯ КОНФИГУРАЦИЯ ФАБРИКИ", status:"15 ИЗ 18 ВОЗМОЖНОСТЕЙ ГОТОВЫ", action:"ПРОВЕРИТЬ ПОЛИТИКИ", next:"audit",
    stages:[["Бренды","4/6","Готовы"],["Возможности","15/18","Доступны"],["Провайдеры","18/21","Исправны"],["Политики","100%","Покрытие"],["Режим","DRY RUN","Зафиксирован"]],
    title:"РЕЕСТР ВОЗМОЖНОСТЕЙ", columns:["ВОЗМОЖНОСТЬ","ТЕКУЩИЙ ПРОВАЙДЕР","СОСТОЯНИЕ","ГРАНИЦА АВТОНОМНОСТИ"], rows:[["Исследование рынка","Локальный Scout","Исправен","Без внешних расходов"],["Создание видео","Provider A","Ухудшено","Только canary"],["Дистрибуция","29 адаптеров","Заблокировано","Требуется production mode"],["Финансовое решение","Policy Engine","Исправен","≤ $2 500"]],
    sideTitle:"МАТРИЦА АВТОНОМНОСТИ", side:[["Создать гипотезу","Автономно"],["Запустить dry-run","Автономно"],["Изменить claims","Подтверждение человека"],["Списать деньги","Жёсткая блокировка"]]
  },
  audit: {
    eyebrow:"АВТОНОМНЫЙ LEGAL POLICY AGENT", status:"14 820 РЕШЕНИЙ ALLOW · БЕЗ ОПЕРАТОРА", action:"ОТКРЫТЬ ОПЕРАЦИИ", next:"operations",
    stages:[["Юрисдикции","18","Версионируются"],["Auto-ALLOW","14 820","Legal agent"],["Auto-remediation","126","Исправлено"],["Блокировки","4","До исправления"],["Эскалации","0,3%","Только исключения"]],
    title:"ЖУРНАЛ УПРАВЛЯЕМЫХ СОБЫТИЙ", columns:["ВРЕМЯ / СОБЫТИЕ","ОБЛАСТЬ","РЕЗУЛЬТАТ","ДОКАЗАТЕЛЬСТВО"], rows:[["14:07 · AUTHORITY_EVALUATED","RigZip / Nebraska","Разрешено до $100","POLICY-v3"],["14:07 · DISTRIBUTION_GATED","Meta / RigZip","Заблокировано","DRY_RUN"],["14:06 · CLAIM_VERIFIED","Asset RGZ-042","4 из 4","EVIDENCE-88"],["14:05 · MODEL_PROPOSED","Response Ranker v4","Challenger","EVAL-214"]],
    sideTitle:"LEGAL AGENT AUTHORITY", side:[["ALLOW","Автономное исполнение"],["BLOCK","Автоисправление / запрет"],["Устаревшее правило","Автообновление политики"],["Человек","Только неразрешимый конфликт"]]
  },
  campaigns: {
    eyebrow:"УПРАВЛЕНИЕ КАМПАНИЯМИ", status:"24 АКТИВНЫ · 3 ТРЕБУЮТ РЕШЕНИЯ", action:"ОТКРЫТЬ КАНАЛЫ", next:"channels",
    stages:[["Гипотеза","7","Активные тесты"],["Материалы","143","Одобрены"],["Размещение","24","Работают"],["Темп","82%","В пределах"],["Оценка","3,2×","Средняя отдача"]],
    title:"ЖИЗНЕННЫЙ ЦИКЛ КАМПАНИЙ", columns:["КАМПАНИЯ","ЦЕЛЬ И РЫНОК","БЮДЖЕТ / ТЕМП","СОСТОЯНИЕ"], rows:[["RGZ-NE-014","Регистрации поставщиков / Nebraska","$2 500 · 82%","Масштабирование"],["EVR-CZ-008","Ликвидность Tools / Czechia","$4 000 · 64%","Проверка"],["TRV-IT-003","Намерение City breaks / Italy","$1 500 · 43%","Исследование"]],
    sideTitle:"УСЛОВИЯ ОСТАНОВКИ", side:[["RigZip","CPA > $42"],["Evorios","Match rate < 8%"],["Travel","Intent CVR < 2%"],["Автоостановка","Включена локально"]]
  },
  channels: {
    eyebrow:"РЕЕСТР СПОСОБОВ ДИСТРИБУЦИИ", status:"29 КАНАЛОВ · 10 СЕМЕЙСТВ", action:"ОТКРЫТЬ РАСПРЕДЕЛЕНИЕ", next:"distribution",
    stages:[["Платные","6","Аукцион"],["Контент","4","SEO и статьи"],["Социальные","7","Органика"],["Партнёрства","8","Авторы и affiliates"],["Локальные","4","Рынки и события"]],
    title:"КАНАЛЫ И ИХ ЭКОНОМИКА", columns:["СЕМЕЙСТВО","ПРИМЕРЫ","МОДЕЛЬ ЗАТРАТ","ГОТОВНОСТЬ"], rows:[["Платная реклама","Meta, Google, TikTok, YouTube","Аукцион","5 из 6"],["Контент и поиск","SEO-статьи, local SEO, guides","Производство","4 из 4"],["Инфлюенсеры","YouTube creators, micro-influencers","Фикс. / комиссия","CRM · 1 240"],["Маркетплейсы","Региональные площадки, каталоги","Комиссия","1 из 2"],["Удержание","Email, push, referral","Собственный","3 из 3"]],
    sideTitle:"INFLUENCER OPERATIONS", side:[["Обнаружены","1 240 профилей"],["Контакт разрешён","486"],["В переговорах","38"],["Права / disclosure","Обязательная проверка"]]
  },
  assets: {
    eyebrow:"ОБЛАЧНАЯ БИБЛИОТЕКА КРЕАТИВОВ", status:"1 284 МАТЕРИАЛА · 4,8 TB · 100% LINEAGE", action:"ОТКРЫТЬ КОНТЕНТ-ФАБРИКУ", next:"content-factory",
    stages:[["Объекты","1 284","Фото · видео · тексты"],["Версии","3 846","Неизменяемые"],["Права","98%","Проверены"],["Дедупликация","214","Повторы исключены"],["Выдача","143","Готовы к каналам"]],
    title:"МАТЕРИАЛЫ И ПРОИСХОЖДЕНИЕ", columns:["МАТЕРИАЛ","ФОРМАТ / ВЕРСИЯ","ДОКАЗАТЕЛЬСТВА","СОСТОЯНИЕ"], rows:[["RGZ_TRAILER_042","Короткое видео · v3","4 из 4","Одобрен"],["EVR_NEIGHBOR_018","Статичный пост · v4","3 из 3","Проверка"],["TRV_CITY_011","SEO-статья · v2","5 из 6","Доработка"]],
    sideTitle:"ХРАНЕНИЕ И ПРОИСХОЖДЕНИЕ", side:[["Object storage","Адаптер не подключён"],["Каталог","Brand · locale · territory"],["Цепочка","Brief → Prompt → Provider"],["Права","Owner · usage · expiry"]]
  },
  operations: {
    eyebrow:"НАДЁЖНОЕ ИСПОЛНЕНИЕ", status:"237 В РАБОТЕ · 2 ОШИБКИ", action:"ОТКРЫТЬ АУДИТ", next:"audit",
    stages:[["Очередь","12","Ожидают"],["В работе","237","Операции"],["Повтор","4","С задержкой"],["Сверка","97,8%","Подтверждено"],["Инциденты","2","Открыты"]],
    title:"ПОТОК ОПЕРАЦИЙ", columns:["ОПЕРАЦИЯ","ВОЗМОЖНОСТЬ","ПОПЫТКА / SLA","СОСТОЯНИЕ"], rows:[["DIST-8821","Доставка кампании","1 · 99,8%","Завершена"],["GEN-1942","Создание видео","1 · 98,4%","В работе"],["SCAN-4461","Исследование рынка","1 · 99,1%","В очереди"],["RECON-104","Сверка расходов","2 · 94,7%","Задержка"]],
    sideTitle:"АКТИВНЫЕ ИНЦИДЕНТЫ", side:[["Видео-провайдер","Задержка стоимости"],["Meta reconciliation","Отстаёт на 2 часа"],["Автоповтор","До 3 попыток"],["Внешние действия","Заблокированы"]]
  },
  "learning-engine": {
    eyebrow:"КОНТУР УПРАВЛЯЕМОГО ОБУЧЕНИЯ", status:"7 МОДЕЛЕЙ НА ПРОВЕРКЕ", action:"ОТКРЫТЬ CAPITAL ALLOCATOR", next:"capital-allocator",
    stages:[["Creative genome","18,4 тыс.","Hooks · formats · regions"],["Атрибуция","97,8%","Причинный эффект"],["Fatigue","26","Автоостановлены"],["Exploration","20%","Новые концепции"],["Предложение","7","Следующий бюджет"]],
    title:"НОВЫЕ ЗНАНИЯ", columns:["ОБЛАСТЬ","ВЫВОД","КАЧЕСТВО","ПРИМЕНИМОСТЬ"], rows:[["RigZip / Nebraska","Доказанная доступность повышает конверсию в заявку","Сильное · 91%","Trailers / counties"],["Evorios / Czechia","Подтверждение соседями снижает барьер доверия","Пригодное · 79%","Home / urban"],["Travel / Italy","Маршрут на 48 часов повышает намерение","Ограниченное · 64%","City breaks"]],
    sideTitle:"ОСНОВНАЯ И КОНКУРИРУЮЩАЯ МОДЕЛИ", side:[["Основная модель","Response Ranker v4"],["Конкурирующая модель","Causal Ranker v1"],["Условие повышения","Ошибка калибровки < 8%"],["Изоляция","Только это рабочее пространство"]]
  },
  "capital-allocator": {
    eyebrow:"СЛЕДУЮЩИЙ ДОЛЛАР", status:"$316K ДОСТУПНО", action:"ПЕРЕДАТЬ В VENTURE", next:"venture",
    stages:[["Допуск","18","Кандидаты"],["Ограничения","6","Проверки политик"],["Сценарии","12","Кривые капитала"],["Сравнение","4,9×","Предельная ценность"],["Предложение","3","Ограниченные транши"]],
    title:"РАНЖИРОВАНИЕ ВОЗМОЖНОСТЕЙ", columns:["ПРИОРИТЕТ","РЫНОЧНАЯ ЯЧЕЙКА","СЛЕДУЮЩИЙ ТРАНШ","ОЖИДАЕМЫЙ ЭФФЕКТ"], rows:[["01","Evorios / Czechia / Tools","$4 000","4,9× · 79%"],["02","RigZip / Nebraska / Trailers","$2 500","4,2× · 83%"],["03","Travel / Lombardia / City","$1 500","3,1× · 64%"]],
    sideTitle:"ОГРАНИЧЕНИЯ ПОРТФЕЛЯ", side:[["Резерв исследования","15%"],["Лимит бренда","35%"],["Лимит решения","$2 500"],["Изъятие средств","Заблокировано"]]
  },
  venture: {
    eyebrow:"ВНУТРЕННИЙ РЫНОК КАПИТАЛА", status:"3 РЕШЕНИЯ ОЖИДАЮТ", action:"ПЕРЕДАТЬ В TREASURY", next:"treasury",
    stages:[["Запрос","18","Capital requests"],["Меморандум","12","Evidence complete"],["Сравнение","6","Alternative uses"],["Решение","3","Awaiting authority"],["Оценка","41","Closed loops"]],
    title:"ИНВЕСТИЦИОННЫЕ МЕМОРАНДУМЫ", columns:["ВОЗМОЖНОСТЬ","ТЕЗИС","ТРАНШ","РЕШЕНИЕ"], rows:[["RigZip / Nebraska","Устранить разрыв доступности при подтверждённом спросе","$2 500","Рекомендовать"],["Evorios / Czechia","Доказать локальную ликвидность категории Tools","$4 000","Изменить лимит"],["Travel / Italy","Проверить намерение для коротких поездок","$1 500","Отложить"]],
    sideTitle:"ЗАФИКСИРОВАННЫЙ ПРОГНОЗ", side:[["Основная метрика","Целевое ценностное событие"],["Окно результата","14 дней"],["Условие остановки","CPA > $42"],["Альтернативная стоимость","Транш RigZip"]]
  },
  treasury: {
    eyebrow:"ФИНАНСОВАЯ ИСТИНА И БЕЗОПАСНОСТЬ", status:"DRY RUN · ДЕНЬГИ НЕ ДВИГАЮТСЯ", action:"ОТКРЫТЬ АУДИТ", next:"audit",
    stages:[["Кошелёк","$1,0M","Settled"],["Конверты","$684K","Allocated"],["Резервы","$184K","Committed"],["Доступно","$316K","Deployable"],["Сверка","97,8%","Reconciled"]],
    title:"КОНВЕРТЫ И РЕЗЕРВЫ", columns:["ПРОЕКТ","В РАБОТЕ","ЗАРЕЗЕРВИРОВАНО","ДОСТУПНО"], rows:[["RigZip","$245 000","$42 000","$38 000"],["Evorios","$190 000","$54 000","$29 000"],["Travel","$96 000","$18 000","$21 000"],["Portfolio reserve","$153 000","$70 000","$228 000"]],
    sideTitle:"ФИНАНСОВЫЕ ПОЛНОМОЧИЯ", side:[["Одно решение","≤ $2 500"],["Дневной предел","≤ $5 000"],["Банковское изъятие","Жёсткая блокировка"],["Kill switch","Доступен владельцу"]]
  }
};

function strategySurfaceMarkup(screen) {
  const spec = strategyScreens[screen.key];
  const rows = screen.key === "brands" ? [...spec.rows,...state.brandProfiles.map((brand)=>[brand.name,brand.primaryValueEvent,"Исследование","Контекст принят"])] : spec.rows;
  return `<section class="strategy-surface"><header class="strategy-bar"><div><small>${esc(spec.eyebrow)}</small><b>${esc(spec.status)}</b></div><button data-route="${esc(byKey(spec.next)?.route ?? "/command")}">${esc(spec.action)} →</button></header><div class="strategy-stages">${spec.stages.map(([label,value,note],index)=>`<button data-route="${screen.route}"><i>${String(index+1).padStart(2,"0")}</i><span><small>${esc(label)}</small><b>${esc(value)}</b><em>${esc(note)}</em></span></button>`).join("")}</div><article class="module strategy-table"><div class="module-title">${esc(spec.title)} <span>${tr("ПОД УПРАВЛЕНИЕМ","GOVERNED")}</span></div><div class="strategy-head">${spec.columns.map(column=>`<b>${esc(column)}</b>`).join("")}</div>${rows.map((row,index)=>`<button class="strategy-row" data-route="${esc(byKey(screen.linksTo[index % screen.linksTo.length])?.route ?? screen.route)}">${row.map(cell=>`<span>${esc(cell)}</span>`).join("")}</button>`).join("")}</article><aside class="module strategy-side"><div class="module-title">${esc(spec.sideTitle)} <span>${tr("ПОЛИТИКА","POLICY")}</span></div><dl>${spec.side.map(([label,value])=>`<div><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`).join("")}</dl><div class="policy-seal"><i></i><span><b>ЛОКАЛЬНЫЙ УПРАВЛЯЕМЫЙ РЕЖИМ</b><small>Без внешнего исполнения и движения средств</small></span></div></aside></section>`;
}

function productIntelligenceMarkup() {
  const brand = state.brandProfiles[0] ?? { id:"rigzip", name:"RigZip" };
  const sources = state.productSources.filter((item)=>item.brandId===brand.id);
  const evidence = state.productEvidence.filter((item)=>item.brandId===brand.id);
  const diagnosis = state.productDiagnoses.find((item)=>item.brandId===brand.id);
  const facts = evidence.filter((item)=>item.classification==="FACT").length;
  const unknowns = evidence.filter((item)=>item.classification==="UNKNOWN").length;
  const ready = sources.length>=2 && facts>=3 && unknowns>=1;
  const register = evidence.length ? evidence.map((item,index)=>{ const source=sources.find((entry)=>entry.id===item.sourceId); return `<div class="evidence-row"><i>${String(index+1).padStart(2,"0")}</i><span><b>${esc(item.statement)}</b><small>${esc(source?.title ?? item.sourceId)}</small></span><em class="${item.classification.toLowerCase()}">${esc(item.classification)} · ${Math.round(item.confidence*100)}%</em></div>`; }).join("") : `<div class="evidence-empty"><b>${tr("Источники ещё не зарегистрированы","No sources registered yet")}</b><span>${tr("Добавьте сайт, репозиторий, документ, аналитику или интервью. Каждое утверждение будет связано с первоисточником.","Add a website, repository, document, analytics source, or interview. Every claim remains linked to its source.")}</span></div>`;
  const side = diagnosis ? `<aside class="module diagnosis-card"><div class="module-title">${tr("ДИАГНОЗ ПРОДУКТА","PRODUCT DIAGNOSIS")} <span>DRAFT · CITED</span></div><h3>${esc(diagnosis.valueThesis)}</h3><dl><div><dt>${tr("АУДИТОРИИ","AUDIENCES")}</dt><dd>${esc(diagnosis.priorityAudiences.join(" · "))}</dd></div><div><dt>${tr("ПРОБЛЕМЫ","PROBLEMS")}</dt><dd>${esc(diagnosis.customerProblems.join(" · "))}</dd></div><div><dt>${tr("БАРЬЕРЫ","BARRIERS")}</dt><dd>${esc(diagnosis.adoptionBarriers.join(" · "))}</dd></div><div><dt>${tr("АЛЬТЕРНАТИВЫ","ALTERNATIVES")}</dt><dd>${esc(diagnosis.competitiveAlternatives.join(" · "))}</dd></div><div><dt>${tr("РИСКИ","RISKS")}</dt><dd>${esc(diagnosis.materialRisks.join(" · "))}</dd></div><div><dt>${tr("НЕИЗВЕСТНО","UNRESOLVED")}</dt><dd>${esc(diagnosis.unresolvedQuestions.join(" · "))}</dd></div></dl><button data-route="/markets">${tr("ПЕРЕЙТИ К ТЕЗИСУ ЭКСПАНСИИ","BUILD EXPANSION THESIS")} →</button></aside>` : `<aside class="module intelligence-policy"><div class="module-title">${tr("КОНТРАКТ ГОТОВНОСТИ","READINESS CONTRACT")} <span>GATED</span></div><p>${tr("Система не имеет права предлагать рынок, бюджет или кампанию, пока не отделит факты от предположений и неизвестных.","The system cannot recommend a market, budget, or campaign until facts are separated from inferences and unknowns.")}</p><ul><li class="${sources.length>=2?"done":""}">${tr("Минимум два независимых источника","At least two independent sources")}</li><li class="${facts>=3?"done":""}">${tr("Минимум три подтверждённых факта","At least three verified facts")}</li><li class="${unknowns>=1?"done":""}">${tr("Хотя бы один явно зафиксированный пробел","At least one explicitly recorded unknown")}</li></ul><button data-action="add-diagnosis" ${ready?"":"disabled"}>${tr("СОЗДАТЬ ДИАГНОЗ ПРОДУКТА","CREATE PRODUCT DIAGNOSIS")}</button></aside>`;
  return `<section class="intelligence-surface"><header class="strategy-bar"><div><small>${tr("ИЗУЧЕНИЕ ПРОДУКТА","PRODUCT INTELLIGENCE")}</small><b>${esc(brand.name)} · ${diagnosis?tr("ДИАГНОЗ СОЗДАН","DIAGNOSIS CREATED"):ready?tr("ГОТОВО К ДИАГНОЗУ","READY FOR DIAGNOSIS"):tr("СБОР ДОКАЗАТЕЛЬСТВ","EVIDENCE INTAKE")}</b></div><button class="primary" data-action="add-source">＋ ${tr("ДОБАВИТЬ ИСТОЧНИК","ADD SOURCE")}</button></header><div class="readiness-grid"><article><small>${tr("ИСТОЧНИКИ","SOURCES")}</small><b>${sources.length} / 2</b><span>${sources.length>=2?"✓":"→"}</span></article><article><small>${tr("ПОДТВЕРЖДЁННЫЕ ФАКТЫ","VERIFIED FACTS")}</small><b>${facts} / 3</b><span>${facts>=3?"✓":"→"}</span></article><article><small>${tr("ОТКРЫТЫЕ ВОПРОСЫ","OPEN QUESTIONS")}</small><b>${unknowns} / 1</b><span>${unknowns>=1?"✓":"→"}</span></article><article class="${ready?"ready":"blocked"}"><small>${tr("ДИАГНОЗ ПРОДУКТА","PRODUCT DIAGNOSIS")}</small><b>${diagnosis?tr("СОЗДАН","CREATED"):ready?tr("РАЗБЛОКИРОВАН","UNLOCKED"):tr("ЗАБЛОКИРОВАН","BLOCKED")}</b><span>${ready?"✓":"×"}</span></article></div><article class="module evidence-register"><div class="module-title">${tr("РЕЕСТР ДОКАЗАТЕЛЬСТВ","EVIDENCE REGISTER")} <span>${tr("ЦИТИРУЕМЫЙ","TRACEABLE")}</span></div>${register}</article>${side}</section>`;
}

function expansionThesisControlMarkup() {
  const brand=state.brandProfiles[0] ?? {id:"rigzip",name:"RigZip"};
  const diagnosis=state.productDiagnoses.find((item)=>item.brandId===brand.id);
  const thesis=state.expansionTheses.find((item)=>item.brandId===brand.id);
  if (!diagnosis) return "";
  const score=(item)=>Math.round((item.demandScore*.35+item.supplyScore*.25+item.accessibilityScore*.2+item.regulatoryScore*.2)*10)/10;
  const ranked=thesis?[...thesis.candidates].sort((a,b)=>score(b)-score(a)):[];
  return `<section class="module expansion-thesis"><div class="module-title">${tr("ТЕЗИС ЭКСПАНСИИ","EXPANSION THESIS")} <span>${thesis?"DRAFT · RANKED":"DIAGNOSIS REQUIRED · PASSED"}</span></div><header><div><h2>${tr("Сравнение географий до выделения бюджета","Compare geographies before budget allocation")}</h2><p>${tr("Рейтинг определяет порядок исследования, а не разрешение на запуск.","The ranking determines research order, not launch authority.")}</p></div>${thesis?"":`<button data-action="add-thesis">＋ ${tr("СОЗДАТЬ ТЕЗИС","CREATE THESIS")}</button>`}</header>${thesis?`<div class="thesis-ranking">${ranked.map((item,index)=>`<article><i>${String(index+1).padStart(2,"0")}</i><span><b>${esc(item.geographyName)}</b><small>${esc(item.countryCode)} · ${esc(item.administrativeLevel)}</small></span><strong>${score(item)}</strong><p>${esc(item.rationale)}</p><em>${tr("ПРОВЕРИТЬ","VALIDATE")}: ${esc(item.validationQuestions.join(" · "))}</em></article>`).join("")}</div>`:`<div class="thesis-empty"><b>${tr("Диагноз готов. Географии ещё не сравнены.","Diagnosis ready. Geographies have not been compared.")}</b><span>${tr("Добавьте минимум две страны, штата или региона и зафиксируйте, что система должна проверить.","Add at least two countries, states, or regions and record what the system must validate.")}</span></div>`}</section>`;
}

function brandOnboardingMarkup() {
  const brandId = location.pathname.split("/")[2];
  const brand = state.brandProfiles.find((item)=>item.id===brandId);
  if (!brand) return `<section class="module onboarding-empty"><h2>${tr("Профиль бренда не найден","Brand profile not found")}</h2><button data-route="/brands">${tr("ВЕРНУТЬСЯ К БРЕНДАМ","BACK TO BRANDS")}</button></section>`;
  const stages = [
    [tr("Паспорт и задачи","Profile and objectives"),"COMPLETE",brand.objectives.join(" · ")],
    [tr("Изучение продукта","Product intelligence"),"NEXT",tr("Репозиторий, сайт, аналитика, интервью и материалы","Repository, website, analytics, interviews and collateral")],
    [tr("Диагноз продукта","Product diagnosis"),"LOCKED",tr("Ценность, аудитории, барьеры, конкуренты и доказательства","Value, audiences, barriers, competitors and evidence")],
    [tr("Тезис экспансии","Expansion thesis"),"LOCKED",tr("Приоритетные страны, территории и последовательность","Priority countries, territories and sequence")],
    [tr("Тестовый портфель","Test portfolio"),"LOCKED",tr("Бюджет, каналы, прогноз, stop conditions и authority","Budget, channels, forecast, stop conditions and authority")],
    [tr("Исходные материалы","Source materials"),"LOCKED",tr("Claims, брендбук, фото, видео, права и ограничения","Claims, brand book, photos, video, rights and constraints")],
    [tr("Производство и запуск","Production and launch"),"LOCKED",tr("Контент, QA, дистрибуция и атрибуция","Content, QA, distribution and attribution")],
    [tr("Обучение и следующий цикл","Learning and next cycle"),"LOCKED",tr("Вовлечение, удержание, экономика и перераспределение бюджета","Engagement, retention, economics and budget reallocation")],
  ];
  return `<section class="brand-journey"><article class="module brand-brief"><div class="module-title">${tr("ИСХОДНЫЙ КОНТЕКСТ","SOURCE CONTEXT")} <span>DISCOVERY</span></div><h2>${esc(brand.name)}</h2><p>${esc(brand.offering)}</p><dl><div><dt>${tr("АУДИТОРИЯ","AUDIENCE")}</dt><dd>${esc(brand.audience)}</dd></div><div><dt>${tr("БИЗНЕС-МОДЕЛЬ","BUSINESS MODEL")}</dt><dd>${esc(brand.businessModel)}</dd></div><div><dt>${tr("ЦЕННОСТНОЕ СОБЫТИЕ","VALUE EVENT")}</dt><dd>${esc(brand.primaryValueEvent)}</dd></div><div><dt>${tr("ГЕОГРАФИИ И ЯЗЫКИ","GEOGRAPHIES AND LANGUAGES")}</dt><dd>${esc([...brand.targetGeographies,...brand.languages].join(" · "))}</dd></div></dl></article><article class="module journey-flow"><div class="module-title">${tr("МАРШРУТ ЗАПУСКА БРЕНДА","BRAND LAUNCH JOURNEY")} <span>${tr("ШАГ 2 ИЗ 8","STEP 2 OF 8")}</span></div>${stages.map(([title,status,note],index)=>`<button class="journey-step ${status.toLowerCase()}" data-route="${status==="NEXT"?"/factory-config":location.pathname}"><i>${String(index+1).padStart(2,"0")}</i><span><b>${esc(title)}</b><small>${esc(note)}</small></span><em>${status}</em></button>`).join("")}</article><aside class="module journey-next"><div class="module-title">${tr("СЛЕДУЮЩЕЕ ДЕЙСТВИЕ","NEXT ACTION")} <span>GOVERNED</span></div><h3>${tr("Передайте системе источники о продукте","Provide product source material")}</h3><p>${tr("Система не предложит рынок или бюджет до фиксации продуктовых фактов и источников. Предположения будут отделены от доказательств.","The system will not recommend a market or budget until product facts and sources are recorded. Assumptions remain separate from evidence.")}</p><button data-route="/factory-config">${tr("ДОБАВИТЬ ИСТОЧНИКИ ПРОДУКТА","ADD PRODUCT SOURCES")} →</button></aside></section>`;
}

function render() {
  if (!isLocalRuntime && !state.cloudContext) {
    renderAuthGate();
    return;
  }
  const screen = current();
  if (!screen) return;
  const blueprint = blueprints[screen.key] ?? blueprints.command;
  const metrics = screen.key === "brand-onboarding" ? [[tr("ЭТАП","STAGE"),"2 / 8"],[tr("ИСТОЧНИКИ","SOURCES"),"0"],[tr("РЫНКИ-КАНДИДАТЫ","MARKET CANDIDATES"),"—"],[tr("ТЕСТОВЫЙ БЮДЖЕТ","TEST BUDGET"),tr("НЕ ПРЕДЛОЖЕН","NOT PROPOSED")]] : blueprint.metrics;
  const groups = navGroups();
  document.title = `${screen.title} — LAFWIRON`;
  document.getElementById("app").innerHTML = `
    <header class="command-bar">
      <button class="brand" data-route="/command"><strong>LAFWIRON</strong><small>MARKET FACTORY OS</small></button><button class="mobile-menu" data-action="mobile-menu" aria-label="${tr("Открыть навигацию","Open navigation")}" aria-expanded="${state.mobileNav}"><i></i><i></i><i></i></button>
      <div class="factory-state"><i></i> ${tr("ФАБРИКА РАБОТАЕТ","FACTORY ONLINE")}</div>
      <button class="attention" data-route="/owner"><i></i><span>${pendingDecisionLabel(state.decisions)}</span><em>→</em></button>
      <div class="signal"><small>${tr("ЛУЧШЕЕ ВЛОЖЕНИЕ $100","BEST NEXT $100")}</small><b>RigZip / Nebraska → +87 ${tr("рег.","sign-ups")}</b><span>83% · ${tr("прогноз","forecast")}</span></div>
      <div class="signal"><small>${tr("ЛУЧШЕЕ ВЛОЖЕНИЕ $1,000","BEST NEXT $1,000")}</small><b>Evorios / Czechia → +312 ${tr("рег.","sign-ups")}</b><span>79% · ${tr("прогноз","forecast")}</span></div>
      <div class="capital-mini"><small>${tr("КАПИТАЛ В РАБОТЕ","CAPITAL DEPLOYED")}</small><b>$684K</b></div>
      <button class="exec ${state.executive?"on":""}" data-action="executive">${tr("Обзор владельца","Executive view")}</button>
      <button class="locale" data-action="locale" aria-label="${tr("Переключить интерфейс на английский","Switch interface to Russian")}"><span class="${state.locale==="RU"?"active":""}">RU</span><i></i><span class="${state.locale==="EN"?"active":""}">EN</span></button>
      <button class="avatar" data-action="auth" title="${tr("Облачный профиль","Cloud profile")}">${state.session?"ON":"OP"}</button>
    </header>
    <div class="stats-ribbon"><span>5 БРЕНДОВ • 87 ЯЧЕЕК • 29 КАНАЛОВ • $684K КАПИТАЛ</span><b>DRY RUN / LOCAL GOVERNED STATE</b></div>
    <div class="workspace">
      <aside class="side-nav ${state.mobileNav?"mobile-open":""}"><button class="mobile-nav-close" data-action="mobile-menu" aria-label="${tr("Закрыть навигацию","Close navigation")}">×</button><small>НАВИГАЦИЯ</small>${groups.map(([label,keys])=>`<details ${state.mobileNav||keys.includes(screen.key)?"open":""}><summary>${label}<i>⌄</i></summary><section>${keys.map(key=>{const item=byKey(key);return item?`<button class="${item.key===screen.key?"active":""}" data-route="${item.route}">${esc(item.title)}<span>${String(item.order).padStart(2,"0")}</span></button>`:""}).join("")}</section></details>`).join("")}<div class="health"><span>ЗДОРОВЬЕ <b>99.97%</b></span><span>ПОЛИТИКИ <b>GATED</b></span><span>РЕЖИМ <b>DRY RUN</b></span></div></aside>${state.mobileNav?'<button class="mobile-nav-scrim" data-action="mobile-menu" aria-label="Закрыть навигацию"></button>':""}
      <main>
        <div class="page-head"><div><p>${screen.domain} / SCREEN ${String(screen.order).padStart(2,"0")}</p><h1>${esc(screen.title)}</h1><span>${esc(blueprint.subtitle)}</span></div><div class="head-actions">${screen.domain==="MARKET"?'<button class="primary" data-action="add-country">＋ ДОБАВИТЬ СТРАНУ</button>':""}${screen.key==="brands"?`<button class="primary" data-action="add-brand">＋ ${tr("ДОБАВИТЬ БРЕНД","ADD BRAND")}</button>`:""}<button data-action="filter">${state.selectedFilter} ▾</button><button data-action="refresh">ОБНОВИТЬ</button></div></div>
        <div class="metric-ribbon">${metrics.map(([label,value])=>`<div><small>${esc(label)}</small><b>${esc(value)}</b><span>${screen.key === "brand-onboarding" ? tr("СТАТУС","STATUS") : tr("ФАКТ","FACT")}</span></div>`).join("")}</div>
        ${screen.key === "command" ? commandCenterMarkup(screen, blueprint) : screen.key === "brand-onboarding" ? brandOnboardingMarkup() : screen.key === "factory-config" ? productIntelligenceMarkup()+expansionThesisControlMarkup() : productionScreens[screen.key] ? productionSurfaceMarkup(screen) : strategyScreens[screen.key] ? strategySurfaceMarkup(screen) : `<div class="screen-grid ${state.executive?"executive-grid":""}">${blueprint.panels.map(panel=>panelMarkup(panel,screen)).join("")}</div>`}
        <section class="linked"><div class="module-title">СВЯЗАННЫЕ ПОВЕРХНОСТИ <span>INTERACTION GRAPH</span></div>${screen.linksTo.map(key=>{const item=byKey(key);return item?`<button data-route="${item.route}"><small>${String(item.order).padStart(2,"0")}</small><b>${esc(item.title)}</b><span>${item.domain} →</span></button>`:""}).join("")}</section>
      </main>
    </div>
    <footer><span>АКТИВНЫХ ОПЕРАЦИЙ: 237</span><span>ОЧЕРЕДИ: 12</span><span>ОШИБКИ: 2</span><span>ПОЛИТИКИ: GATED</span><b>OWN THE LOGIC. RENT THE CAPABILITY.</b></footer>
    ${state.addCountry?countryModal():""}
    ${state.pendingArea?areaModal():""}
    ${state.addBrand?brandModal():""}
    ${state.addSource?sourceModal():""}
    ${state.addDiagnosis?diagnosisModal():""}
    ${state.addThesis?thesisModal():""}
    ${state.authOpen?authModal():""}
    ${state.welcome?welcomeMarkup():""}
    ${state.notice?`<div class="toast"><i>✓</i><span><b>${tr("ДЕЙСТВИЕ ЗАПИСАНО","ACTION RECORDED")}</b><small>${esc(state.notice)}</small></span></div>`:""}`;
  renderChoropleths().catch((error) => { state.notice = error.message; console.error("Map rendering failed", error); });
}

function renderAuthGate() {
  document.title = `${tr("Вход", "Sign in")} — LAFWIRON`;
  const configured = state.backendStatus?.configured !== false;
  const form = `<form class="auth-gate-form" id="owner-auth-form"><p>${tr("Введите пароль владельца. Он проверяется только на сервере и не передаётся в код приложения.", "Enter the owner password. It is verified only by the server and is never embedded in the application.")}</p><label>${tr("ПАРОЛЬ ВЛАДЕЛЬЦА", "OWNER PASSWORD")}<input name="password" type="password" autocomplete="current-password" minlength="12" required autofocus></label><button class="primary auth-gate-submit" type="submit" disabled>${tr("ВОЙТИ В КОМАНДНЫЙ ЦЕНТР", "ENTER CONTROL ROOM")}</button></form>`;
  document.getElementById("app").innerHTML = `<main class="auth-gate"><section class="auth-gate-brand"><strong>LAFWIRON</strong><span>MARKET FACTORY OS</span><i></i><p>${tr("Автономная маркетинговая фабрика холдинга.", "The holding company's autonomous market factory.")}</p></section><section class="auth-gate-card"><div class="auth-gate-top"><span>${tr("ДОСТУП ВЛАДЕЛЬЦА", "OWNER ACCESS")}</span><button class="locale" type="button" data-action="locale"><span class="${state.locale==="RU"?"active":""}">RU</span><i></i><span class="${state.locale==="EN"?"active":""}">EN</span></button></div><h1>${tr("Вход в командный центр", "Enter the Control Room")}</h1>${configured ? form : `<div class="auth-gate-error">${tr("Доступ владельца не настроен. Проверьте LAFWIRON_OWNER_PASSWORD и LAFWIRON_SESSION_SECRET в Vercel.", "Owner access is not configured. Check LAFWIRON_OWNER_PASSWORD and LAFWIRON_SESSION_SECRET in Vercel.")}</div>`}<small>${tr("Сессия действует 12 часов. Все действия фиксируются в аудите.", "The session lasts 12 hours. Every action is recorded in the audit trail.")}</small></section>${state.notice?`<div class="toast"><i>!</i><span><b>${tr("СТАТУС ВХОДА", "SIGN-IN STATUS")}</b><small>${esc(state.notice)}</small></span></div>`:""}</main>`;
}

function countryModal() {
  const existing = new Set([...geographies,...state.addedMarkets].map(item=>item.countryCode));
  const [pendingAlpha2="",pendingAlpha3=""] = String(state.pendingCountry ?? "").split(":");
  return `<div class="modal-backdrop"><form class="modal" id="country-form"><div class="module-title">${tr("ИССЛЕДОВАНИЕ НОВОГО РЫНКА","NEW MARKET DISCOVERY")} <button type="button" data-action="close-country">×</button></div><h2>${tr("Добавить в экспансию","Add to expansion")}</h2><p>${tr("Страна начнёт с нулевой глубины проникновения в режиме исследования. Расходы, публикации и внешние подключения останутся заблокированы.","The country starts at zero penetration in discovery mode. Spending, publishing and external connections remain blocked.")}</p><input type="hidden" name="worldCode" value="${esc(pendingAlpha3)}"><label>${tr("СТРАНА","COUNTRY")}<select name="country" required><option value="">${tr("Выберите страну","Select a country")}</option>${countryCatalog.map(item=>`<option value="${item.code}" ${existing.has(item.code)?"disabled":""} ${pendingAlpha2===item.code?"selected":""}>${esc(item.name)} (${item.code})</option>`).join("")}</select></label><label>${tr("БРЕНД","BRAND")}<select name="brand" required>${brandOptions()}</select></label><label>${tr("НАПРАВЛЕНИЕ ДЕЯТЕЛЬНОСТИ","ACTIVITY")}<input name="activity" required placeholder="${tr("Например: аренда коммерческого транспорта","For example: commercial vehicle rental")}"></label><div class="modal-actions"><button type="button" data-action="close-country">${tr("ОТМЕНА","CANCEL")}</button><button type="submit">${tr("ДОБАВИТЬ В ЭКСПАНСИЮ","ADD TO EXPANSION")}</button></div></form></div>`;
}

function sourceModal() {
  const brands = state.brandProfiles.length ? state.brandProfiles : [{id:"rigzip",name:"RigZip"}];
  return `<div class="modal-backdrop"><form class="modal source-modal" id="source-form"><div class="module-title">${tr("ИСТОЧНИК И ДОКАЗАТЕЛЬСТВО","SOURCE AND EVIDENCE")} <button type="button" data-action="close-source">×</button></div><h2>${tr("Зафиксировать знание о продукте","Record product knowledge")}</h2><p>${tr("Сначала регистрируется первоисточник, затем утверждение с классификацией и уверенностью. Это не запускает внешних действий.","The primary source is registered first, followed by a classified statement and confidence. This does not trigger external actions.")}</p><div class="form-grid"><label>${tr("БРЕНД","BRAND")}<select name="brandId" required>${brands.map((brand)=>`<option value="${esc(brand.id)}">${esc(brand.name)}</option>`).join("")}</select></label><label>${tr("ТИП ИСТОЧНИКА","SOURCE TYPE")}<select name="kind" required><option value="WEBSITE">Website</option><option value="REPOSITORY">Repository</option><option value="DOCUMENT">Document</option><option value="ANALYTICS">Analytics</option><option value="INTERVIEW">Interview</option><option value="OWNER_NOTE">Owner note</option></select></label><label class="form-span">${tr("НАЗВАНИЕ ИСТОЧНИКА","SOURCE TITLE")}<input name="title" required minlength="2" placeholder="Product website / customer interview"></label><label class="form-span">${tr("ССЫЛКА ИЛИ ИДЕНТИФИКАТОР","URL OR IDENTIFIER")}<input name="locator" required minlength="2" placeholder="https://… or internal://…"></label><label class="form-span">${tr("УТВЕРЖДЕНИЕ","STATEMENT")}<textarea name="statement" required minlength="5" placeholder="${tr("Что именно этот источник подтверждает или оставляет неизвестным","What this source confirms or leaves unknown")}"></textarea></label><label>${tr("КЛАССИФИКАЦИЯ","CLASSIFICATION")}<select name="classification" required><option value="FACT">${tr("Факт","Fact")}</option><option value="INFERENCE">${tr("Вывод / гипотеза","Inference")}</option><option value="UNKNOWN">${tr("Неизвестно / вопрос","Unknown / question")}</option></select></label><label>${tr("УВЕРЕННОСТЬ","CONFIDENCE")}<select name="confidence" required><option value="0.9">90%</option><option value="0.8">80%</option><option value="0.7">70%</option><option value="0.5">50%</option><option value="0.3">30%</option></select></label></div><div class="modal-actions"><button type="button" data-action="close-source">${tr("ОТМЕНА","CANCEL")}</button><button type="submit">${tr("ЗАПИСАТЬ В РЕЕСТР","RECORD IN REGISTER")}</button></div></form></div>`;
}

function thesisModal() {
  const brand=state.brandProfiles[0] ?? {id:"rigzip",name:"RigZip"};
  const diagnosis=state.productDiagnoses.find((item)=>item.brandId===brand.id);
  const candidate=(index)=>`<fieldset><legend>${tr("ГЕОГРАФИЯ","GEOGRAPHY")} ${index}</legend><div class="form-grid"><label>${tr("ISO-КОД СТРАНЫ","COUNTRY ISO CODE")}<input name="countryCode${index}" required maxlength="2" placeholder="US"></label><label>${tr("НАЗВАНИЕ","NAME")}<input name="geographyName${index}" required placeholder="Nebraska"></label><label>${tr("УРОВЕНЬ","LEVEL")}<select name="administrativeLevel${index}"><option value="COUNTRY">Country</option><option value="STATE">State</option><option value="REGION">Region</option></select></label><label>${tr("СПРОС 0–100","DEMAND 0–100")}<input name="demandScore${index}" type="number" min="0" max="100" required></label><label>${tr("ПРЕДЛОЖЕНИЕ 0–100","SUPPLY 0–100")}<input name="supplyScore${index}" type="number" min="0" max="100" required></label><label>${tr("ДОСТУПНОСТЬ 0–100","ACCESSIBILITY 0–100")}<input name="accessibilityScore${index}" type="number" min="0" max="100" required></label><label>${tr("РЕГУЛЯТОРНАЯ СРЕДА 0–100","REGULATORY 0–100")}<input name="regulatoryScore${index}" type="number" min="0" max="100" required></label><label class="form-span">${tr("ОБОСНОВАНИЕ","RATIONALE")}<textarea name="rationale${index}" required minlength="12"></textarea></label><label>${tr("ДОПУЩЕНИЯ","ASSUMPTIONS")}<textarea name="assumptions${index}" required></textarea></label><label>${tr("ЧТО ПРОВЕРИТЬ","VALIDATION QUESTIONS")}<textarea name="validationQuestions${index}" required></textarea></label></div></fieldset>`;
  return `<div class="modal-backdrop"><form class="modal thesis-modal" id="thesis-form"><div class="module-title">${tr("ТЕЗИС ЭКСПАНСИИ","EXPANSION THESIS")} <button type="button" data-action="close-thesis">×</button></div><h2>${esc(brand.name)} · ${tr("сравнение географий","geography comparison")}</h2><p>${tr("Оценки формируют исследовательский приоритет. Они не создают кампанию и не резервируют деньги.","Scores create a research priority. They do not create a campaign or reserve money.")}</p><input type="hidden" name="brandId" value="${esc(brand.id)}"><input type="hidden" name="diagnosisId" value="${esc(diagnosis?.id ?? "")}">${candidate(1)}${candidate(2)}<div class="modal-actions"><button type="button" data-action="close-thesis">${tr("ОТМЕНА","CANCEL")}</button><button type="submit">${tr("ЗАФИКСИРОВАТЬ ТЕЗИС","RECORD THESIS")}</button></div></form></div>`;
}

function diagnosisModal() {
  const brand = state.brandProfiles[0] ?? {id:"rigzip",name:"RigZip"};
  return `<div class="modal-backdrop"><form class="modal diagnosis-modal" id="diagnosis-form"><div class="module-title">${tr("ДИАГНОЗ ПРОДУКТА","PRODUCT DIAGNOSIS")} <button type="button" data-action="close-diagnosis">×</button></div><h2>${esc(brand.name)} · ${tr("рабочий диагноз","working diagnosis")}</h2><p>${tr("Диагноз будет связан со всеми текущими доказательствами бренда. Это ещё не разрешение на запуск кампаний или расходование средств.","The diagnosis will cite all current brand evidence. It does not authorize campaigns or spending.")}</p><input type="hidden" name="brandId" value="${esc(brand.id)}"><div class="form-grid"><label class="form-span">${tr("ЦЕННОСТНЫЙ ТЕЗИС","VALUE THESIS")}<textarea name="valueThesis" required minlength="12"></textarea></label><label>${tr("ПРИОРИТЕТНЫЕ АУДИТОРИИ","PRIORITY AUDIENCES")}<textarea name="priorityAudiences" required></textarea></label><label>${tr("ПРОБЛЕМЫ КЛИЕНТА","CUSTOMER PROBLEMS")}<textarea name="customerProblems" required></textarea></label><label>${tr("БАРЬЕРЫ ПРИНЯТИЯ","ADOPTION BARRIERS")}<textarea name="adoptionBarriers" required></textarea></label><label>${tr("КОНКУРЕНТНЫЕ АЛЬТЕРНАТИВЫ","COMPETITIVE ALTERNATIVES")}<textarea name="competitiveAlternatives" required></textarea></label><label>${tr("СУЩЕСТВЕННЫЕ РИСКИ","MATERIAL RISKS")}<textarea name="materialRisks" required></textarea></label><label>${tr("НЕРАЗРЕШЁННЫЕ ВОПРОСЫ","UNRESOLVED QUESTIONS")}<textarea name="unresolvedQuestions" required></textarea></label></div><div class="modal-actions"><button type="button" data-action="close-diagnosis">${tr("ОТМЕНА","CANCEL")}</button><button type="submit">${tr("ЗАФИКСИРОВАТЬ ДИАГНОЗ","RECORD DIAGNOSIS")}</button></div></form></div>`;
}

function authModal() {
  const workspace=state.cloudContext?.workspace;
  if (state.session) return `<div class="modal-backdrop"><section class="modal auth-modal"><div class="module-title">${tr("ОБЛАЧНЫЙ ПРОФИЛЬ","CLOUD PROFILE")} <button type="button" data-action="close-auth">×</button></div><h2>${esc(workspace?.name ?? tr("Подключение подтверждено","Connection verified"))}</h2><p>${tr("Сессия владельца подписана сервером и действует ограниченное время.","The owner session is signed by the server and has a limited lifetime.")}</p><dl><div><dt>WORKSPACE</dt><dd>${esc(state.cloudContext?.authentication ?? "OWNER_PASSWORD")}</dd></div><div><dt>ROLE</dt><dd>${esc(state.cloudContext?.membership?.member_role ?? "OWNER")}</dd></div><div><dt>MODE</dt><dd>${esc(workspace?.mode ?? "DRY_RUN")}</dd></div></dl><div class="modal-actions"><button type="button" data-action="sign-out">${tr("ВЫЙТИ","SIGN OUT")}</button><button type="button" data-action="close-auth">${tr("ГОТОВО","DONE")}</button></div></section></div>`;
  return `<div class="modal-backdrop"><section class="modal auth-modal"><div class="module-title">${tr("ДОСТУП ВЛАДЕЛЬЦА","OWNER ACCESS")} <button type="button" data-action="close-auth">×</button></div><h2>${tr("Активной сессии нет","No active session")}</h2><p>${tr("Обновите страницу, чтобы войти с паролем владельца.","Reload the page to sign in with the owner password.")}</p></section></div>`;
}

async function loadCloudContext() {
  if (!state.session?.access_token) return;
  const response=await fetch("/api/v1/auth/owner-session",{headers:{Authorization:`Bearer ${state.session.access_token}`}});
  const payload=await response.json();
  if (!response.ok) throw new Error(payload.error ?? "Cloud context unavailable");
  state.cloudContext=payload;
}

function areaModal() {
  const area = state.pendingArea;
  const exists = state.expansionAreas.some((item)=>item.countryCode===area.countryCode && item.adminUnitId===area.adminUnitId);
  return `<div class="modal-backdrop"><form class="modal" id="area-form"><div class="module-title">${tr("УПРАВЛЕНИЕ ТЕРРИТОРИЕЙ","TERRITORY CONTROL")} <button type="button" data-action="close-area">×</button></div><h2>${esc(area.name)}</h2><p>${tr("Территория будет добавлена как исследуемая зона. Система подготовит следующий административный уровень, но не запустит расходы или публикации.","The territory will be added as a discovery area. The system will prepare the next administrative level without spending or publishing.")}</p><dl><div><dt>${tr("ТИП ЕДИНИЦЫ","UNIT TYPE")}</dt><dd>${esc(area.unitType)}</dd></div><div><dt>${tr("СТАТУС","STATUS")}</dt><dd>${exists?tr("УЖЕ В ЭКСПАНСИИ","ALREADY IN EXPANSION"):"DISCOVERY"}</dd></div></dl><label>${tr("БРЕНД","BRAND")}<select name="brand" required>${brandOptions()}</select></label><div class="modal-actions"><button type="button" data-action="close-area">${tr("ОТМЕНА","CANCEL")}</button><button type="button" data-route="${esc(area.route)}">${tr("ОТКРЫТЬ ГЛУБИНУ","OPEN DRILL-DOWN")}</button>${exists?"":`<button type="submit">${tr("ДОБАВИТЬ ТЕРРИТОРИЮ","ADD TERRITORY")}</button>`}</div></form></div>`;
}

function brandModal() {
  return `<div class="modal-backdrop"><form class="modal brand-modal" id="brand-form"><div class="module-title">${tr("ПАСПОРТ БРЕНДА","BRAND INTAKE")} <button type="button" data-action="close-brand">×</button></div><h2>${tr("Добавить бренд в фабрику","Add a brand to the factory")}</h2><p>${tr("Система использует этот контекст для построения контракта роста, исследования рынков, выбора каналов и метрик. Новый бренд начинает в DISCOVERY без внешних действий.","The factory uses this context to form a growth contract, scout markets, choose channels and metrics. New brands start in DISCOVERY with no external execution.")}</p><div class="form-grid"><label>${tr("НАЗВАНИЕ","NAME")}<input name="name" required minlength="2" placeholder="Acme"></label><label>${tr("ТИП ПРОДУКТА","PRODUCT ARCHETYPE")}<select name="archetype" required><option value="LOCAL_TWO_SIDED_MARKETPLACE">${tr("Локальный двусторонний маркетплейс","Local two-sided marketplace")}</option><option value="INTERNATIONAL_NEIGHBORHOOD_MARKETPLACE">${tr("Международный соседский маркетплейс","International neighborhood marketplace")}</option><option value="CONTENT_IP_PORTFOLIO">${tr("Контент и интеллектуальная собственность","Content and IP portfolio")}</option><option value="TRAVEL_PLATFORM">${tr("Платформа путешествий","Travel platform")}</option><option value="RECURRING_UTILITY">${tr("Регулярный цифровой сервис","Recurring utility")}</option><option value="OTHER">${tr("Другая модель","Other model")}</option></select></label><label>${tr("ЧТО ПРЕДЛАГАЕТ ПРОДУКТ","OFFERING")}<textarea name="offering" required placeholder="${tr("Продукт или услуга и решаемая проблема","Product, service and problem solved")}"></textarea></label><label>${tr("ДЛЯ КОГО","TARGET AUDIENCE")}<textarea name="audience" required placeholder="${tr("Покупатели, поставщики, сегменты","Buyers, suppliers and segments")}"></textarea></label><label>${tr("БИЗНЕС-МОДЕЛЬ","BUSINESS MODEL")}<input name="businessModel" required placeholder="${tr("Комиссия, подписка, продажа…","Commission, subscription, sale…")}"></label><label>${tr("ГЛАВНОЕ ЦЕННОСТНОЕ СОБЫТИЕ","PRIMARY VALUE EVENT")}<input name="primaryValueEvent" required placeholder="completed_booking"></label><label class="form-span">${tr("ЗАДАЧИ БРЕНДА","BRAND OBJECTIVES")}<textarea name="objectives" required placeholder="${tr("Например: проверить спрос; привлечь поставщиков; выйти в новый штат","For example: validate demand; acquire suppliers; enter a new state")}"></textarea></label><label>${tr("ЦЕЛЕВЫЕ ГЕОГРАФИИ","TARGET GEOGRAPHIES")}<input name="targetGeographies" required placeholder="US, CZ, EU"></label><label>${tr("ЯЗЫКИ","LANGUAGES")}<input name="languages" required placeholder="ru, en"></label><label class="form-span">${tr("ОГРАНИЧЕНИЯ И ЗАПРЕТЫ","CONSTRAINTS AND PROHIBITIONS")}<textarea name="constraints" placeholder="${tr("Регулирование, запрещённые claims, возрастные ограничения, риски","Regulation, prohibited claims, age restrictions and risks")}"></textarea></label></div><div class="modal-actions"><button type="button" data-action="close-brand">${tr("ОТМЕНА","CANCEL")}</button><button type="submit">${tr("СОЗДАТЬ ПРОФИЛЬ БРЕНДА","CREATE BRAND PROFILE")}</button></div></form></div>`;
}

function welcomeMarkup() {
  const status=state.factoryStatus;
  const value=(candidate,fallback="UNAVAILABLE")=>candidate===undefined||candidate===null?fallback:candidate;
  const shift=String(value(status?.cadence?.shift)).replace("_"," ");
  const transition=status?.cadence?.mode==="BRAINSTORM"?tr("ДО КОНЦА БРЕЙНШТОРМА","BRAINSTORM ENDS IN"):tr("ДО БРЕЙНШТОРМА","NEXT BRAINSTORM");
  const capital=status?new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:0}).format(status.availableCapitalUsd):"UNAVAILABLE";
  return `<div class="welcome-backdrop"><section class="welcome-panel"><header><div class="welcome-brand"><strong>LAFWIRON</strong><small>MARKET FACTORY OS</small></div><span><i></i>${status?tr("ЛОКАЛЬНОЕ СОСТОЯНИЕ ПОДТВЕРЖДЕНО","LOCAL STATE VERIFIED"):tr("ДАННЫЕ НЕДОСТУПНЫ","DATA UNAVAILABLE")}</span></header><div class="welcome-hero"><p>${tr("ДОБРО ПОЖАЛОВАТЬ В КОМАНДНЫЙ ЦЕНТР","WELCOME TO THE COMMAND CENTER")}</p><h1>${tr("Маркетинговая фабрика, которая работает круглосуточно.","A marketing factory that operates around the clock.")}</h1><p>${tr("Это фактический снимок локального управляемого состояния. Значения получены из runtime API и пересчитываются при загрузке.","This is an actual snapshot of local governed state. Values come from the runtime API and are recomputed on load.")}</p></div><div class="welcome-status"><article><small>${tr("ТЕКУЩАЯ СМЕНА","CURRENT SHIFT")}</small><b>${esc(shift)}</b><span>${esc(value(status?.cadence?.mode))}</span></article><article><small>${transition}</small><b>${esc(value(status?.cadence?.minutesUntilTransition))} MIN</b><span>5 ${tr("минут · очереди продолжаются","minutes · queues continue")}</span></article><article><small>${tr("РЕЖИМ","MODE")}</small><b>${esc(value(status?.mode))}</b><span>runtime v${esc(value(status?.runtimeVersion))}</span></article><article><small>${tr("БРЕНДЫ / РЫНКИ","BRANDS / MARKETS")}</small><b>${esc(value(status?.brands))} / ${esc(value(status?.expansionMarkets))}</b><span>${tr("Территорий добавлено","Expansion areas")}: ${esc(value(status?.expansionAreas))}</span></article><article><small>${tr("ОТКРЫТЫЕ РЕШЕНИЯ","OPEN DECISIONS")}</small><b>${esc(value(status?.openDecisions))}</b><span>${status?.killSwitch?"KILL SWITCH ACTIVE":tr("Политики активны","Policies active")}</span></article><article><small>${tr("ДОСТУПНЫЙ КАПИТАЛ","AVAILABLE CAPITAL")}</small><b>${esc(capital)}</b><span>${esc(value(status?.source))}</span></article></div><div class="welcome-flow"><span>${tr("Исследование","Intelligence")}</span><i>→</i><span>${tr("Эксперименты","Experiments")}</span><i>→</i><span>${tr("Контент","Content")}</span><i>→</i><span>${tr("Дистрибуция","Distribution")}</span><i>→</i><span>${tr("Обучение","Learning")}</span><i>→</i><span>${tr("Капитал","Capital")}</span></div><footer><small>${status?new Date(status.generatedAt).toLocaleString():tr("API не ответил","API did not respond")}</small><button data-action="welcome-factory">${tr("ПОСМОТРЕТЬ РАБОТУ ЦЕХОВ","VIEW FACTORY FLOOR")}</button><button class="primary" data-action="welcome-command">${tr("ВОЙТИ В КОМАНДНЫЙ ЦЕНТР","ENTER COMMAND CENTER")} →</button></footer></section></div>`;
}

function navigate(route) { state.mobileNav=false; history.pushState({},"",route); render(); window.scrollTo(0,0); }
document.addEventListener("click", async (event) => {
  const target = event.target.closest("[data-route],[data-geo-action],button"); if (!target) return;
  if (target.dataset.geoAction === "add-expansion") { state.pendingCountry=String(target.dataset.geoCode ?? ""); state.addCountry=true; render(); return; }
  if (target.dataset.geoAction === "inspect-area") { try { state.pendingArea=JSON.parse(decodeURIComponent(String(target.dataset.geoArea ?? ""))); render(); } catch { state.notice=tr("Не удалось прочитать территорию","Unable to read territory"); render(); } return; }
  if (target.dataset.route) { navigate(target.dataset.route); return; }
  if (target.matches('button[type="submit"]')) return;
  try {
    if (target.dataset.action === "welcome-command") { state.welcome=false; navigate("/command"); return; }
    if (target.dataset.action === "welcome-factory") { state.welcome=false; navigate("/factory"); return; }
    if (target.dataset.action === "mobile-menu") { state.mobileNav=!state.mobileNav; render(); return; }
    if (target.dataset.action === "auth") state.authOpen=true;
    if (target.dataset.action === "close-auth") state.authOpen=false;

    if (target.dataset.action === "sign-out") { localStorage.removeItem("lafwiron-owner-session"); state.session=null; state.cloudContext=null; state.authOpen=false; state.notice=tr("Сессия владельца завершена","Owner session ended"); }
    if (target.dataset.action === "executive") { await sendCommand({kind:"SET_EXECUTIVE_VIEW",enabled:!state.executive}); state.notice=tr(state.executive?"Включён обзор для владельца":"Включён рабочий обзор",state.executive?"Executive view enabled":"Operator view enabled"); }
    if (target.dataset.action === "locale") {
      if (!isLocalRuntime && !state.cloudContext) state.locale=state.locale==="RU"?"EN":"RU";
      else await sendCommand({kind:"SET_LOCALE",locale:state.locale==="RU"?"EN":"RU"});
      state.notice=tr("Выбран русский язык","English interface selected");
    }
    if (target.dataset.action === "filter") { const values=["ВСЕ","RIGZIP","EVORIOS","TRAVEL"]; const filter=values[(values.indexOf(state.selectedFilter)+1)%values.length]; await sendCommand({kind:"SET_FILTER",filter}); state.notice=tr(`Выбран фильтр: ${state.selectedFilter}`,`Filter selected: ${state.selectedFilter}`); }
    if (target.dataset.action === "refresh") { await sendCommand({kind:"REFRESH_READ_MODELS"}); state.notice=tr("Данные обновлены локально. Внешние вызовы не выполнялись","Read models refreshed locally. No external calls were made"); }
    if (target.dataset.region) { state.selectedRegion=target.dataset.region; state.notice=tr("Географический охват изменён","Geographic scope changed"); }
  if (target.dataset.action === "add-country") state.addCountry=true;
  if (target.dataset.action === "add-brand") state.addBrand=true;
  if (target.dataset.action === "add-source") state.addSource=true;
  if (target.dataset.action === "add-diagnosis" && !target.disabled) state.addDiagnosis=true;
  if (target.dataset.action === "add-thesis") state.addThesis=true;
  if (target.dataset.action === "close-country") { state.addCountry=false; state.pendingCountry=null; }
    if (target.dataset.action === "close-brand") state.addBrand=false;
    if (target.dataset.action === "close-source") state.addSource=false;
    if (target.dataset.action === "close-diagnosis") state.addDiagnosis=false;
    if (target.dataset.action === "close-thesis") state.addThesis=false;
    if (target.dataset.action === "close-area") state.pendingArea=null;
    if (target.dataset.action === "approve") { await sendCommand({kind:"RESOLVE_DECISION",outcome:"APPROVED"}); state.notice=tr("Решение сохранено в режиме проверки. Средства не перемещались","Dry-run approval recorded. No funds moved"); }
    if (target.dataset.action === "reject") { await sendCommand({kind:"RESOLVE_DECISION",outcome:"REJECTED"}); state.notice=tr("Предложение отклонено и сохранено локально","Proposal rejected and recorded locally"); }
  } catch (error) { state.notice = `COMMAND REJECTED: ${error.message}`; }
  render(); setTimeout(()=>{state.notice="";render();},2200);
});
document.addEventListener("input", (event) => {
  const form = event.target.closest?.(".auth-gate-form");
  if (!form) return;
  const submit = form.querySelector('button[type="submit"]');
  const ready = form.checkValidity();
  form.classList.toggle("ready", ready);
  if (submit) submit.disabled = !ready;
});
document.addEventListener("submit", async (event) => {
  if (event.target.id === "owner-auth-form") {
    event.preventDefault();
    const form=new FormData(event.target);
    try {
      const response=await fetch("/api/v1/auth/owner-login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({password:String(form.get("password") ?? "")})});
      const payload=await response.json();
      if (!response.ok) throw new Error(response.status===401?tr("Неверный пароль владельца","Invalid owner password"):(payload.error ?? "Owner sign-in failed"));
      state.session=payload;
      localStorage.setItem("lafwiron-owner-session",JSON.stringify(payload));
      await loadCloudContext();
      state.notice=tr("Доступ владельца подтверждён","Owner access verified");
      if (matchMedia("(max-width: 760px)").matches) { state.welcome=false; navigate("/command"); return; }
    } catch (error) { state.notice=error.message; }
    render();
    return;
  }
  if (event.target.id === "brand-form") {
    event.preventDefault();
    const form = new FormData(event.target);
    const split = (name) => String(form.get(name) ?? "").split(/[,;\n]/).map((item)=>item.trim()).filter(Boolean);
    const name = String(form.get("name") ?? "").trim();
    const id = name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-zа-я0-9]+/gi,"-").replace(/^-|-$/g,"");
    const brand = { id, name, archetype:String(form.get("archetype")), offering:String(form.get("offering")), audience:String(form.get("audience")), businessModel:String(form.get("businessModel")), objectives:split("objectives"), primaryValueEvent:String(form.get("primaryValueEvent")), targetGeographies:split("targetGeographies"), languages:split("languages"), constraints:split("constraints"), status:"DISCOVERY" };
    try {
      await sendCommand({kind:"ADD_BRAND_PROFILE",brand});
      state.addBrand=false;
      navigate(`/brands/${id}/onboarding`);
      state.notice=tr(`${name}: профиль создан, начато изучение продукта`,`${name}: profile created, product intelligence started`);
      render();
    } catch (error) { state.notice=`COMMAND REJECTED: ${error.message}`; render(); }
    return;
  }
  if (event.target.id === "source-form") {
    event.preventDefault();
    const form = new FormData(event.target);
    const brandId = String(form.get("brandId") ?? "");
    const capturedAt = new Date().toISOString();
    try {
      await sendCommand({kind:"REGISTER_PRODUCT_SOURCE",source:{brandId,kind:String(form.get("kind")),title:String(form.get("title")),locator:String(form.get("locator")),capturedAt}});
      const source = [...state.productSources].reverse().find((item)=>item.brandId===brandId && item.locator===String(form.get("locator")));
      if (!source) throw new Error("Registered source was not returned");
      await sendCommand({kind:"RECORD_PRODUCT_EVIDENCE",evidence:{brandId,sourceId:source.id,statement:String(form.get("statement")),classification:String(form.get("classification")),confidence:Number(form.get("confidence")),recordedAt:new Date().toISOString()}});
      state.addSource=false;
      state.notice=tr("Источник и доказательство записаны в реестр","Source and evidence recorded");
    } catch (error) { state.notice=`COMMAND REJECTED: ${error.message}`; }
    render();
    return;
  }
  if (event.target.id === "diagnosis-form") {
    event.preventDefault();
    const form = new FormData(event.target);
    const brandId=String(form.get("brandId") ?? "");
    const split=(name)=>String(form.get(name) ?? "").split(/[,;\n]/).map((item)=>item.trim()).filter(Boolean);
    const diagnosis={brandId,valueThesis:String(form.get("valueThesis")),priorityAudiences:split("priorityAudiences"),customerProblems:split("customerProblems"),adoptionBarriers:split("adoptionBarriers"),competitiveAlternatives:split("competitiveAlternatives"),materialRisks:split("materialRisks"),unresolvedQuestions:split("unresolvedQuestions"),evidenceIds:state.productEvidence.filter((item)=>item.brandId===brandId).map((item)=>item.id),createdAt:new Date().toISOString()};
    try { await sendCommand({kind:"CREATE_PRODUCT_DIAGNOSIS",diagnosis}); state.addDiagnosis=false; state.notice=tr("Диагноз продукта зафиксирован","Product diagnosis recorded"); }
    catch (error) { state.notice=`COMMAND REJECTED: ${error.message}`; }
    render();
    return;
  }
  if (event.target.id === "thesis-form") {
    event.preventDefault();
    const form=new FormData(event.target);
    const split=(name)=>String(form.get(name) ?? "").split(/[,;\n]/).map((item)=>item.trim()).filter(Boolean);
    const candidate=(index)=>({countryCode:String(form.get(`countryCode${index}`) ?? "").trim().toUpperCase(),geographyName:String(form.get(`geographyName${index}`) ?? "").trim(),administrativeLevel:String(form.get(`administrativeLevel${index}`)),demandScore:Number(form.get(`demandScore${index}`)),supplyScore:Number(form.get(`supplyScore${index}`)),accessibilityScore:Number(form.get(`accessibilityScore${index}`)),regulatoryScore:Number(form.get(`regulatoryScore${index}`)),rationale:String(form.get(`rationale${index}`)),assumptions:split(`assumptions${index}`),validationQuestions:split(`validationQuestions${index}`)});
    const thesis={brandId:String(form.get("brandId")),diagnosisId:String(form.get("diagnosisId")),candidates:[candidate(1),candidate(2)],createdAt:new Date().toISOString()};
    try { await sendCommand({kind:"CREATE_EXPANSION_THESIS",thesis}); state.addThesis=false; state.notice=tr("Тезис экспансии зафиксирован","Expansion thesis recorded"); }
    catch(error){state.notice=`COMMAND REJECTED: ${error.message}`;}
    render();
    return;
  }
  if (event.target.id === "area-form") {
    event.preventDefault();
    if (!state.pendingArea) return;
    const form = new FormData(event.target);
    const area = { ...state.pendingArea, brand:String(form.get("brand")), status:"DISCOVERY" };
    try {
      await sendCommand({kind:"ADD_EXPANSION_AREA",area});
      state.pendingArea=null;
      state.notice=tr(`${area.name}: территория добавлена в исследование`,`${area.name}: discovery territory added`);
    } catch (error) { state.notice=`COMMAND REJECTED: ${error.message}`; }
    render();
    setTimeout(()=>{state.notice="";render();},2200);
    return;
  }
  if (event.target.id !== "country-form") return;
  event.preventDefault();
  const form = new FormData(event.target);
  const code = String(form.get("country") ?? "");
  const catalogItem = countryCatalog.find(item=>item.code===code);
  if (!catalogItem) return;
  const mappedPolygon = document.querySelector(`[data-geo-code^="${code}:"]`);
  const mappedWorldCode = mappedPolygon?.getAttribute("data-geo-code")?.split(":")[1] ?? String(form.get("worldCode") ?? "");
  const slug = catalogItem.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-zа-я0-9]+/gi,"-").replace(/^-|-$/g,"");
  const market = { countryCode:code, countryName:catalogItem.name, slug, worldCode:mappedWorldCode, activity:String(form.get("activity")), status:"DISCOVERY", brand:String(form.get("brand")) };
  try {
    await sendCommand({kind:"ADD_DISCOVERY_MARKET",market});
    state.addCountry=false;
    state.pendingCountry=null;
    navigate(`/markets/${slug}`);
    state.notice=`${catalogItem.name}: DISCOVERY MARKET CREATED`;
    render();
  } catch (error) { state.notice=`COMMAND REJECTED: ${error.message}`; render(); }
});
addEventListener("popstate", render);

Promise.all([
  fetch("/api/v1/screens").then(response=>response.json()),
  fetch("/api/v1/control-room").then(response=>response.json()),
  fetch("/api/v1/geographies").then(response=>response.json()),
  fetch("/api/v1/country-catalog").then(response=>response.json()),
  fetch("/api/v1/runtime-state").then(response=>response.json()),
  fetch("/api/v1/factory-status").then(response=>response.json()),
  fetch("/api/v1/backend-status").then(response=>response.json()),
]).then(async ([registry,readModel,geographyRegistry,catalog,runtime,factoryStatus,backendStatus])=>{screens=registry.screens;control=readModel;geographies=geographyRegistry.geographies;countryCatalog=catalog.countries;state.factoryStatus=factoryStatus;state.backendStatus=backendStatus;applyRuntime(runtime);try{state.session=JSON.parse(localStorage.getItem("lafwiron-owner-session"));if(state.session)await loadCloudContext();}catch{localStorage.removeItem("lafwiron-owner-session");state.session=null;state.cloudContext=null;}render();}).catch(error=>{document.getElementById("app").innerHTML=`<div class="fatal">CONTROL ROOM UNAVAILABLE<br>${esc(error.message)}</div>`;});
