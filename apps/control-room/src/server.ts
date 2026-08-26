import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { productScreens, runRigZipDryRun } from "@lattice/core";

const host = "127.0.0.1";
const port = Number(process.env.LATTICE_PORT ?? 4310);
const publicRoot = fileURLToPath(new URL("../public/", import.meta.url));
const mime: Record<string, string> = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8" };

createServer(async (request, response) => {
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("Referrer-Policy", "no-referrer");
  response.setHeader("X-Frame-Options", "DENY");
  response.setHeader("Content-Security-Policy", "default-src 'self'; style-src 'self'; script-src 'self'; connect-src 'self'; img-src 'self' data:");
  if (request.method === "GET" && request.url === "/api/v1/control-room") {
    response.writeHead(200, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
    response.end(JSON.stringify(runRigZipDryRun().readModel));
    return;
  }
  if (request.method === "GET" && request.url === "/api/v1/screens") {
    response.writeHead(200, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
    response.end(JSON.stringify({ screens: productScreens }));
    return;
  }
  if (request.method !== "GET") {
    response.writeHead(405, { Allow: "GET" }); response.end("Method not allowed"); return;
  }
  const requested = request.url === "/" ? "index.html" : (request.url ?? "/").slice(1);
  const safePath = normalize(requested).replace(/^(\.\.(\\|\/|$))+/, "");
  try {
    const body = await readFile(join(publicRoot, safePath));
    response.writeHead(200, { "Content-Type": mime[extname(safePath)] ?? "application/octet-stream", "Cache-Control": "no-store" });
    response.end(body);
  } catch {
    response.writeHead(404); response.end("Not found");
  }
}).listen(port, host, () => process.stdout.write(`LATTICE Control Room: http://${host}:${port}\n`));
