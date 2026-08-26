import { runRigZipDryRun } from "@lattice/core";

process.stdout.write(`${JSON.stringify(runRigZipDryRun().packet, null, 2)}\n`);
