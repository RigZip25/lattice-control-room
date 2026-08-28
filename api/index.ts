import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { APICallError, generateText } from "ai";
import { z } from "zod";
import {
  applyOperatingCommand,
  buildExecutionHealthSnapshot,
  factoryCadenceAt,
  initialOperatingState,
  productScreens,
  referenceGeographies,
  runRigZipDryRun,
  type OperatingCommand,
  type OperatingState,
} from "../packages/core/dist/index.js";
import {
  bearerToken,
  cloudExecutionConfigured,
  executeStepwiseDryRunCycle,
  deleteBrandServer,
  fetchOperatingStateServer,
  fetchBrandsServer,
  fetchCloudContext,
  persistBrandServer,
  persistOperatingStateServer,
  requestEmailOtp,
  supabaseRuntimeConfig,
  verifyEmailOtp,
} from "../apps/control-room/src/supabase-gateway.js";

interface ApiRequest {
  method?: string;
  url?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
}

interface ApiResponse {
  status(code: number): ApiResponse;
  setHeader(name: string, value: string): void;
  json(payload: unknown): void;
}

const supabase = supabaseRuntimeConfig();
const ownerPassword = process.env.LAFWIRON_OWNER_PASSWORD;
const sessionSecret = process.env.LAFWIRON_SESSION_SECRET;
const ownerAccessConfigured = Boolean(ownerPassword && sessionSecret && sessionSecret.length >= 32);
const ownerSessionSeconds = 12 * 60 * 60;
const executionWorkspaceId = process.env.LAFWIRON_WORKSPACE_ID;
const analysisModel = process.env.LAFWIRON_ANALYSIS_MODEL ?? "minimax/minimax-m3-free";

function digest(value: string): Buffer {
  return createHash("sha256").update(value, "utf8").digest();
}

function passwordsMatch(candidate: string): boolean {
  if (!ownerPassword) return false;
  return timingSafeEqual(digest(candidate), digest(ownerPassword));
}

function signOwnerSession(now = Math.floor(Date.now() / 1000)): { access_token: string; expires_at: number; token_type: "bearer" } {
  if (!sessionSecret) throw new Error("Owner session configuration is unavailable");
  const payload = Buffer.from(JSON.stringify({ sub:"lafwiron-owner", iat:now, exp:now + ownerSessionSeconds }), "utf8").toString("base64url");
  const signature = createHmac("sha256", sessionSecret).update(payload).digest("base64url");
  return { access_token:`${payload}.${signature}`, expires_at:now + ownerSessionSeconds, token_type:"bearer" };
}

function validOwnerSession(token: string | undefined, now = Math.floor(Date.now() / 1000)): boolean {
  if (!token || !sessionSecret) return false;
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra) return false;
  const expected = createHmac("sha256", sessionSecret).update(payload).digest();
  let supplied: Buffer;
  try { supplied = Buffer.from(signature, "base64url"); } catch { return false; }
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return false;
  try {
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { sub?: unknown; exp?: unknown };
    return claims.sub === "lafwiron-owner" && typeof claims.exp === "number" && claims.exp > now;
  } catch { return false; }
}

function header(request: ApiRequest, name: string): string | undefined {
  const value = request.headers[name] ?? request.headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}

function parseBody(body: unknown): unknown {
  if (typeof body === "string") return JSON.parse(body);
  return body ?? {};
}

function privateAddress(address:string):boolean {
  if (address.includes(":")) return address==="::1" || address.startsWith("fc") || address.startsWith("fd") || address.startsWith("fe8") || address.startsWith("fe9") || address.startsWith("fea") || address.startsWith("feb");
  const octets=address.split(".").map(Number);
  return octets[0]===10 || octets[0]===127 || octets[0]===0 || (octets[0]===169&&octets[1]===254) || (octets[0]===172&&octets[1]>=16&&octets[1]<=31) || (octets[0]===192&&octets[1]===168) || (octets[0]>=224);
}

async function safeResearchUrl(raw:string):Promise<URL> {
  const url=new URL(raw);
  if (url.protocol!=="https:" || url.username || url.password || url.port) throw new Error("Research accepts public HTTPS websites only");
  const host=url.hostname.toLowerCase();
  if (host==="localhost" || host.endsWith(".local") || isIP(host)&&privateAddress(host)) throw new Error("Private network addresses are not allowed");
  const addresses=await lookup(host,{all:true,verbatim:true});
  if (!addresses.length || addresses.some((item)=>privateAddress(item.address))) throw new Error("Website resolved to a private or reserved network");
  return url;
}

