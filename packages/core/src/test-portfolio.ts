import { deterministicId } from "./identity.js";

export interface TestPortfolioChannel {
  readonly channel:string;
  readonly role:string;
  readonly hypothesis:string;
  readonly allocationUsd:number;
  readonly primaryMetric:string;
  readonly successThreshold:string;
  readonly stopCondition:string;
  readonly legalCheck:string;
}

export interface TestPortfolio {
  readonly id:string;
  readonly brandId:string;
  readonly expansionThesisId:string;
  readonly geographyName:string;
  readonly objective:string;
  readonly durationDays:number;
  readonly proposedBudgetUsd:number;
  readonly authorityRequired:boolean;
  readonly channels:readonly TestPortfolioChannel[];
  readonly assumptions:readonly string[];
  readonly createdAt:string;
  readonly status:"DRAFT";
  readonly mode:"DRY_RUN";
}

export function createTestPortfolio(input:Omit<TestPortfolio,"id"|"status"|"mode">):TestPortfolio{
  if(!input.brandId||!input.expansionThesisId||input.geographyName.trim().length<2||input.objective.trim().length<8)throw new Error("Test portfolio identity is incomplete");
  if(!Number.isInteger(input.durationDays)||input.durationDays<3||input.durationDays>90)throw new Error("Test portfolio duration must be 3–90 days");
  if(!Number.isFinite(input.proposedBudgetUsd)||input.proposedBudgetUsd<0||input.proposedBudgetUsd>10_000)throw new Error("Test portfolio budget is outside the planning envelope");
  if(input.channels.length<2||input.channels.length>6)throw new Error("Test portfolio requires 2–6 channels");
  const allocated=input.channels.reduce((sum,item)=>sum+item.allocationUsd,0);
  if(input.channels.some((item)=>!item.channel.trim()||!item.hypothesis.trim()||item.allocationUsd<0)||Math.abs(allocated-input.proposedBudgetUsd)>.01)throw new Error("Test portfolio channel allocation is invalid");
  if(!Number.isFinite(Date.parse(input.createdAt)))throw new Error("Test portfolio timestamp is invalid");
  const payload={...input,status:"DRAFT" as const,mode:"DRY_RUN" as const};
  return {...payload,id:deterministicId("test_portfolio",payload)};
}

