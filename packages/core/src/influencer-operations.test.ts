import {describe,expect,it} from "vitest";
import {createInfluencerEngagement,type InfluencerProfile} from "./influencer-operations.js";

const profile:InfluencerProfile={id:"creator-1",handle:"@nebraskahauls",platform:"youtube",territories:["US-NE"],audienceTopics:["commercial trailers"],followers:42000,verifiedEngagementRate:.061,riskFlags:[],contactState:"CONTACTABLE"};
describe("governed influencer operations",()=>{
  it("creates a traceable engagement and escalates compensation beyond authority",()=>{
    const engagement=createInfluencerEngagement({profile,brandId:"rigzip",influencerId:profile.id,campaignId:"campaign-1",compensation:{model:"HYBRID",maximumUsd:1200},deliverables:["video","short"],rights:["organic","paid_whitelisting_30d"],disclosureRequired:true,autonomousSpendLimitUsd:500});
    expect(engagement.stage).toBe("SHORTLISTED");
    expect(engagement.ownerApprovalRequired).toBe(true);
  });
});
