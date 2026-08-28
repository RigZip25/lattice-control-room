import { blueprints } from "/screen-blueprints.js";
import { renderChoropleths } from "/map.js";

const state = { executive:false, locale:"RU", notice:"", noticeTone:"success", noticeModal:false, analysisRun:null, decisions:0, selectedFilter:"ВСЕ", selectedRegion:"WORLD", mobileNav:false, welcome:location.pathname==="/", factoryStatus:null, backendStatus:null, authOpen:false, session:null, cloudContext:null, addCountry:false, addBrand:false, duplicateBrand:null, editBrandId:null, analystBrandId:null, analystPending:false, pendingAnalystMessage:null, pendingAnalystQuestion:null, analystSeconds:30, addSource:false, addDiagnosis:false, addThesis:false, pendingCountry:null, pendingArea:null, addedMarkets:[], expansionAreas:[], brandProfiles:[], productUnderstandings:[], productSources:[], productEvidence:[], productDiagnoses:[], expansionTheses:[], activationSprints:[], executionCycles:[], dryRunPending:false, version:0 };
let noticeTimer;
let analysisClock;
let analystClock;
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
const activeCountrySpec = () => state.addedMarkets.filter((market)=>market.worldCode).map((market)=>({country:market.worldCode,brand:market.brand.toUpperCase(),penetration:Number(market.penetration??0)})).filter((market)=>state.selectedFilter === "ВСЕ" || market.brand === state.selectedFilter).map((market)=>`${market.country}:${market.penetration}`).join(",");

