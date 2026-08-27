import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { initialOperatingState, type OperatingState } from "@lattice/core";

export interface OperatingStateStore {
  load(): OperatingState;
  save(state:OperatingState):void;
}

function assertStoredState(value:unknown):asserts value is OperatingState {
  if (value===null || typeof value!=="object") throw new Error("Stored operating state must be an object");
  const state=value as Partial<OperatingState>;
  if (!Number.isInteger(state.version) || state.mode!=="DRY_RUN" || !Array.isArray(state.events) || !Array.isArray(state.discoveryMarkets) || !Array.isArray(state.expansionAreas) || !Array.isArray(state.brandProfiles)) throw new Error("Stored operating state is incompatible");
}

export function createFileOperatingStateStore(path:string):OperatingStateStore {
  if (!path.trim()) throw new Error("Operating state path is required");
  return {
    load() {
      if (!existsSync(path)) return initialOperatingState();
      const parsed:unknown=JSON.parse(readFileSync(path,"utf8"));
      assertStoredState(parsed);
      return { ...parsed, productSources:parsed.productSources ?? [], productEvidence:parsed.productEvidence ?? [], productDiagnoses:parsed.productDiagnoses ?? [], expansionTheses:parsed.expansionTheses ?? [], executionCycles:parsed.executionCycles ?? [] };
    },
    save(state) {
      mkdirSync(dirname(path),{recursive:true});
      const temporaryPath=`${path}.${process.pid}.tmp`;
      writeFileSync(temporaryPath,`${JSON.stringify(state,null,2)}\n`,{encoding:"utf8",flag:"w"});
      renameSync(temporaryPath,path);
    },
  };
}
