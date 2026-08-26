import { blueprints } from "/screen-blueprints.js";
import { renderChoropleths } from "/map.js";

const state = { executive:false, locale:"RU", notice:"", decisions:3, selectedFilter:"ВСЕ", selectedRegion:"WORLD", addCountry:false, addBrand:false, pendingCountry:null, pendingArea:null, addedMarkets:[], expansionAreas:[], brandProfiles:[], version:0 };
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
  state.version = runtime.version;
}
async function sendCommand(command) {
  const response = await fetch("/api/v1/commands", { method:"POST", headers:{ "Content-Type":"application/json" }, body:JSON.stringify(command) });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error ?? "Command rejected");
  applyRuntime(payload);
}
const byKey = (key) => screens.find((screen) => screen.key === key);
function current() {
  const exact = screens.find((screen) => screen.route === location.pathname);
  if (exact) return exact;
  if (location.pathname.startsWith("/markets/")) {
    const [, , countrySlug = "market", areaSlug] = location.pathname.split("/");
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
    const interactive = screen.figmaNodeId === "PARAMETERIZED_GEOGRAPHIC_DRILLDOWN" ? null : interactiveMaps[screen.key];
    const asset = screen.figmaNodeId === "PARAMETERIZED_GEOGRAPHIC_DRILLDOWN" ? null : referenceMapAssets[screen.key];
    const map = interactive
      ? `<div class="geo-vector" data-geo-source="${interactive.source}" data-geo-mode="${interactive.mode}" data-geo-country="${interactive.country ?? (interactive.mode === "states" || interactive.mode === "counties" ? "US" : "")}" data-geo-base="${interactive.base}" data-geo-attribution="${interactive.attribution}" data-geo-region="${screen.key === "command" ? state.selectedRegion : "ALL"}" data-active-countries="${screen.key === "command" ? activeCountrySpec() : ""}" data-active-areas="${state.expansionAreas.map((area)=>`${area.countryCode}:${area.adminUnitId}`).join(",")}"></div>`
      : asset
      ? `<img src="${asset}" alt="${esc(panel.title)}: административные границы" loading="eager">`
      : `<div class="boundary-pending"><b>ГРАНИЦЫ ЗАГРУЖАЮТСЯ</b><span>Система определяет принятый административный уровень и проверяет набор полигонов перед публикацией.</span><small>DISCOVERY · NO SYNTHETIC CELLS</small></div>`;
    const config = mapPanelConfig[screen.key] ?? { title:panel.title, segment:"ALL MARKETCELLS", pills:[] };
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
    label:"CONTENT PRODUCTION SYSTEM", primary:"ACTIVE JOBS", primaryValue:"48",
    tabs:["QUEUE 48","GENERATING 12","QA 9","APPROVED 143","BLOCKED 4"],
    columns:["JOB / ASSET","RECIPE","CLAIM COVERAGE","QUALITY","СТАТУС"],
    rows:[
      ["CNT-RGZ-042","SHORT_VIDEO_v3 / Trailer availability","4/4 VERIFIED","92 / 100","QA"],
      ["CNT-EVR-018","META_STATIC_v4 / Neighbor proof","3/3 VERIFIED","89 / 100","GENERATING"],
      ["CNT-TRV-011","SEO_ARTICLE_v2 / 48-hour city guide","5/6 VERIFIED","84 / 100","REVIEW"],
    ],
    detailTitle:"ASSET LINEAGE", detail:["Experiment","EXP-RGZ-014","Brief → Recipe","BRF-014 → SHORT_VIDEO_v3","Provider mode","LOCAL STUB / NO EXTERNAL CALL"],
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
    eyebrow:"ВОСПРОИЗВОДИМЫЙ СЛЕД РЕШЕНИЙ", status:"18,4 ТЫС. СОБЫТИЙ · 99,97% ПОКРЫТИЕ", action:"ОТКРЫТЬ ОПЕРАЦИИ", next:"operations",
    stages:[["Команды","312","Приняты"],["Решения","184","Зафиксированы"],["Политики","31","Сработали"],["Доказательства","1 806","Связаны"],["Повтор","100%","Воспроизводим"]],
    title:"ЖУРНАЛ УПРАВЛЯЕМЫХ СОБЫТИЙ", columns:["ВРЕМЯ / СОБЫТИЕ","ОБЛАСТЬ","РЕЗУЛЬТАТ","ДОКАЗАТЕЛЬСТВО"], rows:[["14:07 · AUTHORITY_EVALUATED","RigZip / Nebraska","Разрешено до $100","POLICY-v3"],["14:07 · DISTRIBUTION_GATED","Meta / RigZip","Заблокировано","DRY_RUN"],["14:06 · CLAIM_VERIFIED","Asset RGZ-042","4 из 4","EVIDENCE-88"],["14:05 · MODEL_PROPOSED","Response Ranker v4","Challenger","EVAL-214"]],
    sideTitle:"ПОКРЫТИЕ ПОЛИТИК", side:[["Финансы","100%"],["Утверждения","96%"],["Конфиденциальность","100%"],["Хранение данных","92%"]]
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
    title:"КАНАЛЫ И ИХ ЭКОНОМИКА", columns:["СЕМЕЙСТВО","ПРИМЕРЫ","МОДЕЛЬ ЗАТРАТ","ГОТОВНОСТЬ"], rows:[["Платная реклама","Meta, Google, TikTok, YouTube","Аукцион","5 из 6"],["Контент и поиск","SEO-статьи, local SEO, guides","Производство","4 из 4"],["Инфлюенсеры","YouTube creators, micro-influencers","Фикс. / комиссия","2 из 5"],["Маркетплейсы","Региональные площадки, каталоги","Комиссия","1 из 2"],["Удержание","Email, push, referral","Собственный","3 из 3"]],
    sideTitle:"КОНТРАКТ КАНАЛА", side:[["Обязательные поля","География и метрики"],["Права на контент","Версия и срок"],["Атрибуция","Нативная → value event"],["Новый канал","Без изменения ядра"]]
  },
  assets: {
    eyebrow:"РЕЕСТР КРЕАТИВОВ И ДОКАЗАТЕЛЬСТВ", status:"1 284 МАТЕРИАЛА · 143 НА ПРОВЕРКЕ", action:"ОТКРЫТЬ КОНТЕНТ-ФАБРИКУ", next:"content-factory",
    stages:[["Задание","48","В очереди"],["Утверждения","96%","Покрыты"],["Создание","186","Версии"],["Контроль","143","Одобрены"],["Реестр","1 284","С происхождением"]],
    title:"МАТЕРИАЛЫ И ПРОИСХОЖДЕНИЕ", columns:["МАТЕРИАЛ","ФОРМАТ / ВЕРСИЯ","ДОКАЗАТЕЛЬСТВА","СОСТОЯНИЕ"], rows:[["RGZ_TRAILER_042","Короткое видео · v3","4 из 4","Одобрен"],["EVR_NEIGHBOR_018","Статичный пост · v4","3 из 3","Проверка"],["TRV_CITY_011","SEO-статья · v2","5 из 6","Доработка"]],
    sideTitle:"ЦЕПОЧКА ПРОИСХОЖДЕНИЯ", side:[["Эксперимент","EXP-RGZ-014"],["Задание","BRF-014"],["Рецепт","SHORT_VIDEO_v3"],["Провайдер","Локальная заглушка"]]
  },
  operations: {
    eyebrow:"НАДЁЖНОЕ ИСПОЛНЕНИЕ", status:"237 В РАБОТЕ · 2 ОШИБКИ", action:"ОТКРЫТЬ АУДИТ", next:"audit",
    stages:[["Очередь","12","Ожидают"],["В работе","237","Операции"],["Повтор","4","С задержкой"],["Сверка","97,8%","Подтверждено"],["Инциденты","2","Открыты"]],
    title:"ПОТОК ОПЕРАЦИЙ", columns:["ОПЕРАЦИЯ","ВОЗМОЖНОСТЬ","ПОПЫТКА / SLA","СОСТОЯНИЕ"], rows:[["DIST-8821","Доставка кампании","1 · 99,8%","Завершена"],["GEN-1942","Создание видео","1 · 98,4%","В работе"],["SCAN-4461","Исследование рынка","1 · 99,1%","В очереди"],["RECON-104","Сверка расходов","2 · 94,7%","Задержка"]],
    sideTitle:"АКТИВНЫЕ ИНЦИДЕНТЫ", side:[["Видео-провайдер","Задержка стоимости"],["Meta reconciliation","Отстаёт на 2 часа"],["Автоповтор","До 3 попыток"],["Внешние действия","Заблокированы"]]
  },
  "learning-engine": {
    eyebrow:"КОНТУР УПРАВЛЯЕМОГО ОБУЧЕНИЯ", status:"7 МОДЕЛЕЙ НА ПРОВЕРКЕ", action:"ОТКРЫТЬ CAPITAL ALLOCATOR", next:"capital-allocator",
    stages:[["События","18,4 тыс.","Канонические факты"],["Атрибуция","97,8%","Связь с решением"],["Оценка","1 806","Окна результатов"],["Калибровка","91%","Точность основной модели"],["Предложение","7","Конкурирующие модели"]],
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
  const screen = current();
  if (!screen) return;
  const blueprint = blueprints[screen.key] ?? blueprints.command;
  const metrics = screen.key === "brand-onboarding" ? [[tr("ЭТАП","STAGE"),"2 / 8"],[tr("ИСТОЧНИКИ","SOURCES"),"0"],[tr("РЫНКИ-КАНДИДАТЫ","MARKET CANDIDATES"),"—"],[tr("ТЕСТОВЫЙ БЮДЖЕТ","TEST BUDGET"),tr("НЕ ПРЕДЛОЖЕН","NOT PROPOSED")]] : blueprint.metrics;
  const groups = navGroups();
  document.title = `${screen.title} — LATTICE`;
  document.getElementById("app").innerHTML = `
    <header class="command-bar">
      <button class="brand" data-route="/command"><strong>LATTICE</strong><small>MARKET FACTORY OS</small></button>
      <div class="factory-state"><i></i> ${tr("ФАБРИКА РАБОТАЕТ","FACTORY ONLINE")}</div>
      <button class="attention" data-route="/owner"><i></i><span>${pendingDecisionLabel(state.decisions)}</span><em>→</em></button>
      <div class="signal"><small>${tr("ЛУЧШЕЕ ВЛОЖЕНИЕ $100","BEST NEXT $100")}</small><b>RigZip / Nebraska → +87 ${tr("рег.","sign-ups")}</b><span>83% · ${tr("прогноз","forecast")}</span></div>
      <div class="signal"><small>${tr("ЛУЧШЕЕ ВЛОЖЕНИЕ $1,000","BEST NEXT $1,000")}</small><b>Evorios / Czechia → +312 ${tr("рег.","sign-ups")}</b><span>79% · ${tr("прогноз","forecast")}</span></div>
      <div class="capital-mini"><small>${tr("КАПИТАЛ В РАБОТЕ","CAPITAL DEPLOYED")}</small><b>$684K</b></div>
      <button class="exec ${state.executive?"on":""}" data-action="executive">${tr("Обзор владельца","Executive view")}</button>
      <button class="locale" data-action="locale" aria-label="${tr("Переключить интерфейс на английский","Switch interface to Russian")}"><span class="${state.locale==="RU"?"active":""}">RU</span><i></i><span class="${state.locale==="EN"?"active":""}">EN</span></button>
      <span class="avatar">OP</span>
    </header>
    <div class="stats-ribbon"><span>5 БРЕНДОВ • 87 ЯЧЕЕК • 29 КАНАЛОВ • $684K КАПИТАЛ</span><b>DRY RUN / LOCAL GOVERNED STATE</b></div>
    <div class="workspace">
      <aside class="side-nav"><small>НАВИГАЦИЯ</small>${groups.map(([label,keys])=>`<details ${keys.includes(screen.key)?"open":""}><summary>${label}<i>⌄</i></summary><section>${keys.map(key=>{const item=byKey(key);return item?`<button class="${item.key===screen.key?"active":""}" data-route="${item.route}">${esc(item.title)}<span>${String(item.order).padStart(2,"0")}</span></button>`:""}).join("")}</section></details>`).join("")}<div class="health"><span>ЗДОРОВЬЕ <b>99.97%</b></span><span>ПОЛИТИКИ <b>GATED</b></span><span>РЕЖИМ <b>DRY RUN</b></span></div></aside>
      <main>
        <div class="page-head"><div><p>${screen.domain} / SCREEN ${String(screen.order).padStart(2,"0")}</p><h1>${esc(screen.title)}</h1><span>${esc(blueprint.subtitle)}</span></div><div class="head-actions">${screen.domain==="MARKET"?'<button class="primary" data-action="add-country">＋ ДОБАВИТЬ СТРАНУ</button>':""}${screen.key==="brands"?`<button class="primary" data-action="add-brand">＋ ${tr("ДОБАВИТЬ БРЕНД","ADD BRAND")}</button>`:""}<button data-action="filter">${state.selectedFilter} ▾</button><button data-action="refresh">ОБНОВИТЬ</button></div></div>
        <div class="metric-ribbon">${metrics.map(([label,value])=>`<div><small>${esc(label)}</small><b>${esc(value)}</b><span>${screen.key === "brand-onboarding" ? tr("СТАТУС","STATUS") : tr("ФАКТ","FACT")}</span></div>`).join("")}</div>
        ${screen.key === "command" ? commandCenterMarkup(screen, blueprint) : screen.key === "brand-onboarding" ? brandOnboardingMarkup() : productionScreens[screen.key] ? productionSurfaceMarkup(screen) : strategyScreens[screen.key] ? strategySurfaceMarkup(screen) : `<div class="screen-grid ${state.executive?"executive-grid":""}">${blueprint.panels.map(panel=>panelMarkup(panel,screen)).join("")}</div>`}
        <section class="linked"><div class="module-title">СВЯЗАННЫЕ ПОВЕРХНОСТИ <span>INTERACTION GRAPH</span></div>${screen.linksTo.map(key=>{const item=byKey(key);return item?`<button data-route="${item.route}"><small>${String(item.order).padStart(2,"0")}</small><b>${esc(item.title)}</b><span>${item.domain} →</span></button>`:""}).join("")}</section>
      </main>
    </div>
    <footer><span>АКТИВНЫХ ОПЕРАЦИЙ: 237</span><span>ОЧЕРЕДИ: 12</span><span>ОШИБКИ: 2</span><span>ПОЛИТИКИ: GATED</span><b>OWN THE LOGIC. RENT THE CAPABILITY.</b></footer>
    ${state.addCountry?countryModal():""}
    ${state.pendingArea?areaModal():""}
    ${state.addBrand?brandModal():""}
    ${state.notice?`<div class="toast"><i>✓</i><span><b>${tr("ДЕЙСТВИЕ ЗАПИСАНО","ACTION RECORDED")}</b><small>${esc(state.notice)}</small></span></div>`:""}`;
  renderChoropleths().catch((error) => { state.notice = error.message; console.error("Map rendering failed", error); });
}

function countryModal() {
  const existing = new Set([...geographies,...state.addedMarkets].map(item=>item.countryCode));
  const [pendingAlpha2="",pendingAlpha3=""] = String(state.pendingCountry ?? "").split(":");
  return `<div class="modal-backdrop"><form class="modal" id="country-form"><div class="module-title">${tr("ИССЛЕДОВАНИЕ НОВОГО РЫНКА","NEW MARKET DISCOVERY")} <button type="button" data-action="close-country">×</button></div><h2>${tr("Добавить в экспансию","Add to expansion")}</h2><p>${tr("Страна начнёт с нулевой глубины проникновения в режиме исследования. Расходы, публикации и внешние подключения останутся заблокированы.","The country starts at zero penetration in discovery mode. Spending, publishing and external connections remain blocked.")}</p><input type="hidden" name="worldCode" value="${esc(pendingAlpha3)}"><label>${tr("СТРАНА","COUNTRY")}<select name="country" required><option value="">${tr("Выберите страну","Select a country")}</option>${countryCatalog.map(item=>`<option value="${item.code}" ${existing.has(item.code)?"disabled":""} ${pendingAlpha2===item.code?"selected":""}>${esc(item.name)} (${item.code})</option>`).join("")}</select></label><label>${tr("БРЕНД","BRAND")}<select name="brand" required>${brandOptions()}</select></label><label>${tr("НАПРАВЛЕНИЕ ДЕЯТЕЛЬНОСТИ","ACTIVITY")}<input name="activity" required placeholder="${tr("Например: аренда коммерческого транспорта","For example: commercial vehicle rental")}"></label><div class="modal-actions"><button type="button" data-action="close-country">${tr("ОТМЕНА","CANCEL")}</button><button type="submit">${tr("ДОБАВИТЬ В ЭКСПАНСИЮ","ADD TO EXPANSION")}</button></div></form></div>`;
}

function areaModal() {
  const area = state.pendingArea;
  const exists = state.expansionAreas.some((item)=>item.countryCode===area.countryCode && item.adminUnitId===area.adminUnitId);
  return `<div class="modal-backdrop"><form class="modal" id="area-form"><div class="module-title">${tr("УПРАВЛЕНИЕ ТЕРРИТОРИЕЙ","TERRITORY CONTROL")} <button type="button" data-action="close-area">×</button></div><h2>${esc(area.name)}</h2><p>${tr("Территория будет добавлена как исследуемая зона. Система подготовит следующий административный уровень, но не запустит расходы или публикации.","The territory will be added as a discovery area. The system will prepare the next administrative level without spending or publishing.")}</p><dl><div><dt>${tr("ТИП ЕДИНИЦЫ","UNIT TYPE")}</dt><dd>${esc(area.unitType)}</dd></div><div><dt>${tr("СТАТУС","STATUS")}</dt><dd>${exists?tr("УЖЕ В ЭКСПАНСИИ","ALREADY IN EXPANSION"):"DISCOVERY"}</dd></div></dl><label>${tr("БРЕНД","BRAND")}<select name="brand" required>${brandOptions()}</select></label><div class="modal-actions"><button type="button" data-action="close-area">${tr("ОТМЕНА","CANCEL")}</button><button type="button" data-route="${esc(area.route)}">${tr("ОТКРЫТЬ ГЛУБИНУ","OPEN DRILL-DOWN")}</button>${exists?"":`<button type="submit">${tr("ДОБАВИТЬ ТЕРРИТОРИЮ","ADD TERRITORY")}</button>`}</div></form></div>`;
}

function brandModal() {
  return `<div class="modal-backdrop"><form class="modal brand-modal" id="brand-form"><div class="module-title">${tr("ПАСПОРТ БРЕНДА","BRAND INTAKE")} <button type="button" data-action="close-brand">×</button></div><h2>${tr("Добавить бренд в фабрику","Add a brand to the factory")}</h2><p>${tr("Система использует этот контекст для построения контракта роста, исследования рынков, выбора каналов и метрик. Новый бренд начинает в DISCOVERY без внешних действий.","The factory uses this context to form a growth contract, scout markets, choose channels and metrics. New brands start in DISCOVERY with no external execution.")}</p><div class="form-grid"><label>${tr("НАЗВАНИЕ","NAME")}<input name="name" required minlength="2" placeholder="Acme"></label><label>${tr("ТИП ПРОДУКТА","PRODUCT ARCHETYPE")}<select name="archetype" required><option value="LOCAL_TWO_SIDED_MARKETPLACE">${tr("Локальный двусторонний маркетплейс","Local two-sided marketplace")}</option><option value="INTERNATIONAL_NEIGHBORHOOD_MARKETPLACE">${tr("Международный соседский маркетплейс","International neighborhood marketplace")}</option><option value="CONTENT_IP_PORTFOLIO">${tr("Контент и интеллектуальная собственность","Content and IP portfolio")}</option><option value="TRAVEL_PLATFORM">${tr("Платформа путешествий","Travel platform")}</option><option value="RECURRING_UTILITY">${tr("Регулярный цифровой сервис","Recurring utility")}</option><option value="OTHER">${tr("Другая модель","Other model")}</option></select></label><label>${tr("ЧТО ПРЕДЛАГАЕТ ПРОДУКТ","OFFERING")}<textarea name="offering" required placeholder="${tr("Продукт или услуга и решаемая проблема","Product, service and problem solved")}"></textarea></label><label>${tr("ДЛЯ КОГО","TARGET AUDIENCE")}<textarea name="audience" required placeholder="${tr("Покупатели, поставщики, сегменты","Buyers, suppliers and segments")}"></textarea></label><label>${tr("БИЗНЕС-МОДЕЛЬ","BUSINESS MODEL")}<input name="businessModel" required placeholder="${tr("Комиссия, подписка, продажа…","Commission, subscription, sale…")}"></label><label>${tr("ГЛАВНОЕ ЦЕННОСТНОЕ СОБЫТИЕ","PRIMARY VALUE EVENT")}<input name="primaryValueEvent" required placeholder="completed_booking"></label><label class="form-span">${tr("ЗАДАЧИ БРЕНДА","BRAND OBJECTIVES")}<textarea name="objectives" required placeholder="${tr("Например: проверить спрос; привлечь поставщиков; выйти в новый штат","For example: validate demand; acquire suppliers; enter a new state")}"></textarea></label><label>${tr("ЦЕЛЕВЫЕ ГЕОГРАФИИ","TARGET GEOGRAPHIES")}<input name="targetGeographies" required placeholder="US, CZ, EU"></label><label>${tr("ЯЗЫКИ","LANGUAGES")}<input name="languages" required placeholder="ru, en"></label><label class="form-span">${tr("ОГРАНИЧЕНИЯ И ЗАПРЕТЫ","CONSTRAINTS AND PROHIBITIONS")}<textarea name="constraints" placeholder="${tr("Регулирование, запрещённые claims, возрастные ограничения, риски","Regulation, prohibited claims, age restrictions and risks")}"></textarea></label></div><div class="modal-actions"><button type="button" data-action="close-brand">${tr("ОТМЕНА","CANCEL")}</button><button type="submit">${tr("СОЗДАТЬ ПРОФИЛЬ БРЕНДА","CREATE BRAND PROFILE")}</button></div></form></div>`;
}

function navigate(route) { history.pushState({},"",route); render(); window.scrollTo(0,0); }
document.addEventListener("click", async (event) => {
  const target = event.target.closest("[data-route],[data-geo-action],button"); if (!target) return;
  if (target.dataset.geoAction === "add-expansion") { state.pendingCountry=String(target.dataset.geoCode ?? ""); state.addCountry=true; render(); return; }
  if (target.dataset.geoAction === "inspect-area") { try { state.pendingArea=JSON.parse(decodeURIComponent(String(target.dataset.geoArea ?? ""))); render(); } catch { state.notice=tr("Не удалось прочитать территорию","Unable to read territory"); render(); } return; }
  if (target.dataset.route) { navigate(target.dataset.route); return; }
  if (target.matches('button[type="submit"]')) return;
  try {
    if (target.dataset.action === "executive") { await sendCommand({kind:"SET_EXECUTIVE_VIEW",enabled:!state.executive}); state.notice=tr(state.executive?"Включён обзор для владельца":"Включён рабочий обзор",state.executive?"Executive view enabled":"Operator view enabled"); }
    if (target.dataset.action === "locale") { await sendCommand({kind:"SET_LOCALE",locale:state.locale==="RU"?"EN":"RU"}); state.notice=tr("Выбран русский язык","English interface selected"); }
    if (target.dataset.action === "filter") { const values=["ВСЕ","RIGZIP","EVORIOS","TRAVEL"]; const filter=values[(values.indexOf(state.selectedFilter)+1)%values.length]; await sendCommand({kind:"SET_FILTER",filter}); state.notice=tr(`Выбран фильтр: ${state.selectedFilter}`,`Filter selected: ${state.selectedFilter}`); }
    if (target.dataset.action === "refresh") { await sendCommand({kind:"REFRESH_READ_MODELS"}); state.notice=tr("Данные обновлены локально. Внешние вызовы не выполнялись","Read models refreshed locally. No external calls were made"); }
    if (target.dataset.region) { state.selectedRegion=target.dataset.region; state.notice=tr("Географический охват изменён","Geographic scope changed"); }
  if (target.dataset.action === "add-country") state.addCountry=true;
  if (target.dataset.action === "add-brand") state.addBrand=true;
  if (target.dataset.action === "close-country") { state.addCountry=false; state.pendingCountry=null; }
    if (target.dataset.action === "close-brand") state.addBrand=false;
    if (target.dataset.action === "close-area") state.pendingArea=null;
    if (target.dataset.action === "approve") { await sendCommand({kind:"RESOLVE_DECISION",outcome:"APPROVED"}); state.notice=tr("Решение сохранено в режиме проверки. Средства не перемещались","Dry-run approval recorded. No funds moved"); }
    if (target.dataset.action === "reject") { await sendCommand({kind:"RESOLVE_DECISION",outcome:"REJECTED"}); state.notice=tr("Предложение отклонено и сохранено локально","Proposal rejected and recorded locally"); }
  } catch (error) { state.notice = `COMMAND REJECTED: ${error.message}`; }
  render(); setTimeout(()=>{state.notice="";render();},2200);
});
document.addEventListener("submit", async (event) => {
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
]).then(([registry,readModel,geographyRegistry,catalog,runtime])=>{screens=registry.screens;control=readModel;geographies=geographyRegistry.geographies;countryCatalog=catalog.countries;applyRuntime(runtime);render();}).catch(error=>{document.getElementById("app").innerHTML=`<div class="fatal">CONTROL ROOM UNAVAILABLE<br>${esc(error.message)}</div>`;});
