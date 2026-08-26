const palette = ["#273044", "#34425a", "#465970", "#63748a", "#9b8338", "#e2b51a"];
const macroRegions = {
  NORTH_AMERICA:["CAN","USA","MEX","GRL","BLZ","GTM","HND","SLV","NIC","CRI","PAN","BHS","CUB","JAM","HTI","DOM","TTO"],
  EUROPE:["ALB","AND","AUT","BEL","BGR","BIH","BLR","CHE","CZE","DEU","DNK","ESP","EST","FIN","FRA","GBR","GRC","HRV","HUN","IRL","ISL","ITA","LTU","LUX","LVA","MDA","MKD","MNE","NLD","NOR","POL","PRT","ROU","SRB","SVK","SVN","SWE","UKR"],
  LATAM:["MEX","BLZ","GTM","HND","SLV","NIC","CRI","PAN","CUB","HTI","DOM","JAM","TTO","ARG","BOL","BRA","CHL","COL","ECU","GUY","PRY","PER","SUR","URY","VEN"],
  ASIA:["AFG","ARM","AZE","BGD","BTN","CHN","GEO","IDN","IND","JPN","KAZ","KGZ","KHM","KOR","LAO","LKA","MMR","MNG","MYS","NPL","PAK","PHL","PRK","SGP","THA","TJK","TKM","TLS","UZB","VNM"],
  AFRICA:["AGO","BDI","BEN","BFA","BWA","CAF","CIV","CMR","COD","COG","COM","CPV","DJI","DZA","EGY","ERI","ESH","ETH","GAB","GHA","GIN","GMB","GNB","GNQ","KEN","LBR","LBY","LSO","MAR","MDG","MLI","MOZ","MRT","MUS","MWI","NAM","NER","NGA","RWA","SDN","SEN","SLE","SOM","SSD","SWZ","TCD","TGO","TUN","TZA","UGA","ZAF","ZMB","ZWE"],
  MIDDLE_EAST:["ARE","BHR","CYP","EGY","IRN","IRQ","ISR","JOR","KWT","LBN","OMN","PSE","QAT","SAU","SYR","TUR","YEM"],
  OCEANIA:["AUS","FJI","FSM","KIR","MHL","NRU","NZL","PLW","PNG","SLB","TON","TUV","VUT","WSM"]
};

