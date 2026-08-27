import { describe, expect, it } from "vitest";
import { assessProductIntelligence, recordProductEvidence, registerProductSource } from "./product-evidence.js";

describe("product intelligence evidence register", () => {
  const website = registerProductSource({ brandId:"rigzip", kind:"WEBSITE", title:"RigZip website", locator:"https://rigzip.com", capturedAt:"2026-08-27T13:00:00.000Z" });
  const interview = registerProductSource({ brandId:"rigzip", kind:"INTERVIEW", title:"Owner interview", locator:"interview://owner/2026-08-27", capturedAt:"2026-08-27T13:05:00.000Z" });

  it("keeps facts, inference and unknowns explicitly separated", () => {
    const evidence = [
      recordProductEvidence({ brandId:"rigzip", sourceId:website.id, statement:"RigZip rents commercial vehicles in the United States", classification:"FACT", confidence:.95, recordedAt:"2026-08-27T13:10:00.000Z" },website),
      recordProductEvidence({ brandId:"rigzip", sourceId:website.id, statement:"Availability may be the dominant registration barrier", classification:"INFERENCE", confidence:.61, recordedAt:"2026-08-27T13:11:00.000Z" },website),
      recordProductEvidence({ brandId:"rigzip", sourceId:interview.id, statement:"County-level supply density has not yet been measured", classification:"UNKNOWN", confidence:0, recordedAt:"2026-08-27T13:12:00.000Z" },interview),
    ];
    expect(assessProductIntelligence([website,interview],evidence)).toMatchObject({ state:"INSUFFICIENT_EVIDENCE", facts:1, inferences:1, unknowns:1 });
  });

  it("blocks unsupported facts and becomes ready only with minimum evidence", () => {
    expect(() => recordProductEvidence({ brandId:"rigzip", sourceId:website.id, statement:"An uncertain statement cannot be promoted to fact", classification:"FACT", confidence:.4, recordedAt:"2026-08-27T13:10:00.000Z" },website)).toThrow(/fact requires confidence/);
    const facts = ["Commercial vehicles are the initial category","Nebraska is an initial validation market","Qualified registration is the primary value event"].map((statement,index)=>recordProductEvidence({ brandId:"rigzip", sourceId:index===2?interview.id:website.id, statement, classification:"FACT", confidence:.8, recordedAt:`2026-08-27T13:1${index}:00.000Z` },index===2?interview:website));
    const unknown = recordProductEvidence({ brandId:"rigzip", sourceId:interview.id, statement:"The initial county-level acquisition cost is unknown", classification:"UNKNOWN", confidence:0, recordedAt:"2026-08-27T13:20:00.000Z" },interview);
    expect(assessProductIntelligence([website,interview],[...facts,unknown])).toMatchObject({ state:"READY_FOR_DIAGNOSIS", blockers:[] });
  });
});
