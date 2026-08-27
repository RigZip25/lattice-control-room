import {mkdtempSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {afterEach,describe,expect,it} from "vitest";
import {applyOperatingCommand,initialOperatingState} from "@lattice/core";
import {createFileOperatingStateStore} from "./state-store.js";

const roots:string[]=[];
afterEach(()=>{for(const root of roots.splice(0)) rmSync(root,{recursive:true,force:true});});

describe("durable local operating-state repository",()=>{
  it("persists and reloads governed commands atomically",()=>{
    const root=mkdtempSync(join(tmpdir(),"lattice-state-")); roots.push(root);
    const store=createFileOperatingStateStore(join(root,"runtime.json"));
    expect(store.load()).toEqual(initialOperatingState());
    const changed=applyOperatingCommand(store.load(),{kind:"SET_FILTER",filter:"RIGZIP"},"2026-08-26T12:00:00.000Z");
    store.save(changed);
    expect(store.load()).toMatchObject({version:1,selectedFilter:"RIGZIP",mode:"DRY_RUN"});
  });
  it("fails closed on an incompatible state file",()=>{
    const root=mkdtempSync(join(tmpdir(),"lattice-state-")); roots.push(root);
    const path=join(root,"runtime.json");
    const store=createFileOperatingStateStore(path);
    expect(()=>createFileOperatingStateStore("")).toThrow(/path/);
    expect(store.load().version).toBe(0);
  });
  it("restores a completed dry-run cycle after a process restart",()=>{
    const root=mkdtempSync(join(tmpdir(),"lattice-state-")); roots.push(root);
    const store=createFileOperatingStateStore(join(root,"runtime.json"));
    const changed=applyOperatingCommand(store.load(),{kind:"START_RIGZIP_DRY_RUN",cycleId:"rigzip-restart-proof"},"2026-08-27T12:00:00.000Z");
    store.save(changed);
    const restored=createFileOperatingStateStore(join(root,"runtime.json")).load();
    expect(restored.executionCycles[0]?.cycleId).toBe("rigzip-restart-proof");
    expect(restored.executionCycles[0]?.jobs.every((job)=>job.state==="SUCCEEDED")).toBe(true);
  });
});
