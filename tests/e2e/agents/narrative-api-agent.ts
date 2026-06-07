import type { AgentContext, TestAgent, Finding } from "../agent/types.ts";

interface NarrativeRequest {
  sessionId: string;
  event: {
    type: string;
    pageId?: string;
  };
  signature: {
    sessionId: string;
    startTime: number;
    lastActiveTime: number;
    pagesVisited: Array<{
      url: string;
      title: string;
      firstVisit: number;
      lastVisit: number;
      visitCount: number;
      dwellTime: number;
      maxScrollDepth: number;
    }>;
    searches: Array<{
      query: string;
      timestamp: number;
      pageUrl: string;
    }>;
    anomaliesTriggered: string[];
    ruleViolations: Array<{
      ruleId: string;
      detail: string;
      timestamp: number;
      pageUrl: string;
    }>;
    copies: number;
    totalScrollDepth: number;
    pageCount: number;
    returnVisit: boolean;
    version: number;
  };
}

function buildValidRequest(): NarrativeRequest {
  return {
    sessionId: `test-${Date.now()}`,
    event: { type: "page_visit", pageId: "volume-01" },
    signature: {
      sessionId: `test-${Date.now()}`,
      startTime: Date.now(),
      lastActiveTime: Date.now(),
      pagesVisited: [],
      searches: [],
      anomaliesTriggered: [],
      ruleViolations: [],
      copies: 0,
      totalScrollDepth: 0,
      pageCount: 0,
      returnVisit: false,
      version: 1,
    },
  };
}

export class NarrativeApiAgent implements TestAgent {
  name = "NarrativeApiAgent";
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  async run(ctx: AgentContext): Promise<number> {
    let findingCount = 0;

    const report = (finding: Finding) => {
      ctx.findings.push(finding);
      findingCount++;
    };

    // Case 1: Valid request should return 200
    const validRes = await this.postNarrative(buildValidRequest());
    if (validRes.status !== 200) {
      report({
        severity: "critical",
        category: "fallback_detected",
        page: "/api/narrative",
        description: `合法请求返回 HTTP ${validRes.status}，期望 200`,
        reproduction: `POST /api/narrative with valid body`,
      });
    }

    // Case 2: Missing sessionId should return 400
    const missingSession = buildValidRequest();
    delete (missingSession as Record<string, unknown>).sessionId;
    const missingRes = await this.postNarrative(missingSession);
    if (missingRes.status !== 400) {
      report({
        severity: "critical",
        category: "fallback_detected",
        page: "/api/narrative",
        description: `缺少 sessionId 应返回 400, 实际 ${missingRes.status}`,
        reproduction: `POST /api/narrative without sessionId`,
      });
    }

    // Case 3: Missing signature should return 400
    const missingSig = buildValidRequest();
    delete (missingSig as Record<string, unknown>).signature;
    const missingSigRes = await this.postNarrative(missingSig);
    if (missingSigRes.status !== 400) {
      report({
        severity: "critical",
        category: "fallback_detected",
        page: "/api/narrative",
        description: `缺少 signature 应返回 400, 实际 ${missingSigRes.status}`,
        reproduction: `POST /api/narrative without signature`,
      });
    }

    // Case 4: Invalid JSON should return 400
    const invalidJsonRes = await fetch(`${this.baseUrl}/api/narrative`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not-json",
    });
    if (invalidJsonRes.status !== 400) {
      report({
        severity: "critical",
        category: "fallback_detected",
        page: "/api/narrative",
        description: `非法 JSON 应返回 400, 实际 ${invalidJsonRes.status}`,
        reproduction: `POST /api/narrative with body "not-json"`,
      });
    }

    // Case 5: Empty body should return 400
    const emptyBodyRes = await fetch(`${this.baseUrl}/api/narrative`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "",
    });
    if (emptyBodyRes.status !== 400) {
      report({
        severity: "critical",
        category: "fallback_detected",
        page: "/api/narrative",
        description: `空 body 应返回 400, 实际 ${emptyBodyRes.status}`,
        reproduction: `POST /api/narrative with empty body`,
      });
    }

    // Case 6: GET request should not be handled as narrative (returns 404)
    const getRes = await fetch(`${this.baseUrl}/api/narrative`, {
      method: "GET",
    });
    if (getRes.status !== 404) {
      report({
        severity: "high",
        category: "fallback_detected",
        page: "/api/narrative",
        description: `GET 请求应返回 404, 实际 ${getRes.status}`,
        reproduction: `GET /api/narrative`,
      });
    }

    return findingCount;
  }

  private async postNarrative(body: NarrativeRequest): Promise<Response> {
    try {
      return await fetch(`${this.baseUrl}/api/narrative`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch (error) {
      return new Response(
        JSON.stringify({ error: String(error) }),
        { status: 503 }
      );
    }
  }
}
