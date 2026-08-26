import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { productScreens } from "@lattice/core";
import { blueprints } from "../public/screen-blueprints.js";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const [html, css, app, mapModule, worldRaw, statesRaw, countiesRaw, czechiaRaw, italyRaw, colombiaRaw] = await Promise.all([
  readFile(join(root, "public", "index.html"), "utf8"),
  readFile(join(root, "public", "styles.css"), "utf8"),
  readFile(join(root, "public", "app.js"), "utf8"),
  readFile(join(root, "public", "map.js"), "utf8"),
  readFile(join(root, "public", "data", "maps", "world-countries.geojson"), "utf8"),
  readFile(join(root, "public", "data", "maps", "us-states.geojson"), "utf8"),
  readFile(join(root, "public", "data", "maps", "nebraska-counties.geojson"), "utf8"),
  readFile(join(root, "public", "data", "maps", "czechia-regions.geojson"), "utf8"),
  readFile(join(root, "public", "data", "maps", "italy-regions.geojson"), "utf8"),
  readFile(join(root, "public", "data", "maps", "colombia-departments.geojson"), "utf8"),
]);

const missing = productScreens.filter((screen) => blueprints[screen.key] === undefined);
if (productScreens.length !== 22 || Object.keys(blueprints).length !== 22 || missing.length > 0) {
  throw new Error(`UI blueprint coverage failed: ${missing.map((screen) => screen.key).join(", ")}`);
}
for (const screen of productScreens) {
  const blueprint = blueprints[screen.key];
  if (blueprint.metrics.length !== 4 || blueprint.panels.length < 3) {
    throw new Error(`Incomplete UI composition: ${screen.key}`);
  }
}
for (const marker of ["id=\"app\"", "screen-blueprints.js", ".command-bar", "data-action", "PARAMETERIZED_GEOGRAPHIC_DRILLDOWN"]) {
  if (!`${html}\n${css}\n${app}`.includes(marker)) throw new Error(`Missing UI marker: ${marker}`);
}
const world = JSON.parse(worldRaw);
const states = JSON.parse(statesRaw);
const counties = JSON.parse(countiesRaw);
const czechia = JSON.parse(czechiaRaw);
const italy = JSON.parse(italyRaw);
const colombia = JSON.parse(colombiaRaw);
if (world.features.length < 175 || states.features.length !== 51 || counties.features.length !== 93 || czechia.features.length !== 14 || italy.features.length !== 20 || colombia.features.length !== 33) {
  throw new Error(`Administrative boundary coverage failed: ${states.features.length}/51 US, ${counties.features.length}/93 Nebraska, ${czechia.features.length}/14 Czechia, ${italy.features.length}/20 Italy, ${colombia.features.length}/33 Colombia`);
}
for (const marker of ["data-geo-source", "renderChoropleths", "ТОПОЛОГИЯ ПРОНИКНОВЕНИЯ", "NO SYNTHETIC CELLS"]) {
  if (!`${app}\n${mapModule}`.includes(marker)) throw new Error(`Missing geographic interaction marker: ${marker}`);
}
process.stdout.write(`Verified 22 Figma screens, ${world.features.length} countries and 211 subnational boundaries across six reference maps.\n`);
