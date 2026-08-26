import { runDecisionLoop, type DecisionLoopInput } from "./decision-loop.js";
import type { DecisionPacketStore } from "./decision-packet-store.js";
import type { DecisionPacket, WorkspaceId } from "./model.js";

export interface Principal {
  readonly subjectId: string;
  readonly workspaceId: WorkspaceId;
  readonly allowedBrandIds: readonly string[];
  readonly roles: readonly ("OWNER" | "STRATEGIST" | "OPERATOR" | "VIEWER")[];
}

export interface DecisionSummary {
  readonly decisionId: string;
  readonly workspaceId: WorkspaceId;
  readonly brandId: string;
  readonly marketCellId: string;
  readonly kind: DecisionPacket["capitalDecision"]["kind"];
  readonly approvedUsd: number;
  readonly confidence: DecisionPacket["capitalDecision"]["confidence"];
  readonly authorizationState: DecisionPacket["distributionAuthorization"]["state"];
  readonly reasonCodes: readonly string[];
}

function authorize(principal: Principal, workspaceId: WorkspaceId, brandId: string): void {
  if (principal.workspaceId !== workspaceId) {
    throw new Error("Principal workspace does not match requested workspace");
  }
  if (!principal.allowedBrandIds.includes(brandId)) {
    throw new Error("Principal is not authorized for requested brand");
  }
}

function summarize(packet: DecisionPacket): DecisionSummary {
  return {
    decisionId: packet.capitalDecision.id,
    workspaceId: packet.capitalDecision.workspaceId,
    brandId: packet.capitalDecision.brandId,
    marketCellId: packet.capitalDecision.marketCellId,
    kind: packet.capitalDecision.kind,
    approvedUsd: packet.capitalDecision.approvedUsd,
    confidence: packet.capitalDecision.confidence,
    authorizationState: packet.distributionAuthorization.state,
    reasonCodes: [...packet.capitalDecision.reasonCodes],
  };
}

export class DecisionService {
  constructor(private readonly store: DecisionPacketStore) {}

  async evaluate(
    principal: Principal,
    input: DecisionLoopInput,
  ): Promise<{ result: "INSERTED" | "IDEMPOTENT_REPLAY"; decision: DecisionSummary }> {
    authorize(principal, input.productSnapshot.workspaceId, input.productSnapshot.brandId);
    if (!principal.roles.some((role) => role === "OWNER" || role === "STRATEGIST")) {
      throw new Error("Principal may not evaluate a capital decision");
    }
    const packet = runDecisionLoop(input);
    const result = await this.store.append(packet);
    return { result, decision: summarize(packet) };
  }

  async list(principal: Principal): Promise<readonly DecisionSummary[]> {
    const packets = await this.store.list(principal.workspaceId);
    return packets
      .filter((packet) => principal.allowedBrandIds.includes(packet.capitalDecision.brandId))
      .map(summarize);
  }
}

