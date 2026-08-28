import {describe,expect,it} from "vitest";
import {initialOperatingState,type BrandProfile} from "@lattice/core";
import {reconcileRegisteredBrands} from "./state-reconciliation.js";

const registryBrand:BrandProfile={id:"my-smart-road",name:"My Smart Road",archetype:"OTHER",offering:"Продукт представлен на сайте https://www.mysmartroad.com",audience:"Водители",businessModel:"Требует подтверждения",objectives:["Понять продукт"],primaryValueEvent:"validated_customer_value",targetGeographies:["GLOBAL"],languages:["ru"],constraints:["DRY RUN only"],status:"DISCOVERY"};

describe("canonical brand reconciliation",()=>{
  it("restores a canonical brand and a safe draft when workspace_state lost both",()=>{
    const restored=reconcileRegisteredBrands({...initialOperatingState(),version:6},[{brand_id:registryBrand.id,name:registryBrand.name,profile:registryBrand,status:"DISCOVERY"}]);
    expect(restored.brandProfiles).toEqual([registryBrand]);
    expect(restored.productUnderstandings[0]).toMatchObject({brandId:"my-smart-road",website:"https://www.mysmartroad.com",status:"DRAFT"});
  });

  it("replaces stale profiles, removes orphaned state, and hides paused rows",()=>{
    const stale={...registryBrand,offering:"stale offering"};
    const orphan={...registryBrand,id:"orphan",name:"Orphan"};
    const replaced=reconcileRegisteredBrands({...initialOperatingState(),brandProfiles:[stale,orphan]},[{brand_id:registryBrand.id,name:registryBrand.name,profile:registryBrand,status:"DISCOVERY"}]);
    expect(replaced.brandProfiles).toEqual([registryBrand]);
    const paused=reconcileRegisteredBrands(replaced,[{brand_id:registryBrand.id,name:registryBrand.name,profile:registryBrand,status:"PAUSED"}]);
    expect(paused.brandProfiles).toHaveLength(0);
    expect(paused.productUnderstandings).toHaveLength(0);
  });
});
