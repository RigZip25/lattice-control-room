import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { productScreens } from "@lattice/core";
import { blueprints } from "../public/screen-blueprints.js";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const [html, css, app, mapModule, statesRaw, countiesRaw] = await Promise.all([
  readFile(join(root, "public", "index.html"), "utf8"),
  readFile(join(root, "public", "styles.css"), "utf8"),
  readFile(join(root, "public", "app.js"), "utf8"),
  readFile(join(root, "public", "map.js"), "utf8"),
  readFile(join(root, "public", "data", "maps", "us-states.geojson"), "utf8"),
  readFile(join(root, "public", "data", "maps", "nebraska-counties.geojson"), "utf8"),
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
const states = JSON.parse(statesRaw);
const counties = JSON.parse(countiesRaw);
if (states.features.length !== 51 || counties.features.length !== 93) {
  throw new Error(`Administrative boundary coverage failed: ${states.features.length} states, ${counties.features.length} counties`);
}
for (const marker of ["data-geo-source", "renderChoropleths", "ADMINISTRATIVE BOUNDARIES", "NO SYNTHETIC CELLS"]) {
  if (!`${app}\n${mapModule}`.includes(marker)) throw new Error(`Missing geographic interaction marker: ${marker}`);
}
process.stdout.write("Verified 22 Figma screens plus 51-state and 93-county interactive boundary coverage.\n");
