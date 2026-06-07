import { ToolExecutor } from "../agent/tool-executor.ts";
import type { AgentContext, TestAgent } from "../agent/types.ts";

interface BehaviorSignature {
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
  searches: Array<{ query: string; timestamp: number }>;
  anomaliesTriggered: string[];
  ruleViolations: Array<{ ruleId: string; detail: string; timestamp: number }>;
  copies: number;
  totalScrollDepth: number;
  pageCount: number;
  returnVisit: boolean;
  version: number;
}

export class AnomalyAgent implements TestAgent {
  name = "AnomalyAgent";

  async run(ctx: AgentContext): Promise<number> {
    const executor = new ToolExecutor(ctx);
    let findingCount = 0;

    // Test 1: Search injection with pre-fabricated signature
    const injectFound = await this.testSearchInjection(ctx, executor);
    if (!injectFound) {
      executor.reportFinding({
        severity: "medium",
        category: "anomaly_missing",
        page: "/",
        description: "搜索框注入异常未触发: 访问次数 >= 3 时 placeholder 应被注入隐藏关键词",
        reproduction: "预制签名 visitCount >= 3 后刷新首页，检查 #search-input placeholder",
      });
      findingCount++;
    }

    // Test 2: Copy event tracking
    const copyFound = await this.testCopyTracking(ctx, executor);
    if (!copyFound) {
      executor.reportFinding({
        severity: "medium",
        category: "anomaly_missing",
        page: "/",
        description: "Copy 事件未记录到行为签名",
        reproduction: "dispatch copy 事件后检查 signature.copies",
      });
      findingCount++;
    }

    // Test 3: Page timeout color shift
    const timeoutFound = await this.testPageTimeout(ctx, executor);
    if (!timeoutFound) {
      executor.reportFinding({
        severity: "medium",
        category: "anomaly_missing",
        page: "/",
        description: "页面超时颜色变化未触发: dwellTime > 600s 时 footer 应变红",
        reproduction: "预制签名 dwellTime = 601 后刷新页面，检查 body --footer-color",
      });
      findingCount++;
    }

    return findingCount;
  }

  private async testSearchInjection(
    ctx: AgentContext,
    _executor: ToolExecutor
  ): Promise<boolean> {
    await ctx.page.goto(ctx.baseUrl);
    await ctx.page.evaluate(() => localStorage.clear());

    // Fabricate a signature with 3 page visits to satisfy injection condition
    const sessionId = `bailu_${Date.now()}_test`;
    const now = Date.now();
    const sig: BehaviorSignature = {
      sessionId,
      startTime: now,
      lastActiveTime: now,
      pagesVisited: [
        {
          url: "/pages/volume-01",
          title: "卷一",
          firstVisit: now,
          lastVisit: now,
          visitCount: 1,
          dwellTime: 0,
          maxScrollDepth: 0,
        },
        {
          url: "/pages/volume-02",
          title: "卷二",
          firstVisit: now,
          lastVisit: now,
          visitCount: 1,
          dwellTime: 0,
          maxScrollDepth: 0,
        },
        {
          url: "/pages/volume-03",
          title: "卷三",
          firstVisit: now,
          lastVisit: now,
          visitCount: 1,
          dwellTime: 0,
          maxScrollDepth: 0,
        },
      ],
      searches: [],
      anomaliesTriggered: [],
      ruleViolations: [],
      copies: 0,
      totalScrollDepth: 0,
      pageCount: 3,
      returnVisit: false,
      version: 1,
    };

    await ctx.page.evaluate((data) => {
      localStorage.setItem(`bailu_sig_${data.sessionId}`, JSON.stringify(data));
      sessionStorage.setItem("bailu_current_sid", data.sessionId);
    }, sig);

    // Reload so initBehavior and initMain pick up the fabricated signature
    await ctx.page.goto(ctx.baseUrl);
    await ctx.page.waitForTimeout(500);

    // Since injection is probabilistic (15%), try multiple times
    for (let i = 0; i < 20; i++) {
      await ctx.page.reload();
      await ctx.page.waitForTimeout(300);
      const placeholder = await ctx.page.evaluate(() => {
        const input = document.getElementById("search-input") as HTMLInputElement | null;
        return input ? input.getAttribute("placeholder") : null;
      });
      const injectedTerms = ["4楼", "第七本", "2:47", "不对劲", "多出来"];
      if (placeholder !== null && injectedTerms.includes(placeholder)) {
        return true;
      }
    }

    return false;
  }

