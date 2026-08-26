const palette = ["#e8e4dc", "#c5e5e5", "#7dc4c4", "#3d9e9e", "#2f7a7a", "#1a4d4d"];

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
  return 8 + (Math.abs(value) % 850) / 10;
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
    const all = collection.features.flatMap((feature) => rings(feature).flatMap((polygon) => polygon.flatMap((ring) => ring.map((point) => usCoordinate(point, feature.properties.STUSPS)))));
    const xs = all.map(([x]) => x), ys = all.map(([, y]) => y);
    const bounds = { minX:Math.min(...xs), maxX:Math.max(...xs), minY:Math.min(...ys), maxY:Math.max(...ys) };
    const width = 760, height = 330, padding = 12;
    const scale = Math.min((width - padding * 2) / (bounds.maxX - bounds.minX), (height - padding * 2) / (bounds.maxY - bounds.minY));
    const project = ([x,y]) => [padding + (x - bounds.minX) * scale, height - padding - (y - bounds.minY) * scale];
    const paths = collection.features.map((feature) => {
      const name = feature.properties.NAME ?? feature.properties.shapeName;
      const id = feature.properties.GEOID ?? feature.properties.shapeID;
      const value = score(id);
      const bucket = Math.min(5, Math.floor(value / 17));
      const route = mode === "states" && feature.properties.STUSPS === "NE" ? "/markets/nebraska" : `${container.dataset.geoBase}/${slug(name)}`;
      return `<path d="${pathFor(feature, project, feature.properties.STUSPS)}" fill="${palette[bucket]}" data-route="${route}" tabindex="0" role="link" aria-label="${name}: проникновение ${value.toFixed(1)}%"><title>${name} · проникновение ${value.toFixed(1)}% · demo</title></path>`;
    }).join("");
    container.innerHTML = `<svg class="choropleth" viewBox="0 0 ${width} ${height}" aria-label="Интерактивная карта административных единиц">${paths}</svg><div class="map-legend"><span>ПРОНИКНОВЕНИЕ · DEMO</span>${palette.map((color,index)=>`<i style="--swatch:${color}">${index*17}${index===5?"+":"–"+(index+1)*17}%</i>`).join("")}<b>Наведите или выберите область</b></div><small class="map-source">${container.dataset.geoAttribution}</small>`;
  }));
}
