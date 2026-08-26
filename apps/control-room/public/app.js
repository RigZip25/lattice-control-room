import { blueprints } from "/screen-blueprints.js";
import { renderChoropleths } from "/map.js";

const savedMarkets = JSON.parse(localStorage.getItem("lattice.discovery-markets") ?? "[]");
const state = { executive:false, locale:"RU", notice:"", decisions:3, selectedFilter:"ВСЕ", addCountry:false, addedMarkets:savedMarkets };
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
  command: { source:"/data/maps/us-states.geojson", mode:"states" },
  markets: { source:"/data/maps/us-states.geojson", mode:"states" },
  nebraska: { source:"/data/maps/nebraska-counties.geojson", mode:"counties" },
};

const esc = (value) => String(value).replace(/[&<>'"]/g, (char) => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"})[char]);
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
  if (panel.kind === "flow") return `<article class="module module-wide"><div class="module-title">${esc(panel.title)}<span>LIVE</span></div><div class="flowline">${panel.rows.map((row,index)=>`<button data-route="${esc(byKey(screen.linksTo[index % screen.linksTo.length])?.route ?? screen.route)}"><i>${String(index+1).padStart(2,"0")}</i>${esc(row)}</button>`).join("<em>→</em>")}</div></article>`;
  if (panel.kind === "map") {
    const interactive = screen.figmaNodeId === "PARAMETERIZED_GEOGRAPHIC_DRILLDOWN" ? null : interactiveMaps[screen.key];
    const asset = screen.figmaNodeId === "PARAMETERIZED_GEOGRAPHIC_DRILLDOWN" ? null : referenceMapAssets[screen.key];
    const map = interactive
      ? `<div class="geo-vector" data-geo-source="${interactive.source}" data-geo-mode="${interactive.mode}"></div>`
      : asset
      ? `<img src="${asset}" alt="${esc(panel.title)}: административные границы" loading="eager">`
      : `<div class="boundary-pending"><b>ГРАНИЦЫ ЗАГРУЖАЮТСЯ</b><span>Система определяет принятый административный уровень и проверяет набор полигонов перед публикацией.</span><small>DISCOVERY · NO SYNTHETIC CELLS</small></div>`;
    return `<article class="module map-module"><div class="module-title">${esc(panel.title)}<span>ADMINISTRATIVE BOUNDARIES</span></div><div class="geo-map">${map}</div><div class="module-rows">${rows}</div></article>`;
  }
  if (panel.kind === "bars") return `<article class="module"><div class="module-title">${esc(panel.title)}<span>FORECAST</span></div><div class="bars">${panel.rows.map((row,index)=>`<div><label>${esc(row)}</label><i><b class="bar-${Math.min(index,5)}"></b></i></div>`).join("")}</div></article>`;
  if (panel.kind === "decisions") return `<article class="module decisions"><div class="module-title">${esc(panel.title)}<span>${state.decisions}</span></div>${panel.rows.map((row,index)=>`<div class="decision"><small>REQUIRES AUTHORITY</small><b>${esc(row)}</b><div><button data-action="approve" data-index="${index}">ОДОБРИТЬ</button><button data-action="reject" data-index="${index}">ОТКЛОНИТЬ</button><button data-route="${esc(byKey(screen.linksTo[index % screen.linksTo.length])?.route ?? screen.route)}">ПОДРОБНЕЕ</button></div></div>`).join("")}</article>`;
  return `<article class="module"><div class="module-title">${esc(panel.title)}<span>FACT</span></div><div class="module-rows">${rows}</div></article>`;
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
      <div class="factory-state"><i></i> ФАБРИКА АКТИВНА</div>
      <button class="attention" data-route="/owner">${state.decisions} РЕШЕНИЯ ТРЕБУЮТ ВНИМАНИЯ</button>
      <div class="signal"><small>ЛУЧШИЙ СЛЕД. $100</small><b>RigZip / Nebraska → +87 рег.</b><span>83% · прогноз</span></div>
      <div class="signal"><small>ЛУЧШИЙ СЛЕД. $1,000</small><b>Evorios / Czechia → +312 рег.</b><span>79% · прогноз</span></div>
      <div class="capital-mini"><small>КАПИТАЛ В РАБОТЕ</small><b>$684K</b></div>
      <button class="exec ${state.executive?"on":""}" data-action="executive">Executive View</button>
      <button class="locale" data-action="locale">${state.locale} | ${state.locale==="RU"?"EN":"RU"}</button>
      <span class="avatar">OP</span>
    </header>
    <div class="stats-ribbon"><span>5 БРЕНДОВ • 87 ЯЧЕЕК • 8 КАНАЛОВ • $684K КАПИТАЛ</span><b>DRY RUN / LOCAL GOVERNED STATE</b></div>
    <div class="workspace">
      <aside class="side-nav"><small>НАВИГАЦИЯ</small>${groups.map(([label,keys])=>`<section><label>${label}</label>${keys.map(key=>{const item=byKey(key);return item?`<button class="${item.key===screen.key?"active":""}" data-route="${item.route}">${esc(item.title)}<span>${String(item.order).padStart(2,"0")}</span></button>`:""}).join("")}</section>`).join("")}<div class="health"><span>ЗДОРОВЬЕ <b>99.97%</b></span><span>ПОЛИТИКИ <b>GATED</b></span><span>РЕЖИМ <b>DRY RUN</b></span></div></aside>
      <main>
        <div class="page-head"><div><p>${screen.domain} / SCREEN ${String(screen.order).padStart(2,"0")}</p><h1>${esc(screen.title)}</h1><span>${esc(blueprint.subtitle)}</span></div><div class="head-actions">${screen.domain==="MARKET"?'<button class="primary" data-action="add-country">＋ ДОБАВИТЬ СТРАНУ</button>':""}<button data-action="filter">${state.selectedFilter} ▾</button><button data-action="refresh">ОБНОВИТЬ</button></div></div>
        <div class="metric-ribbon">${blueprint.metrics.map(([label,value])=>`<div><small>${esc(label)}</small><b>${esc(value)}</b><span>факт</span></div>`).join("")}</div>
        <div class="screen-grid ${state.executive?"executive-grid":""}">${blueprint.panels.map(panel=>panelMarkup(panel,screen)).join("")}</div>
        <section class="linked"><div class="module-title">СВЯЗАННЫЕ ПОВЕРХНОСТИ <span>INTERACTION GRAPH</span></div>${screen.linksTo.map(key=>{const item=byKey(key);return item?`<button data-route="${item.route}"><small>${String(item.order).padStart(2,"0")}</small><b>${esc(item.title)}</b><span>${item.domain} →</span></button>`:""}).join("")}</section>
      </main>
    </div>
    <footer><span>АКТИВНЫХ ОПЕРАЦИЙ: 237</span><span>ОЧЕРЕДИ: 12</span><span>ОШИБКИ: 2</span><span>ПОЛИТИКИ: GATED</span><b>OWN THE LOGIC. RENT THE CAPABILITY.</b></footer>
    ${state.addCountry?countryModal():""}
    ${state.notice?`<div class="toast">${esc(state.notice)}</div>`:""}`;
  renderChoropleths().catch((error) => { state.notice = error.message; });
}

function countryModal() {
  const existing = new Set([...geographies,...state.addedMarkets].map(item=>item.countryCode));
  return `<div class="modal-backdrop"><form class="modal" id="country-form"><div class="module-title">NEW MARKET DISCOVERY <button type="button" data-action="close-country">×</button></div><h2>Добавить страну</h2><p>География создаётся в discovery-режиме. Расходы и внешние подключения остаются заблокированы.</p><label>СТРАНА<select name="country" required><option value="">Выберите страну</option>${countryCatalog.map(item=>`<option value="${item.code}" ${existing.has(item.code)?"disabled":""}>${esc(item.name)} (${item.code})</option>`).join("")}</select></label><label>БРЕНД<select name="brand" required><option>RigZip</option><option>Evorios</option><option>Books</option><option>Travel</option><option>Smart Navigator</option></select></label><label>НАПРАВЛЕНИЕ<input name="activity" required placeholder="Например: commercial transport"></label><div class="modal-actions"><button type="button" data-action="close-country">ОТМЕНА</button><button type="submit">СОЗДАТЬ DISCOVERY MARKET</button></div></form></div>`;
}

function navigate(route) { history.pushState({},"",route); render(); window.scrollTo(0,0); }
document.addEventListener("click", (event) => {
  const target = event.target.closest("[data-route],button"); if (!target) return;
  if (target.dataset.route) { navigate(target.dataset.route); return; }
  if (target.dataset.action === "executive") { state.executive=!state.executive; state.notice=state.executive?"EXECUTIVE VIEW ENABLED":"OPERATOR VIEW ENABLED"; }
  if (target.dataset.action === "locale") { state.locale=state.locale==="RU"?"EN":"RU"; state.notice="LANGUAGE LAYER SWITCHED"; }
  if (target.dataset.action === "filter") { const values=["ВСЕ","RIGZIP","EVORIOS","TRAVEL"]; state.selectedFilter=values[(values.indexOf(state.selectedFilter)+1)%values.length]; state.notice=`FILTER: ${state.selectedFilter}`; }
  if (target.dataset.action === "refresh") state.notice="READ MODELS REFRESHED / NO EXTERNAL CALLS";
  if (target.dataset.action === "add-country") state.addCountry=true;
  if (target.dataset.action === "close-country") state.addCountry=false;
  if (target.dataset.action === "approve") { state.decisions=Math.max(0,state.decisions-1); state.notice="DRY-RUN APPROVAL RECORDED / NO FUNDS MOVED"; }
  if (target.dataset.action === "reject") { state.decisions=Math.max(0,state.decisions-1); state.notice="PROPOSAL REJECTED IN LOCAL STATE"; }
  render(); setTimeout(()=>{state.notice="";render();},2200);
});
document.addEventListener("submit", (event) => {
  if (event.target.id !== "country-form") return;
  event.preventDefault();
  const form = new FormData(event.target);
  const code = String(form.get("country") ?? "");
  const catalogItem = countryCatalog.find(item=>item.code===code);
  if (!catalogItem) return;
  const slug = catalogItem.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-zа-я0-9]+/gi,"-").replace(/^-|-$/g,"");
  const market = { countryCode:code, countryName:catalogItem.name, slug, administrativeLevels:["country","subdivision"], supportedActivityDimensions:[String(form.get("activity"))], status:"DISCOVERY", brand:String(form.get("brand")) };
  state.addedMarkets.push(market);
  localStorage.setItem("lattice.discovery-markets",JSON.stringify(state.addedMarkets));
  state.addCountry=false;
  navigate(`/markets/${slug}`);
  state.notice=`${catalogItem.name}: DISCOVERY MARKET CREATED`;
  render();
});
addEventListener("popstate", render);

Promise.all([
  fetch("/api/v1/screens").then(response=>response.json()),
  fetch("/api/v1/control-room").then(response=>response.json()),
  fetch("/api/v1/geographies").then(response=>response.json()),
  fetch("/api/v1/country-catalog").then(response=>response.json()),
]).then(([registry,readModel,geographyRegistry,catalog])=>{screens=registry.screens;control=readModel;geographies=geographyRegistry.geographies;countryCatalog=catalog.countries;render();}).catch(error=>{document.getElementById("app").innerHTML=`<div class="fatal">CONTROL ROOM UNAVAILABLE<br>${esc(error.message)}</div>`;});
