import { deterministicId } from "./identity.js";

export interface FactoryShift {
  readonly id:string;
  readonly name:"SHIFT_A"|"SHIFT_B"|"SHIFT_C";
  readonly startsAtHourUtc:number;
  readonly durationMinutes:480;
  readonly productionBlockMinutes:115;
  readonly brainstormMinutes:5;
  readonly brainstormCount:4;
}

export interface FactoryCadenceState {
  readonly id:string;
  readonly shift:FactoryShift["name"];
  readonly mode:"PRODUCTION"|"BRAINSTORM";
  readonly minuteInShift:number;
  readonly minutesUntilTransition:number;
  readonly executionQueuesContinue:boolean;
  readonly brainstormAgenda:readonly string[];
}

export const continuousFactoryShifts:readonly FactoryShift[]=[
  {id:"shift-a",name:"SHIFT_A",startsAtHourUtc:0,durationMinutes:480,productionBlockMinutes:115,brainstormMinutes:5,brainstormCount:4},
  {id:"shift-b",name:"SHIFT_B",startsAtHourUtc:8,durationMinutes:480,productionBlockMinutes:115,brainstormMinutes:5,brainstormCount:4},
  {id:"shift-c",name:"SHIFT_C",startsAtHourUtc:16,durationMinutes:480,productionBlockMinutes:115,brainstormMinutes:5,brainstormCount:4},
];

export function factoryCadenceAt(isoTime:string):FactoryCadenceState {
  const timestamp=Date.parse(isoTime);
  if (!Number.isFinite(timestamp)) throw new Error("Factory cadence timestamp is invalid");
  const date=new Date(timestamp);
  const minuteOfDay=date.getUTCHours()*60+date.getUTCMinutes();
  const shift=continuousFactoryShifts[Math.floor(minuteOfDay/480)]!;
  const minuteInShift=minuteOfDay-shift.startsAtHourUtc*60;
  const cycleMinutes=shift.productionBlockMinutes+shift.brainstormMinutes;
  const minuteInCycle=minuteInShift%cycleMinutes;
  const mode=minuteInCycle<shift.productionBlockMinutes?"PRODUCTION":"BRAINSTORM";
  const minutesUntilTransition=mode==="PRODUCTION"?shift.productionBlockMinutes-minuteInCycle:cycleMinutes-minuteInCycle;
  const brainstormAgenda=["Review anomalies and failed QA","Detect creative fatigue and saturation","Propose new hypotheses and channels","Rebalance exploration portfolio"];
  return {id:deterministicId("factory_cadence",{isoTime,shift:shift.id}),shift:shift.name,mode,minuteInShift,minutesUntilTransition,executionQueuesContinue:true,brainstormAgenda};
}