function slug(value) {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function rings(feature) {
  return feature.geometry.type === "Polygon" ? [feature.geometry.coordinates] : feature.geometry.coordinates;
}

function usCoordinate([longitude, latitude], code) {
  if (code === "AK") return [-124 + ((longitude + 180) / 50) * 12, 24 + ((latitude - 51) / 21) * 7];
  if (code === "HI") return [-111 + ((longitude + 161) / 7) * 7, 24 + ((latitude - 18) / 5) * 4];
  return [longitude, latitude];
}

function score(id) {
  let value = 2166136261;
  for (const character of id) value = Math.imul(value ^ character.charCodeAt(0), 16777619);
  return 0.2 + (Math.abs(value) % 278) / 10;
}

function bucketFor(value) {
  return value < 1 ? 0 : value < 3 ? 1 : value < 5 ? 2 : value < 10 ? 3 : value < 20 ? 4 : 5;
}

function pathFor(feature, project, code) {
  return rings(feature).map((polygon) => polygon.map((ring) => ring.map((coordinate, index) => {
    const [x, y] = project(usCoordinate(coordinate, code));
    return `${index ? "L" : "M"}${x.toFixed(2)},${y.toFixed(2)}`;
  }).join("") + "Z").join(" ")).join(" ");
}

export async function renderChoropleths(root = document) {
  const maps = [...root.querySelectorAll("[data-geo-source]")];
  await Promise.all(maps.map(async (container) => {
    const response = await fetch(container.dataset.geoSource);
    if (!response.ok) throw new Error(`Boundary dataset unavailable: ${container.dataset.geoSource}`);
    const collection = await response.json();
    const mode = container.dataset.geoMode;
    const region = container.dataset.geoRegion;
    const activeCountries = new Map((container.dataset.activeCountries ?? "").split(",").filter(Boolean).map((item)=>{ const [id,value] = item.split(":"); return [id,Number(value)]; }));
    const activeAreas = new Set((container.dataset.activeAreas ?? "").split(",").filter(Boolean));
    const visibleFeatures = mode === "country-focus"
      ? collection.features.filter((feature)=>feature.id===container.dataset.geoFocus)
      : mode === "countries" && region !== "WORLD" ? collection.features.filter((feature)=>macroRegions[region]?.includes(feature.id)) : collection.features;
    const all = visibleFeatures.flatMap((feature) => rings(feature).flatMap((polygon) => polygon.flatMap((ring) => ring.map((point) => usCoordinate(point, feature.properties.STUSPS)))));
    const xs = all.map(([x]) => x), ys = all.map(([, y]) => y);
    const bounds = { minX:Math.min(...xs), maxX:Math.max(...xs), minY:Math.min(...ys), maxY:Math.max(...ys) };
    const width = 760, height = 330, padding = 12;
    const scale = Math.min((width - padding * 2) / (bounds.maxX - bounds.minX), (height - padding * 2) / (bounds.maxY - bounds.minY));
    const usedWidth = (bounds.maxX - bounds.minX) * scale;
    const usedHeight = (bounds.maxY - bounds.minY) * scale;
    const offsetX = (width - usedWidth) / 2;
    const offsetY = (height - usedHeight) / 2;
    const project = ([x,y]) => [offsetX + (x - bounds.minX) * scale, height - offsetY - (y - bounds.minY) * scale];
    const scoredFeatures = visibleFeatures.map((feature) => {
      const name = feature.properties.NAME ?? feature.properties.name ?? feature.properties.shapeName;
      const id = feature.properties.GEOID ?? feature.properties.shapeID ?? feature.id;
      const isExpansionMarket = mode !== "countries" || activeCountries.has(feature.id);
      const value = mode === "countries" ? activeCountries.get(feature.id) ?? 0 : mode === "country-focus" ? 0.2 : score(id);
      const bucket = bucketFor(value);
      const route = mode === "states" && feature.properties.STUSPS === "NE" ? "/markets/nebraska" : `${container.dataset.geoBase}/${slug(name)}`;
      return { feature, name, value, bucket, route, isExpansionMarket };
    });
    const paths = scoredFeatures.map(({feature,name,value,bucket,route,isExpansionMarket}) => {
      const alpha2=feature.properties.iso_a2;
      const countryCode = mode === "states" || mode === "counties" ? "US" : container.dataset.geoCountry ?? "";
      const unitType = mode === "states" ? "state" : mode === "counties" ? "county" : "region";
      const areaToken = encodeURIComponent(JSON.stringify({countryCode,adminUnitId:String(feature.properties.GEOID ?? feature.properties.shapeID ?? feature.id),name,unitType,route}));
      const isSelectedArea = activeAreas.has(`${countryCode}:${String(feature.properties.GEOID ?? feature.properties.shapeID ?? feature.id)}`);
      const action=mode === "country-focus" ? ""
        : mode === "countries" && !isExpansionMarket && alpha2
        ? `data-geo-action="add-expansion" data-geo-code="${alpha2}:${feature.id}"`
        : mode !== "countries" ? `data-geo-action="inspect-area" data-geo-area="${areaToken}"` : `data-route="${route}"`;
      return `<path d="${pathFor(feature, project, feature.properties.STUSPS)}" fill="${isExpansionMarket ? palette[bucket] : "#252d3e"}" class="${isExpansionMarket ? "market-active" : "market-inactive"}${isSelectedArea ? " area-in-expansion" : ""}" ${action} tabindex="0" role="link" aria-label="${name}: ${isSelectedArea ? "в текущей экспансии" : isExpansionMarket ? `проникновение ${value.toFixed(1)}%` : alpha2 ? "добавить в экспансию" : "добавление требует настройки"}"><title>${name} · ${mode === "countries" ? isExpansionMarket ? `проникновение ${value.toFixed(1)}% · demo` : alpha2 ? "нажмите, чтобы добавить в экспансию" : "требуется отдельная настройка территории" : `${isSelectedArea ? "в текущей экспансии · " : ""}проникновение ${value.toFixed(1)}% · нажмите для действий`}</title></path>`;
    }).join("");
    const listedFeatures = mode === "country-focus" ? [] : mode === "states"
      ? scoredFeatures.filter(({feature}) => feature.properties.STUSPS !== "DC").toSorted((a,b)=>a.name.localeCompare(b.name))
      : mode === "countries"
      ? scoredFeatures.filter(({isExpansionMarket})=>isExpansionMarket).toSorted((a,b)=>a.name.localeCompare(b.name))
      : scoredFeatures.toSorted((a,b)=>b.value-a.value).slice(0,10);
    const rankingLabel = mode === "country-focus" ? "ВНУТРЕННИЕ АДМИНИСТРАТИВНЫЕ ЕДИНИЦЫ ПОДГОТАВЛИВАЮТСЯ" : mode === "states" ? `ВСЕ ШТАТЫ · ${listedFeatures.length}` : mode === "countries" ? `РЫНКИ В ЭКСПАНСИИ · ${listedFeatures.length}` : mode === "counties" ? "ТЕРРИТОРИИ С НАИБОЛЬШИМ СИГНАЛОМ" : "РЕГИОНЫ С НАИБОЛЬШИМ СИГНАЛОМ";
    const ranking = listedFeatures.map(({name,value,route},index)=>`<button data-route="${route}"><i>${String(index+1).padStart(2,"0")}</i><span>${name}</span><b>${value.toFixed(1)}%</b></button>`).join("");
    const ranges = ["< 1%","1–3%","3–5%","5–10%","10–20%","> 20%"];
    container.innerHTML = `<div class="map-canvas"><span class="metric-badge">АНАЛИТИЧЕСКИЙ СЛОЙ: <b>OPPORTUNITY</b> · <strong>DEMO</strong></span><svg class="choropleth" viewBox="0 0 ${width} ${height}" aria-label="Интерактивная карта административных единиц">${paths}</svg></div><section class="region-ranking ${mode === "states" ? "region-ranking-states" : mode === "countries" ? "region-ranking-countries" : ""}"><h3>${rankingLabel}</h3><div>${ranking || `<p class="empty-markets">${mode === "country-focus" ? "Система определяет принятый административный уровень страны и проверяет источник полигонов." : "В выбранном регионе пока нет добавленных рынков."}</p>`}</div></section><div class="legend-scale">${palette.map((color,index)=>`<div><i class="swatch-${index}"></i><span>${ranges[index]}</span></div>`).join("")}</div><div class="uncertainty-legend"><span><i></i>Прямые данные</span><span class="limited"><i></i>Ограниченные данные</span><span class="modelled"><i></i>Модельная оценка</span><b>Наведите или выберите область</b></div><small class="map-source">${container.dataset.geoAttribution} · METRIC DATA: DEMO</small>`;
  }));
}
