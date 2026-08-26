import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { applyOperatingCommand, factoryCadenceAt, initialOperatingState, productScreens, referenceGeographies, runRigZipDryRun, type OperatingCommand } from "@lattice/core";

const host = "127.0.0.1";
const port = Number(process.env.LATTICE_PORT ?? 4310);
const publicRoot = fileURLToPath(new URL("../public/", import.meta.url));
const mime: Record<string, string> = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".geojson": "application/geo+json; charset=utf-8", ".png": "image/png" };
let operatingState = initialOperatingState();

function json(response: import("node:http").ServerResponse, status: number, payload: unknown): void {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  response.end(JSON.stringify(payload));
}

async function readJson(request: import("node:http").IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let bytes = 0;
  for await (const chunk of request) {
    const buffer = Buffer.from(chunk);
    bytes += buffer.length;
    if (bytes > 32_768) throw new Error("Command payload is too large");
    chunks.push(buffer);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

createServer(async (request, response) => {
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("Referrer-Policy", "no-referrer");
  response.setHeader("X-Frame-Options", "DENY");
  response.setHeader("Content-Security-Policy", "default-src 'self'; style-src 'self'; script-src 'self'; connect-src 'self'; img-src 'self' data:");
  const requestUrl = new URL(request.url ?? "/", `http://${host}:${port}`);
  if (request.method === "GET" && requestUrl.pathname === "/api/v1/runtime-state") {
    json(response, 200, operatingState);
    return;
  }
  if (request.method === "GET" && requestUrl.pathname === "/api/v1/factory-status") {
    const generatedAt = new Date().toISOString();
    const readModel = runRigZipDryRun().readModel;
    json(response, 200, {
      generatedAt,
      cadence: factoryCadenceAt(generatedAt),
      runtimeVersion: operatingState.version,
      mode: operatingState.mode,
      openDecisions: operatingState.openDecisions,
      brands: readModel.portfolio.length + operatingState.brandProfiles.length,
      expansionMarkets: 4 + operatingState.discoveryMarkets.length,
      expansionAreas: operatingState.expansionAreas.length,
      availableCapitalUsd: readModel.wallet.availableUsd,
      killSwitch: readModel.authority.killSwitch,
      source: "LOCAL_GOVERNED_READ_MODEL",
    });
    return;
  }
  if (request.method === "POST" && requestUrl.pathname === "/api/v1/commands") {
    try {
      const command = await readJson(request) as OperatingCommand;
      operatingState = applyOperatingCommand(operatingState, command, new Date().toISOString());
      json(response, 200, operatingState);
    } catch (error) {
      json(response, 400, { error: error instanceof Error ? error.message : "Invalid command" });
    }
    return;
  }
  if (request.method === "GET" && requestUrl.pathname === "/api/v1/control-room") {
    response.writeHead(200, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
    response.end(JSON.stringify(runRigZipDryRun().readModel));
    return;
  }
  if (request.method === "GET" && requestUrl.pathname === "/api/v1/screens") {
    response.writeHead(200, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
    response.end(JSON.stringify({ screens: productScreens }));
    return;
  }
  if (request.method === "GET" && requestUrl.pathname === "/api/v1/geographies") {
    response.writeHead(200, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
    response.end(JSON.stringify({ geographies: referenceGeographies.list() }));
    return;
  }
  if (request.method === "GET" && requestUrl.pathname === "/api/v1/country-catalog") {
    const names = new Intl.DisplayNames(["ru"], { type: "region" });
    const isoAlpha2 = "AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW".split(" ");
    const countries = isoAlpha2.map((code) => ({ code, name: names.of(code) ?? code }));
    response.writeHead(200, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "public, max-age=86400" });
    response.end(JSON.stringify({ countries: countries.sort((a, b) => a.name.localeCompare(b.name, "ru")) }));
    return;
  }
  if (request.method !== "GET") {
    response.writeHead(405, { Allow: "GET, POST" }); response.end("Method not allowed"); return;
  }
  const isApplicationRoute = productScreens.some((screen) => screen.route === requestUrl.pathname)
    || requestUrl.pathname.startsWith("/markets/")
    || requestUrl.pathname.startsWith("/brands/");
  const requested = requestUrl.pathname === "/" || isApplicationRoute ? "index.html" : requestUrl.pathname.slice(1);
  const safePath = normalize(requested).replace(/^(\.\.(\\|\/|$))+/, "");
  try {
    const body = await readFile(join(publicRoot, safePath));
    response.writeHead(200, { "Content-Type": mime[extname(safePath)] ?? "application/octet-stream", "Cache-Control": "no-store" });
    response.end(body);
  } catch {
    response.writeHead(404); response.end("Not found");
  }
}).listen(port, host, () => process.stdout.write(`LATTICE Control Room: http://${host}:${port}\n`));
