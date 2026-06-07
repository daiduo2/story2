import { createServer, IncomingMessage, ServerResponse } from "http";
import { config } from "dotenv";
import fs from "fs/promises";
import path from "path";
import { NarrativeDirector } from "./agent.js";
import {
  GameEvent as AgentGameEvent,
  PlayerSignature as AgentPlayerSignature,
} from "./store.js";
import { createStartupLogger } from "./logger.js";
import { renderPage } from "./render.js";

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

async function serveStaticFile(urlPath: string, res: ServerResponse): Promise<void> {
  const staticPath = urlPath === "/" ? "/index.html" : urlPath;
  const filePath = path.join("public", staticPath);

  const contentTypes: Record<string, string> = {
    ".html": "text/html",
    ".js": "application/javascript",
    ".css": "text/css",
    ".json": "application/json",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".svg": "image/svg+xml",
  };

  try {
    const content = await fs.readFile(filePath);
    const ext = path.extname(filePath);
    res.writeHead(200, { "Content-Type": contentTypes[ext] || "application/octet-stream" });
    res.end(content);
  } catch {
    res.writeHead(404, { "Content-Type": "text/html" });
    res.end("<h1>404</h1><p>Not found</p>");
  }
}

async function startServer(): Promise<void> {
  const logger = createStartupLogger();
  logger.info("server.startup", { port: PORT });

  const director = new NarrativeDirector(logger);
  await director.init();
  logger.info("server.director_ready");

  const server = createServer(async (req, res) => {
    setCorsHeaders(res);

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = new URL(req.url || "/", `http://localhost:${PORT}`);
    logger.info("http.request", { method: req.method, path: url.pathname });

    // API route
    if (url.pathname === "/api/narrative" && req.method === "POST") {
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
        logger.info("api.narrative.success", { sessionId: body.sessionId });
      } catch (error) {
        logger.error("api.narrative.failed", {
          sessionId: body.sessionId,
          error: error instanceof Error ? error.message : String(error),
        });
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Internal server error" }));
      }
      return;
    }

    // Dynamic markdown page route
    const pageMatch = url.pathname.match(/^\/pages\/(.+)$/);
    if (pageMatch && req.method === "GET") {
      const pageId = pageMatch[1];
      try {
        const html = await renderPage(pageId);
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(html);
        logger.info("page.render", { pageId });
      } catch {
        logger.warn("page.not_found", { pageId });
        res.writeHead(404, { "Content-Type": "text/html" });
        res.end("<h1>404</h1><p>档案未找到</p>");
      }
      return;
    }

    // Static file routes
    if (req.method === "GET") {
      await serveStaticFile(url.pathname, res);
      return;
    }

    res.writeHead(404);
    res.end("Not found");
  });

  server.listen(PORT, () => {
    logger.info("server.listening", { url: `http://localhost:${PORT}` });
  });
}

startServer().catch((err) => {
  console.error("[server] Failed to start:", err);
  process.exit(1);
});
