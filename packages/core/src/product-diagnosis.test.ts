import { describe,expect,it } from "vitest";
import { createProductDiagnosis } from "./product-diagnosis.js";
import { recordProductEvidence,registerProductSource } from "./product-evidence.js";

const at="2026-08-27T15:00:00.000Z";
function fixture() {
  const sources=[registerProductSource({brandId:"rigzip",kind:"WEBSITE",title:"Site",locator:"https://rigzip.com",capturedAt:at}),registerProductSource({brandId:"rigzip",kind:"INTERVIEW",title:"Interview",locator:"internal://interview/1",capturedAt:at})];
  const evidence=[recordProductEvidence({brandId:"rigzip",sourceId:sources[0]!.id,statement:"Customers can request commercial transport rentals",classification:"FACT",confidence:.9,recordedAt:at},sources[0]!),recordProductEvidence({brandId:"rigzip",sourceId:sources[1]!.id,statement:"Suppliers need qualified local rental demand",classification:"FACT",confidence:.8,recordedAt:at},sources[1]!),recordProductEvidence({brandId:"rigzip",sourceId:sources[0]!.id,statement:"A completed request is the primary value event",classification:"FACT",confidence:.8,recordedAt:at},sources[0]!),recordProductEvidence({brandId:"rigzip",sourceId:sources[1]!.id,statement:"Nebraska acquisition cost remains unknown",classification:"UNKNOWN",confidence:.5,recordedAt:at},sources[1]!)];
  return {sources,evidence};
}

describe("product diagnosis",()=>{
  it("creates a cited draft only after the evidence gate passes",()=>{const {sources,evidence}=fixture(); const diagnosis=createProductDiagnosis({brandId:"rigzip",valueThesis:"Qualified local demand reduces idle commercial fleet time",priorityAudiences:["fleet owners"],customerProblems:["idle inventory"],adoptionBarriers:["trust"],competitiveAlternatives:["brokers"],materialRisks:["supply imbalance"],unresolvedQuestions:["local CPA"],evidenceIds:evidence.slice(0,3).map((item)=>item.id),createdAt:at},sources,evidence); expect(diagnosis.status).toBe("DRAFT"); expect(diagnosis.evidenceIds).toHaveLength(3);});
  it("blocks diagnosis when product intelligence is incomplete",()=>{const {sources,evidence}=fixture(); expect(()=>createProductDiagnosis({brandId:"rigzip",valueThesis:"Qualified local demand reduces idle commercial fleet time",priorityAudiences:["fleet owners"],customerProblems:["idle inventory"],adoptionBarriers:["trust"],competitiveAlternatives:["brokers"],materialRisks:["supply imbalance"],unresolvedQuestions:["local CPA"],evidenceIds:evidence.slice(0,3).map((item)=>item.id),createdAt:at},sources.slice(0,1),evidence.slice(0,1))).toThrow(/blocked/);});
});
