import {describe,expect,it} from "vitest";
import {createExpansionThesis,expansionCandidateScore} from "./expansion-thesis.js";
import type {ProductDiagnosis} from "./product-diagnosis.js";

const diagnosis:ProductDiagnosis={id:"diag-1",brandId:"rigzip",valueThesis:"Qualified demand reduces idle fleet time",priorityAudiences:["fleet owners"],customerProblems:["idle fleet"],adoptionBarriers:["trust"],competitiveAlternatives:["brokers"],materialRisks:["imbalance"],unresolvedQuestions:["CPA"],evidenceIds:["a","b","c"],createdAt:"2026-08-27T16:00:00.000Z",status:"DRAFT"};
const candidate=(countryCode:string,geographyName:string)=>({countryCode,geographyName,administrativeLevel:"STATE" as const,demandScore:80,supplyScore:70,accessibilityScore:60,regulatoryScore:90,rationale:"Demand and supply can be tested with bounded exposure",assumptions:["Search demand represents intent"],validationQuestions:["Can qualified requests stay below target CPA?"]});
describe("expansion thesis",()=>{
  it("creates a diagnosis-cited comparison without allocating money",()=>{const thesis=createExpansionThesis({brandId:"rigzip",diagnosisId:diagnosis.id,candidates:[candidate("US","Nebraska"),candidate("US","Iowa")],createdAt:"2026-08-27T16:10:00.000Z"},diagnosis);expect(thesis.status).toBe("DRAFT");expect(expansionCandidateScore(thesis.candidates[0]!)).toBe(75.5);});
  it("requires at least two geographies",()=>{expect(()=>createExpansionThesis({brandId:"rigzip",diagnosisId:diagnosis.id,candidates:[candidate("US","Nebraska")],createdAt:"2026-08-27T16:10:00.000Z"},diagnosis)).toThrow(/at least two/);});
});
