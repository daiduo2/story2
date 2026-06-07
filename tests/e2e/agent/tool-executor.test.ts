// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { chromium, Browser, BrowserContext, Page } from "@playwright/test";
import { startServer, stopServer, SERVER_PORT } from "../helpers/server.ts";
import { ToolExecutor } from "./tool-executor.ts";
import type { AgentContext } from "./types.ts";
import type { ChildProcess } from "child_process";

let browser: Browser;
let serverProc: ChildProcess;
const BASE_URL = `http://localhost:${SERVER_PORT}`;

async function createContext(): Promise<{ page: Page; ctx: AgentContext }> {
  const context = await browser.newContext();
  const page = await context.newPage();
  const ctx: AgentContext = {
    page,
    baseUrl: BASE_URL,
    findings: [],
    visitedPages: new Set(),
  };
  return { page, ctx };
}

describe("tool-executor integration", () => {
  beforeAll(async () => {
    serverProc = await startServer();
    browser = await chromium.launch({ headless: true });
  }, 30000);

  afterAll(async () => {
    await browser.close();
    await stopServer(serverProc);
  }, 10000);

  describe("visitPage", () => {
    it("should visit the homepage and collect metadata", async () => {
      const { ctx } = await createContext();
      const executor = new ToolExecutor(ctx);
      const result = await executor.visitPage("/");

      expect(result.status).toBe(200);
      expect(result.title).toContain("白鹿疗养院");
      expect(result.hasSearchBox).toBe(true);
      expect(result.consoleErrors).toEqual([]);
      expect(result.loadTimeMs).toBeGreaterThan(0);

      await ctx.page.context().close();
    });

    it("should return 404 for a non-existent page", async () => {
      const { ctx } = await createContext();
      const executor = new ToolExecutor(ctx);
      const result = await executor.visitPage("/pages/nonexistent.html");

      expect(result.status).toBe(404);

      await ctx.page.context().close();
    });

    it("should discover all volume pages", async () => {
      const { ctx } = await createContext();
      const executor = new ToolExecutor(ctx);
      const result = await executor.visitPage("/");

      const volumeLinks = result.links.filter((l) =>
        l.href.includes("/pages/volume-")
      );
      expect(volumeLinks.length).toBeGreaterThanOrEqual(24);

      await ctx.page.context().close();
    });
  });

  describe("verifyElement", () => {
    it("should detect the search box on homepage", async () => {
      const { ctx } = await createContext();
      const executor = new ToolExecutor(ctx);
      const result = await executor.verifyElement("/", '#search-input', "exists", "true");

      expect(result.passed).toBe(true);

      await ctx.page.context().close();
    });

    it("should detect the correct page title", async () => {
      const { ctx } = await createContext();
      const executor = new ToolExecutor(ctx);
      const result = await executor.verifyElement("/", "title", "contains_text", "白鹿疗养院");

      expect(result.passed).toBe(true);

      await ctx.page.context().close();
    });
  });

  describe("searchKeyword", () => {
    it("should route public keyword to fixed page", async () => {
      const { ctx } = await createContext();
      const executor = new ToolExecutor(ctx);
      const result = await executor.searchKeyword("入院", "/");

      expect(result.resolvedPage).toBe("volume-01");

      await ctx.page.context().close();
    }, 15000);

    it("should return null for hidden keyword without prior visits", async () => {
      const { ctx } = await createContext();
      const executor = new ToolExecutor(ctx);
      const result = await executor.searchKeyword("4楼", "/");

      // Should go to search-results or stay on page, not to a volume
      expect(result.resolvedPage).toBeNull();

      await ctx.page.context().close();
    }, 15000);
  });

  describe("reportFinding", () => {
    it("should accumulate findings in context", async () => {
      const { ctx } = await createContext();
      const executor = new ToolExecutor(ctx);

      executor.reportFinding({
        severity: "high",
        category: "http_error",
        page: "/test",
        description: "Test finding",
        reproduction: "visit /test",
      });

      expect(ctx.findings.length).toBe(1);
      expect(ctx.findings[0].severity).toBe("high");

      await ctx.page.context().close();
    });
  });
});
