import { createServer, IncomingMessage, ServerResponse } from "http";
import { config } from "dotenv";
import fs from "fs/promises";
import path from "path";
import { marked } from "marked";
import yaml from "js-yaml";
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

async function findContentFile(pageId: string): Promise<string> {
  const dirs = ["volumes", "supplements", "peripherals", "meta", "variants"];
  for (const dir of dirs) {
    const filePath = path.join("content", dir, `${pageId}.md`);
    try {
      await fs.access(filePath);
      return filePath;
    } catch {
      // continue
    }
  }
  throw new Error(`Content not found: ${pageId}`);
}

function parseFrontmatter(content: string): { metadata: Record<string, string>; body: string } {
  const match = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (match) {
    const metadata = yaml.load(match[1]) as Record<string, string>;
    return { metadata, body: match[2].trim() };
  }
  return { metadata: {}, body: content.trim() };
}

function buildPageHtml(metadata: Record<string, string>, contentHtml: string): string {
  const title = metadata.title || "白鹿疗养院数字档案";
  const pageNum = metadata.page_num || "";
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body { font-family: 'Noto Serif SC', 'SimSun', serif; max-width: 800px; margin: 0 auto; padding: 40px 20px; background: #f5f5f0; color: #333; line-height: 1.8; }
    h1 { color: #2c5f2d; border-bottom: 2px solid #2c5f2d; padding-bottom: 10px; font-size: 1.8em; }
    h2 { color: #3a7a3c; margin-top: 2em; font-size: 1.4em; }
    h3 { color: #4a4a4a; margin-top: 1.5em; }
    a { color: #2c5f2d; text-decoration: none; }
    a:hover { color: #1e401f; }
    nav { margin-bottom: 30px; padding-bottom: 15px; border-bottom: 1px solid #ddd; }
    nav a { margin-right: 15px; }
    .search-box { margin: 20px 0; position: relative; }
    #search-form { display: flex; gap: 10px; }
    #search-input { flex: 1; padding: 10px; font-size: 15px; border: 1px solid #ccc; border-radius: 4px; font-family: inherit; }
    button { padding: 10px 20px; background: #2c5f2d; color: white; border: none; border-radius: 4px; cursor: pointer; font-family: inherit; }
    button:hover { background: #1e401f; }
    .search-feedback { margin-top: 10px; padding: 10px 14px; border-radius: 4px; font-size: 14px; animation: fadeIn 0.2s ease; }
    .search-found { background: #e8f5e9; color: #2c5f2d; border: 1px solid #a5d6a7; }
    .search-not-found { background: #ffebee; color: #8b0000; border: 1px solid #ef9a9a; }
    #search-history { margin-top: 10px; display: flex; flex-wrap: wrap; gap: 8px; }
    .search-history-item { display: inline-block; padding: 4px 12px; background: #e8e8e0; border-radius: 12px; font-size: 13px; color: #555; cursor: pointer; }
    .search-history-item:hover { background: #d0d0c8; }
    .meta { color: #666; font-size: 0.9em; margin-bottom: 20px; }
    .page-num { float: right; color: #999; font-size: 0.85em; }
    blockquote { border-left: 3px solid #2c5f2d; margin: 1em 0; padding-left: 1em; color: #555; }
    ul, ol { padding-left: 1.5em; }
    hr { border: none; border-top: 1px solid #ddd; margin: 2em 0; }
    footer { margin-top: 60px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666; }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
  </style>
</head>
<body>
  <nav>
    <a href="/">首页</a>
    <a href="/pages/archives">档案检索</a>
  </nav>
  <div class="search-box">
    <form id="search-form">
      <input type="text" id="search-input" placeholder="搜索档案..." autocomplete="off" />
      <button type="submit">搜索</button>
    </form>
    <div id="search-history"></div>
  </div>
  ${pageNum ? `<div class="page-num">${pageNum}</div>` : ""}
  <main>${contentHtml}</main>
  <footer>
    <p>白鹿疗养院病历数字化项目 | 内部资料</p>
  </footer>
  <script type="module" src="/js/frontend.js"></script>
</body>
</html>`;
}

async function renderPage(pageId: string): Promise<string> {
  const filePath = await findContentFile(pageId);
  const raw = await fs.readFile(filePath, "utf-8");
  const { metadata, body } = parseFrontmatter(raw);
  const contentHtml = await marked.parse(body);
  return buildPageHtml(metadata, contentHtml);
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

    const url = new URL(req.url || "/", `http://localhost:${PORT}`);

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
      } catch {
        console.error("[server] Evaluate error");
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
      } catch {
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
    console.log(`[server] Listening on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("[server] Failed to start:", err);
  process.exit(1);
});
