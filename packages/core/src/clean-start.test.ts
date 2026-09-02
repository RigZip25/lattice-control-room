import {describe,expect,it} from "vitest";
import {applyOperatingCommand,initialOperatingState,type BrandProfile,type ProductUnderstanding} from "./operating-state.js";

describe("single-brand clean start",()=>{
  it("keeps the chosen profile and intake while removing derived and demo state",()=>{
    const keep={id:"my-smart-road",name:"My Smart Road",archetype:"RECURRING_UTILITY",offering:"AI road companion",audience:"Truck drivers",primaryValueEvent:"Useful assisted trip",businessModel:"Subscription",targetGeographies:["US"],languages:["EN"],objectives:["Validate product"],constraints:[],status:"DISCOVERY"} satisfies BrandProfile;
    const remove={...keep,id:"rigzip",name:"RigZip"};
    const intake={brandId:keep.id,website:"https://mysmartroad.com",ownerDescription:"An AI road companion for truck drivers",materialNames:[],productSummary:"A road companion",customerSummary:"Truck drivers",valueSummary:"Safer planned trips",assumptions:[],criticalQuestions:[],status:"CONFIRMED",confirmedAt:"2026-09-01T00:00:00.000Z"} satisfies ProductUnderstanding;
    const state={...initialOperatingState(),brandProfiles:[keep,remove],productUnderstandings:[intake],openDecisions:3,discoveryMarkets:[{countryCode:"US",countryName:"United States",slug:"united-states",brand:"RIGZIP",activity:"TRAILERS",status:"DISCOVERY" as const,penetration:0}]};
    const result=applyOperatingCommand(state,{kind:"CLEAN_START_BRAND",brandId:keep.id},"2026-09-02T12:00:00.000Z");
    expect(result.brandProfiles.map((item)=>item.id)).toEqual([keep.id]);expect(result.productUnderstandings[0]).toMatchObject({brandId:keep.id,website:"https://mysmartroad.com",status:"DRAFT"});expect(result.discoveryMarkets).toEqual([]);expect(result.openDecisions).toBe(0);
  });
});