function decodeHtml(value:string):string {
  return value.replace(/&nbsp;/gi," ").replace(/&amp;/gi,"&").replace(/&quot;/gi,'"').replace(/&#39;|&apos;/gi,"'").replace(/&lt;/gi,"<").replace(/&gt;/gi,">").replace(/&#(\d+);/g,(_,code)=>String.fromCodePoint(Number(code))).replace(/\s+/g," ").trim();
}

function elementText(html:string,tag:string):string[] {
  return [...html.matchAll(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`,"gi"))].map((match)=>decodeHtml(match[1].replace(/<[^>]+>/g," "))).filter(Boolean);
}

function metaValues(html:string):Map<string,string[]> {
  const values=new Map<string,string[]>();
  for (const match of html.matchAll(/<meta\b[^>]*>/gi)) {
    const tag=match[0]; const attributes=new Map<string,string>();
    for (const attribute of tag.matchAll(/([:\w-]+)\s*=\s*["']([^"']*)["']/g)) attributes.set(attribute[1].toLowerCase(),decodeHtml(attribute[2]));
    const key=(attributes.get("property")??attributes.get("name")??"").toLowerCase(); const content=attributes.get("content")??"";
    if (key&&content) values.set(key,[...(values.get(key)??[]),content]);
  }
  return values;
}

async function fetchResearchPage(raw:string):Promise<{url:string;html:string}> {
  let url=await safeResearchUrl(raw);
  for (let redirect=0;redirect<4;redirect+=1) {
    const response=await fetch(url,{redirect:"manual",headers:{"User-Agent":"LAFWIRON-Research/1.0 (+read-only; dry-run)",Accept:"text/html,application/xhtml+xml"},signal:AbortSignal.timeout(9_000)});
    if ([301,302,303,307,308].includes(response.status)) {
      const location=response.headers.get("location");
      if (!location) throw new Error("Website returned an invalid redirect");
      url=await safeResearchUrl(new URL(location,url).toString());
      continue;
    }
    if (!response.ok) throw new Error(`Website returned HTTP ${response.status}`);
    if (!(response.headers.get("content-type")??"").toLowerCase().includes("text/html")) throw new Error("Website did not return HTML");
    const reader=response.body?.getReader();
    if (!reader) throw new Error("Website response is empty");
    const chunks:Uint8Array[]=[]; let size=0;
    while (true) { const part=await reader.read(); if (part.done) break; size+=part.value.byteLength; if (size>1_500_000) { await reader.cancel(); throw new Error("Website page exceeds the research size limit"); } chunks.push(part.value); }
    return {url:url.toString(),html:new TextDecoder().decode(Buffer.concat(chunks))};
  }
  throw new Error("Website redirected too many times");
}

async function fetchResearchAsset(raw:string,maximumBytes=5_000_000):Promise<string> {
  const url=await safeResearchUrl(raw);
  const response=await fetch(url,{redirect:"error",headers:{"User-Agent":"LAFWIRON-Research/1.0 (+read-only; dry-run)",Accept:"text/javascript,application/javascript"},signal:AbortSignal.timeout(12_000)});
  if (!response.ok) throw new Error(`Research asset returned HTTP ${response.status}`);
  const reader=response.body?.getReader(); if(!reader)throw new Error("Research asset is empty");
  const chunks:Uint8Array[]=[]; let size=0;
  while(true){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>maximumBytes){await reader.cancel();throw new Error("Research asset exceeds the safe size limit");}chunks.push(part.value);}
  return new TextDecoder().decode(Buffer.concat(chunks));
}

function figmaEnglishContent(component:string):Map<string,string> {
  const start=component.indexOf('en:{"nav.home"'); if(start<0)return new Map();
  const end=component.indexOf('},es:{',start); if(end<0)return new Map();
  const block=component.slice(start+3,end+1); const values=new Map<string,string>();
  for(const match of block.matchAll(/"([\w.-]+)":"((?:\\.|[^"\\])*)"/g)) {
    try { values.set(match[1],JSON.parse(`"${match[2]}"`)); } catch { /* malformed strings are ignored */ }
  }
  return values;
}

function figmaObservedClaims(values:Map<string,string>):string[] {
  const groups:Array<[string,string[]]>=[
    ["Product",["hero.title","hero.subtitle","hero.description"]],
    ["Company",["about.hero.subtitle","about.mission.description"]],
    ["Capabilities",["features.voiceControl.desc","features.smartRouting.desc","features.fuelOptimization.desc","features.obdDiagnostics.desc","features.maintenanceAlerts.desc","featureCard.iftaReports.desc"]],
    ["Commercial offer",["cta.benefit1","cta.benefit2","cta.benefit3","explore.card3.desc"]],
  ];
  return groups.flatMap(([label,keys])=>{const found=keys.map((key)=>values.get(key)).filter((value):value is string=>Boolean(value));return found.length?[`${label}: ${found.join(" · ")}`]:[];});
}

async function researchWebsite(raw:string) {
  const first=await fetchResearchPage(raw);
  const origin=new URL(first.url).origin;
  const candidates=[...first.html.matchAll(/<a\b[^>]*href=["']([^"'#]+)["']/gi)]
    .map((match)=>{try{return new URL(match[1],first.url)}catch{return null}})
    .filter((url):url is URL=>Boolean(url&&url.origin===origin&&/(about|product|service|pricing|how|faq|solution)/i.test(url.pathname)))
    .map((url)=>url.toString().split("#")[0]);
  const urls=[first.url,...new Set(candidates)].slice(0,5);
  const fetched=[first,...(await Promise.allSettled(urls.slice(1).map(fetchResearchPage))).flatMap((item)=>item.status==="fulfilled"?[item.value]:[])];
  const pages=fetched.map(({url,html})=>{
    const metadata=metaValues(html); const titles=elementText(html,"title");
    const title=metadata.get("og:title")?.at(-1)??metadata.get("twitter:title")?.at(-1)??titles.at(-1)??"Untitled page";
    const description=metadata.get("og:description")?.at(-1)??metadata.get("twitter:description")?.at(-1)??metadata.get("description")?.at(-1)??"";
    const keywords=(metadata.get("keywords")?.at(-1)??"").split(",").map((item)=>item.trim()).filter(Boolean).slice(0,12);
    return {url,title,description,headings:[...elementText(html,"h1"),...elementText(html,"h2"),...(keywords.length?[`Keywords: ${keywords.join(", ")}`]:[])].filter((value)=>!/^created with figma$/i.test(value)&&!/^this site requires javascript/i.test(value)).slice(0,12)};
  });
  const componentPath=first.html.match(/(?:href|src)=["']([^"']*\/_components\/v2\/[^"']+\.js)["']/i)?.[1];
  let componentClaims:string[]=[];
  if(componentPath){try{const component=await fetchResearchAsset(new URL(componentPath,first.url).toString());componentClaims=figmaObservedClaims(figmaEnglishContent(component));}catch{/* metadata remains available as a safe fallback */}}
  const claims=[...new Set([...componentClaims,...pages.flatMap((page)=>[page.description,...page.headings]).filter((value)=>value.length>=12&&!/^created with figma$/i.test(value)))].slice(0,12);
  if(componentClaims.length){pages[0]={...pages[0],title:componentClaims[0].replace(/^Product:\s*/,"").split(" · ")[0],description:componentClaims[0],headings:componentClaims.slice(1)};}
  return {status:"COMPLETED" as const,researchedAt:new Date().toISOString(),pages,observedClaims:claims.length?claims:[`The public website did not expose enough product content for a reliable summary`],unresolvedQuestions:["Which website claims are supported by independent product or analytics evidence?","Who is the primary paying customer: an individual driver, fleet, or partner?","Which customer value event should govern the first market test?"]};
}

const semanticProductSchema=z.object({
  productName:z.string().min(1).max(160),
  oneLineSummary:z.string().min(1).max(360),
  companyContext:z.string().max(500),
  customerSegments:z.array(z.string().max(240)).max(6),
  jobsToBeDone:z.array(z.string().max(280)).max(6),
  valuePropositions:z.array(z.string().max(280)).max(6),
  businessModelHypotheses:z.array(z.string().max(280)).max(5),
  productCapabilities:z.array(z.string().max(240)).max(8),
  claims:z.array(z.object({statement:z.string().max(360),classification:z.enum(["OWNER_CLAIM","OBSERVED","UNKNOWN"]),evidenceUrls:z.array(z.string().url()).max(5)})).max(10),
  risks:z.array(z.string().max(280)).max(6),
  criticalQuestions:z.array(z.string().max(280)).max(6),
  recommendedNextResearch:z.array(z.string().max(280)).max(6),
  strategicVerdict:z.string().min(1).max(600),
  recommendedDisposition:z.enum(["HOLD","RESEARCH","IMPROVE","READY_FOR_MARKET_TEST"]),
  primaryAudienceChoice:z.string().min(1).max(240),
  primaryAudienceRationale:z.string().min(1).max(400),
  marketPain:z.array(z.string().max(280)).max(6),
  positioningThesis:z.string().min(1).max(400),
  competitorHypotheses:z.array(z.object({name:z.string().max(120),whyRelevant:z.string().max(320),productStrongerWhere:z.string().max(320),productWeakerWhere:z.string().max(320),verificationNeeded:z.string().max(320)})).max(5),
  differentiators:z.array(z.string().max(280)).max(6),
  productWeaknesses:z.array(z.string().max(280)).max(6),
  distributionHypotheses:z.array(z.string().max(280)).max(6),
  improvementPhases:z.array(z.object({phase:z.string().max(100),objective:z.string().max(320),exitCriteria:z.string().max(320)})).max(5),
  marketEducationNeed:z.string().max(500),
});

function normalizeSemanticCandidate(value:unknown):unknown {
  if(!value||typeof value!=="object"||Array.isArray(value))return value;
  const source=value as Record<string,unknown>;
  const text=(input:unknown,max:number)=>typeof input==="string"?input.trim().slice(0,max):"";
  const list=(input:unknown,maxItems:number,maxLength:number)=>Array.isArray(input)?input.map((item)=>text(item,maxLength)).filter(Boolean).slice(0,maxItems):[];
  const claims=Array.isArray(source.claims)?source.claims.flatMap((item)=>{
    if(!item||typeof item!=="object")return [];
    const claim=item as Record<string,unknown>;
    const classification=["OWNER_CLAIM","OBSERVED","UNKNOWN"].includes(String(claim.classification))?String(claim.classification):"UNKNOWN";
    const evidenceUrls=Array.isArray(claim.evidenceUrls)?claim.evidenceUrls.filter((url):url is string=>typeof url==="string"&&/^https?:\/\//i.test(url)).slice(0,5):[];
    return [{statement:text(claim.statement,360),classification,evidenceUrls}];
  }).filter((claim)=>claim.statement).slice(0,10):[];
  const competitorHypotheses=Array.isArray(source.competitorHypotheses)?source.competitorHypotheses.flatMap((item)=>{
    if(!item||typeof item!=="object")return [];
    const competitor=item as Record<string,unknown>;
    return [{name:text(competitor.name,120),whyRelevant:text(competitor.whyRelevant,320),productStrongerWhere:text(competitor.productStrongerWhere,320),productWeakerWhere:text(competitor.productWeakerWhere,320),verificationNeeded:text(competitor.verificationNeeded,320)||"Требуется независимая проверка релевантности и сравнения"}];
  }).filter((item)=>item.name).slice(0,5):[];
  const improvementPhases=Array.isArray(source.improvementPhases)?source.improvementPhases.flatMap((item)=>{
    if(!item||typeof item!=="object")return [];
    const phase=item as Record<string,unknown>;
    return [{phase:text(phase.phase,100),objective:text(phase.objective,320),exitCriteria:text(phase.exitCriteria,320)}];
  }).filter((item)=>item.phase&&item.objective&&item.exitCriteria).slice(0,5):[];
  return {
    ...source,
    productName:text(source.productName,160),oneLineSummary:text(source.oneLineSummary,360),companyContext:text(source.companyContext,500),
    customerSegments:list(source.customerSegments,6,240),jobsToBeDone:list(source.jobsToBeDone,6,280),valuePropositions:list(source.valuePropositions,6,280),businessModelHypotheses:list(source.businessModelHypotheses,5,280),productCapabilities:list(source.productCapabilities,8,240),claims,
    risks:list(source.risks,6,280),criticalQuestions:list(source.criticalQuestions,6,280),recommendedNextResearch:list(source.recommendedNextResearch,6,280),strategicVerdict:text(source.strategicVerdict,600),primaryAudienceChoice:text(source.primaryAudienceChoice,240),primaryAudienceRationale:text(source.primaryAudienceRationale,400),marketPain:list(source.marketPain,6,280),positioningThesis:text(source.positioningThesis,400),competitorHypotheses,differentiators:list(source.differentiators,6,280),productWeaknesses:list(source.productWeaknesses,6,280),distributionHypotheses:list(source.distributionHypotheses,6,280),improvementPhases,marketEducationNeed:text(source.marketEducationNeed,500),
  };
}

async function analyzeProductSemantics(research:Awaited<ReturnType<typeof researchWebsite>>,ownerDescription:string,maturity:string) {
  const generationId=`product-analysis-${randomUUID()}`;
  const source=JSON.stringify({ownerDeclaredMaturity:maturity,ownerDescription,pages:research.pages,websiteObservations:research.observedClaims}).slice(0,24_000);
  console.log("[product-analysis] started",{generationId,model:analysisModel,pages:research.pages.length});
  for(let attempt=1;attempt<=2;attempt+=1) {
    const result=await generateText({
      model:analysisModel,
      system:"Ты — партнёр владельца по продуктовой стратегии и маркетингу в LAFWIRON. Твоя задача — не продвигать всё подряд, а определить, способен ли продукт обрести конкурентоспособный контур. Анализируй только переданные материалы. Не выдумывай факты, метрики, клиентов, готовность функций или доказательства. Все заявления сайта и владельца считай гипотезами до независимой проверки. Конкурентов называй только гипотезами для следующего исследования и объясняй, почему каждый релевантен. Пиши естественным, ясным русским языком, коротко и конкретно. На этом этапе маркетинговый запуск всегда заблокирован.",
      prompt:`Верни ТОЛЬКО корректный JSON-объект без markdown и комментариев. Все пользовательские строки внутри JSON должны быть на русском языке, кроме названий бренда, продукта и URL. Обязательный формат: {"productName":"","oneLineSummary":"","companyContext":"","customerSegments":[],"jobsToBeDone":[],"valuePropositions":[],"businessModelHypotheses":[],"productCapabilities":[],"claims":[{"statement":"","classification":"OWNER_CLAIM|OBSERVED|UNKNOWN","evidenceUrls":[]}],"risks":[],"criticalQuestions":[],"recommendedNextResearch":[],"strategicVerdict":"","recommendedDisposition":"HOLD|RESEARCH|IMPROVE|READY_FOR_MARKET_TEST","primaryAudienceChoice":"","primaryAudienceRationale":"","marketPain":[],"positioningThesis":"","competitorHypotheses":[{"name":"","whyRelevant":"","productStrongerWhere":"","productWeakerWhere":"","verificationNeeded":""}],"differentiators":[],"productWeaknesses":[],"distributionHypotheses":[],"improvementPhases":[{"phase":"","objective":"","exitCriteria":""}],"marketEducationNeed":""}. Создай одновременно паспорт и предварительный стратегический диагноз. Выбери одну первичную аудиторию, а не перечисляй всех как равных. Сформулируй боль рынка, предварительное позиционирование и причины, по которым идея может не сработать. Конкуренты — только кандидаты на проверку: включай прямые решения, заменители и существующее поведение пользователя, объясняя релевантность. Для каждой фазы улучшения задай проверяемый критерий выхода. Distribution hypotheses должны соответствовать выбранной аудитории и зрелости продукта. READY_FOR_MARKET_TEST допустим только как будущая рекомендация после независимых доказательств; при IDEA или PROTOTYPE выбирай HOLD, RESEARCH или IMPROVE. OWNER_CLAIM означает утверждение сайта/владельца, OBSERVED — непосредственно наблюдаемую структуру, UNKNOWN — пробел. В evidenceUrls используй только URL из входных страниц. Не более 6 пунктов в каждом массиве.${attempt===2?" Это повторная попытка после повреждённого ответа: особенно тщательно проверь запятые, кавычки и закрывающие скобки.":""}\n\nВходные данные:\n${source}`,
      providerOptions:{gateway:{user:executionWorkspaceId??"lafwiron-owner",tags:["feature:product-intelligence","mode:dry-run","budget:free-only",`attempt:${attempt}`],cacheControl:"s-maxage=86400"}},
      maxOutputTokens:5_000,
      abortSignal:AbortSignal.timeout(80_000),
    });
    const json=result.text.trim().replace(/^```(?:json)?\s*/i,"").replace(/\s*```$/i,"");
    const start=json.indexOf("{");
    const end=json.lastIndexOf("}");
    let parsed:unknown;
    try { parsed=JSON.parse(start>=0&&end>start?json.slice(start,end+1):json); }
    catch(error) { console.warn("[product-analysis] malformed JSON",{generationId,attempt,finishReason:result.finishReason,outputCharacters:result.text.length,usage:result.usage,message:error instanceof Error?error.message:String(error)}); if(attempt<2)continue; throw new Error("Модель дважды вернула повреждённую структуру ответа. Исходные материалы сохранены — запустите анализ ещё раз."); }
    const validated=semanticProductSchema.safeParse(normalizeSemanticCandidate(parsed));
    if(!validated.success){console.warn("[product-analysis] validation failed",{generationId,attempt,issues:validated.error.issues.map((issue)=>({path:issue.path.join("."),code:issue.code}))});if(attempt<2)continue;throw new Error("Модель дважды вернула неполный аналитический отчёт. Исходные материалы сохранены — запустите анализ ещё раз.");}
    const russianText=JSON.stringify(validated.data).match(/[А-Яа-яЁё]/g)?.length??0;
    if(russianText<40){console.warn("[product-analysis] language check failed",{generationId,attempt,russianText});if(attempt<2)continue;throw new Error("Аналитический отчёт не прошёл проверку языка. Исходные материалы сохранены — запустите анализ ещё раз.");}
    console.log("[product-analysis] completed",{generationId,model:analysisModel,attempt,totalTokens:result.usage.totalTokens});
    return {...validated.data,marketingGate:"BLOCKED" as const,generationId,status:"COMPLETED" as const,model:analysisModel,createdAt:new Date().toISOString(),usage:{inputTokens:result.usage.inputTokens,outputTokens:result.usage.outputTokens,totalTokens:result.usage.totalTokens}};
  }
  throw new Error("Анализ продукта не завершён. Исходные материалы сохранены — запустите анализ ещё раз.");
}

const analystDialogueSchema=z.object({
  analystResponse:z.string().min(1).max(1200),
  nextQuestion:z.string().max(360).optional(),
  alternatives:z.array(z.string().max(360)).max(3),
  councilViews:z.array(z.object({role:z.enum(["PRODUCT","MARKET","GROWTH","CREATIVE","FINANCE","LEGAL"]),opinion:z.string().min(1).max(360)})).max(6),
  status:z.enum(["ASKING","SUFFICIENT"]),
}).superRefine((value,context)=>{
  if(value.status==="ASKING"&&!value.nextQuestion?.trim()) context.addIssue({code:"custom",message:"The next question is required",path:["nextQuestion"]});
});

async function continueAnalystDialogue(input:{understanding:NonNullable<OperatingState["productUnderstandings"][number]>;userMessage:string;mode:"ANSWER"|"HELP"}) {
  const analysis=input.understanding.websiteResearch?.analysis;
  if(!analysis) throw new Error("Сначала изучите сайт или исходные материалы продукта");
  const transcript=(input.understanding.analystDialogue??[]).slice(-8).map((turn)=>({owner:turn.ownerMessage,analyst:turn.analystResponse,question:turn.nextQuestion,status:turn.status}));
  const context=JSON.stringify({maturity:input.understanding.maturity??"MVP",ownerDescription:input.understanding.ownerDescription,analysis,transcript,userMessage:input.userMessage,mode:input.mode}).slice(0,28_000);
  const result=await generateText({
    model:analysisModel,
    system:"Ты — председатель партнёрского совета директоров продукта LAFWIRON. Совет не противостоит владельцу и не ищет поводы отказать: он дополняет его компетенции в продукте, рынке, росте, креативе, финансах и праве и совместно строит актив, способный зарабатывать. На стадии IDEA работай с любопытством и энергией: находи сильные сценарии, новые функции, альтернативные архитектуры, модели оплаты и способы создать или видоизменить рынок. Рассуждай с позиции возможного заработка: кто и за что заплатит, какой ценностный момент ведёт к оплате, что нужно изменить в продукте и на сайте, что заложить в тариф или предложение. Не превращай разговор в экзамен и не повторяй, что доказательств пока нет. Разделяй потенциал идеи и разрешение расходовать деньги: идея может быть перспективной, пока платный запуск закрыт. Совет всегда предлагает следующий управляемый ход из цикла: BUILD_AND_TEST — доработать и проверить; PIVOT_PRODUCT — изменить решение; PIVOT_AUDIENCE — сменить круг клиентов; PIVOT_MARKET — изменить или подготовить рынок; PAUSE — временно снять с линии до появления условий; RETIRE — закрыть только при устойчивых объективных основаниях. Не используй PAUSE или RETIRE как лёгкий выход: сначала предложи дешёвую проверку, продуктовую модификацию и варианты поворота. В каждом ходе задавай не более одного НОВОГО вопроса и не повторяй закрытый. Не спрашивай то, что система может проверить сама. Если владелец не знает, сформируй собственную рекомендуемую гипотезу и 2–3 альтернативы. Отделяй реализованное от идеи и заявления от доказательств, но критикуй конструктивно: как сделать сильнее, а не только почему сыро. Реальные расходы и публикация заблокированы без доказательств и полномочий. Пиши естественным русским языком.",
    prompt:`Верни только JSON без markdown: {"analystResponse":"единое партнёрское решение совета: потенциал заработка, рекомендуемый маршрут BUILD_AND_TEST|PIVOT_PRODUCT|PIVOT_AUDIENCE|PIVOT_MARKET|PAUSE|RETIRE и почему","nextQuestion":"ровно один следующий новый вопрос или отсутствует при достаточности","alternatives":["конкретный вариант продуктового или рыночного хода с компромиссом"],"councilViews":[{"role":"PRODUCT|MARKET|GROWTH|CREATIVE|FINANCE|LEGAL","opinion":"конкретное дополнение этой компетенции"}],"status":"ASKING|SUFFICIENT"}. Сначала отрази новую ценность последнего ответа владельца. Затем дай конструктивное решение совета и только потом риск. В каждом содержательном ходе PRODUCT предлагает продуктовую доработку, MARKET или GROWTH — способ проверить спрос и необходимые изменения сайта/предложения, FINANCE — гипотезу оплаты или безопасный лимит следующего теста; остальные роли добавляй по необходимости. Не выдумывай точные цены как факт: предлагай диапазон или тест цены и объясняй, что он проверяет. Для IDEA не требуй доказательств как условие продолжения брейншторма. Не повторяй предыдущий nextQuestion. Если ответ закрыл вопрос, переходи к следующей важной неизвестной. Если владелец не знает, совет выбирает рекомендуемую рабочую гипотезу и предлагает альтернативы вместо повторного допроса. Достаточность означает ясный продуктовый контур и следующий внутренний тест, а не готовность тратить деньги. При HELP обязательно дай варианты.\n\nКонтекст:\n${context}`,
    providerOptions:{gateway:{user:executionWorkspaceId??"lafwiron-owner",tags:["feature:brand-analyst","mode:dry-run","budget:free-only"],cacheControl:"s-maxage=3600"}},
    maxOutputTokens:1_200,
    abortSignal:AbortSignal.timeout(55_000),
  });
  const raw=result.text.trim().replace(/^```(?:json)?\s*/i,"").replace(/\s*```$/i,"");
  let candidate:unknown;
  try { const start=raw.indexOf("{"); const end=raw.lastIndexOf("}"); candidate=JSON.parse(start>=0&&end>start?raw.slice(start,end+1):raw); }
  catch { throw new Error("Аналитик вернул повреждённый ответ. Повторите последнее сообщение."); }
  const parsed=analystDialogueSchema.safeParse(candidate);
  if(!parsed.success) throw new Error("Ответ аналитика не прошёл структурную проверку. Повторите попытку.");
  if((JSON.stringify(parsed.data).match(/[А-Яа-яЁё]/g)?.length??0)<20) throw new Error("Ответ аналитика не прошёл проверку русского языка. Повторите попытку.");
  return {id:`analyst-${randomUUID()}`,createdAt:new Date().toISOString(),ownerMessage:input.userMessage,...parsed.data};
}

function websiteResearchError(error:unknown):{status:number;message:string} {
  console.error("[website-research] failed",{name:error instanceof Error?error.name:"UnknownError",message:error instanceof Error?error.message:String(error),statusCode:APICallError.isInstance(error)?error.statusCode:undefined});
  if (APICallError.isInstance(error)) {
    if (error.statusCode===402) return {status:402,message:"Бесплатный лимит AI Gateway исчерпан. Анализ не выполнен, расходы не произведены."};
    if (error.statusCode===429) return {status:429,message:"AI Gateway временно ограничил частоту запросов. Повторите изучение через несколько минут."};
    if (error.statusCode===403) return {status:503,message:"Выбранная AI-модель недоступна в текущем режиме. LAFWIRON не использовала платные кредиты."};
    if (error.statusCode===503) return {status:503,message:"Сервис анализа временно недоступен. Исходные материалы сохранены; повторите попытку позже."};
  }
  return {status:400,message:error instanceof Error?error.message:"Не удалось изучить сайт"};
}

function isOperatingState(value: unknown): value is OperatingState {
  if (!value || typeof value !== "object") return false;
  const state = value as Partial<OperatingState>;
  return state.mode === "DRY_RUN"
    && Number.isInteger(state.version)
    && Array.isArray(state.events)
    && Array.isArray(state.discoveryMarkets)
    && Array.isArray(state.expansionAreas)
    && Array.isArray(state.brandProfiles)
    && (state.productUnderstandings===undefined || Array.isArray(state.productUnderstandings))
    && Array.isArray(state.productSources)
    && Array.isArray(state.productEvidence)
    && Array.isArray(state.executionCycles);
}

async function canonicalOperatingState(candidate:OperatingState):Promise<OperatingState> {
  if(!supabase||!executionWorkspaceId)return candidate;
  const [stored,registered]=await Promise.all([fetchOperatingStateServer(supabase,executionWorkspaceId),fetchBrandsServer(supabase,executionWorkspaceId)]);
  const storedRow=stored.status<400?(stored.body as Array<{state?:unknown}>)[0]:undefined;
  const persisted=isOperatingState(storedRow?.state)&&storedRow.state.version>=candidate.version?storedRow.state:candidate;
  if(registered.status>=400)return persisted;
  const rows=registered.body as Array<{brand_id:string;profile?:unknown;status:string}>;
  const registryProfiles=rows.filter((row)=>row.status!=="PAUSED"&&row.profile&&typeof row.profile==="object").map((row)=>row.profile as OperatingState["brandProfiles"][number]);
  const profiles=[...persisted.brandProfiles];
  for(const profile of registryProfiles)if(!profiles.some((item)=>item.id===profile.id))profiles.push(profile);
  const understandings=[...persisted.productUnderstandings];
  for(const brand of profiles){
    if(understandings.some((item)=>item.brandId===brand.id))continue;
    const website=brand.offering.match(/https:\/\/[^\s]+/i)?.[0];
    understandings.push({brandId:brand.id,...(website?{website}:{}),ownerDescription:brand.offering,materialNames:[],productSummary:brand.offering,customerSummary:brand.audience,valueSummary:"Требует повторного подтверждения владельца",assumptions:["Карточка восстановлена из реестра брендов после рассинхронизации состояния"],criticalQuestions:[],status:"DRAFT"});
  }
  return {...persisted,brandProfiles:profiles,productUnderstandings:understandings};
}

function countries(): Array<{ code: string; name: string }> {
  const names = new Intl.DisplayNames(["ru"], { type: "region" });
  const codes = "AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW".split(" ");
  return codes.map((code) => ({ code, name: names.of(code) ?? code })).sort((a, b) => a.name.localeCompare(b.name, "ru"));
}

export default async function handler(request: ApiRequest, response: ApiResponse): Promise<void> {
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("X-Content-Type-Options", "nosniff");
  const pathname = new URL(request.url ?? "/", "https://lattice.invalid").pathname;
  const method = request.method ?? "GET";

  if (method === "GET" && pathname === "/api/v1/backend-status") {
    response.status(200).json({ provider:"LAFWIRON", configured:ownerAccessConfigured, authentication:"OWNER_PASSWORD", configuration:{ ownerPassword:Boolean(ownerPassword), sessionSecret:Boolean(sessionSecret), sessionSecretStrong:Boolean(sessionSecret && sessionSecret.length >= 32), cloudExecution:cloudExecutionConfigured(supabase)&&Boolean(executionWorkspaceId) }, dataProvider:supabase?"SUPABASE":"LOCAL", mode:"DRY_RUN", runtime:"VERCEL_STATELESS" });
    return;
  }
  if (method === "POST" && pathname === "/api/v1/auth/owner-login") {
    if (!ownerAccessConfigured) { response.status(503).json({ error:"Owner access is not configured" }); return; }
    try {
      const body = parseBody(request.body) as { password?: unknown };
      const password = typeof body.password === "string" ? body.password : "";
      if (!passwordsMatch(password)) { response.status(401).json({ error:"Invalid owner credentials" }); return; }
      response.status(200).json(signOwnerSession());
    } catch { response.status(400).json({ error:"Invalid authentication request" }); }
    return;
  }
  if (method === "GET" && pathname === "/api/v1/auth/owner-session") {
    const token = bearerToken(header(request, "authorization"));
    if (!validOwnerSession(token)) { response.status(401).json({ error:"Owner session is invalid or expired" }); return; }
    response.status(200).json({ workspace:{ name:"LAFWIRON", mode:"DRY_RUN" }, membership:{ member_role:"OWNER" }, authentication:"OWNER_PASSWORD" });
    return;
  }
  if (method === "POST" && (pathname === "/api/v1/auth/request-otp" || pathname === "/api/v1/auth/verify-otp")) {
    if (!supabase) { response.status(503).json({ error:"Supabase runtime configuration is not available" }); return; }
    try {
      const body = parseBody(request.body) as { email?: unknown; token?: unknown };
      const email = typeof body.email === "string" ? body.email.trim() : "";
      const token = typeof body.token === "string" ? body.token.trim() : "";
      if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error("Valid email is required");
      if (pathname.endsWith("verify-otp") && !/^\d{6}$/.test(token)) throw new Error("A six-digit code is required");
      const result = pathname.endsWith("verify-otp") ? await verifyEmailOtp(supabase, email, token) : await requestEmailOtp(supabase, email);
      response.status(result.status).json(result.body);
    } catch (error) { response.status(400).json({ error:error instanceof Error ? error.message : "Invalid authentication request" }); }
    return;
  }
  if (method === "GET" && pathname === "/api/v1/cloud-context") {
    if (!supabase) { response.status(503).json({ error:"Supabase runtime configuration is not available" }); return; }
    const token = bearerToken(header(request, "authorization"));
    if (!token) { response.status(401).json({ error:"Authentication required" }); return; }
    const result = await fetchCloudContext(supabase, token);
    response.status(result.status).json(result.body);
    return;
  }
  if (method === "POST" && pathname === "/api/v1/commands") {
    if (ownerAccessConfigured && !validOwnerSession(bearerToken(header(request, "authorization")))) {
      response.status(401).json({ error:"Owner authentication required" });
      return;
    }
    try {
      const envelope = parseBody(request.body) as { command?: OperatingCommand; currentState?: unknown };
      if (!envelope.command) throw new Error("Command is required");
      const submitted = isOperatingState(envelope.currentState) ? envelope.currentState : initialOperatingState();
      const base = await canonicalOperatingState(submitted);
      const next = applyOperatingCommand(base, envelope.command, new Date().toISOString());
      if (supabase && executionWorkspaceId && ["START_RIGZIP_DRY_RUN","START_BRAND_DRY_RUN"].includes(envelope.command.kind)) {
        const cycle=next.executionCycles.at(-1);
        if (!cycle) throw new Error("Completed dry-run cycle was not produced");
        const cloudResult=await executeStepwiseDryRunCycle(supabase,executionWorkspaceId,cycle);
        if (cloudResult.status>=400) { response.status(cloudResult.status).json(cloudResult.body); return; }
      }
      if (supabase && executionWorkspaceId) {
        if (envelope.command.kind==="DELETE_BRAND_PROFILE") {
          const deletion=await deleteBrandServer(supabase,executionWorkspaceId,envelope.command.brandId);
          if (deletion.status>=400) { response.status(deletion.status).json(deletion.body); return; }
        }
        for (const brand of next.brandProfiles) {
          const brandResult=await persistBrandServer(supabase,executionWorkspaceId,brand);
          if (brandResult.status>=400) { response.status(brandResult.status).json(brandResult.body); return; }
        }
        const stateResult=await persistOperatingStateServer(supabase,executionWorkspaceId,next);
        if (stateResult.status>=400) { response.status(stateResult.status).json(stateResult.body); return; }
      }
      response.status(200).json(next);
    } catch (error) { response.status(400).json({ error:error instanceof Error ? error.message : "Invalid command" }); }
    return;
  }
  if (method === "GET" && pathname === "/api/v1/runtime-state") {
    if (supabase && executionWorkspaceId) {
      const stored=await fetchOperatingStateServer(supabase,executionWorkspaceId);
      if (stored.status<400) {
        const row=(stored.body as Array<{state?:unknown}>)[0];
        if (row?.state && isOperatingState(row.state)) { response.status(200).json(await canonicalOperatingState(row.state)); return; }
      }
    }
    response.status(200).json(initialOperatingState()); return;
  }
  if (method === "POST" && pathname === "/api/v1/research/website") {
    if (ownerAccessConfigured && !validOwnerSession(bearerToken(header(request,"authorization")))) { response.status(401).json({error:"Owner authentication required"}); return; }
    try {
      const envelope=parseBody(request.body) as {brandId?:unknown;currentState?:unknown};
      const base=isOperatingState(envelope.currentState)?envelope.currentState:initialOperatingState();
      const brandId=typeof envelope.brandId==="string"?envelope.brandId:"";
      const intake=base.productUnderstandings.find((item)=>item.brandId===brandId);
      if (!intake?.website) throw new Error("A website is required to start website research");
      const rawResearch=await researchWebsite(intake.website);
      const analysis=await analyzeProductSemantics(rawResearch,intake.ownerDescription,intake.maturity??"MVP");
      const research={...rawResearch,analysis,unresolvedQuestions:analysis.criticalQuestions};
      const next=applyOperatingCommand(base,{kind:"RECORD_WEBSITE_RESEARCH",brandId,research},new Date().toISOString());
      if (supabase&&executionWorkspaceId) {
        const result=await persistOperatingStateServer(supabase,executionWorkspaceId,next);
        if (result.status>=400) { response.status(result.status).json(result.body); return; }
      }
      response.status(200).json(next);
    } catch(error) { const failure=websiteResearchError(error); response.status(failure.status).json({error:failure.message}); }
    return;
  }
  if (method === "POST" && pathname === "/api/v1/research/analyst") {
    if (ownerAccessConfigured && !validOwnerSession(bearerToken(header(request,"authorization")))) { response.status(401).json({error:"Owner authentication required"}); return; }
    try {
      const envelope=parseBody(request.body) as {brandId?:unknown;currentState?:unknown;userMessage?:unknown;mode?:unknown};
      const base=isOperatingState(envelope.currentState)?envelope.currentState:initialOperatingState();
      const brandId=typeof envelope.brandId==="string"?envelope.brandId:"";
      const userMessage=typeof envelope.userMessage==="string"?envelope.userMessage.trim():"";
      const mode=envelope.mode==="HELP"?"HELP":"ANSWER";
      if(!userMessage) throw new Error("Напишите ответ или попросите аналитика предложить варианты");
      const understanding=base.productUnderstandings.find((item)=>item.brandId===brandId);
      if(!understanding) throw new Error("Карточка продукта не найдена");
      const turn=await continueAnalystDialogue({understanding,userMessage,mode});
      const next=applyOperatingCommand(base,{kind:"RECORD_ANALYST_TURN",brandId,turn},new Date().toISOString());
      if(supabase&&executionWorkspaceId){const stored=await persistOperatingStateServer(supabase,executionWorkspaceId,next);if(stored.status>=400){response.status(stored.status).json(stored.body);return;}}
      response.status(200).json(next);
    } catch(error) { const failure=websiteResearchError(error); response.status(failure.status).json({error:failure.message}); }
    return;
  }
  if (method === "GET" && pathname === "/api/v1/execution-status") {
    const generatedAt=new Date().toISOString();
    const cycle=runRigZipDryRun().durableCycle;
    response.status(200).json({generatedAt,mode:"DRY_RUN",runtime:"VERCEL_STATELESS",persistence:"CLIENT_STATE_ENVELOPE",cycles:1,latest:{cycleId:"rigzip-nebraska-001",brandId:"rigzip",status:"COMPLETED",health:buildExecutionHealthSnapshot({jobs:cycle.jobs,telemetry:[],now:generatedAt,maximumRunnableLagMs:30_000})}});
    return;
  }
  if (method === "GET" && pathname === "/api/v1/control-room") { response.status(200).json(runRigZipDryRun().readModel); return; }
  if (method === "GET" && pathname === "/api/v1/screens") { response.status(200).json({ screens:productScreens }); return; }
  if (method === "GET" && pathname === "/api/v1/geographies") { response.status(200).json({ geographies:referenceGeographies.list() }); return; }
  if (method === "GET" && pathname === "/api/v1/country-catalog") { response.setHeader("Cache-Control", "public, max-age=86400"); response.status(200).json({ countries:countries() }); return; }
  if (method === "GET" && pathname === "/api/v1/factory-status") {
    const generatedAt = new Date().toISOString();
    const state = initialOperatingState();
    const readModel = runRigZipDryRun().readModel;
    response.status(200).json({ generatedAt, cadence:factoryCadenceAt(generatedAt), runtimeVersion:state.version, mode:state.mode, openDecisions:state.openDecisions, brands:readModel.portfolio.length, expansionMarkets:4, expansionAreas:0, availableCapitalUsd:readModel.wallet.availableUsd, killSwitch:readModel.authority.killSwitch, source:"VERCEL_GOVERNED_READ_MODEL" });
    return;
  }
  response.status(404).json({ error:"Not found" });
}

