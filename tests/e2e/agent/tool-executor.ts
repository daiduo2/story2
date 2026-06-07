import type { Page } from "@playwright/test";
import type {
  PageVisitResult,
  SearchResult,
  VerifyResult,
  LinkInfo,
  Finding,
  AgentContext,
} from "./types.ts";

export class ToolExecutor {
  private ctx: AgentContext;

  constructor(ctx: AgentContext) {
    this.ctx = ctx;
  }

  async visitPage(url: string, waitForAgent = true): Promise<PageVisitResult> {
    const fullUrl = url.startsWith("http") ? url : `${this.ctx.baseUrl}${url}`;
    const start = performance.now();

    const consoleErrors: string[] = [];
    const handler = (msg: { type: () => string; text: () => string }) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    };
    this.ctx.page.on("console", handler);

    try {
      const response = await this.ctx.page.goto(fullUrl, {
        waitUntil: "networkidle",
      });

      const status = response === null || response === undefined ? 0 : response.status();
      const title = await this.ctx.page.title();
      const hasSearchBox = await this.ctx.page.locator('input[type="search"], #search-input').count() > 0;
      const hasSystemMessage = await this.ctx.page.locator(".system-message").count() > 0;
      const linkElements = await this.ctx.page.locator("a[href]").all();
      const links = await Promise.all(
        linkElements.map(async (el) => {
          const hrefAttr = await el.getAttribute("href");
          const textContent = await el.textContent();
          return {
            href: hrefAttr === null ? "" : hrefAttr,
            text: textContent === null ? "" : textContent,
          };
        })
      );

      const pageIdMatch = url.match(/\/pages\/([a-z0-9-]+)\.html/);
      const pageId = pageIdMatch ? pageIdMatch[1] : null;

      this.ctx.visitedPages.add(url);

      return {
        url: fullUrl,
        status,
        title,
        pageId,
        hasSearchBox,
        hasSystemMessage,
        consoleErrors,
        links: links.filter((l) => l.href),
        loadTimeMs: Math.round(performance.now() - start),
      };
    } finally {
      // Small delay to let console events flush
      await this.ctx.page.waitForTimeout(100);
      this.ctx.page.off("console", handler);
    }
  }

  async searchKeyword(keyword: string, pageUrl: string): Promise<SearchResult> {
    await this.visitPage(pageUrl);

    const searchInput = this.ctx.page.locator('#search-input').first();
    const submitButton = this.ctx.page.locator('#search-form button[type="submit"]').first();

    await searchInput.fill(keyword);

    // Click the submit button to trigger the form's JS event listener
    // (form.submit() bypasses event listeners and would not execute the search)
    await submitButton.click();

    // Wait for feedback element to appear (immediate for both found/not-found)
    await this.ctx.page.waitForSelector('#search-feedback', { timeout: 5000 });

    // Allow time for the 300ms delayed navigation to occur when a match is found
    await this.ctx.page.waitForTimeout(800);

    const finalUrl = this.ctx.page.url();
    const resolvedPageMatch = finalUrl.match(/\/pages\/([a-z0-9-]+)/);
    const resolvedPage = resolvedPageMatch ? resolvedPageMatch[1] : null;

    // Check if rule_3 was triggered via localStorage
    const signatureRaw = await this.ctx.page.evaluate(() =>
      localStorage.getItem("bailu_behavior_signature")
    );
    const ruleViolation = this.extractRuleViolation(signatureRaw, "rule_3");

    return {
      keyword,
      resolvedPage,
      finalUrl,
      ruleViolation,
    };
  }

  async verifyElement(
    pageUrl: string,
    selector: string,
    assertion: string,
    expected: string
  ): Promise<VerifyResult> {
    await this.visitPage(pageUrl);
    const el = this.ctx.page.locator(selector).first();

    let actual = "";
    let passed = false;

    switch (assertion) {
      case "exists":
        passed = (await el.count()) > 0;
        actual = passed ? "exists" : "not found";
        break;
      case "not_exists":
        passed = (await el.count()) === 0;
        actual = passed ? "not found" : "exists";
        break;
      case "contains_text": {
        const text = await el.textContent();
        actual = text === null ? "" : text;
        passed = actual.includes(expected);
        break;
      }
      case "has_attribute": {
        const attrValue = await el.getAttribute(expected.split("=")[0]);
        actual = attrValue === null ? "" : attrValue;
        passed = actual === expected.split("=")[1];
        break;
      }
      case "matches_regex": {
        const text = await el.textContent();
        actual = text === null ? "" : text;
        passed = new RegExp(expected).test(actual);
        break;
      }
      default:
        throw new Error(`Unknown assertion: ${assertion}`);
    }

    return { passed, actual, expected };
  }

  async extractLinks(pageUrl: string, scope: string): Promise<LinkInfo[]> {
    await this.visitPage(pageUrl);
    const links = await this.ctx.page.locator("a[href]").all();

    const results: LinkInfo[] = [];
    for (const link of links) {
      const hrefAttr = await link.getAttribute("href");
      const textContent = await link.textContent();
      const href = hrefAttr === null ? "" : hrefAttr;
      const text = textContent === null ? "" : textContent;

      const isInternal = href.startsWith("/") || href.startsWith("http://localhost");
      if (scope === "internal" && !isInternal) continue;
      if (scope === "external" && isInternal) continue;

      let status: number | null = null;
      let isBroken = false;

      if (isInternal) {
        const targetUrl = href.startsWith("/") ? `${this.ctx.baseUrl}${href}` : href;
        try {
          const res = await fetch(targetUrl, { method: "HEAD", signal: AbortSignal.timeout(3000) });
          status = res.status;
          isBroken = res.status >= 400;
        } catch {
          isBroken = true;
        }
      }

      results.push({ href, text, status, isBroken });
    }

    return results;
  }

  async screenshot(pageUrl: string, name: string): Promise<string> {
    await this.visitPage(pageUrl);
    const fileName = `${Date.now()}-${name}.png`;
    const filePath = `tests/e2e/reports/screenshots/${fileName}`;
    await this.ctx.page.screenshot({ path: filePath, fullPage: true });
    return filePath;
  }

  reportFinding(finding: Finding): void {
    this.ctx.findings.push(finding);
  }

  finishAudit(): TestReport {
    const findings = this.ctx.findings;
    return {
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
      summary: {
        critical: findings.filter((f) => f.severity === "critical").length,
        high: findings.filter((f) => f.severity === "high").length,
        medium: findings.filter((f) => f.severity === "medium").length,
        low: findings.filter((f) => f.severity === "low").length,
      },
      agents: [],
      findings,
    };
  }

  private extractRuleViolation(
    signatureRaw: string | null,
    ruleId: string
  ): string | null {
    if (signatureRaw === null) return null as string | null;
    try {
      const sig = JSON.parse(signatureRaw);
      const violations = Array.isArray(sig.ruleViolations) ? sig.ruleViolations : [];
      const found = violations.find((v: { ruleId: string }) => v.ruleId === ruleId);
      if (found) return ruleId;
      return null as string | null;
    } catch {
      return null as string | null;
    }
  }
}
