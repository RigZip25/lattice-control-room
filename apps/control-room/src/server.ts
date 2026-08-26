import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { productScreens, referenceGeographies, runRigZipDryRun } from "@lattice/core";

const host = "127.0.0.1";
const port = Number(process.env.LATTICE_PORT ?? 4310);
const publicRoot = fileURLToPath(new URL("../public/", import.meta.url));
const mime: Record<string, string> = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8" };

createServer(async (request, response) => {
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("Referrer-Policy", "no-referrer");
  response.setHeader("X-Frame-Options", "DENY");
  response.setHeader("Content-Security-Policy", "default-src 'self'; style-src 'self'; script-src 'self'; connect-src 'self'; img-src 'self' data:");
  const requestUrl = new URL(request.url ?? "/", `http://${host}:${port}`);
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
    response.writeHead(405, { Allow: "GET" }); response.end("Method not allowed"); return;
  }
  const isApplicationRoute = productScreens.some((screen) => screen.route === requestUrl.pathname)
    || requestUrl.pathname.startsWith("/markets/");
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
