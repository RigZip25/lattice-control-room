import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

const port = 4391;
const base = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, ["dist/server.js"], {
  cwd: new URL("..", import.meta.url),
  env: { ...process.env, LATTICE_PORT:String(port) },
  stdio:["ignore", "pipe", "pipe"],
});

async function waitForServer() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try { if ((await fetch(`${base}/api/v1/runtime-state`)).ok) return; } catch {}
    await delay(100);
  }
  throw new Error("Control Room test server did not start");
}

async function json(path, options) {
  const response = await fetch(`${base}${path}`, options);
  const payload = await response.json();
  return { response, payload };
}

try {
  await waitForServer();
  const registry = await json("/api/v1/screens");
  if (!registry.response.ok || registry.payload.screens.length !== 22) throw new Error("Screen registry endpoint is incomplete");
  for (const screen of registry.payload.screens) {
    const response = await fetch(`${base}${screen.route}`);
    if (!response.ok || !(await response.text()).includes('id="app"')) throw new Error(`SPA route failed: ${screen.route}`);
  }

  const initial = await json("/api/v1/runtime-state");
  if (initial.payload.mode !== "DRY_RUN" || initial.payload.version !== 0) throw new Error("Runtime must start in version-zero DRY_RUN mode");
  const filtered = await json("/api/v1/commands", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({kind:"SET_FILTER",filter:"RIGZIP"}) });
  if (!filtered.response.ok || filtered.payload.version !== 1 || filtered.payload.selectedFilter !== "RIGZIP") throw new Error("Governed filter command failed");
  const expanded = await json("/api/v1/commands", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({kind:"ADD_EXPANSION_AREA",area:{countryCode:"US",adminUnitId:"31",name:"Nebraska",unitType:"state",route:"/markets/nebraska",brand:"RigZip",status:"DISCOVERY"}}) });
  if (!expanded.response.ok || expanded.payload.version !== 2 || expanded.payload.expansionAreas.length !== 1) throw new Error("Governed expansion-area command failed");
  const addedBrand = await json("/api/v1/commands", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({kind:"ADD_BRAND_PROFILE",brand:{id:"test-brand",name:"Test Brand",archetype:"OTHER",offering:"A test service",audience:"Qualified local customers",businessModel:"Subscription",objectives:["Validate demand"],primaryValueEvent:"qualified_subscription",targetGeographies:["US"],languages:["en"],constraints:["No external execution"],status:"DISCOVERY"}}) });
  if (!addedBrand.response.ok || addedBrand.payload.version !== 3 || addedBrand.payload.brandProfiles.length !== 1) throw new Error("Governed brand-profile command failed");
  const forbidden = await json("/api/v1/commands", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({kind:"SPEND_FUNDS",amountUsd:100}) });
  if (forbidden.response.status !== 400) throw new Error("Unknown financial command was not rejected");
  const unchanged = await json("/api/v1/runtime-state");
  if (unchanged.payload.version !== 3 || unchanged.payload.mode !== "DRY_RUN") throw new Error("Rejected command mutated runtime state");
  process.stdout.write("Verified 22 routes and governed DRY_RUN command API.\n");
} finally {
  server.kill("SIGTERM");
}