  private async testCopyTracking(
    ctx: AgentContext,
    _executor: ToolExecutor
  ): Promise<boolean> {
    await ctx.page.goto(ctx.baseUrl);
    await ctx.page.evaluate(() => localStorage.clear());

    const sessionId = `bailu_${Date.now()}_copytest`;
    const now = Date.now();
    const sig: BehaviorSignature = {
      sessionId,
      startTime: now,
      lastActiveTime: now,
      pagesVisited: [],
      searches: [],
      anomaliesTriggered: [],
      ruleViolations: [],
      copies: 0,
      totalScrollDepth: 0,
      pageCount: 0,
      returnVisit: false,
      version: 1,
    };

    await ctx.page.evaluate((data) => {
      localStorage.setItem(`bailu_sig_${data.sessionId}`, JSON.stringify(data));
      sessionStorage.setItem("bailu_current_sid", data.sessionId);
    }, sig);

    await ctx.page.goto(ctx.baseUrl);
    await ctx.page.waitForTimeout(300);

    const before = await this.getCopiesCount(ctx);
    await ctx.page.evaluate(() => {
      document.dispatchEvent(new Event("copy", { bubbles: true }));
    });
    await ctx.page.waitForTimeout(200);
    const after = await this.getCopiesCount(ctx);

    return after > before;
  }

  private async testPageTimeout(
    ctx: AgentContext,
    _executor: ToolExecutor
  ): Promise<boolean> {
    await ctx.page.goto(ctx.baseUrl);
    await ctx.page.evaluate(() => localStorage.clear());

    const now = Date.now();
    const sessionId = `bailu_${Date.now()}_timeout`;
    const sig: BehaviorSignature = {
      sessionId,
      startTime: now,
      lastActiveTime: now,
      pagesVisited: [
        {
          url: "/",
          title: "首页",
          firstVisit: now,
          lastVisit: now,
          visitCount: 1,
          dwellTime: 601,
          maxScrollDepth: 0,
        },
      ],
      searches: [],
      anomaliesTriggered: [],
      ruleViolations: [],
      copies: 0,
      totalScrollDepth: 0,
      pageCount: 1,
      returnVisit: false,
      version: 1,
    };

    await ctx.page.evaluate((data) => {
      localStorage.setItem(`bailu_sig_${data.sessionId}`, JSON.stringify(data));
      sessionStorage.setItem("bailu_current_sid", data.sessionId);
    }, sig);

    // Reload so checkPageTimeout runs with dwellTime > 600
    await ctx.page.goto(ctx.baseUrl);
    await ctx.page.waitForTimeout(500);

    const footerColor = await ctx.page.evaluate(() => {
      return getComputedStyle(document.body).getPropertyValue("--footer-color").trim();
    });

    return footerColor === "#8b0000" || footerColor === "rgb(139, 0, 0)";
  }

  private async getCopiesCount(ctx: AgentContext): Promise<number> {
    const raw = await ctx.page.evaluate(() => {
      const keys = Object.keys(localStorage).filter((k) =>
        k.startsWith("bailu_sig_")
      );
      if (keys.length === 0) return null as string | null;
      return localStorage.getItem(keys[0]);
    });
    if (raw === null) return 0;
    try {
      const sig: BehaviorSignature = JSON.parse(raw);
      return typeof sig.copies === "number" ? sig.copies : 0;
    } catch {
      return 0;
    }
  }
}
