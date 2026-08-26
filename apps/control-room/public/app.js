import { blueprints } from "/screen-blueprints.js";
import { renderChoropleths } from "/map.js";

const state = { executive:false, locale:"RU", notice:"", decisions:3, selectedFilter:"ВСЕ", addCountry:false, addedMarkets:[], version:0 };
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
  command: { source:"/data/maps/us-states.geojson", mode:"states", base:"/markets/united-states", attribution:"US Census Bureau · 2024" },
  markets: { source:"/data/maps/us-states.geojson", mode:"states", base:"/markets/united-states", attribution:"US Census Bureau · 2024" },
  nebraska: { source:"/data/maps/nebraska-counties.geojson", mode:"counties", base:"/markets/nebraska", attribution:"US Census Bureau · 2024" },
  czechia: { source:"/data/maps/czechia-regions.geojson", mode:"regions", base:"/markets/czechia", attribution:"geoBoundaries · 2021 · CC BY 4.0" },
  italy: { source:"/data/maps/italy-regions.geojson", mode:"regions", base:"/markets/italy", attribution:"geoBoundaries · 2023 · CC BY 3.0" },
  colombia: { source:"/data/maps/colombia-departments.geojson", mode:"regions", base:"/markets/colombia", attribution:"geoBoundaries · 2017 · ODbL 1.0" },
};
const mapPanelConfig = {
  command: { title:"ТОПОЛОГИЯ РЫНОЧНЫХ СИГНАЛОВ ПО ШТАТАМ", segment:"ВСЕ НАПРАВЛЕНИЯ", pills:["RigZip","Evorios","Travel","Navigator"] },
  markets: { title:"ТОПОЛОГИЯ ПРОНИКНОВЕНИЯ ПО ШТАТАМ", segment:"ВСЕ НАПРАВЛЕНИЯ", pills:["RigZip","Evorios","Travel","Navigator"] },
  nebraska: { title:"ТОПОЛОГИЯ ПРОНИКНОВЕНИЯ ПО КАУНТИ", segment:"Construction / Logistics", pills:["Trailers","Agriculture","Equipment","Contractors","Fleet"] },
  czechia: { title:"ТОПОЛОГИЯ ПРОНИКНОВЕНИЯ ПО КРАЯМ", segment:"Товары для дома / Маркетплейсы", pills:["Товары для дома","Маркетплейсы","Логистика","Фуд","Финансы"] },
  italy: { title:"ТОПОЛОГИЯ ПРОНИКНОВЕНИЯ ПО РЕГИОНАМ", segment:"Delivery / Logistics", pills:["Delivery","Логистика","Ритейл","Ф&Б","HoReCa"] },
  colombia: { title:"ТОПОЛОГИЯ ПРОНИКНОВЕНИЯ ПО ДЕПАРТАМЕНТАМ", segment:"Продукты питания / Фреш-доставка", pills:["Продукты питания","Фреш-доставка","Ритейл","Фарма","Агро"] },
};

