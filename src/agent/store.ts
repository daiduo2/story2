import fs from "fs/promises";
import path from "path";
import type { Logger } from "./logger.js";

export interface GameEvent {
  type: string;
  pageId?: string;
  timestamp: number;
}

export interface SearchRecord {
  query: string;
  timestamp: number;
}

export interface PlayerSignature {
  sessionId: string;
  startTime: number;
  pagesVisited: string[];
  searches: SearchRecord[];
  anomaliesTriggered: string[];
  ruleViolations: string[];
  copies: number;
  totalScrollDepth: number;
}

export interface RouteDecision {
  action: "stay" | "redirect" | "suggest";
  targetPage?: string;
  variantHint?: string;
}

export interface SystemMessage {
  text: string;
  style: "observational" | "intimate" | "confrontational" | "invitational";
}

export interface ContentModule {
  moduleId: string;
  targetSelector: string;
  position: "before" | "after" | "replace";
}

export interface MemoryUpdate {
  relationshipStage: "unknown" | "noticed" | "watched" | "understood" | "confronted" | "fused";
  understandingDepth: number;
  observedPatterns: string[];
  notes: string;
}

export interface NarrativeDecision {
  version: string;
  routeDecision: RouteDecision;
  systemMessage?: SystemMessage;
  contentModules: ContentModule[];
  memoryUpdate: MemoryUpdate;
}

export interface DecisionRecord {
  timestamp: number;
  event: GameEvent;
  decision: NarrativeDecision;
}

export interface Memory {
  relationshipStage: MemoryUpdate["relationshipStage"];
  understandingDepth: number;
  observedPatterns: string[];
  messagesSent: string[];
  decisions: DecisionRecord[];
  notes: string;
}

export class MemoryStore {
  private dataDir: string;
  private logger: Logger;

  constructor(dataDir = "./baiLu-data/players", logger?: Logger) {
    this.dataDir = dataDir;
    this.logger = logger ?? { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} };
  }

  async load(sessionId: string): Promise<Memory> {
    const filePath = path.join(this.dataDir, `${sessionId}.json`);
    try {
      const raw = await fs.readFile(filePath, "utf-8");
      const memory = JSON.parse(raw) as Memory;
      this.logger.info("memory.loaded", { sessionId, stage: memory.relationshipStage });
      return memory;
    } catch (err) {
      this.logger.info("memory.created", { sessionId, reason: "file_not_found" });
      return this.createDefaultMemory();
    }
  }

  async save(sessionId: string, memory: Memory, decision: NarrativeDecision): Promise<void> {
    const updated: Memory = {
      ...memory,
      relationshipStage: decision.memoryUpdate.relationshipStage,
      understandingDepth: decision.memoryUpdate.understandingDepth,
      observedPatterns: decision.memoryUpdate.observedPatterns,
      messagesSent: decision.systemMessage
        ? [...memory.messagesSent, decision.systemMessage.text]
        : memory.messagesSent,
      decisions: [
        ...memory.decisions,
        {
          timestamp: Date.now(),
          event: { type: "narrative", timestamp: Date.now() },
          decision,
        },
      ],
      notes: decision.memoryUpdate.notes,
    };

    await fs.mkdir(this.dataDir, { recursive: true });
    await fs.writeFile(
      path.join(this.dataDir, `${sessionId}.json`),
      JSON.stringify(updated, null, 2)
    );

    this.logger.info("memory.saved", {
      sessionId,
      stage: updated.relationshipStage,
      depth: updated.understandingDepth,
      decisionCount: updated.decisions.length,
    });
  }

  private createDefaultMemory(): Memory {
    return {
      relationshipStage: "unknown",
      understandingDepth: 0,
      observedPatterns: [],
      messagesSent: [],
      decisions: [],
      notes: "新玩家，尚无印象。",
    };
  }
}
