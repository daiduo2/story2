import { createServer, IncomingMessage, ServerResponse } from "http";
import { config } from "dotenv";
import { NarrativeDirector } from "./agent.js";
import {
  GameEvent as AgentGameEvent,
  PlayerSignature as AgentPlayerSignature,
} from "./store.js";

config({ override: true });

const PORT = Number(process.env.NARRATIVE_PORT) || 3724;

interface FrontendGameEvent {
  type: string;
  pageId?: string;
  keyword?: string;
  ruleId?: string;
  anomalyId?: string;
}

interface FrontendPageVisit {
  url: string;
  title: string;
  firstVisit: number;
  lastVisit: number;
  visitCount: number;
  dwellTime: number;
  maxScrollDepth: number;
}

interface FrontendSearchRecord {
  query: string;
  timestamp: number;
  pageUrl: string;
}

interface FrontendRuleViolation {
  ruleId: string;
  detail: string;
  timestamp: number;
  pageUrl: string;
}

interface FrontendPlayerSignature {
  sessionId: string;
  startTime: number;
  lastActiveTime: number;
  pagesVisited: FrontendPageVisit[];
  searches: FrontendSearchRecord[];
  anomaliesTriggered: string[];
  ruleViolations: FrontendRuleViolation[];
  copies: number;
  totalScrollDepth: number;
  pageCount: number;
  returnVisit: boolean;
  version: number;
}

interface RequestBody {
  sessionId: string;
  event: FrontendGameEvent;
  signature: FrontendPlayerSignature;
}

function parseBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(data));
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", reject);
  });
}

function setCorsHeaders(res: ServerResponse): void {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function adaptSignature(
  frontend: FrontendPlayerSignature
): AgentPlayerSignature {
  return {
    sessionId: frontend.sessionId,
    startTime: frontend.startTime,
    pagesVisited: frontend.pagesVisited.map((p) => p.url),
    searches: frontend.searches.map((s) => ({
      query: s.query,
      timestamp: s.timestamp,
    })),
    anomaliesTriggered: frontend.anomaliesTriggered,
    ruleViolations: frontend.ruleViolations.map((v) => v.ruleId),
    copies: frontend.copies,
    totalScrollDepth: frontend.totalScrollDepth,
  };
}

function adaptEvent(frontend: FrontendGameEvent): AgentGameEvent {
  return {
    type: frontend.type,
    pageId: frontend.pageId,
    timestamp: Date.now(),
  };
}

function adaptDecision(decision: {
  routeDecision: { action: string; targetPage?: string; variantHint?: string };
  systemMessage?: { text: string; style: string };
  contentModules: Array<{
    moduleId: string;
    targetSelector: string;
    position: string;
  }>;
  memoryUpdate: {
    relationshipStage: string;
    understandingDepth: number;
    observedPatterns: string[];
    notes: string;
  };
}): unknown {
  const actionMap: Record<string, string> = {
    stay: "stay",
    redirect: "redirect",
    suggest: "inject",
  };

  const styleMap: Record<string, string> = {
    observational: "observational",
    intimate: "observational",
    confrontational: "confrontational",
    invitational: "whisper",
  };

  const positionMap: Record<string, string> = {
    before: "before",
    after: "after",
    replace: "after",
  };

  return {
    version: "narrative-v2",
    routeDecision: {
      action: actionMap[decision.routeDecision.action] || "stay",
      targetPage: decision.routeDecision.targetPage,
    },
    systemMessage: decision.systemMessage
      ? {
          text: decision.systemMessage.text,
          style:
            styleMap[decision.systemMessage.style] ||
            decision.systemMessage.style,
        }
      : undefined,
    contentModules: decision.contentModules.map((m) => ({
      moduleId: m.moduleId,
      targetSelector: m.targetSelector,
      position: positionMap[m.position] || m.position,
    })),
    memoryUpdate: {
      relationshipStage: decision.memoryUpdate.relationshipStage,
      understandingDepth: decision.memoryUpdate.understandingDepth,
      observedPatterns: decision.memoryUpdate.observedPatterns,
      notes: decision.memoryUpdate.notes,
    },
  };
}

async function startServer(): Promise<void> {
  console.log("[server] Initializing NarrativeDirector...");
  const director = new NarrativeDirector();
  await director.init();
  console.log("[server] NarrativeDirector ready.");

  const server = createServer(async (req, res) => {
    setCorsHeaders(res);

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    if (req.method !== "POST" || req.url !== "/api/narrative") {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Not found" }));
      return;
    }

    let body: RequestBody;
    try {
      const parsed = (await parseBody(req)) as RequestBody;
      body = parsed;
    } catch {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Invalid JSON" }));
      return;
    }

    if (!body.sessionId || !body.signature) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Missing sessionId or signature" }));
      return;
    }

    try {
      const agentSignature = adaptSignature(body.signature);
      const agentEvent = adaptEvent(body.event);

      await director.ensureSession(body.sessionId);

      const decision = await director.evaluate(
        body.sessionId,
        agentEvent,
        agentSignature
      );

      const adapted = adaptDecision(decision);

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(adapted));
    } catch (error) {
      console.error("[server] Evaluate error:", error);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Internal server error" }));
    }
  });

  server.listen(PORT, () => {
    console.log(`[server] Listening on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("[server] Failed to start:", err);
  process.exit(1);
});
