import {describe,expect,it} from "vitest";
import {continuousFactoryShifts,factoryCadenceAt} from "./factory-scheduler.js";

describe("continuous three-shift autonomous factory",()=>{
  it("covers all twenty-four hours with three eight-hour shifts",()=>{
    expect(continuousFactoryShifts.map((shift)=>shift.startsAtHourUtc)).toEqual([0,8,16]);
    expect(continuousFactoryShifts.reduce((sum,shift)=>sum+shift.durationMinutes,0)).toBe(1440);
  });
  it("runs a five-minute brainstorm after every 115-minute production block without stopping execution queues",()=>{
    expect(factoryCadenceAt("2026-08-26T01:54:00.000Z")).toMatchObject({shift:"SHIFT_A",mode:"PRODUCTION",minutesUntilTransition:1});
    expect(factoryCadenceAt("2026-08-26T01:55:00.000Z")).toMatchObject({shift:"SHIFT_A",mode:"BRAINSTORM",minutesUntilTransition:5,executionQueuesContinue:true});
  });
});