const esc = (value) => String(value).replace(/[&<>'"]/g, (char) => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"})[char]);
const tr = (ru, en) => state.locale === "RU" ? ru : en;
const brandOptions = () => state.brandProfiles.map((brand)=>`<option value="${esc(brand.id)}">${esc(brand.name)}</option>`).join("");
const pendingDecisionLabel = (count) => state.locale === "EN" ? `${count} ${count === 1 ? "decision" : "decisions"} pending` : `${count} ${count === 1 ? "решение ожидает" : count < 5 ? "решения ожидают" : "решений ожидают"}`;
function applyRuntime(runtime) {
  state.executive = runtime.executive;
  state.locale = runtime.locale;
  state.decisions = runtime.openDecisions;
  state.selectedFilter = runtime.selectedFilter;
  state.addedMarkets = runtime.discoveryMarkets.map((market) => ({ ...market, administrativeLevels:["country","subdivision"], supportedActivityDimensions:[market.activity] }));
  state.expansionAreas = runtime.expansionAreas ?? [];
  state.brandProfiles = runtime.brandProfiles ?? [];
  state.productUnderstandings = runtime.productUnderstandings ?? [];
  state.productSources = runtime.productSources ?? [];
  state.productEvidence = runtime.productEvidence ?? [];
  state.productDiagnoses = runtime.productDiagnoses ?? [];
  state.expansionTheses = runtime.expansionTheses ?? [];
  state.activationSprints = runtime.activationSprints ?? [];
  state.executionCycles = runtime.executionCycles ?? [];
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
    productUnderstandings:state.productUnderstandings,
    productSources:state.productSources,
    productEvidence:state.productEvidence,
    productDiagnoses:state.productDiagnoses,
    expansionTheses:state.expansionTheses,
    activationSprints:state.activationSprints,
    executionCycles:state.executionCycles,
    events:[],
  };
  const response = await fetch("/api/v1/commands", { method:"POST", headers, body:JSON.stringify({command,currentState}) });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error ?? "Command rejected");
  applyRuntime(payload);
}
async function runWebsiteResearch(brandId) {
  const headers={"Content-Type":"application/json"};
  if (state.session?.access_token) headers.Authorization=`Bearer ${state.session.access_token}`;
  const currentState={version:state.version,mode:"DRY_RUN",executive:state.executive,locale:state.locale,selectedFilter:state.selectedFilter,openDecisions:state.decisions,discoveryMarkets:state.addedMarkets.map(({administrativeLevels,supportedActivityDimensions,...market})=>market),expansionAreas:state.expansionAreas,brandProfiles:state.brandProfiles,productUnderstandings:state.productUnderstandings,productSources:state.productSources,productEvidence:state.productEvidence,productDiagnoses:state.productDiagnoses,expansionTheses:state.expansionTheses,activationSprints:state.activationSprints,executionCycles:state.executionCycles,events:[]};
  const response=await fetch("/api/v1/research/website",{method:"POST",headers,body:JSON.stringify({brandId,currentState})});
  const payload=await response.json();
  if (!response.ok) throw new Error(payload.error??"Website research failed");
  applyRuntime(payload);
}
async function startWebsiteAnalysis(brandId) {
  state.notice="";
  state.noticeModal=false;
  state.analysisRun={brandId,status:"RUNNING",error:"",startedAt:Date.now()};
  clearTimeout(noticeTimer);
  render();
  beginAnalysisClock();
  try {
    await runWebsiteResearch(brandId);
    clearInterval(analysisClock);
    state.analysisRun=null;
    state.analystBrandId=brandId;
    state.noticeTone="success";
    state.notice=tr("Изучение завершено. Совет фабрики подготовил выводы.","Research completed. The factory council prepared its findings.");
  } catch(error) {
    clearInterval(analysisClock);
    state.analysisRun={brandId,status:"ERROR",error:error instanceof Error?error.message:tr("Анализ не завершён","Analysis did not complete")};
  }
  render();
}
function beginAnalysisClock() {
  clearInterval(analysisClock);
  const tick=()=>{
    if(state.analysisRun?.status!=="RUNNING"){clearInterval(analysisClock);return;}
    const elapsed=Math.max(0,Math.floor((Date.now()-state.analysisRun.startedAt)/1000));
    const remaining=Math.max(0,60-elapsed);
    const countdown=document.getElementById("analysis-countdown");
    const caption=document.getElementById("analysis-countdown-caption");
    const fill=document.getElementById("analysis-progress-fill");
    if(countdown)countdown.textContent=remaining>0?`${remaining}`:"…";
    if(caption)caption.textContent=remaining>0?tr("СЕКУНД · ОРИЕНТИР","SECONDS · ESTIMATE"):tr("ЗАВЕРШАЕМ ПРОВЕРКУ","FINALIZING VERIFICATION");
    if(fill)fill.style.width=`${Math.min(94,Math.max(4,(elapsed/60)*92))}%`;
    const active=Math.min(3,elapsed<12?0:elapsed<28?1:elapsed<45?2:3);
    document.querySelectorAll(".analysis-live-steps li").forEach((item,index)=>item.classList.toggle("current",index===active));
  };
  tick(); analysisClock=setInterval(tick,1000);
}
function scrollAnalystThread() {
  requestAnimationFrame(()=>{const thread=document.querySelector(".analyst-thread");if(thread)thread.scrollTop=thread.scrollHeight;});
}
function startAnalystClock(){
  clearInterval(analystClock);state.analystSeconds=30;
  analystClock=setInterval(()=>{if(!state.analystPending){clearInterval(analystClock);return;}state.analystSeconds=Math.max(0,state.analystSeconds-1);updateAnalystProgress();},1000);
}
function updateAnalystProgress(){
  const progress=document.querySelector(".analyst-live-progress");if(!progress)return;
  const elapsed=30-state.analystSeconds;const percent=Math.min(96,Math.max(8,(elapsed/30)*100));
  progress.querySelector("i")?.style.setProperty("width",`${percent}%`);
  const timer=progress.querySelector("b");if(timer)timer.textContent=state.analystSeconds>0?tr(`до ${state.analystSeconds} сек.`,`up to ${state.analystSeconds} sec.`):tr("завершаем вывод…","finalizing…");
  const stage=progress.querySelector("span");if(stage)stage.textContent=elapsed<8?tr("Сопоставляем ваш ответ с паспортом продукта","Matching your answer to the product passport"):elapsed<20?tr("Обсуждают PRODUCT · MARKET · GROWTH · FINANCE","PRODUCT · MARKET · GROWTH · FINANCE are discussing"):tr("Формируем решение и следующий вопрос","Preparing the decision and next question");
}
function installAnalystDiscussionState(){
  const intake=state.productUnderstandings.find((item)=>item.brandId===state.analystBrandId);const stored=intake?.analystDialogue??[];
  const owners=[...document.querySelectorAll(".analyst-thread .owner-turn")];
  owners.forEach((owner,index)=>{if(owner.previousElementSibling?.classList.contains("answered-question"))return;const question=index===owners.length-1&&state.analystPending?state.pendingAnalystQuestion:(index===0?tr("Опишите продукт целиком своими словами: что он делает сегодня, а что пока остаётся замыслом?","Describe the whole product: what works today and what remains a concept?"):stored[index-1]?.nextQuestion);if(!question)return;const item=document.createElement("article");item.className="answered-question";item.innerHTML=`<small>${tr("ОТВЕЧЕННЫЙ ВОПРОС","ANSWERED QUESTION")}</small><p>${esc(question)}</p>`;owner.before(item);});
  if(state.analystPending){const card=document.querySelector(".analyst-question");if(card&&!card.querySelector(".analyst-live-progress")){card.classList.add("discussing");card.insertAdjacentHTML("beforeend",`<div class="analyst-live-progress"><span></span><b></b><em><i></i></em></div>`);}updateAnalystProgress();}
}
function installAnalystResetControl() {
  const header=document.querySelector(".analyst-modal>header");
  const close=header?.querySelector('[data-action="close-analyst"]');
  if(!header||!close||header.querySelector('[data-action="reset-analyst-dialogue"]'))return;
  const button=document.createElement("button");
  button.type="button";button.dataset.action="reset-analyst-dialogue";button.dataset.brandId=String(state.analystBrandId??"");button.className="analyst-reset";button.textContent=tr("↻ НАЧАТЬ ОБСУЖДЕНИЕ ЗАНОВО","↻ RESTART DISCUSSION");
  header.insertBefore(button,close);
}
function restoreFailedAnalystAnswer() {
  if(state.analystPending||!state.pendingAnalystMessage)return;
  const form=document.querySelector("#analyst-form");
  const field=form?.querySelector('textarea[name="message"]');
  if(field&&!field.value)field.value=state.pendingAnalystMessage;
  if(form&&state.noticeTone==="error"&&state.notice&&!form.querySelector(".analyst-inline-error")){
    const error=document.createElement("div");error.className="analyst-inline-error";error.textContent=state.notice;form.prepend(error);
  }
}
async function runAnalystDialogue(brandId,userMessage,mode="ANSWER") {
  const headers={"Content-Type":"application/json"};
  if(state.session?.access_token) headers.Authorization=`Bearer ${state.session.access_token}`;
  const currentState={version:state.version,mode:"DRY_RUN",executive:state.executive,locale:state.locale,selectedFilter:state.selectedFilter,openDecisions:state.decisions,discoveryMarkets:state.addedMarkets.map(({administrativeLevels,supportedActivityDimensions,...market})=>market),expansionAreas:state.expansionAreas,brandProfiles:state.brandProfiles,productUnderstandings:state.productUnderstandings,productSources:state.productSources,productEvidence:state.productEvidence,productDiagnoses:state.productDiagnoses,expansionTheses:state.expansionTheses,activationSprints:state.activationSprints,executionCycles:state.executionCycles,events:[]};
  const response=await fetch("/api/v1/research/analyst",{method:"POST",headers,body:JSON.stringify({brandId,userMessage,mode,currentState})});
  const payload=await response.json();
  if(!response.ok) throw new Error(payload.error??"Analyst dialogue failed");
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
    const brandId = decodeURIComponent(location.pathname.split("/")[2] ?? "");
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
  const brandCards=state.brandProfiles.map((brand)=>{
    const understanding=state.productUnderstandings.find((item)=>item.brandId===brand.id);
    const analysis=understanding?.websiteResearch?.analysis;
    const turns=understanding?.analystDialogue?.length??0;
    const sprint=state.activationSprints.find((item)=>item.brandId===brand.id&&item.status==="ACTIVE");
    const stage=sprint?tr("АКТИВАЦИОННЫЙ СПРИНТ","ACTIVATION SPRINT"):analysis?tr("СОВЕТ И СТРАТЕГИЯ","COUNCIL AND STRATEGY"):understanding?tr("ИЗУЧЕНИЕ ПРОДУКТА","PRODUCT INTELLIGENCE"):tr("ПЕРВИЧНЫЕ ДАННЫЕ","INITIAL INTAKE");
    const next=sprint?sprint.firstArtifact:analysis?(turns?tr("Продолжить обсуждение и выбрать следующий ход","Continue the discussion and choose the next move"):tr("Открыть выводы и начать совет","Open findings and begin the council")):understanding?.website?tr("Запустить изучение сайта","Start website research"):tr("Добавить сайт, описание или материалы","Add a website, description or materials");
    return `<article class="owner-brand-card"><header><div><small>${esc(stage)}</small><h2>${esc(brand.name)}</h2></div><span>${sprint?tr("В РАБОТЕ","ACTIVE"):analysis?tr("ИЗУЧЕН","REVIEWED"):tr("ПОДГОТОВКА","PREPARING")}</span></header><p>${esc(analysis?.oneLineSummary??understanding?.ownerDescription??brand.offering)}</p><footer><div><small>${tr("СЛЕДУЮЩИЙ ШАГ","NEXT STEP")}</small><b>${esc(next)}</b></div><button data-action="open-brand" data-brand-id="${esc(brand.id)}">${tr("ПРОДОЛЖИТЬ","CONTINUE")} →</button></footer></article>`;
  }).join("");
  return `<section class="owner-workbench" aria-label="${tr("Рабочий стол владельца","Owner workbench")}"><header class="owner-workbench-head"><div><small>${tr("ФАКТИЧЕСКОЕ СОСТОЯНИЕ · БЕЗ ДЕМО-ДАННЫХ","ACTUAL STATE · NO DEMO DATA")}</small><h2>${tr("Продолжите работу с продуктом","Continue building a product")}</h2><p>${tr("Выберите бренд — фабрика откроет его материалы, выводы совета и следующий управляемый шаг.","Choose a brand to open its materials, council findings and next governed action.")}</p></div><button class="primary" data-action="add-brand">＋ ${tr("ДОБАВИТЬ БРЕНД","ADD BRAND")}</button></header><div class="owner-brand-grid">${brandCards||`<article class="owner-empty"><b>${tr("Начните с первого бренда","Start with your first brand")}</b><p>${tr("Достаточно сайта или короткого описания. Фабрика сама соберёт первичное понимание и предложит обсуждение.","A website or short description is enough. The factory will form an initial understanding and propose a discussion.")}</p><button class="primary" data-action="add-brand">${tr("ДОБАВИТЬ БРЕНД","ADD BRAND")}</button></article>`}</div><aside class="owner-contours"><div><small>01</small><b>${tr("ПРОДУКТ И СОВЕТ","PRODUCT AND COUNCIL")}</b><span>${tr("Работает сейчас","Available now")}</span></div><div><small>02</small><b>${tr("РЫНОЧНАЯ РАЗВЕДКА","MARKET INTELLIGENCE")}</b><span>${tr("После продуктовой гипотезы","After product thesis")}</span></div><div><small>03</small><b>${tr("ПРОТОТИПЫ И КРЕАТИВЫ","PROTOTYPES AND CREATIVES")}</b><span>${tr("Следующий рабочий контур","Next production contour")}</span></div><div><small>04</small><b>${tr("ДИСТРИБУЦИЯ И ОБУЧЕНИЕ","DISTRIBUTION AND LEARNING")}</b><span>${tr("Заблокировано в DRY RUN","Blocked in DRY RUN")}</span></div></aside></section>`;
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
  const realBrandRows=state.brandProfiles.map((brand)=>({brandId:brand.id,cells:[brand.name,brand.primaryValueEvent,tr("Исследование продукта","Product intelligence"),tr("Открыть рабочее пространство","Open workspace")]}));
  const brandRegistryEmpty=screen.key==="brands"&&realBrandRows.length===0;
  const rows = screen.key === "brands" ? realBrandRows : spec.rows.map((cells,index)=>({cells,route:byKey(screen.linksTo[index % screen.linksTo.length])?.route ?? screen.route}));
  const registryStatus=screen.key==="brands"?tr(`${realBrandRows.length} БРЕНДОВ В СИСТЕМЕ`,`${realBrandRows.length} BRANDS IN SYSTEM`):spec.status;
  const tableBody=brandRegistryEmpty?`<div class="brand-registry-empty"><i>＋</i><div><b>${tr("В рабочем реестре пока нет брендов","There are no brands in the active registry")}</b><span>${tr("Удалённые проекты не показываются как рабочие. Создайте новый профиль, добавьте сайт или описание — после сохранения карточка откроет маршрут изучения.","Deleted projects are not shown as active. Create a new profile and add a website or description; the saved card will open the research journey.")}</span></div><button class="primary" data-action="add-brand">＋ ${tr("ДОБАВИТЬ БРЕНД","ADD BRAND")}</button></div>`:rows.map((row)=>screen.key==="brands"?`<button class="strategy-row" data-action="open-brand" data-brand-id="${esc(row.brandId)}">${row.cells.map(cell=>`<span>${esc(cell)}</span>`).join("")}</button>`:`<button class="strategy-row" data-route="${esc(row.route)}">${row.cells.map(cell=>`<span>${esc(cell)}</span>`).join("")}</button>`).join("");
  return `<section class="strategy-surface"><header class="strategy-bar"><div><small>${esc(spec.eyebrow)}</small><b>${esc(registryStatus)}</b></div><button data-route="${esc(byKey(spec.next)?.route ?? "/command")}">${esc(spec.action)} →</button></header><div class="strategy-stages">${spec.stages.map(([label,value,note],index)=>`<button data-route="${screen.route}"><i>${String(index+1).padStart(2,"0")}</i><span><small>${esc(label)}</small><b>${screen.key==="brands"&&index===0?realBrandRows.length:esc(value)}</b><em>${esc(note)}</em></span></button>`).join("")}</div><article class="module strategy-table"><div class="module-title">${esc(spec.title)} <span>${tr("ПОД УПРАВЛЕНИЕМ","GOVERNED")}</span></div><div class="strategy-head">${spec.columns.map(column=>`<b>${esc(column)}</b>`).join("")}</div>${tableBody}</article><aside class="module strategy-side"><div class="module-title">${esc(spec.sideTitle)} <span>${tr("ПОЛИТИКА","POLICY")}</span></div><dl>${spec.side.map(([label,value])=>`<div><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`).join("")}</dl><div class="policy-seal"><i></i><span><b>ЛОКАЛЬНЫЙ УПРАВЛЯЕМЫЙ РЕЖИМ</b><small>Без внешнего исполнения и движения средств</small></span></div></aside></section>`;
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

function pendingProductAnalysisMarkup(brand,understanding) {
  return `<article class="module understanding-review pending-analysis"><div class="module-title">${tr("ПЕРВИЧНЫЕ ДАННЫЕ ПРИНЯТЫ","INITIAL INPUT RECEIVED")} <span>${tr("АНАЛИЗ НЕ ЗАВЕРШЁН","ANALYSIS NOT COMPLETE")}</span></div><h2>${tr("LAFWIRON готова начать изучение продукта","LAFWIRON is ready to study the product")}</h2><p>${tr("Система прочитает публичные страницы сайта в безопасном режиме, отделит наблюдения от неизвестных и сохранит ссылки на каждую изученную страницу.","The system will read public website pages safely, separate observations from unknowns, and retain every studied page URL.")}</p><div class="analysis-progress"><span class="done"><i>✓</i><b>${tr("Сайт принят","Website received")}</b><small>${esc(understanding.website??tr("Описание владельца","Owner description"))}</small></span><span><i>2</i><b>${tr("Изучение сайта","Website analysis")}</b><small>${tr("Продукт, аудитории, предложения и доверие","Product, audiences, offers, and trust")}</small></span><span><i>3</i><b>${tr("Исследование рынка","Market research")}</b><small>${tr("Следующий исполнитель после подтверждения продукта","Next worker after product confirmation")}</small></span></div><div class="modal-actions"><button data-action="edit-brand" data-brand-id="${esc(brand.id)}">${tr("ДОПОЛНИТЬ МАТЕРИАЛЫ","ADD MATERIALS")}</button><button class="primary" data-action="research-website" data-brand-id="${esc(brand.id)}" ${understanding.website?"":"disabled"}>${tr("НАЧАТЬ ИЗУЧЕНИЕ САЙТА","START WEBSITE RESEARCH")}</button></div></article>`;
}

function researchedProductMarkup(brand,understanding) {
  const research=understanding.websiteResearch;
  const analysis=research.analysis;
  const native=(value)=>state.locale==="EN"?value:String(value).replace(/Hands-free operation/gi,"Голосовое управление без отрыва от дороги").replace(/Truck-optimized GPS/gi,"Навигация с учётом параметров грузовика").replace(/Route optimization/gi,"Оптимизация маршрутов").replace(/Real-time diagnostics/gi,"Диагностика в реальном времени").replace(/Predictive maintenance alerts/gi,"Предиктивные уведомления о техобслуживании").replace(/Reports ready to file/gi,"Готовые отчёты");
  const list=(title,items,className="")=>items?.length?`<section class="${className}"><h3>${title}</h3>${items.map((item)=>`<p>• ${esc(native(item))}</p>`).join("")}</section>`:"";
  const strategy=analysis?.strategicVerdict?`<section class="strategic-verdict"><div><small>${tr("МНЕНИЕ СТАРШЕГО АНАЛИТИКА","SENIOR ANALYST OPINION")}</small><h2>${esc(native(analysis.strategicVerdict))}</h2><p>${esc(native(analysis.positioningThesis??""))}</p></div><span class="disposition ${esc((analysis.recommendedDisposition??"RESEARCH").toLowerCase())}">${esc(analysis.recommendedDisposition??"RESEARCH")}</span></section><div class="strategy-grid">${list(tr("БОЛЬ РЫНКА","MARKET PAIN"),analysis.marketPain)}${list(tr("СЛАБЫЕ МЕСТА ПРОДУКТА","PRODUCT WEAKNESSES"),analysis.productWeaknesses)}${list(tr("ГИПОТЕЗЫ ДИСТРИБУЦИИ","DISTRIBUTION HYPOTHESES"),analysis.distributionHypotheses)}</div>`:"";
  const semantic=analysis?`<header class="product-passport"><div><small>${tr("ПРЕДВАРИТЕЛЬНЫЙ ПАСПОРТ ПРОДУКТА","PRELIMINARY PRODUCT PASSPORT")}</small><h2>${esc(analysis.productName)}</h2><p>${esc(native(analysis.oneLineSummary))}</p></div><span><b>${tr("ТРЕБУЕТ ПОДТВЕРЖДЕНИЯ","CONFIRMATION REQUIRED")}</b><small>${tr("Бюджет и запуск заблокированы","Budget and launch remain blocked")}</small></span></header><div class="understanding-status"><article><small>${tr("УСТАНОВЛЕНО ПО САЙТУ","OBSERVED ON WEBSITE")}</small><b>${analysis.claims.filter((item)=>item.classification==="OBSERVED").length}</b></article><article><small>${tr("ЗАЯВЛЕНИЯ ВЛАДЕЛЬЦА","OWNER CLAIMS")}</small><b>${analysis.claims.filter((item)=>item.classification==="OWNER_CLAIM").length}</b></article><article><small>${tr("НЕИЗВЕСТНО / НЕ ДОКАЗАНО","UNKNOWN / UNVERIFIED")}</small><b>${analysis.risks.length+analysis.claims.filter((item)=>item.classification==="UNKNOWN").length}</b></article></div><div class="semantic-grid primary-understanding">${list(tr("ПРЕДПОЛАГАЕМЫЙ ПОКУПАТЕЛЬ","PROPOSED CUSTOMER"),analysis.customerSegments,"customer")}${list(tr("КАКУЮ ЗАДАЧУ РЕШАЕТ","JOB TO BE DONE"),analysis.jobsToBeDone,"job")}${list(tr("ОБЕЩАЕМАЯ ЦЕННОСТЬ","PROMISED VALUE"),analysis.valuePropositions,"value")}${list(tr("ВОЗМОЖНОСТИ ПРОДУКТА","PRODUCT CAPABILITIES"),analysis.productCapabilities,"capabilities")}</div><div class="research-boundary">${list(tr("СИСТЕМА ПРОВЕРИТ САМА","SYSTEM WILL RESEARCH"),analysis.recommendedNextResearch,"system-research")}${list(tr("ПОКА НЕ ПОДТВЕРЖДЕНО","NOT YET VERIFIED"),analysis.risks,"risks")}${list(tr("ВОПРОСЫ ВЛАДЕЛЬЦУ","QUESTIONS FOR OWNER"),analysis.criticalQuestions.slice(0,3),"owner-questions")}</div><details class="raw-observations"><summary>${tr("Источники и исходные заявления сайта","Sources and raw website claims")}</summary>${research.observedClaims.slice(0,10).map((claim)=>`<p>• ${esc(claim)}</p>`).join("")}<div class="research-sources">${research.pages.map((page)=>`<a href="${esc(page.url)}" target="_blank" rel="noreferrer"><b>${esc(page.title)}</b><small>${esc(page.url)}</small></a>`).join("")}</div></details><small class="analysis-meta">AI · ${esc(analysis.model)} · ${analysis.usage.totalTokens??"—"} tokens · DRY RUN</small>`:`<h2>${esc(research.observedClaims[0]??understanding.productSummary)}</h2>${list(tr("НАБЛЮДЕНИЯ","OBSERVATIONS"),research.observedClaims.slice(0,8))}${list(tr("ЧТО ЕЩЁ НУЖНО УСТАНОВИТЬ","WHAT REMAINS UNKNOWN"),research.unresolvedQuestions)}`;
  return `<article class="module understanding-review research-result"><div class="module-title">${tr("ПОНИМАНИЕ ПРОДУКТА","PRODUCT UNDERSTANDING")} <span>${tr("ЭТАП 02 · ПРОВЕРКА ВЛАДЕЛЬЦЕМ","STAGE 02 · OWNER REVIEW")}</span></div>${strategy}${semantic}<div class="product-decision"><p>${tr("Обсудите выводы с аналитиком. Он задаст по одному вопросу и не откроет запуск, пока конкурентный контур не станет достаточно ясным.","Discuss the findings with the analyst. It asks one question at a time and keeps launch blocked until the competitive contour is clear.")}</p><div class="modal-actions"><button class="analyst-cta" data-action="open-analyst" data-brand-id="${esc(brand.id)}">${tr("ОБСУДИТЬ С АНАЛИТИКОМ","TALK TO ANALYST")}</button><button data-action="edit-brand" data-brand-id="${esc(brand.id)}">${tr("ИСПРАВИТЬ ИЛИ ДОПОЛНИТЬ","CORRECT OR ADD CONTEXT")}</button><button data-action="research-website" data-brand-id="${esc(brand.id)}">${tr("ПОВТОРИТЬ АНАЛИЗ","RUN ANALYSIS AGAIN")}</button><button class="primary" data-action="confirm-understanding" data-brand-id="${esc(brand.id)}">${tr("ПОДТВЕРДИТЬ ПОНИМАНИЕ","CONFIRM UNDERSTANDING")}</button></div></div></article>`;
}

function brandOnboardingMarkup() {
  const brandId = decodeURIComponent(location.pathname.split("/")[2] ?? "");
  const brand = state.brandProfiles.find((item)=>item.id===brandId);
  if (!brand) return `<section class="module onboarding-empty"><h2>${tr("Профиль бренда не найден","Brand profile not found")}</h2><button data-route="/brands">${tr("ВЕРНУТЬСЯ К БРЕНДАМ","BACK TO BRANDS")}</button></section>`;
  const understanding=state.productUnderstandings.find((item)=>item.brandId===brand.id);
  const sources=state.productSources.filter((item)=>item.brandId===brand.id);
  const evidence=state.productEvidence.filter((item)=>item.brandId===brand.id);
  const facts=evidence.filter((item)=>item.classification==="FACT").length;
  const unknowns=evidence.filter((item)=>item.classification==="UNKNOWN").length;
  const diagnosis=state.productDiagnoses.find((item)=>item.brandId===brand.id);
  const thesis=state.expansionTheses.find((item)=>item.brandId===brand.id);
  const cycleReady=sources.length>=2&&facts>=3&&unknowns>=1&&Boolean(diagnosis&&thesis);
  const stages = [
    [tr("Паспорт и задачи","Profile and objectives"),"COMPLETE",brand.objectives.join(" · ")],
    [tr("Изучение продукта","Product intelligence"),"NEXT",tr("Репозиторий, сайт, аналитика, интервью и материалы","Repository, website, analytics, interviews and collateral")],
    [tr("Диагноз продукта","Product diagnosis"),"LOCKED",tr("Ценность, аудитории, барьеры, конкуренты и доказательства","Value, audiences, barriers, competitors and evidence")],
    [tr("Тезис экспансии","Expansion thesis"),"LOCKED",tr("Приоритетные страны, территории и последовательность","Priority countries, territories and sequence")],
    [tr("Тестовый портфель","Test portfolio"),"LOCKED",tr("Бюджет, каналы, прогноз, условия остановки и полномочия","Budget, channels, forecast, stop conditions and authority")],
    [tr("Исходные материалы","Source materials"),"LOCKED",tr("Заявления, брендбук, фото, видео, права и ограничения","Claims, brand book, photos, video, rights and constraints")],
    [tr("Производство и запуск","Production and launch"),"LOCKED",tr("Контент, контроль качества, дистрибуция и атрибуция","Content, QA, distribution and attribution")],
    [tr("Обучение и следующий цикл","Learning and next cycle"),"LOCKED",tr("Вовлечение, удержание, экономика и перераспределение бюджета","Engagement, retention, economics and budget reallocation")],
  ];
  const understandingReview=understanding?.status==="DRAFT"?`<article class="module understanding-review"><div class="module-title">${tr("КАК СИСТЕМА ПОНЯЛА ПРОДУКТ","HOW THE SYSTEM UNDERSTANDS THE PRODUCT")} <span>${tr("НУЖНО ПОДТВЕРЖДЕНИЕ","CONFIRMATION NEEDED")}</span></div><h2>${esc(understanding.productSummary)}</h2><dl><div><dt>${tr("ПРЕДПОЛАГАЕМАЯ АУДИТОРИЯ","PROPOSED AUDIENCE")}</dt><dd>${esc(understanding.customerSummary)}</dd></div><div><dt>${tr("ЦЕННОСТЬ","VALUE")}</dt><dd>${esc(understanding.valueSummary)}</dd></div><div><dt>${tr("МАТЕРИАЛЫ","MATERIALS")}</dt><dd>${esc([understanding.website,...understanding.materialNames].filter(Boolean).join(" · ")||tr("Описание владельца","Owner description"))}</dd></div><div><dt>${tr("ДОПУЩЕНИЕ","ASSUMPTION")}</dt><dd>${esc(understanding.assumptions.join(" · "))}</dd></div></dl><div class="modal-actions"><button data-action="add-brand">${tr("ПОПРАВИТЬ","CORRECT")}</button><button class="primary" data-action="confirm-understanding" data-brand-id="${esc(brand.id)}">${tr("ДА, ВСЁ ВЕРНО","YES, THAT IS CORRECT")}</button></div></article>`:``;
  let nextAction=understanding?.status==="DRAFT" ? (understanding.websiteResearch?researchedProductMarkup(brand,understanding):pendingProductAnalysisMarkup(brand,understanding)) : understandingReview ? understandingReview : cycleReady
    ? `<h3>${tr("Бренд готов к управляемому циклу","Brand is ready for a governed cycle")}</h3><p>${tr("Все входные контракты зафиксированы. Запуск выполнит 13 стадий без публикаций, платежей и внешних коммуникаций.","All admission contracts are recorded. The run executes 13 stages without publishing, payments or external communication.")}</p><button class="primary" data-action="start-brand-dry-run" data-brand-id="${esc(brand.id)}">▶ ${tr("ЗАПУСТИТЬ DRY RUN БРЕНДА","START BRAND DRY RUN")}</button>`
    : `<h3>${tr("Передайте системе источники о продукте","Provide product source material")}</h3><p>${tr("Нужно: 2 источника, 3 факта, 1 открытый вопрос, диагноз и сравнительный тезис экспансии. До этого бюджет не предлагается.","Required: 2 sources, 3 facts, 1 open question, a diagnosis and a comparative expansion thesis. No budget is proposed before then.")}</p><button data-route="/factory-config">${tr("ПРОДОЛЖИТЬ ПОДГОТОВКУ","CONTINUE PREPARATION")} →</button>`;
  nextAction+=`<div class="danger-zone"><button data-action="delete-brand" data-brand-id="${esc(brand.id)}" data-brand-name="${esc(brand.name)}">${tr("УДАЛИТЬ БРЕНД","DELETE BRAND")}</button></div>`;
  const stageLabel=(status)=>status==="COMPLETE"?tr("ЗАВЕРШЕНО","COMPLETE"):status==="NEXT"?tr("СЕЙЧАС","CURRENT"):tr("ПОЗЖЕ","LOCKED");
  const registeredSources=sources.length+(understanding?.websiteResearch?1:0);
  return `<section class="brand-journey"><article class="module brand-brief"><div class="module-title">${tr("КОНТЕКСТ БРЕНДА","BRAND CONTEXT")} <span>${tr("ИССЛЕДОВАНИЕ","DISCOVERY")}</span></div><h2>${esc(brand.name)}</h2><p>${esc(brand.offering)}</p><dl><div><dt>${tr("МАТЕРИАЛЫ","MATERIALS")}</dt><dd>${registeredSources} ${tr("источник изучен","source reviewed")}</dd></div><div><dt>${tr("АУДИТОРИЯ","AUDIENCE")}</dt><dd>${esc(understanding?.websiteResearch?.analysis?.customerSegments?.slice(0,2).join(" · ")||brand.audience)}</dd></div><div><dt>${tr("БИЗНЕС-МОДЕЛЬ","BUSINESS MODEL")}</dt><dd>${esc(brand.businessModel)}</dd></div><div><dt>${tr("СТАТУС","STATUS")}</dt><dd>${tr("Продукт изучен предварительно · требуется подтверждение владельца","Preliminary product review · owner confirmation required")}</dd></div></dl></article><main class="journey-next">${nextAction}</main><article class="module journey-flow"><div class="module-title">${tr("МАРШРУТ ОТ ПРОДУКТА ДО РЫНКА","PRODUCT-TO-MARKET JOURNEY")} <span>${cycleReady?tr("ГОТОВ К ЦИКЛУ","READY FOR CYCLE"):tr("ЭТАП 02 ИЗ 08","STAGE 02 OF 08")}</span></div><div class="journey-steps">${stages.map(([title,status,note],index)=>`<button class="journey-step ${status.toLowerCase()}" data-route="${status==="NEXT"?"/factory-config":location.pathname}"><i>${String(index+1).padStart(2,"0")}</i><span><b>${esc(title)}</b><small>${esc(note)}</small></span><em>${stageLabel(status)}</em></button>`).join("")}</div></article></section>`;
}

function render() {
  if (!isLocalRuntime && !state.cloudContext) {
    renderAuthGate();
    return;
  }
  const screen = current();
  if (!screen) return;
  const blueprint = blueprints[screen.key] ?? blueprints.command;
  const onboardingBrand=screen.key==="brand-onboarding"?state.brandProfiles.find((item)=>item.id===location.pathname.split("/")[2]):null;
  const onboardingUnderstanding=onboardingBrand?state.productUnderstandings.find((item)=>item.brandId===onboardingBrand.id):null;
  const onboardingSourceCount=onboardingBrand?state.productSources.filter((item)=>item.brandId===onboardingBrand.id).length+(onboardingUnderstanding?.websiteResearch?1:0):0;
  const metrics = screen.key === "brand-onboarding" ? [[tr("ЭТАП","STAGE"),"2 / 8"],[tr("ИЗУЧЕННЫЕ ИСТОЧНИКИ","REVIEWED SOURCES"),String(onboardingSourceCount)],[tr("РЫНКИ-КАНДИДАТЫ","MARKET CANDIDATES"),tr("ПОСЛЕ ПОДТВЕРЖДЕНИЯ","AFTER CONFIRMATION")],[tr("ТЕСТОВЫЙ БЮДЖЕТ","TEST BUDGET"),tr("ЕЩЁ НЕ РАССЧИТАН","NOT CALCULATED YET")]] : screen.key === "command" ? [[tr("БРЕНДЫ","BRANDS"),String(state.brandProfiles.length)],[tr("ПРОДУКТЫ ИЗУЧЕНЫ","PRODUCTS REVIEWED"),String(state.productUnderstandings.filter((item)=>item.websiteResearch?.analysis).length)],[tr("АКТИВНЫЕ СПРИНТЫ","ACTIVE SPRINTS"),String(state.activationSprints.filter((item)=>item.status==="ACTIVE").length)],[tr("РЫНКИ В ИССЛЕДОВАНИИ","MARKETS IN DISCOVERY"),String(state.addedMarkets.length)]] : blueprint.metrics;
  const groups = navGroups();
  document.title = `${screen.title} — LAFWIRON`;
-��m�G����ƭy�ze:8px;color:var(--green-dark)}.policy-seal small{font-size:7px;color:var(--muted);margin-top:2px}.production-detail>button{width:100%;border:1px solid var(--teal);border-radius:999px;background:#0e2537;color:#d9eef5;padding:9px;font-size:8px;cursor:pointer}
.linked{border:1px solid var(--border);border-radius:14px;margin-top:12px;padding:15px;background:var(--surface);box-shadow:0 2px 5px rgb(0 0 0 / .05)}.linked .module-title{margin-bottom:10px}.linked>button{min-width:210px;border:1px solid var(--border);border-radius:10px;background:var(--canvas-soft);text-align:left;padding:10px 12px;margin-right:8px;cursor:pointer}.linked>button small,.linked>button b,.linked>button span{display:block}.linked>button small{color:var(--faint);font:9px ui-monospace,monospace}.linked>button b{margin:5px 0}.linked>button span{color:var(--teal);font-size:8px}
footer{height:36px;display:flex;align-items:center;gap:24px;border-top:1px solid var(--border-strong);padding:0 22px;font-size:8px;color:var(--muted);position:relative;background:var(--canvas-soft)}footer b{margin-left:auto;color:var(--teal);letter-spacing:.11em}.toast{position:fixed;right:24px;bottom:54px;background:#ecfdf5;border:1px solid var(--green);color:var(--green-dark);border-radius:10px;padding:12px 16px;font-size:9px;letter-spacing:.1em;z-index:30;box-shadow:var(--shadow)}
.modal-backdrop{position:fixed;inset:0;background:rgb(17 24 39 / .38);display:grid;place-items:center;z-index:50}.modal{width:min(540px,90vw);border:1px solid var(--border-strong);border-radius:16px;background:var(--surface);padding:20px;box-shadow:var(--shadow)}.modal .module-title button{border:0;background:none;color:var(--muted);font-size:18px;cursor:pointer}.modal h2{font-size:25px;margin:20px 0 8px}.modal p{color:var(--muted);margin:0 0 22px}.modal label{display:grid;gap:7px;color:var(--muted);font-size:9px;letter-spacing:.1em;margin-top:14px}.modal select,.modal input{height:40px;border:1px solid var(--border-strong);border-radius:8px;background:var(--surface-warm);padding:0 12px}.modal-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:24px}.modal-actions button{height:34px;border:1px solid var(--border-strong);border-radius:999px;background:var(--canvas-soft);padding:0 14px;font-size:9px;cursor:pointer}.modal-actions button[type=submit]{border-color:var(--teal);color:var(--teal);background:var(--surface)}
@media(max-width:1300px){.signal:nth-of-type(2){display:none}.screen-grid{grid-template-columns:1fr 1fr}.decisions{grid-column:1/-1}}
@media(max-width:1100px){.capital-mini,.exec{display:none}.screen-grid{grid-template-columns:1fr}.workspace{grid-template-columns:180px 1fr}.module{min-height:250px}}
@media(max-width:1100px){.command-overview{grid-template-columns:1fr}.command-map{grid-row:auto}.command-map>.map-module{min-height:570px}}
@media(max-width:1100px){.production-surface{grid-template-columns:1fr}.production-toolbar{grid-column:1}.production-toolbar{align-items:start;gap:12px;flex-direction:column}.production-toolbar nav{max-width:100%;overflow-x:auto}.production-detail{min-height:320px}}

/* Institutional premium theme: global control, restrained accents, high contrast. */
.map-module{container-type:inline-size}
@container(max-width:1000px){.map-panel-head{grid-template-columns:1fr}.map-controls{grid-template-columns:1fr 1fr}}
.command-bar{background:#081421;border-color:#203246;color:#e8f0f6;box-shadow:0 8px 24px rgb(5 14 24 / .16)}
.brand{border-color:#203246}.brand strong{color:#f4f8fb}.brand small,.signal small,.capital-mini small{color:#7f94a8}
.factory-state,.signal,.capital-mini{border-color:#203246}.signal b,.capital-mini b{color:#edf5fa}.signal span{color:#57d4bc}
.attention{border-color:#743341;background:#2b1720;color:#f397a1}.exec,.locale{border-color:#2a4056;background:#102236;color:#9db0c1}.exec.on{border-color:#3d9dbb;color:#76cbe2}.avatar{border-color:#2a4056;background:#102236;color:#dce8ef}
.stats-ribbon{background:#0e1d2d;border-color:#203246;color:#8da1b3}.stats-ribbon b{color:#6fc5dd}
.side-nav{color:#d8e4ec}.side-nav>small,.side-nav label{color:#70869a}.side-nav button{color:#aebdca}.side-nav button span{color:#5f7488}.side-nav button:hover{background:#12263a;color:#f3f7fa}.side-nav button.active{background:#142b40;color:#f6fafc;box-shadow:inset 3px 0 #3aa0bd,0 8px 20px rgb(0 0 0 / .18)}
.health{background:#101f30;border-color:#263a4e;color:#8ea2b4;box-shadow:none}.health b{color:#50c9ae}
.module,.metric-ribbon,.linked{background:linear-gradient(180deg,#ffffff,#f8fafc);border-color:#d3dde6;box-shadow:0 18px 50px rgb(20 42 61 / .07),0 2px 8px rgb(20 42 61 / .05)}
.page-head p,.module-title span,.linked>button span{color:#176b87}.head-actions button.primary{border-color:#176b87;background:#0e2537;color:#d9eef5}
.map-chip.selected{border-color:#79c7d8;background:#e2f3f7;color:#125d75}.map-canvas{background:radial-gradient(circle at 50% 45%,#ffffff 0,#edf3f6 72%,#e2eaf0 100%)}.metric-badge{border-color:#cbd8e2;background:rgb(249 252 253 / .88)}.metric-badge b{color:#176b87}
.legend-scale .swatch-0{background:#e7edf2}.legend-scale .swatch-1{background:#c4dbe3}.legend-scale .swatch-2{background:#8abecb}.legend-scale .swatch-3{background:#4e96aa}.legend-scale .swatch-4{background:#226a82}.legend-scale .swatch-5{background:#0b3d55}
footer{background:#081421;border-color:#203246;color:#8297aa}footer b{color:#6fc5dd}

@media(max-width:760px){
  body{font-size:12px;overflow-x:hidden}.command-bar{height:56px}.brand{width:118px;height:56px;padding:9px 12px}.brand strong{font-size:16px}.brand small{font-size:7px}.factory-state,.attention,.signal,.capital-mini,.exec{display:none}.locale{margin-left:auto}.avatar{margin:0 10px}.stats-ribbon{display:none}
  .workspace{display:block;min-height:calc(100vh - 92px)}.side-nav{position:sticky;top:56px;z-index:15;height:48px;width:100%;display:flex;align-items:center;gap:5px;padding:6px 9px;overflow-x:auto;border:0;border-bottom:1px solid var(--sidebar-border)}.side-nav>small,.side-nav label,.side-nav .health{display:none}.side-nav section{display:contents;margin:0}.side-nav button{flex:0 0 auto;width:auto;min-height:34px;padding:8px 10px;border-radius:8px;font-size:10px;gap:8px}.side-nav button span{display:none}.side-nav button.active{box-shadow:inset 0 -2px #3aa0bd}
  main{padding:14px 12px;overflow:visible}.page-head{height:auto;min-height:86px;display:grid;gap:12px;align-items:start}.page-head h1{font-size:24px}.head-actions{display:flex;gap:5px;overflow-x:auto}.head-actions button{flex:0 0 auto;margin:0}.metric-ribbon{grid-template-columns:1fr 1fr;margin-top:12px}.metric-ribbon div:nth-child(3){border-left:0;border-top:1px solid var(--border)}.metric-ribbon div:nth-child(4){border-top:1px solid var(--border)}.metric-ribbon b{font-size:20px}
  .screen-grid,.executive-grid{grid-template-columns:minmax(0,1fr)}.module,.map-module,.module-wide,.decisions{grid-column:1;min-width:0;min-height:260px}.map-module{min-height:570px;padding:12px}.map-panel-head{display:grid;grid-template-columns:1fr;gap:10px}.map-panel-head h2{white-space:normal;margin:0}.map-controls{display:grid;grid-template-columns:1fr;gap:9px}.map-control-block>div{flex-wrap:nowrap;overflow-x:auto;padding-bottom:2px}.map-chip{flex:0 0 auto;min-height:28px}.segment-control{display:none}.geo-map:has(.geo-vector){height:430px;padding:10px}.choropleth{padding:5px}.metric-badge{font-size:7px;padding:5px 7px}.legend-scale{gap:2px}.legend-scale i{height:12px}.legend-scale span{font-size:7px}.uncertainty-legend{gap:8px;overflow-x:auto;white-space:nowrap}.uncertainty-legend b{display:none}.map-source{font-size:5px}.linked{overflow-x:auto;white-space:nowrap}.linked>button{min-width:190px}.flowline{justify-content:flex-start;overflow-x:auto;margin-top:40px}.flowline button{flex:0 0 100px}footer{overflow-x:auto;white-space:nowrap;padding:0 12px}footer b{display:none}
  .command-overview{grid-template-columns:1fr}.command-map>.map-module{min-height:570px}.decision-facts{grid-template-columns:1fr}.capital-split{gap:8px}
  .production-surface{grid-template-columns:minmax(0,1fr)}.production-table{overflow-x:auto}.production-head,.production-row{min-width:720px}.production-toolbar nav{width:100%}.production-toolbar button{flex:0 0 auto}.production-detail{min-height:300px}
  .modal{padding:16px}.modal-actions{display:grid;grid-template-columns:1fr}.modal-actions button{width:100%}
}

/* LAFWIRON night-signal palette: deep global infrastructure with a single
   high-visibility action colour. Inspired by the supplied tonal reference,
   while preserving LAFWIRON information density and semantic states. */
:root{
  --canvas:#080d1c;--canvas-soft:#101627;--sidebar:#060a16;
  --surface:#11182a;--surface-warm:#151d31;
  --border:#273047;--border-strong:#38435d;--sidebar-border:#20283c;
  --ink:#f7f8fb;--text:#d6daE5;--muted:#8f98ad;--faint:#667087;
  --teal:#ffc400;--green:#4fd1a5;--green-dark:#54dbb0;--blue:#6ea8ff;
  --amber:#ffc400;--orange:#ff9f43;--red:#ff667a;--red-dark:#ff8292;
  --shadow:0 22px 60px rgb(0 0 0 / .26),0 3px 12px rgb(0 0 0 / .2);
}
body{background:radial-gradient(circle at 82% 25%,rgb(255 196 0 / .08),transparent 28%),var(--canvas)}
.command-bar{background:#070b18;border-color:#252d43;color:var(--ink)}
.brand strong{color:#ffc400;letter-spacing:.055em}.brand small{color:#7f899f}
.factory-state{color:#ffc400}.factory-state i{background:#ffc400;box-shadow:0 0 12px rgb(255 196 0 / .55)}
.signal b,.capital-mini b{color:#f8fafc}.signal span{color:#ffc400}
.attention{border-color:#59303a;background:#24131c;color:#ff8292}
.exec,.locale,.avatar{border-color:#333d56;background:#12192b;color:#b3bbcb}.exec.on{border-color:#ffc400;color:#ffc400}
.stats-ribbon{background:#0b1120;border-color:#252d43;color:#778198}.stats-ribbon b{color:#ffc400}
.side-nav{background:#060a16}.side-nav button{color:#9ca6ba}.side-nav button:hover{background:#12192a;color:#fff}.side-nav button.active{background:#171d2f;color:#fff;box-shadow:inset 3px 0 #ffc400,0 10px 24px rgb(0 0 0 / .22)}
.health{background:#0d1323;border-color:#252e44}.health b{color:#ffc400}
main{background:transparent}.page-head p,.module-title span,.linked>button span{color:#ffc400}.page-head span{color:#929bae}
.module,.metric-ribbon,.linked{background:linear-gradient(180deg,#151c2e,#101728);border-color:#2b354d;box-shadow:var(--shadow)}
.metric-ribbon div+div,.metric-ribbon div:nth-child(3),.metric-ribbon div:nth-child(4){border-color:#2b354d}.metric-ribbon span{background:#0a1020;border-color:#303a51;color:#818ba0}
.head-actions button,.linked>button,.data-row,.flowline button,.decision button,.map-chip{background:#11182a;border-color:#333d55;color:#b7bfce}.head-actions button.primary,.production-detail>button{border-color:#ffc400;background:#ffc400;color:#111522;font-weight:800}
.data-row{border-color:#293249}.data-row:hover,.spine-list button:hover,.production-row:hover{background:#1a2236;color:#fff}.row-dot{background:#ffc400}
.module-title{border-color:#2c354c;color:#929bae}.bars i,.capital-track{background:#090f1e;border-color:#283149}.bars i b{background:linear-gradient(90deg,#806500,#ffc400)}
.map-canvas{background:radial-gradient(circle at 52% 42%,#202a3c 0,#101728 66%,#090f1d 100%)}.geo-map:has(.geo-vector),.geo-map{background:#0c1222;border-color:#2b354c}.choropleth path{stroke:#0a0f1d}.metric-badge{background:rgb(9 14 27 / .86);border-color:#38435b;color:#aab3c4}.metric-badge b{color:#ffc400}
.legend-scale .swatch-0{background:#292f3e}.legend-scale .swatch-1{background:#554918}.legend-scale .swatch-2{background:#806c10}.legend-scale .swatch-3{background:#ad8f08}.legend-scale .swatch-4{background:#d9ad00}.legend-scale .swatch-5{background:#ffc400}.uncertainty-legend i{background:#ffc400}
.map-chip.selected{border-color:#ffc400;background:#3b3211;color:#ffd740}.decision-actions button:first-child{border-color:#ffc400;background:#3b3211;color:#ffd740}
.capital-track i{background:linear-gradient(90deg,#806500,#ffc400)}.text-link{color:#ffc400}
.production-toolbar{background:#070b18;border-color:#2b354c}.production-toolbar span{color:#ffc400}.production-toolbar button.active{border-color:#ffc400;color:#ffc400}.production-head{background:#0d1424;border-color:#2c354b}.production-head b{color:#8f98ab}.production-row{border-color:#293249}.production-row span{color:#c6ccda}.production-row .cell-0{color:#fff}.production-row .cell-0 i{color:#ffc400}
.production-detail dl div{border-color:#2b354c}.policy-seal{border-color:#315b50;background:#102720}.policy-seal small{color:#91a69f}
.decision-facts span{background:#0b1120;border-color:#2e3850}.decision-facts b{color:#fff}
.modal{background:#12192a;border-color:#38435b}.modal select,.modal input{background:#0b1120;border-color:#354059;color:#fff}
footer{background:#060a16;border-color:#252d43;color:#727d93}footer b{color:#ffc400}

/* Readability pass: keep the night shell, lift working surfaces and reserve
   yellow luminance for the objects an operator must notice first. */
.module,.metric-ribbon,.linked{background:linear-gradient(180deg,#1c253a,#151d31);border-color:#37425c}
.metric-ribbon{box-shadow:inset 0 1px rgb(255 255 255 / .035),0 18px 48px rgb(0 0 0 / .2)}
.metric-ribbon div:first-child{background:linear-gradient(135deg,rgb(255 196 0 / .13),transparent 70%)}
.metric-ribbon b{color:#fff}.metric-ribbon div:first-child b{color:#ffd229;text-shadow:0 0 22px rgb(255 196 0 / .16)}
.production-table{background:#182136}.production-head{background:#212b41}.production-row:nth-child(odd){background:rgb(255 255 255 / .018)}.production-row:hover{background:#263149}
.production-detail{background:linear-gradient(160deg,#202a40,#171f33)}.production-detail .module-title span{padding:3px 6px;border:1px solid rgb(255 196 0 / .35);border-radius:999px;background:rgb(255 196 0 / .08)}
.production-detail dd{color:#fff}.production-detail dl div:first-child dd{color:#ffd229}
.command-spine,.command-decision,.capital-position{background:linear-gradient(160deg,#202a40,#171f33)}
.command-decision{border-color:#665824;box-shadow:inset 0 1px rgb(255 215 64 / .08),var(--shadow)}.command-decision h2{color:#ffd229}
.capital-total b{color:#ffd229}.spine-list button{border-color:#354059}.spine-list button:first-child{background:linear-gradient(90deg,rgb(255 196 0 / .1),transparent)}
.data-row:nth-child(odd){background:rgb(255 255 255 / .018)}.decision{border-color:#354059}.decision>b{color:#fff}
.map-module{background:linear-gradient(180deg,#1b263b,#121a2d)}.geo-map:has(.geo-vector){border-color:#3a465f;box-shadow:inset 0 0 45px rgb(0 0 0 / .18)}
.page-head h1{color:#fff}.page-head span{color:#a9b2c3}.module-title{color:#aab3c3}.production-head b{color:#aab3c3}
@media(max-width:760px){.module,.metric-ribbon,.linked{background:linear-gradient(180deg,#1b2438,#141c2f)}}

/* Density and hierarchy pass for large control-room displays. */
body{font-size:14px}.workspace{grid-template-columns:220px 1fr}.side-nav{padding:20px 12px}.side-nav>small{display:block;margin:0 9px 12px}.side-nav details{border-top:1px solid #1d2639;padding:5px 0}.side-nav summary{display:flex;justify-content:space-between;align-items:center;padding:8px 9px;color:#718099;font-size:9px;letter-spacing:.12em;font-weight:800;cursor:pointer;list-style:none}.side-nav summary::-webkit-details-marker{display:none}.side-nav summary i{font-style:normal;transition:transform .15s}.side-nav details[open] summary{color:#ffc400}.side-nav details[open] summary i{transform:rotate(180deg)}.side-nav section{margin:2px 0 7px}.side-nav button{font-size:12px;padding:10px 10px;border-radius:7px}.side-nav button.active{box-shadow:inset 3px 0 #ffc400}.health{margin-top:14px}
main{padding:24px;max-width:none}.page-head{height:70px}.page-head h1{font-size:30px}.page-head span{font-size:12px}.page-head p{font-size:9px}.head-actions button{height:32px;font-size:9px}.metric-ribbon{margin-top:16px}.metric-ribbon div{padding:15px 18px}.metric-ribbon small{font-size:9px}.metric-ribbon b{font-size:27px}
.screen-grid{grid-template-columns:1fr 1fr 1.12fr;gap:14px}.module{min-height:260px;padding:17px}.screen-grid>.module{height:auto}.screen-grid>.decisions{border-color:#665824;background:linear-gradient(155deg,#242a39,#181f31);box-shadow:inset 0 1px rgb(255 196 0 / .08),var(--shadow)}.screen-grid>.decisions .module-title{color:#d5dae4}.screen-grid>.decisions .module-title span{color:#ffc400}.module-title{height:31px;font-size:11px}.data-row{padding:15px 5px;font-size:12px}.bars{gap:17px;margin-top:18px}.bars label{font-size:12px}.decision{padding:15px 0}.decision small{color:#ffc400}.decision>b{font-size:13px}.decision button:first-child{border-color:#ffc400;background:#ffc400;color:#111522;font-weight:800}
.linked{padding:12px 16px}.linked .module-title{height:25px;margin-bottom:7px}.linked>button{min-width:175px;padding:8px 10px}.linked>button b{margin:3px 0;font-size:11px}.linked>button small,.linked>button span{font-size:7px}
footer{height:40px;font-size:9px}
@media(max-width:1300px){.workspace{grid-template-columns:205px 1fr}.screen-grid{grid-template-columns:1fr 1fr}.screen-grid>.decisions{grid-column:1/-1}.side-nav button{font-size:11px}}
@media(max-width:760px){body{font-size:12px}.workspace{display:block}.side-nav{padding:6px 9px}.side-nav details{display:contents}.side-nav summary{display:none}.side-nav details:not([open]) section{display:none}.side-nav button{font-size:10px;padding:8px 10px}main{padding:14px 12px}.page-head h1{font-size:25px}.screen-grid{grid-template-columns:1fr}.screen-grid>.decisions{grid-column:1}.linked{padding:12px}}

/* Typography and map-header correction after the density pass. */
body{font-family:"Segoe UI Variable Text","Segoe UI",Arial,sans-serif;font-size:13px;line-height:1.42;-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility}
.brand strong,.page-head h1,.metric-ribbon b,.capital-mini b{font-weight:700}.page-head h1{font-size:28px;line-height:1.08;letter-spacing:-.018em}.page-head span{line-height:1.45}.module-title{font-weight:650;letter-spacing:.075em}.side-nav summary{font-weight:700}.side-nav button{font-size:11px;line-height:1.3}.spine-list span b{font-size:11px;font-weight:650;letter-spacing:.035em}.spine-list span small{font-size:9px}.command-decision h2{font-size:22px;line-height:1.2;font-weight:700}.command-decision>p:not(.eyebrow){font-size:11px}.decision-facts span,.command-decision .eyebrow{font-size:8px}.decision-actions button,.text-link{font-size:9px}
.map-panel-head{grid-template-columns:1fr;gap:12px}.map-panel-head h2{margin:0;white-space:normal;font-size:11px;line-height:1.35}.map-controls{grid-template-columns:1.15fr .85fr;gap:14px}.map-control-block>b{font-size:8px;line-height:1.3;letter-spacing:.04em}.map-chip{font-size:8px;padding:5px 8px}.command-map>.map-module{min-height:620px}.command-map .geo-map:has(.geo-vector){height:390px}.command-overview{align-items:start}.command-spine,.command-decision{height:auto}
.legend-scale div,.uncertainty-legend{font-size:9px}.map-source{font-size:7px}.metric-badge{font-size:8px}
.production-toolbar small,.production-toolbar button,.production-head b,.production-detail dt{font-size:8px}.production-row span{font-size:10px}.production-detail dd{font-size:12px}
.legend-scale .swatch-0{background:#293044}.legend-scale .swatch-1{background:#4b4428}.legend-scale .swatch-2{background:#74611d}.legend-scale .swatch-3{background:#a38412}.legend-scale .swatch-4{background:#d1a507}.legend-scale .swatch-5{background:#ffc400}
@media(max-width:1100px){.map-controls{grid-template-columns:1fr}.command-map>.map-module{min-height:580px}.command-map .geo-map:has(.geo-vector){height:390px}}
@media(max-width:760px){body{font-size:12px}.page-head h1{font-size:24px}.map-panel-head{gap:9px}.command-map .geo-map:has(.geo-vector){height:410px}.legend-scale div,.uncertainty-legend{font-size:8px}}

/* Calmer signal scale, exact regional ranking and compact decision card. */
body{color:#f1f3f8}.page-head span,.data-row,.production-row span,.command-decision>p:not(.eyebrow){color:#c0c7d5;font-weight:500}.side-nav button{font-size:12px;font-weight:500}.side-nav button.active{font-weight:700}.module-title,.map-panel-head h2{color:#b8c0d0;font-weight:700}.spine-list span b{font-weight:700}.spine-list span small{color:#a3adbf}
.geo-vector{grid-template-rows:minmax(250px,1fr) auto auto auto auto}.command-map .geo-map:has(.geo-vector){height:505px}.command-map>.map-module{min-height:650px}.region-ranking{display:grid;gap:6px}.region-ranking h3{margin:0;color:#929db1;font-size:8px;letter-spacing:.1em}.region-ranking>div{display:grid;grid-template-columns:repeat(4,1fr);gap:5px}.region-ranking button{display:grid;grid-template-columns:19px 1fr auto;gap:6px;align-items:center;min-width:0;border:1px solid #303b53;border-radius:7px;background:#11182a;color:#dbe0ea;padding:7px 8px;text-align:left;cursor:pointer}.region-ranking button:hover{border-color:#8f7937;background:#1b2233}.region-ranking i{font:7px ui-monospace,monospace;color:#78849a;font-style:normal}.region-ranking span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:9px;font-weight:600}.region-ranking b{color:#e2b51a;font-size:9px}
.legend-scale .swatch-0{background:#273044}.legend-scale .swatch-1{background:#34425a}.legend-scale .swatch-2{background:#465970}.legend-scale .swatch-3{background:#63748a}.legend-scale .swatch-4{background:#9b8338}.legend-scale .swatch-5{background:#e2b51a}
.command-decision{position:relative;border-color:#3b465e;box-shadow:var(--shadow);overflow:hidden}.command-decision:before{content:"";position:absolute;inset:0 auto 0 0;width:3px;background:#e2b51a}.decision-summary{display:flex;align-items:center;gap:12px;margin:16px 0 10px}.decision-summary .decision-amount{display:grid;place-items:center;min-width:74px;height:45px;border:1px solid #77672d;border-radius:9px;background:rgb(226 181 26 / .09);color:#e8c442;font-size:19px;font-weight:750}.decision-summary .eyebrow{margin:0 0 3px}.decision-summary h2{margin:0;color:#f5f6fa;font-size:17px}.command-decision>p:not(.eyebrow){margin:8px 0;font-size:11px;line-height:1.55}.decision-actions button:first-child{background:#e2b51a;border-color:#e2b51a}.decision-actions button{font-weight:650}
@media(max-width:1100px){.region-ranking>div{grid-template-columns:repeat(2,1fr)}}
@media(max-width:760px){.side-nav button{font-size:11px}.command-map .geo-map:has(.geo-vector){height:570px}.region-ranking>div{grid-template-columns:1fr 1fr}.decision-summary{align-items:flex-start}.decision-summary .decision-amount{min-width:67px}}

/* Navigation typography is shared across the shell and in-screen controls. */
.stats-ribbon{height:40px;color:#c8ceda;font-size:11px;font-weight:600;letter-spacing:.045em}.stats-ribbon b{font-size:10px;font-weight:700}
.map-chip,.head-actions button,.production-toolbar button,.linked>button,.decision-actions button,.text-link{color:#d7dce6;font-size:11px;font-weight:600;line-height:1.2}
.map-chip{padding:7px 10px}.head-actions button{font-size:10px}.production-toolbar button{font-size:10px;padding:7px 10px}.linked>button b{color:#eef1f6;font-size:12px;font-weight:650}.linked>button span{font-size:9px;font-weight:650}.linked>button small{font-size:9px;color:#9da7ba}
.map-control-block>b,.region-ranking h3{color:#b7c0d0;font-size:9px;font-weight:700}.region-ranking button{color:#e3e7ee}.region-ranking span{font-size:10px;font-weight:650}
@media(max-width:760px){.stats-ribbon{display:none}.map-chip,.head-actions button,.production-toolbar button,.linked>button,.decision-actions button,.text-link{font-size:10px}}

/* Bring operational labels up to the navigation readability standard. */
.metric-ribbon small{color:#bac3d3;font-size:10px;font-weight:700;letter-spacing:.075em}.metric-ribbon span{color:#b5bece;border-color:#46516a;font-size:9px;font-weight:700;padding:3px 6px}.metric-ribbon b{font-weight:750}
.factory-state{font-size:11px;font-weight:700}.attention{height:27px;font-size:10px;font-weight:700}.signal{gap:3px}.signal small,.capital-mini small{color:#aab4c6;font-size:9px;font-weight:700}.signal b{color:#f5f7fa;font-size:11px;font-weight:700}.signal span{font-size:10px;font-weight:700}.capital-mini b{font-weight:750}.exec,.locale{height:32px;color:#d4dae5;font-size:10px;font-weight:650}.avatar{color:#e7eaf0;font-size:10px;font-weight:700}
.spine-list span small{color:#bac3d2;font-size:10px;font-weight:600}.spine-list i{font-size:9px;font-weight:700}.health span{font-size:9px;font-weight:600}.health b{font-weight:750}
.map-source{color:#a8b1c1;font-size:8px;font-weight:600}.uncertainty-legend{color:#b8c1d0;font-weight:600}.legend-scale div{color:#b8c1d0;font-weight:600}

/* Ranked territories remain a compact, horizontally scrollable data rail. */
.region-ranking{min-width:0}.region-ranking>div{display:flex;grid-template-columns:none;gap:6px;overflow-x:auto;overflow-y:hidden;padding:0 0 5px;scrollbar-width:thin;scrollbar-color:#657188 #161e30}.region-ranking button{flex:0 0 178px}.region-ranking>div::-webkit-scrollbar{height:5px}.region-ranking>div::-webkit-scrollbar-track{background:#161e30;border-radius:5px}.region-ranking>div::-webkit-scrollbar-thumb{background:#657188;border-radius:5px}.geo-vector{grid-template-rows:minmax(270px,1fr) auto auto auto auto}.command-map .geo-map:has(.geo-vector){height:535px;overflow:hidden}
@media(max-width:760px){.factory-state,.attention,.signal,.capital-mini,.exec{display:none}.metric-ribbon small{font-size:9px}.metric-ribbon span{font-size:8px}.region-ranking button{flex-basis:160px}.command-map .geo-map:has(.geo-vector){height:555px}}

/* Yellow is a light action surface: primary CTA copy must always be dark. */
.decision-actions button:first-child,.decision button:first-child,.head-actions button.primary,.production-detail>button{color:#080d1c;font-weight:800;text-shadow:none}

/* Production surfaces are working screens, not miniature dashboard previews. */
.production-surface{grid-template-columns:minmax(0,1fr) 340px;gap:14px}.production-toolbar{min-height:76px;padding:12px 16px}.production-toolbar small{color:#b7c0d1;font-size:10px;font-weight:700}.production-toolbar b{font-size:29px;font-weight:750}.production-toolbar span{font-size:10px;font-weight:700}.production-toolbar nav{gap:7px}.production-toolbar button{min-height:32px;padding:8px 12px;font-size:11px;font-weight:700}
.production-table{min-height:450px}.production-head,.production-row{grid-template-columns:1.15fr 1.85fr .75fr .75fr .9fr;gap:14px}.production-head{min-height:48px;padding:14px 16px}.production-head b{color:#bcc5d4;font-size:10px;font-weight:750;line-height:1.3;letter-spacing:.065em}.production-row{min-height:112px;padding:18px 16px}.production-row span{color:#e0e4ec;font-size:12px;font-weight:550;line-height:1.5}.production-row .cell-0{font-size:12px;font-weight:750}.production-row .cell-0 i{font-size:9px;margin-bottom:5px}.production-row .cell-2{font-weight:650}.production-row .cell-3,.production-row .cell-4{font-size:11px;font-weight:750}
.production-detail{min-height:450px;padding:18px}.production-detail .module-title{height:35px;font-size:12px}.production-detail dl{margin:17px 0}.production-detail dl div{padding:15px 0}.production-detail dt{color:#aeb8c9;font-size:10px;font-weight:650}.production-detail dd{margin-top:7px;color:#f3f5f8;font-size:14px;font-weight:700;line-height:1.4}.policy-seal{padding:13px;margin:19px 0}.policy-seal b{font-size:10px}.policy-seal small{font-size:9px;line-height:1.4}.production-detail>button{min-height:38px;font-size:10px;letter-spacing:.02em}
.production-surface+.linked{margin-top:14px}.production-surface+.linked .module-title{font-size:10px}.production-surface+.linked>button{min-width:210px;padding:11px 13px}.production-surface+.linked>button b{font-size:13px}.production-surface+.linked>button span{font-size:10px}
@media(max-width:1300px){.production-surface{grid-template-columns:minmax(0,1fr) 300px}.production-head,.production-row{grid-template-columns:1fr 1.55fr .7fr .7fr .85fr}.production-row span{font-size:11px}}
@media(max-width:1100px){.production-surface{grid-template-columns:1fr}.production-detail{min-height:0}.production-toolbar{align-items:flex-start}.production-table{overflow-x:auto}.production-head,.production-row{min-width:820px}}
@media(max-width:760px){.production-toolbar b{font-size:25px}.production-toolbar nav{padding-bottom:4px}.production-head,.production-row{min-width:760px}.production-row{min-height:100px}.production-detail dd{font-size:13px}}

/* Calm attention system, explicit locale switch and confident feedback. */
.attention{display:grid;grid-template-columns:7px auto 12px;align-items:center;gap:7px;height:34px;margin:0 14px;padding:0 11px;border:1px solid #5e5130;border-radius:9px;background:linear-gradient(180deg,#211e18,#181719);color:#d9c98c}.attention>i{width:7px;height:7px;border-radius:50%;background:#e2b51a;box-shadow:0 0 10px rgb(226 181 26 / .35)}.attention>span{color:#e2e5eb;font-size:10px;font-weight:700;text-transform:none}.attention>em{color:#a69b77;font-style:normal}.attention:hover{border-color:#8c7634;background:#252117}
.locale{display:flex;align-items:center;gap:7px;padding:0 9px}.locale span{color:#7f8a9e;font-size:10px;font-weight:700}.locale span.active{color:#fff}.locale i{width:1px;height:12px;background:#3b465d}.locale:hover span:not(.active){color:#d7dce5}
.toast{display:flex;align-items:center;gap:11px;min-width:330px;max-width:430px;padding:14px 16px;border:1px solid #77652c;border-left:3px solid #e2b51a;border-radius:11px;background:linear-gradient(160deg,#20283a,#151c2d);color:#eef1f5;box-shadow:0 22px 70px rgb(0 0 0 / .42)}.toast>i{display:grid;place-items:center;flex:0 0 29px;height:29px;border-radius:50%;background:#e2b51a;color:#080d1c;font-size:15px;font-weight:900;font-style:normal}.toast b,.toast small{display:block}.toast b{color:#f4f6f9;font-size:10px;letter-spacing:.07em}.toast small{margin-top:4px;color:#c0c8d5;font-size:10px;line-height:1.4}
.cycle-status-backdrop{position:fixed;inset:0;z-index:80;display:grid;place-items:center;padding:24px;background:rgb(4 8 18 / .78);backdrop-filter:blur(8px)}.cycle-status{width:min(560px,94vw);padding:34px;border:1px solid #77652c;border-radius:18px;background:radial-gradient(circle at 50% 0,rgb(226 181 26 / .12),transparent 44%),linear-gradient(155deg,#202a40,#111827);box-shadow:0 30px 100px rgb(0 0 0 / .62);text-align:center}.cycle-status>i{display:grid;place-items:center;width:58px;height:58px;margin:0 auto 20px;border-radius:50%;background:#e2b51a;color:#080d1c;font-size:27px;font-weight:900;font-style:normal}.cycle-status.progress>i{animation:cycle-spin 1.1s linear infinite}.cycle-status>p{margin:0;color:#e2b51a;font-size:10px;font-weight:800;letter-spacing:.14em}.cycle-status>h2{margin:10px 0 9px;color:#f5f7fa;font-size:28px;line-height:1.2}.cycle-status>span{display:block;color:#c5cddb;font-size:12px;line-height:1.55}.cycle-safety{display:grid;grid-template-columns:auto 1fr auto 1fr;align-items:center;gap:8px 10px;margin:25px 0;padding:15px;border:1px solid #3a4660;border-radius:12px;background:#0d1424;text-align:left}.cycle-safety b{color:#fff;font-size:15px}.cycle-safety small{color:#9eabbe;font-size:9px;font-weight:700;letter-spacing:.08em}.cycle-status>button{width:100%;min-height:44px;background:#e2b51a;color:#080d1c;font-size:10px;font-weight:850}.cycle-progress{height:4px;margin-top:24px;overflow:hidden;border-radius:99px;background:#303a50}.cycle-progress i{display:block;width:38%;height:100%;background:#e2b51a;animation:cycle-progress 1.25s ease-in-out infinite}@keyframes cycle-spin{to{transform:rotate(360deg)}}@keyframes cycle-progress{0%{transform:translateX(-110%)}100%{transform:translateX(285%)}}
.analysis-process-backdrop{position:fixed;inset:0;z-index:90;display:grid;place-items:center;padding:24px;background:rgb(3 7 16 / .9);backdrop-filter:blur(12px)}.analysis-process{width:min(670px,95vw);padding:42px;border:1px solid #4a5873;border-radius:20px;background:radial-gradient(circle at 50% 2%,rgb(226 181 26 / .13),transparent 38%),linear-gradient(150deg,#202a40,#101726);box-shadow:0 34px 110px rgb(0 0 0 / .72);text-align:center}.analysis-process>p{margin:24px 0 0;color:#e2b51a;font-size:11px;font-weight:850;letter-spacing:.14em}.analysis-process>h2{margin:10px auto;color:#f7f8fb;font-size:30px;line-height:1.16}.analysis-process>span{display:block;max-width:540px;margin:0 auto;color:#ccd3df;font-size:13px;font-weight:550;line-height:1.55}.analysis-process>small{display:block;margin-top:22px;color:#9da9bb;font-size:10px;font-weight:650}.analysis-engine{position:relative;width:104px;height:104px;margin:0 auto;display:grid;place-items:center}.analysis-engine:before,.analysis-engine:after,.analysis-engine>i{content:"";position:absolute;border-radius:50%;border:2px solid transparent}.analysis-engine:before{inset:0;border-top-color:#e2b51a;border-right-color:#e2b51a;animation:analysis-orbit 1.35s linear infinite}.analysis-engine:after{inset:12px;border-bottom-color:#75849c;border-left-color:#75849c;animation:analysis-orbit 1.8s linear infinite reverse}.analysis-engine>i{inset:25px;border:1px solid #62708a;background:#111a2b;box-shadow:0 0 28px rgb(226 181 26 / .16)}.analysis-engine>b{position:relative;z-index:1;color:#e2b51a;font-size:23px;font-weight:900}.analysis-engine>span{position:absolute;inset:44px -32px auto;height:2px;background:linear-gradient(90deg,transparent,#e2b51a,transparent);animation:analysis-scan 1.15s ease-in-out infinite}.analysis-live-steps{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin:26px 0 0;padding:0;counter-reset:analysis-step;text-align:left}.analysis-live-steps li{position:relative;min-height:52px;padding:12px 12px 12px 38px;border:1px solid #34415a;border-radius:10px;background:#0d1526;color:#c5cedb;font-size:11px;font-weight:650;line-height:1.35;list-style:none}.analysis-live-steps li:before{counter-increment:analysis-step;content:counter(analysis-step);position:absolute;left:12px;top:13px;color:#e2b51a;font-size:9px;font-weight:850}.analysis-live-steps li:after{content:"";position:absolute;inset:-1px;border:1px solid transparent;border-radius:10px;animation:analysis-step 4.8s linear infinite}.analysis-live-steps li:nth-child(2):after{animation-delay:1.2s}.analysis-live-steps li:nth-child(3):after{animation-delay:2.4s}.analysis-live-steps li:nth-child(4):after{animation-delay:3.6s}.analysis-process.error{border-color:#8b7130}.analysis-error-icon{display:grid;place-items:center;width:68px;height:68px;margin:0 auto;border-radius:50%;background:#e2b51a;color:#080d1c;font-size:30px;font-weight:900}.analysis-process.error>p{margin-top:20px}.analysis-process.error>small{margin-top:12px}.analysis-error-actions{display:grid;grid-template-columns:1.35fr 1fr;gap:10px;margin-top:28px}.analysis-error-actions button{min-height:46px;font-size:10px;font-weight:800}.analysis-error-actions button.primary{border-color:#e2b51a;background:#e2b51a;color:#080d1c}@keyframes analysis-orbit{to{transform:rotate(360deg)}}@keyframes analysis-scan{0%,100%{transform:translateY(-25px);opacity:.25}50%{transform:translateY(25px);opacity:1}}@keyframes analysis-step{0%,24%{border-color:#e2b51a;box-shadow:0 0 14px rgb(226 181 26 / .13)}25%,100%{border-color:transparent;box-shadow:none}}
.modal{width:min(600px,92vw);border-color:#45516a;background:linear-gradient(160deg,#20283b,#141b2c)}.modal .module-title{height:35px;font-size:11px}.modal h2{font-size:27px;line-height:1.2}.modal p{color:#c1c8d4;font-size:12px;line-height:1.55}.modal label{color:#b9c2d1;font-size:10px;font-weight:700}.modal select,.modal input{height:44px;font-size:12px}.modal-actions button{height:38px;font-size:10px;font-weight:700}.modal-actions button[type=submit]{border-color:#e2b51a;background:#e2b51a;color:#080d1c;font-weight:800}
@media(max-width:760px){.attention{display:none}.toast{left:12px;right:12px;bottom:50px;min-width:0;max-width:none}.locale{display:flex}.cycle-status-backdrop,.analysis-process-backdrop{padding:12px}.cycle-status{padding:26px 18px}.cycle-status>h2{font-size:23px}.cycle-safety{grid-template-columns:auto 1fr}.cycle-status>button{font-size:9px}.analysis-process{max-height:calc(100vh - 24px);overflow:auto;padding:28px 18px}.analysis-process>h2{font-size:24px}.analysis-process>span{font-size:12px}.analysis-engine{width:88px;height:88px}.analysis-live-steps{grid-template-columns:1fr}.analysis-error-actions{grid-template-columns:1fr}}

/* Process diagrams use the same readable scale as operational navigation. */
.flow-module{min-height:225px;padding:18px}.flowline{justify-content:center;margin-top:36px;gap:8px}.flowline button{display:grid;align-content:center;gap:5px;min-width:145px;height:92px;padding:12px;border-color:#44506a;background:linear-gradient(160deg,#202a40,#151d30);color:#eef1f6}.flowline button:first-child{border-color:#8f7936;background:linear-gradient(160deg,#28291f,#181e2d)}.flowline button i{margin:0;color:#e2b51a;font-size:10px;font-weight:750}.flowline button b{font-size:12px;font-weight:700;line-height:1.25}.flowline button small{color:#aab4c5;font-size:9px;font-weight:600}.flowline em{margin:0;color:#8994a8;font-size:16px;font-weight:600}.flowline button:hover{border-color:#e2b51a;background:#242d40}
@media(max-width:1300px){.flowline{justify-content:flex-start;overflow-x:auto;padding-bottom:8px}.flowline button{flex:0 0 138px}}
@media(max-width:760px){.flow-module{min-height:210px}.flowline{margin-top:28px}.flowline button{flex-basis:132px;height:86px}.flowline button b{font-size:11px}}

/* Territory ranking is an at-a-glance grid, not a hidden horizontal rail. */
.region-ranking>div{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:6px;overflow:visible;padding:0}.region-ranking button{min-width:0;width:100%;display:grid;grid-template-columns:19px minmax(0,1fr) auto}.geo-map:has(.geo-vector){height:560px}.command-map .geo-map:has(.geo-vector){height:575px}.command-map>.map-module{min-height:700px}
@media(max-width:1500px){.region-ranking>div{grid-template-columns:repeat(4,minmax(0,1fr))}}
@media(max-width:1100px){.region-ranking>div{grid-template-columns:repeat(2,minmax(0,1fr))}.geo-map:has(.geo-vector),.command-map .geo-map:has(.geo-vector){height:640px}}
@media(max-width:560px){.region-ranking>div{grid-template-columns:1fr}.geo-map:has(.geo-vector),.command-map .geo-map:has(.geo-vector){height:820px}}

/* The US overview lists all 50 states; regional screens keep a ranked subset. */
.geo-map:has(.region-ranking-states),.command-map .geo-map:has(.region-ranking-states){height:auto;min-height:780px;overflow:visible}.geo-vector:has(.region-ranking-states){height:auto;grid-template-rows:360px auto auto auto auto}.region-ranking-states>div{grid-template-columns:repeat(5,minmax(0,1fr))}.region-ranking-states button{min-height:36px}.command-map>.map-module:has(.region-ranking-states){min-height:0;height:auto}
@media(max-width:1500px){.region-ranking-states>div{grid-template-columns:repeat(5,minmax(0,1fr))}}
@media(max-width:1100px){.region-ranking-states>div{grid-template-columns:repeat(3,minmax(0,1fr))}.geo-map:has(.region-ranking-states),.command-map .geo-map:has(.region-ranking-states){min-height:1050px}}
@media(max-width:760px){.region-ranking-states>div{grid-template-columns:repeat(2,minmax(0,1fr))}.geo-map:has(.region-ranking-states),.command-map .geo-map:has(.region-ranking-states){min-height:1500px}.geo-vector:has(.region-ranking-states){grid-template-rows:330px auto auto auto auto}}
@media(max-width:480px){.region-ranking-states>div{grid-template-columns:1fr}.geo-map:has(.region-ranking-states),.command-map .geo-map:has(.region-ranking-states){min-height:2350px}}

/* Error recovery remains legible regardless of inherited button themes. */
.analysis-error-actions button:not(.primary){border-color:#4a5873;background:#111a2b;color:#f3f5f8}
.analysis-timing{display:grid;grid-template-columns:auto 1fr;align-items:center;gap:2px 10px;width:min(420px,100%);margin:22px auto 0;text-align:left}.analysis-timing>b{grid-row:1/3;color:#e2b51a;font-size:32px;line-height:1;font-variant-numeric:tabular-nums}.analysis-timing>small{color:#cbd2de;font-size:9px;font-weight:800;letter-spacing:.1em}.analysis-timing>div{height:6px;overflow:hidden;border-radius:99px;background:#303b51}.analysis-timing>div>i{display:block;width:4%;height:100%;border-radius:inherit;background:linear-gradient(90deg,#9b7d0d,#f4c928);transition:width 1s linear}.analysis-live-steps li.current{border-color:#b69418;background:linear-gradient(135deg,#1d2230,#232317);box-shadow:0 0 18px rgb(226 181 26 / .12)}

/* Factory council controls remain explicit in both active and thinking states. */
.analyst-modal>header button[data-action="close-analyst"]{display:grid;place-items:center;flex:0 0 40px;width:40px;height:40px;padding:0;border:1px solid #465570;border-radius:9px;background:#0c1527;color:#f4f6f9;font-size:24px;font-weight:500;line-height:1}.analyst-modal>header button[data-action="close-analyst"]:hover{border-color:#e2b51a;color:#e2b51a}.analyst-modal textarea{border:1px solid #40506c;background:#0c1527;color:#f4f6f9;font-size:13px;line-height:1.5}.analyst-controls button{min-height:38px;border:1px solid #465570;background:#111c31;color:#eef2f7;font-size:10px;font-weight:750}.analyst-controls button:hover:not(:disabled){border-color:#e2b51a;color:#e2b51a}.analyst-controls button.primary{border-color:#e2b51a;background:#e2b51a;color:#080d1c}.analyst-controls button:disabled{border-color:#364158;background:#1a2334;color:#9ea9bb;opacity:1;cursor:wait}.analyst-controls button.primary:disabled{position:relative;padding-left:30px;background:#263147;color:#d4dae4}.analyst-controls button.primary:disabled:before{content:"";position:absolute;left:12px;width:10px;height:10px;border:2px solid #65728a;border-top-color:#e2b51a;border-radius:50%;animation:cycle-spin .8s linear infinite}

/* World and macroregion country inventories expand naturally below the map. */
.geo-map:has(.region-ranking-countries),.command-map .geo-map:has(.region-ranking-countries){height:auto;min-height:640px;overflow:visible}.geo-vector:has(.region-ranking-countries){height:auto;grid-template-rows:360px auto auto auto auto}.region-ranking-countries>div{grid-template-columns:repeat(5,minmax(0,1fr))}.region-ranking-countries button{min-height:36px}.command-map>.map-module:has(.region-ranking-countries){min-height:0;height:auto}.region-control>div{max-height:72px;overflow-y:auto}
@media(max-width:1100px){.region-ranking-countries>div{grid-template-columns:repeat(3,minmax(0,1fr))}.geo-map:has(.region-ranking-countries),.command-map .geo-map:has(.region-ranking-countries){min-height:760px}}
@media(max-width:760px){.region-ranking-countries>div{grid-template-columns:repeat(2,minmax(0,1fr))}.geo-vector:has(.region-ranking-countries){grid-template-rows:300px auto auto auto auto}}

/* Inactive geography stays visible as context; only expansion markets gain colour. */
.choropleth path.market-inactive{fill:#252d3e;opacity:.72;stroke:#111827}.choropleth path.market-inactive:hover{opacity:1;filter:brightness(1.25);stroke:#758096}.choropleth path.market-active{opacity:1;filter:saturate(.9)}.metric-badge strong{margin-left:5px;color:#aeb7c8;font-size:7px}.empty-markets{grid-column:1/-1;margin:0;padding:13px;border:1px dashed #3b465d;border-radius:8px;color:#aeb7c8;font-size:10px;font-weight:600}
.choropleth path.area-in-expansion{stroke:#ffd54a;stroke-width:3;filter:brightness(1.12) saturate(1.1)}.choropleth path.area-in-expansion:hover,.choropleth path.area-in-expansion:focus{stroke:#fff3b0;stroke-width:4}.modal dl{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:18px 0}.modal dl div{border:1px solid #354057;border-radius:9px;background:#101728;padding:10px 12px}.modal dt{color:#9da8bb;font-size:8px;font-weight:700;letter-spacing:.08em}.modal dd{margin:5px 0 0;color:#f0f3f8;font-size:11px;font-weight:750}
.brand-modal{width:min(820px,94vw);max-height:90vh;overflow:auto}.form-grid{display:grid;grid-template-columns:1fr 1fr;gap:0 14px}.form-grid .form-span{grid-column:1/-1}.modal textarea{min-height:72px;resize:vertical;border:1px solid var(--border-strong);border-radius:8px;background:var(--surface-warm);color:var(--ink);padding:10px 12px;font:inherit}.brand-journey{display:grid;grid-template-columns:minmax(250px,310px) minmax(0,1fr);gap:12px;align-items:start}.brand-journey>.module{min-height:0}.brand-brief{position:sticky;top:112px}.brand-brief h2{margin:14px 0 7px;font-size:24px}.brand-brief>p,.journey-next p{color:#c0c8d6;font-size:11px;line-height:1.6}.brand-brief dl{display:grid;gap:8px;margin-top:18px}.brand-brief dl div{border-top:1px solid #344058;padding-top:9px}.brand-brief dt{color:#9ca8bb;font-size:8px;font-weight:700;letter-spacing:.08em}.brand-brief dd{margin:5px 0 0;color:#eef1f6;font-size:11px;font-weight:650;line-height:1.45}.journey-next{min-width:0}.journey-flow{grid-column:1/-1;display:block}.journey-steps{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:7px;margin-top:10px}.journey-step{display:grid;grid-template-columns:28px 1fr;gap:8px;align-items:start;min-height:92px;border:1px solid #354057;border-radius:9px;background:#11182a;color:#e7ebf2;padding:11px;text-align:left}.journey-step i{color:#e2b51a;font:9px ui-monospace,monospace}.journey-step span{display:grid;gap:4px}.journey-step b{font-size:11px}.journey-step small{color:#aeb7c7;font-size:9px;line-height:1.4}.journey-step em{grid-column:2;color:#818da2;font-size:8px;font-style:normal;font-weight:800}.journey-step.complete{border-color:#52715f}.journey-step.next{border-color:#b79828;background:linear-gradient(120deg,#272819,#151b2b)}.journey-step.next em{color:#ffd54a}.journey-step.locked{opacity:.72}.journey-next h3{font-size:18px;line-height:1.3;margin:18px 0 8px}.journey-next>button,.onboarding-empty button{border:1px solid #e2b51a;border-radius:999px;background:#e2b51a;color:#090e1c;padding:11px 14px;font-size:9px;font-weight:800}@media(max-width:1100px){.brand-journey{grid-template-columns:240px 1fr}.journey-steps{grid-template-columns:repeat(2,1fr)}}@media(max-width:700px){.form-grid,.brand-journey{grid-template-columns:1fr}.form-grid .form-span,.journey-flow{grid-column:1}.brand-brief{position:static}.journey-steps{grid-template-columns:1fr}}
.welcome-backdrop{position:fixed;inset:0;z-index:100;display:grid;place-items:center;padding:24px;background:radial-gradient(circle at 72% 30%,rgb(197 157 24 / .2),transparent 34%),rgba(4,8,18,.94);backdrop-filter:blur(12px)}.welcome-panel{width:min(1040px,96vw);border:1px solid #46516a;border-radius:20px;background:linear-gradient(145deg,#171f31,#080e1c 68%);box-shadow:0 30px 90px #000;padding:30px}.welcome-panel>header{display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #313b51;padding-bottom:20px}.welcome-brand{display:grid}.welcome-brand strong{color:#ffc400;font-size:21px;letter-spacing:.06em}.welcome-brand small{color:#8994a8;font-size:7px;letter-spacing:.16em}.welcome-panel>header>span{display:flex;align-items:center;gap:8px;color:#dce2eb;font-size:9px;font-weight:750;letter-spacing:.06em}.welcome-panel>header>span i{width:8px;height:8px;border-radius:50%;background:#ffc400;box-shadow:0 0 16px #ffc400}.welcome-hero{max-width:760px;padding:36px 0 24px}.welcome-hero>p:first-child{color:#ffc400;font-size:9px;font-weight:800;letter-spacing:.12em}.welcome-hero h1{margin:12px 0 16px;color:#f4f6fa;font-size:44px;line-height:1.08}.welcome-hero>p:last-child{max-width:700px;color:#bac3d2;font-size:13px;line-height:1.65}.welcome-status{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.welcome-status article{display:grid;gap:5px;border:1px solid #354058;border-radius:11px;background:#11182a;padding:14px 16px}.welcome-status small{color:#929eb2;font-size:8px;font-weight:700;letter-spacing:.09em}.welcome-status b{color:#f4f6fa;font-size:18px}.welcome-status span{color:#e2b51a;font-size:9px}.welcome-flow{display:flex;align-items:center;justify-content:space-between;gap:7px;margin:20px 0;color:#dfe4ec;font-size:9px;font-weight:700}.welcome-flow span{border:1px solid #344057;border-radius:999px;padding:8px 11px}.welcome-flow i{color:#69758a;font-style:normal}.welcome-panel>footer{display:flex;align-items:center;justify-content:flex-end;gap:9px;border-top:1px solid #313b51;padding-top:18px}.welcome-panel>footer>small{margin-right:auto;color:#8f9aaf;font-size:8px}.welcome-panel>footer button{border:1px solid #4a566e;border-radius:999px;background:#11182a;color:#e6eaf1;padding:11px 17px;font-size:9px;font-weight:800}.welcome-panel>footer .primary{border-color:#e2b51a;background:#e2b51a;color:#080d19}@media(max-width:760px){.welcome-backdrop{padding:10px}.welcome-panel{max-height:95vh;overflow:auto;padding:20px}.welcome-panel>header{align-items:flex-start;gap:15px}.welcome-hero{padding:30px 0 20px}.welcome-hero h1{font-size:30px}.welcome-status{grid-template-columns:1fr}.welcome-flow{overflow-x:auto;justify-content:flex-start}.welcome-flow span{white-space:nowrap}.welcome-panel>footer{display:grid}.welcome-panel>footer>small{margin:0}.welcome-panel>footer button{width:100%}}

/* Learning and capital form one governed strategy spine. */
.strategy-surface{display:grid;grid-template-columns:minmax(0,1fr) 330px;gap:14px;margin-top:12px}.strategy-bar{grid-column:1/-1;display:flex;justify-content:space-between;align-items:center;min-height:70px;padding:13px 16px;border:1px solid #39455f;border-radius:13px;background:linear-gradient(100deg,#1f293e,#111827)}.strategy-bar small,.strategy-bar b{display:block}.strategy-bar small{color:#aeb8ca;font-size:9px;font-weight:700;letter-spacing:.1em}.strategy-bar b{margin-top:5px;color:#f3f5f8;font-size:15px}.strategy-bar button{min-height:34px;border:1px solid #e2b51a;border-radius:999px;background:#e2b51a;color:#080d1c;padding:0 14px;font-size:10px;font-weight:800;cursor:pointer}.strategy-stages{grid-column:1/-1;display:grid;grid-template-columns:repeat(5,1fr);gap:7px}.strategy-stages button{display:grid;grid-template-columns:27px 1fr;gap:8px;align-items:center;min-height:82px;padding:11px;border:1px solid #344058;border-radius:10px;background:#151d30;color:#eef1f6;text-align:left;cursor:pointer}.strategy-stages button:hover{border-color:#8d7838}.strategy-stages i{color:#e2b51a;font:9px ui-monospace,monospace;font-style:normal}.strategy-stages span small,.strategy-stages span b,.strategy-stages span em{display:block}.strategy-stages span small{color:#aeb8c9;font-size:9px}.strategy-stages span b{margin:2px 0;font-size:15px}.strategy-stages span em{color:#8995a9;font-size:8px;font-style:normal}.strategy-table{padding:16px;min-height:410px}.strategy-head,.strategy-row{display:grid;grid-template-columns:1fr 1.6fr .8fr .9fr;gap:12px;align-items:center}.strategy-head{min-height:42px;padding:9px;border-bottom:1px solid #354058}.strategy-head b{color:#aeb8c9;font-size:9px;letter-spacing:.06em}.strategy-row{width:100%;min-height:82px;padding:12px 9px;border:0;border-bottom:1px solid #354058;background:transparent;color:#e0e5ed;text-align:left;cursor:pointer}.strategy-row:hover{background:#202a3f}.strategy-row span{font-size:11px;font-weight:600;line-height:1.45}.strategy-row span:first-child{color:#fff;font-weight:750}.strategy-side{min-height:410px}.strategy-side dl{margin:13px 0}.strategy-side dl div{padding:13px 0;border-bottom:1px solid #354058}.strategy-side dt{color:#aeb8c9;font-size:9px;font-weight:650}.strategy-side dd{margin:5px 0 0;color:#fff;font-size:13px;font-weight:700}.strategy-side dl div:first-child dd{color:#e7c342}
@media(max-width:1100px){.strategy-surface{grid-template-columns:1fr}.strategy-bar,.strategy-stages{grid-column:1}.strategy-stages{grid-template-columns:repeat(3,1fr)}.strategy-side{min-height:0}}
@media(max-width:760px){.strategy-bar{align-items:flex-start;gap:12px;flex-direction:column}.strategy-stages{grid-template-columns:1fr 1fr}.strategy-table{overflow-x:auto}.strategy-head,.strategy-row{min-width:720px}.strategy-side dd{font-size:12px}}
.auth-modal{width:min(520px,92vw)}.auth-modal dl{display:grid;gap:8px;margin:18px 0}.auth-modal dl div{display:flex;justify-content:space-between;gap:18px;border-top:1px solid #354057;padding-top:9px}.auth-modal dt{color:#9ca8bb;font-size:9px;font-weight:700}.auth-modal dd{margin:0;color:#eef1f6;font-size:10px;font-weight:650;overflow-wrap:anywhere}.auth-modal .auth-choice{display:flex;align-items:center;gap:9px;letter-spacing:0}.auth-modal .auth-choice input{width:16px;height:16px;margin:0}.avatar{cursor:pointer}
.future-auth{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:16px}.future-auth button{height:38px;border:1px solid #354057;border-radius:9px;background:#11182a;color:#7f8a9d;font-size:9px;font-weight:700}.auth-modal input[autocomplete="one-time-code"]{font:700 24px ui-monospace,monospace;letter-spacing:.35em;text-align:center}
.auth-gate{min-height:100vh;display:grid;grid-template-columns:minmax(280px,1fr) minmax(420px,600px);align-items:stretch;background:radial-gradient(circle at 28% 48%,rgb(255 198 0 / .13),transparent 32%),#070c1b;color:#f5f7fb}.auth-gate-brand{display:flex;flex-direction:column;justify-content:center;padding:clamp(40px,8vw,140px);border-right:1px solid #273149}.auth-gate-brand strong{color:#ffc400;font-size:clamp(32px,5vw,72px);letter-spacing:.04em}.auth-gate-brand span{margin-top:8px;color:#9ca9bf;font-size:11px;font-weight:800;letter-spacing:.24em}.auth-gate-brand i{width:72px;height:3px;margin:38px 0;background:#ffc400}.auth-gate-brand p{max-width:540px;font-size:clamp(18px,2vw,28px);font-weight:650;line-height:1.35}.auth-gate-card{align-self:center;margin:clamp(24px,6vw,80px);padding:clamp(28px,4vw,52px);border:1px solid #33405a;border-radius:20px;background:linear-gradient(145deg,#182238,#101728);box-shadow:0 30px 80px rgb(0 0 0 / .38)}.auth-gate-top{display:flex;align-items:center;justify-content:space-between;color:#ffc400;font-size:10px;font-weight:850;letter-spacing:.14em}.auth-gate h1{margin:38px 0 12px;font-size:clamp(30px,4vw,48px);line-height:1.08}.auth-gate-form p{color:#c3ccda;font-size:15px;line-height:1.55}.auth-gate-form label{display:grid;gap:9px;margin-top:28px;color:#b5c0d2;font-size:10px;font-weight:800;letter-spacing:.12em}.auth-gate-form input{height:52px;padding:0 15px;border:1px solid #465570;border-radius:10px;background:#0b1222;color:#fff;font-size:16px;outline:none}.auth-gate-form input:focus{border-color:#ffc400;box-shadow:0 0 0 3px rgb(255 196 0 / .12)}.auth-gate-form input[autocomplete="one-time-code"]{font:750 26px ui-monospace,monospace;letter-spacing:.3em;text-align:center}.auth-gate-submit{width:100%;height:48px;margin-top:18px}.auth-gate-actions{display:flex;gap:10px;margin-top:18px}.auth-gate-actions button{min-height:44px;flex:1}.auth-gate-card>small{display:block;margin-top:28px;padding-top:20px;border-top:1px solid #33405a;color:#8f9cb1;font-size:11px;line-height:1.5}.auth-gate-error{margin:24px 0;padding:16px;border:1px solid #8c4b52;border-radius:10px;background:#351c27;color:#ffb3bd;line-height:1.5}@media(max-width:820px){.auth-gate{grid-template-columns:1fr}.auth-gate-brand{min-height:220px;padding:40px;border-right:0;border-bottom:1px solid #273149}.auth-gate-brand p{font-size:18px}.auth-gate-card{margin:24px}.auth-gate-actions{flex-direction:column}}
.intake-drop{border:1px dashed #4b5d79;border-radius:12px;padding:18px;background:#0c1426}
.intake-drop input{margin:10px 0}
.intake-drop span,.intake-promise span{display:block;color:#b9c8e5;line-height:1.5}
.intake-promise{margin:18px 0;padding:16px 18px;border-left:3px solid #ffc400;background:rgba(255,196,0,.06)}
.intake-promise b{display:block;margin-bottom:6px;color:#ffc400}
.understanding-review h2{font-size:18px;line-height:1.45;margin:14px 0}
.understanding-review dl{display:grid;gap:10px}
.understanding-review dl div{padding:10px 0;border-bottom:1px solid #2a3852}
.understanding-review dt{color:#8fa8cf;font-size:11px;font-weight:800;letter-spacing:.08em}
.understanding-review dd{margin:5px 0 0;color:#fff;font-weight:600;line-height:1.45}
.danger-zone{margin-top:24px;padding-top:16px;border-top:1px solid #493044}
.danger-zone button{border-color:#814055;color:#ff9caf;background:#1a1020}
.danger-zone button:hover{background:#351522}
.pending-analysis>p{color:#c4d1e8;line-height:1.55}
.analysis-progress{display:grid;gap:8px;margin:18px 0}
.analysis-progress span{display:grid;grid-template-columns:30px 1fr;gap:2px 10px;padding:12px;border:1px solid #30405d;border-radius:8px;background:#0d1628}
.analysis-progress i{grid-row:1/3;display:grid;place-items:center;width:28px;height:28px;border:1px solid #52647f;border-radius:50%;color:#8fa8cf;font-style:normal;font-weight:800}
.analysis-progress b{color:#fff}
.analysis-progress small{color:#9cafcc}
.analysis-progress .done{border-color:#7f6a20;background:rgba(255,196,0,.06)}
.analysis-progress .done i{border-color:#ffc400;background:#ffc400;color:#07101e}
.research-result>p{color:#c4d1e8;line-height:1.55}.research-claims{margin:16px 0;padding:14px;border:1px solid #34435e;border-radius:10px;background:#0d1628}.research-claims h3,.research-sources h3{margin:12px 0 8px;color:#e2b51a;font-size:9px;letter-spacing:.1em}.research-claims h3:first-child{margin-top:0}.research-claims p{margin:7px 0;color:#e4e9f1;font-size:11px;line-height:1.45}.research-sources{display:grid;gap:7px;margin:16px 0}.research-sources h3{grid-column:1/-1}.research-sources a{display:grid;gap:4px;padding:10px;border:1px solid #35435d;border-radius:8px;background:#10192b;color:#f2f5f9;text-decoration:none}.research-sources a:hover{border-color:#e2b51a}.research-sources b{font-size:10px}.research-sources small{color:#93a6c5;font-size:8px;overflow-wrap:anywhere}
.product-passport{display:flex;justify-content:space-between;gap:20px;padding:18px 0}.product-passport>div{max-width:720px}.product-passport>div>small{color:#e2b51a;font-size:8px;font-weight:800;letter-spacing:.1em}.product-passport h2{font-size:28px;margin:7px 0}.product-passport p{margin:0;color:#eef2f8;font-size:14px;font-weight:650;line-height:1.55}.product-passport>span{align-self:flex-start;display:grid;gap:4px;min-width:200px;padding:11px;border:1px solid #725f24;border-radius:9px;background:#262412}.product-passport>span b{color:#ffd54a;font-size:9px}.product-passport>span small{color:#c4b978;font-size:8px}.understanding-status{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.understanding-status article{display:flex;justify-content:space-between;align-items:center;padding:11px 13px;border:1px solid #35435e;border-radius:9px;background:#10192b}.understanding-status small{color:#a9b7cc;font-size:8px;font-weight:750}.understanding-status b{color:#fff;font-size:18px}.semantic-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:12px 0}.semantic-grid section,.research-boundary section{padding:14px;border:1px solid #34435e;border-radius:10px;background:#0d1628}.semantic-grid h3,.research-boundary h3,.raw-observations summary{margin:0 0 9px;color:#e2b51a;font-size:9px;font-weight:800;letter-spacing:.09em}.semantic-grid p,.research-boundary p,.raw-observations p{margin:7px 0;color:#e5ebf5;font-size:11px;line-height:1.5}.research-boundary{display:grid;grid-template-columns:1.25fr 1fr 1fr;gap:10px;margin:12px 0}.research-boundary .system-research{border-color:#385b55}.research-boundary .risks{border-color:#66532f}.research-boundary .owner-questions{border-color:#4b4564}.raw-observations{margin:12px 0;padding:12px;border:1px solid #34435e;border-radius:9px;background:#10192b}.raw-observations summary{margin:0;cursor:pointer}.raw-observations[open] summary{margin-bottom:10px}.analysis-meta{display:block;color:#8297b8;font-size:8px;overflow-wrap:anywhere}.product-decision{position:sticky;bottom:8px;display:flex;align-items:center;justify-content:space-between;gap:15px;margin-top:14px;padding:12px 14px;border:1px solid #44526c;border-radius:11px;background:rgba(15,23,40,.96);box-shadow:0 12px 28px rgba(0,0,0,.3);backdrop-filter:blur(10px)}.product-decision>p{margin:0;max-width:520px;color:#bfc9d9;font-size:10px;line-height:1.45}.product-decision .modal-actions{margin:0;flex-wrap:wrap}.danger-zone{grid-column:1/-1}
@media(max-width:900px){.research-boundary{grid-template-columns:1fr}.product-passport{display:grid}.product-passport>span{min-width:0}.product-decision{position:static;display:grid}.product-decision .modal-actions{justify-content:flex-start}}
@media(max-width:720px){.semantic-grid,.understanding-status{grid-template-columns:1fr}.semantic-grid p,.research-boundary p,.raw-observations p{font-size:11px}.research-result .modal-actions{display:grid;grid-template-columns:1fr}.research-result .modal-actions button{width:100%;min-height:40px;height:auto;padding:8px 12px}.product-passport h2{font-size:23px}.product-passport p{font-size:12px}}
.strategic-verdict{display:flex;justify-content:space-between;gap:24px;padding:22px;margin:0 0 16px;border:1px solid #ad8b16;background:linear-gradient(135deg,rgba(255,197,0,.12),rgba(12,23,43,.3));border-radius:12px}.strategic-verdict small,.analyst-opinion small,.analyst-question small{color:#ffc400;font-weight:800;letter-spacing:.1em}.strategic-verdict h2{font-size:20px;line-height:1.35;margin:8px 0}.strategic-verdict p{max-width:850px}.disposition{align-self:flex-start;padding:8px 12px;border:1px solid #ffc400;border-radius:999px;color:#ffc400;font-weight:900;font-size:11px}.strategy-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:16px}.strategy-grid section{padding:16px;border:1px solid #33445f;border-radius:10px;background:#0d182c}.strategy-grid h3{color:#ffc400;font-size:11px;letter-spacing:.08em}.analyst-cta{border-color:#ffc400!important;color:#ffc400!important}
.analyst-backdrop{z-index:180}.analyst-modal{width:min(980px,calc(100vw - 32px));max-height:92vh;overflow:auto;padding:0;background:#101b30}.analyst-modal>header{position:sticky;top:0;z-index:2;display:flex;align-items:center;justify-content:space-between;padding:22px 24px;background:#101b30;border-bottom:1px solid #33445f}.analyst-modal>header h2{margin:6px 0 0}.analyst-modal>header button{font-size:26px}.council-roles{display:grid;grid-template-columns:repeat(6,1fr);gap:6px;padding:16px 24px}.council-roles span{padding:10px;border:1px solid #33445f;border-radius:8px}.council-roles b{display:block;color:#ffc400;font-size:10px}.council-roles small{font-size:10px;line-height:1.3}.analyst-opinion,.analyst-question{margin:0 24px 14px;padding:18px;border:1px solid #806b20;border-radius:10px;background:rgba(255,196,0,.06)}.analyst-opinion p{font-size:16px;line-height:1.55}.analyst-thread{display:flex;flex-direction:column;gap:10px;padding:0 24px;max-height:310px;overflow:auto}.analyst-thread article{max-width:78%;padding:14px 16px;border-radius:12px}.analyst-thread article p{margin:5px 0;line-height:1.5}.owner-turn{align-self:flex-end;background:#24314a}.factory-turn{align-self:flex-start;border:1px solid #3c506f;background:#0b1528}.analyst-alternatives{display:grid;gap:6px;margin-top:10px}.analyst-alternatives button{text-align:left;white-space:normal}.analyst-question h3{font-size:18px;line-height:1.4}.analyst-modal form{padding:0 24px 24px}.analyst-modal textarea{width:100%;min-height:100px}.analyst-controls{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}.analyst-controls .primary{margin-left:auto}
@media(max-width:760px){.strategy-grid{grid-template-columns:1fr}.strategic-verdict{flex-direction:column}.analyst-modal{width:100vw;height:100dvh;max-height:none;border-radius:0}.council-roles{grid-template-columns:repeat(2,1fr)}.analyst-thread article{max-width:92%}.analyst-controls button{width:100%;margin-left:0!important}}
.council-views{display:grid;gap:7px;margin-top:12px}.council-views div{display:grid;grid-template-columns:82px 1fr;gap:10px;padding:9px;border-left:2px solid #ffc400;background:#111d33}.council-views b{color:#ffc400;font-size:10px}.council-views span{font-size:12px;line-height:1.45}

/* Final council theme overrides must follow the legacy analyst styles above. */
.analyst-modal>header button[data-action="close-analyst"]{display:grid;place-items:center;flex:0 0 40px;width:40px;height:40px;padding:0;border:1px solid #465570;border-radius:9px;background:#0c1527;color:#f4f6f9;font-size:24px;font-weight:500;line-height:1}.analyst-modal>header button[data-action="close-analyst"]:hover{border-color:#e2b51a;color:#e2b51a}.analyst-modal textarea{border:1px solid #40506c;background:#0c1527;color:#f4f6f9;font-size:13px;line-height:1.5}.analyst-controls button{min-height:38px;border:1px solid #465570;background:#111c31;color:#eef2f7;font-size:10px;font-weight:750}.analyst-controls button:hover:not(:disabled){border-color:#e2b51a;color:#e2b51a}.analyst-controls button.primary{border-color:#e2b51a;background:#e2b51a;color:#080d1c}.analyst-controls button:disabled{border-color:#364158;background:#1a2334;color:#9ea9bb;opacity:1;cursor:wait}.analyst-controls button.primary:disabled{position:relative;padding-left:30px;background:#263147;color:#d4dae4}.analyst-controls button.primary:disabled:before{content:"";position:absolute;left:12px;width:10px;height:10px;border:2px solid #65728a;border-top-color:#e2b51a;border-radius:50%;animation:cycle-spin .8s linear infinite}.analyst-alternatives button{min-height:42px;padding:10px 12px;border:1px solid #3f4e69;border-left:3px solid #e2b51a;border-radius:8px;background:#101b30;color:#e9edf4;font-size:11px;font-weight:650;line-height:1.4;text-align:left;white-space:normal}.analyst-alternatives button:hover{border-color:#e2b51a;background:#182238;color:#fff}.analyst-alternatives button:before{content:"ВАРИАНТ · ";color:#e2b51a;font-size:9px;font-weight:850;letter-spacing:.06em}
.brand-registry-empty{display:grid;grid-template-columns:48px minmax(0,1fr) auto;align-items:center;gap:16px;min-height:130px;padding:22px}.brand-registry-empty>i{display:grid;place-items:center;width:48px;height:48px;border:1px solid #5f522c;border-radius:12px;background:#211f18;color:#e2b51a;font-size:24px;font-style:normal}.brand-registry-empty b,.brand-registry-empty span{display:block}.brand-registry-empty b{color:#f2f4f8;font-size:14px}.brand-registry-empty span{max-width:650px;margin-top:7px;color:#aeb9ca;font-size:11px;line-height:1.5}.brand-registry-empty button{min-height:42px;border-color:#e2b51a;background:#e2b51a;color:#080d1c;font-size:10px;font-weight:850}@media(max-width:760px){.brand-registry-empty{grid-template-columns:44px 1fr}.brand-registry-empty button{grid-column:1/-1;width:100%}}
.analyst-modal>header .analyst-reset{width:auto;height:36px;margin-left:auto;margin-right:10px;padding:0 13px;border:1px solid #465570;border-radius:8px;background:#111c31;color:#dce2eb;font-size:9px;font-weight:800}.analyst-modal>header .analyst-reset:hover{border-color:#e2b51a;color:#e2b51a}@media(max-width:620px){.analyst-modal>header .analyst-reset{max-width:132px;height:auto;min-height:36px;padding:7px;font-size:8px}}
.analyst-inline-error{margin:0 0 12px;padding:12px 14px;border:1px solid #efbd19;background:#2a2518;color:#fff;font-weight:700}
.answered-question{margin:10px 0 4px;padding:9px 14px;border-left:2px solid #66748f;background:#111a2c;color:#9facbf}.answered-question small{font-size:9px;font-weight:800;letter-spacing:.12em}.answered-question p{margin:3px 0 0;font-size:12px;line-height:1.4}.analyst-question.discussing h3{font-size:16px;color:#d8deea}.analyst-live-progress{display:grid;grid-template-columns:1fr auto;gap:8px 14px;margin-top:18px}.analyst-live-progress span{font-size:12px;color:#cbd4e4}.analyst-live-progress b{font-size:11px;color:#efbd19}.analyst-live-progress em{grid-column:1/-1;display:block;height:7px;overflow:hidden;border:1px solid #42516e;background:#0b1322}.analyst-live-progress i{display:block;height:100%;width:8%;background:#efbd19;transition:width .8s ease}
.council-intro{margin:16px 24px 0;padding:12px 14px;border-left:3px solid #e2b51a;background:#0c1629;color:#cdd5e2;font-size:12px;font-weight:600;line-height:1.55}
.decision-scales{margin-top:12px;border:1px solid #43516b;border-radius:10px;background:#0b1425;overflow:hidden}.decision-scales header{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 12px;border-bottom:1px solid #344159}.decision-scales small{color:#e2b51a;font-size:9px;font-weight:850;letter-spacing:.08em}.decision-scales header b{color:#f0f3f7;font-size:10px}.decision-scales>div{display:grid;grid-template-columns:1fr 1fr}.decision-scales section{padding:12px}.decision-scales section+section{border-left:1px solid #344159}.decision-scales p{margin:7px 0 0;color:#d8dfea;font-size:11px;line-height:1.45}.decision-scales footer{padding:12px;border-top:1px solid #344159;background:rgba(226,181,26,.055)}.decision-scales footer p{color:#f0f3f7;font-weight:650}.decision-scales footer p:before{content:"→ ";color:#e2b51a}@media(max-width:620px){.decision-scales>div{grid-template-columns:1fr}.decision-scales section+section{border-left:0;border-top:1px solid #344159}.decision-scales header{align-items:flex-start;flex-direction:column}}
.primary-nav{display:flex;align-items:center;gap:3px;padding:0 10px}.primary-nav button{height:32px;padding:0 11px;border:0;border-radius:8px;background:transparent;color:#aeb8c9;font-size:9px;font-weight:750;cursor:pointer}.primary-nav button:hover{background:#151d30;color:#fff}.owner-workbench{display:grid;gap:14px;margin-top:14px}.owner-workbench-head{display:flex;justify-content:space-between;align-items:flex-end;gap:20px;padding:22px;border:1px solid #39445d;border-radius:14px;background:linear-gradient(115deg,#1e2739,#101727)}.owner-workbench-head small{color:#e2b51a;font-size:9px;font-weight:850;letter-spacing:.1em}.owner-workbench-head h2{margin:7px 0 5px;color:#fff;font-size:25px}.owner-workbench-head p{margin:0;color:#b6c0d0}.owner-workbench button.primary,.owner-brand-card button,.owner-empty button{min-height:39px;padding:0 15px;border:1px solid #e2b51a;border-radius:9px;background:#e2b51a;color:#080d1c;font-size:9px;font-weight:850;cursor:pointer}.owner-brand-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.owner-brand-card,.owner-empty{display:grid;min-height:230px;padding:20px;border:1px solid #37425a;border-radius:14px;background:linear-gradient(160deg,#1c253a,#121a2c);box-shadow:var(--shadow)}.owner-brand-card header{display:flex;justify-content:space-between;gap:15px}.owner-brand-card header small,.owner-brand-card footer small{color:#e2b51a;font-size:8px;font-weight:800;letter-spacing:.08em}.owner-brand-card h2{margin:5px 0;color:#fff;font-size:24px}.owner-brand-card header>span{align-self:flex-start;padding:5px 8px;border:1px solid #49546a;border-radius:999px;color:#b9c2d1;font-size:8px}.owner-brand-card>p{color:#cbd2de;font-size:12px;line-height:1.55}.owner-brand-card footer{display:flex;justify-content:space-between;align-items:end;gap:18px;margin-top:auto;padding-top:15px;border-top:1px solid #354057}.owner-brand-card footer b{display:block;max-width:470px;margin-top:4px;color:#fff;font-size:12px}.owner-empty{grid-column:1/-1;place-items:start;align-content:center}.owner-empty b{font-size:20px}.owner-empty p{max-width:650px;color:#b9c2d1}.owner-contours{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}.owner-contours div{padding:14px;border:1px solid #313c54;border-radius:10px;background:#10182a}.owner-contours small,.owner-contours b,.owner-contours span{display:block}.owner-contours small{color:#e2b51a;font:8px ui-monospace,monospace}.owner-contours b{margin:8px 0 4px;color:#eef1f6;font-size:10px}.owner-contours span{color:#8f9aaf;font-size:9px}@media(max-width:1100px){.primary-nav{display:none}.owner-brand-grid{grid-template-columns:1fr}.owner-contours{grid-template-columns:1fr 1fr}}@media(max-width:760px){.owner-workbench-head{align-items:flex-start;flex-direction:column;padding:17px}.owner-workbench-head button{width:100%}.owner-brand-card{min-height:260px;padding:16px}.owner-brand-card footer{align-items:stretch;flex-direction:column}.owner-brand-card footer button{width:100%}.owner-contours{grid-template-columns:1fr}}
.discussion-history{margin:0 24px 14px;border:1px solid #354159;border-radius:10px;background:#0c1527}.discussion-history>summary{display:flex;justify-content:space-between;gap:15px;padding:13px 15px;color:#eef2f7;cursor:pointer;list-style:none}.discussion-history>summary::-webkit-details-marker{display:none}.discussion-history>summary span{font-size:10px;font-weight:850;letter-spacing:.08em}.discussion-history>summary span:before{content:"▸ ";color:#e2b51a}.discussion-history[open]>summary span:before{content:"▾ "}.discussion-history>summary b{color:#95a1b5;font-size:9px}.discussion-history .analyst-thread{max-height:320px;padding:0 14px 14px;overflow:auto}.discussion-history .factory-turn.compact .decision-scales,.discussion-history .factory-turn.compact .role-details,.discussion-history .factory-turn.compact .analyst-alternatives{display:none}.latest-outcome{margin:0 24px 14px;padding:15px;border:1px solid #43516b;border-radius:12px;background:#111b2f}.latest-outcome>header{display:flex;justify-content:space-between;margin-bottom:10px}.latest-outcome>header small{color:#e2b51a;font-size:9px;font-weight:850;letter-spacing:.08em}.latest-outcome>header b{color:#9faabc;font-size:10px}.latest-outcome .owner-turn,.latest-outcome .factory-turn{max-width:none;margin-top:8px;padding:13px;border-radius:9px}.latest-outcome .owner-turn{margin-left:12%;background:#24314a}.latest-outcome .factory-turn{border:1px solid #3c506f;background:#0b1528}.role-details{margin-top:10px;border-top:1px solid #354159;padding-top:10px}.role-details summary{color:#e2b51a;font-size:9px;font-weight:800;cursor:pointer}.analyst-question{position:relative;z-index:1;background:#1a2130}.analyst-modal form{position:relative;z-index:1;background:#101b30}.analyst-thread{max-height:none;overflow:visible}@media(max-width:760px){.discussion-history,.latest-outcome,.analyst-question{margin-left:12px;margin-right:12px}.latest-outcome .owner-turn{margin-left:0}.discussion-history .analyst-thread{max-height:260px}.analyst-opinion{margin-left:12px;margin-right:12px}.council-intro{margin-left:12px;margin-right:12px}}