const esc = (value) => String(value).replace(/[&<>'"]/g, (char) => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"})[char]);
const tr = (ru, en) => state.locale === "RU" ? ru : en;
const pendingDecisionLabel = (count) => state.locale === "EN" ? `${count} ${count === 1 ? "decision" : "decisions"} pending` : `${count} ${count === 1 ? "решение ожидает" : count < 5 ? "решения ожидают" : "решений ожидают"}`;
function applyRuntime(runtime) {
  state.executive = runtime.executive;
  state.locale = runtime.locale;
  state.decisions = runtime.openDecisions;
  state.selectedFilter = runtime.selectedFilter;
  state.addedMarkets = runtime.discoveryMarkets.map((market) => ({ ...market, administrativeLevels:["country","subdivision"], supportedActivityDimensions:[market.activity] }));
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
      ? `<div class="geo-vector" data-geo-source="${interactive.source}" data-geo-mode="${interactive.mode}" data-geo-base="${interactive.base}" data-geo-attribution="${interactive.attribution}"></div>`
      : asset
      ? `<img src="${asset}" alt="${esc(panel.title)}: административные границы" loading="eager">`
      : `<div class="boundary-pending"><b>ГРАНИЦЫ ЗАГРУЖАЮТСЯ</b><span>Система определяет принятый административный уровень и проверяет набор полигонов перед публикацией.</span><small>DISCOVERY · NO SYNTHETIC CELLS</small></div>`;
    const config = mapPanelConfig[screen.key] ?? { title:panel.title, segment:"ALL MARKETCELLS", pills:[] };
    const controls = interactive ? `<div class="map-controls"><div class="map-control-block"><b>АНАЛИТИЧЕСКИЙ СЛОЙ: OPPORTUNITY</b><div>${["Opportunity","Evidence","Traction","Penetration","Marginal Response","Liquidity","Saturation"].map((label,index)=>`<button class="map-chip ${index===0?"selected":""}" type="button">${label}</button>`).join("")}</div></div><div class="map-control-block segment-control"><b>СЕГМЕНТ MARKETCELL: ${esc(config.segment)}</b><div>${config.pills.map((label,index)=>`<button class="map-chip ${index===0?"selected":""}" type="button">${esc(label)}</button>`).join("")}</div></div></div>` : "";
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

function render() {
  const screen = current();
  if (!screen) return;
  const blueprint = blueprints[screen.key] ?? blueprints.command;
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
    <div class="stats-ribbon"><span>5 БРЕНДОВ • 87 ЯЧЕЕК • 8 КАНАЛОВ • $684K КАПИТАЛ</span><b>DRY RUN / LOCAL GOVERNED STATE</b></div>
    <div class="workspace">
      <aside class="side-nav"><small>НАВИГАЦИЯ</small>${groups.map(([label,keys])=>`<details ${keys.includes(screen.key)?"open":""}><summary>${label}<i>⌄</i></summary><section>${keys.map(key=>{const item=byKey(key);return item?`<button class="${item.key===screen.key?"active":""}" data-route="${item.route}">${esc(item.title)}<span>${String(item.order).padStart(2,"0")}</span></button>`:""}).join("")}</section></details>`).join("")}<div class="health"><span>ЗДОРОВЬЕ <b>99.97%</b></span><span>ПОЛИТИКИ <b>GATED</b></span><span>РЕЖИМ <b>DRY RUN</b></span></div></aside>
      <main>
        <div class="page-head"><div><p>${screen.domain} / SCREEN ${String(screen.order).padStart(2,"0")}</p><h1>${esc(screen.title)}</h1><span>${esc(blueprint.subtitle)}</span></div><div class="head-actions">${screen.domain==="MARKET"?'<button class="primary" data-action="add-country">＋ ДОБАВИТЬ СТРАНУ</button>':""}<button data-action="filter">${state.selectedFilter} ▾</button><button data-action="refresh">ОБНОВИТЬ</button></div></div>
        <div class="metric-ribbon">${blueprint.metrics.map(([label,value])=>`<div><small>${esc(label)}</small><b>${esc(value)}</b><span>факт</span></div>`).join("")}</div>
        ${screen.key === "command" ? commandCenterMarkup(screen, blueprint) : productionScreens[screen.key] ? productionSurfaceMarkup(screen) : `<div class="screen-grid ${state.executive?"executive-grid":""}">${blueprint.panels.map(panel=>panelMarkup(panel,screen)).join("")}</div>`}
        <section class="linked"><div class="module-title">СВЯЗАННЫЕ ПОВЕРХНОСТИ <span>INTERACTION GRAPH</span></div>${screen.linksTo.map(key=>{const item=byKey(key);return item?`<button data-route="${item.route}"><small>${String(item.order).padStart(2,"0")}</small><b>${esc(item.title)}</b><span>${item.domain} →</span></button>`:""}).join("")}</section>
      </main>
    </div>
    <footer><span>АКТИВНЫХ ОПЕРАЦИЙ: 237</span><span>ОЧЕРЕДИ: 12</span><span>ОШИБКИ: 2</span><span>ПОЛИТИКИ: GATED</span><b>OWN THE LOGIC. RENT THE CAPABILITY.</b></footer>
    ${state.addCountry?countryModal():""}
    ${state.notice?`<div class="toast"><i>✓</i><span><b>${tr("ДЕЙСТВИЕ ЗАПИСАНО","ACTION RECORDED")}</b><small>${esc(state.notice)}</small></span></div>`:""}`;
  renderChoropleths().catch((error) => { state.notice = error.message; });
}

function countryModal() {
  const existing = new Set([...geographies,...state.addedMarkets].map(item=>item.countryCode));
  return `<div class="modal-backdrop"><form class="modal" id="country-form"><div class="module-title">${tr("ИССЛЕДОВАНИЕ НОВОГО РЫНКА","NEW MARKET DISCOVERY")} <button type="button" data-action="close-country">×</button></div><h2>${tr("Добавить страну","Add a country")}</h2><p>${tr("Страна добавляется в режиме исследования. Расходы, публикации и внешние подключения останутся заблокированы.","The country starts in discovery mode. Spending, publishing and external connections remain blocked.")}</p><label>${tr("СТРАНА","COUNTRY")}<select name="country" required><option value="">${tr("Выберите страну","Select a country")}</option>${countryCatalog.map(item=>`<option value="${item.code}" ${existing.has(item.code)?"disabled":""}>${esc(item.name)} (${item.code})</option>`).join("")}</select></label><label>${tr("БРЕНД","BRAND")}<select name="brand" required><option>RigZip</option><option>Evorios</option><option>Books</option><option>Travel</option><option>Smart Navigator</option></select></label><label>${tr("НАПРАВЛЕНИЕ ДЕЯТЕЛЬНОСТИ","ACTIVITY")}<input name="activity" required placeholder="${tr("Например: аренда коммерческого транспорта","For example: commercial vehicle rental")}"></label><div class="modal-actions"><button type="button" data-action="close-country">${tr("ОТМЕНА","CANCEL")}</button><button type="submit">${tr("ДОБАВИТЬ ДЛЯ ИССЛЕДОВАНИЯ","START DISCOVERY")}</button></div></form></div>`;
}

function navigate(route) { history.pushState({},"",route); render(); window.scrollTo(0,0); }
document.addEventListener("click", async (event) => {
  const target = event.target.closest("[data-route],button"); if (!target) return;
  if (target.dataset.route) { navigate(target.dataset.route); return; }
  try {
    if (target.dataset.action === "executive") { await sendCommand({kind:"SET_EXECUTIVE_VIEW",enabled:!state.executive}); state.notice=tr(state.executive?"Включён обзор для владельца":"Включён рабочий обзор",state.executive?"Executive view enabled":"Operator view enabled"); }
    if (target.dataset.action === "locale") { await sendCommand({kind:"SET_LOCALE",locale:state.locale==="RU"?"EN":"RU"}); state.notice=tr("Выбран русский язык","English interface selected"); }
    if (target.dataset.action === "filter") { const values=["ВСЕ","RIGZIP","EVORIOS","TRAVEL"]; const filter=values[(values.indexOf(state.selectedFilter)+1)%values.length]; await sendCommand({kind:"SET_FILTER",filter}); state.notice=tr(`Выбран фильтр: ${state.selectedFilter}`,`Filter selected: ${state.selectedFilter}`); }
    if (target.dataset.action === "refresh") { await sendCommand({kind:"REFRESH_READ_MODELS"}); state.notice=tr("Данные обновлены локально. Внешние вызовы не выполнялись","Read models refreshed locally. No external calls were made"); }
  if (target.dataset.action === "add-country") state.addCountry=true;
  if (target.dataset.action === "close-country") state.addCountry=false;
    if (target.dataset.action === "approve") { await sendCommand({kind:"RESOLVE_DECISION",outcome:"APPROVED"}); state.notice=tr("Решение сохранено в режиме проверки. Средства не перемещались","Dry-run approval recorded. No funds moved"); }
    if (target.dataset.action === "reject") { await sendCommand({kind:"RESOLVE_DECISION",outcome:"REJECTED"}); state.notice=tr("Предложение отклонено и сохранено локально","Proposal rejected and recorded locally"); }
  } catch (error) { state.notice = `COMMAND REJECTED: ${error.message}`; }
  render(); setTimeout(()=>{state.notice="";render();},2200);
});
document.addEventListener("submit", async (event) => {
  if (event.target.id !== "country-form") return;
  event.preventDefault();
  const form = new FormData(event.target);
  const code = String(form.get("country") ?? "");
  const catalogItem = countryCatalog.find(item=>item.code===code);
  if (!catalogItem) return;
  const slug = catalogItem.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-zа-я0-9]+/gi,"-").replace(/^-|-$/g,"");
  const market = { countryCode:code, countryName:catalogItem.name, slug, activity:String(form.get("activity")), status:"DISCOVERY", brand:String(form.get("brand")) };
  try {
    await sendCommand({kind:"ADD_DISCOVERY_MARKET",market});
    state.addCountry=false;
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
