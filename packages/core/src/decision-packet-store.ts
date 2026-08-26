import { deterministicId } from "./identity.js";
import type { DecisionPacket, WorkspaceId } from "./model.js";

export interface DecisionPacketStore {
  append(packet: DecisionPacket): Promise<"INSERTED" | "IDEMPOTENT_REPLAY">;
  get(workspaceId: WorkspaceId, decisionId: string): Promise<DecisionPacket | undefined>;
  list(workspaceId: WorkspaceId): Promise<readonly DecisionPacket[]>;
}

function packetFingerprint(packet: DecisionPacket): string {
  return deterministicId("packet", packet);
}

export class InMemoryDecisionPacketStore implements DecisionPacketStore {
  readonly #packets = new Map<string, { fingerprint: string; packet: DecisionPacket }>();

  async append(packet: DecisionPacket): Promise<"INSERTED" | "IDEMPOTENT_REPLAY"> {
    const key = `${packet.productSnapshot.workspaceId}:${packet.capitalDecision.id}`;
    const fingerprint = packetFingerprint(packet);
    const existing = this.#packets.get(key);
    if (existing !== undefined) {
      if (existing.fingerprint !== fingerprint) {
        throw new Error("Conflicting decision packet identity");
      }
      return "IDEMPOTENT_REPLAY";
    }
    this.#packets.set(key, { fingerprint, packet: structuredClone(packet) });
    return "INSERTED";
  }

  async get(
    workspaceId: WorkspaceId,
    decisionId: string,
  ): Promise<DecisionPacket | undefined> {
    const record = this.#packets.get(`${workspaceId}:${decisionId}`);
    return record === undefined ? undefined : structuredClone(record.packet);
  }

  async list(workspaceId: WorkspaceId): Promise<readonly DecisionPacket[]> {
    return [...this.#packets.values()]
      .map((entry) => entry.packet)
      .filter((packet) => packet.productSnapshot.workspaceId === workspaceId)
      .sort((left, right) => left.capitalDecision.id.localeCompare(right.capitalDecision.id))
      .map((packet) => structuredClone(packet));
  }
}

