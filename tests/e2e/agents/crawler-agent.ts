import { ToolExecutor } from "../agent/tool-executor.ts";
import type { AgentContext, TestAgent } from "../agent/types.ts";
import { getPageInventory } from "../fixtures/page-inventory.ts";

export class CrawlerAgent implements TestAgent {
  name = "CrawlerAgent";

  async run(ctx: AgentContext): Promise<number> {
    const executor = new ToolExecutor(ctx);
    const pages = getPageInventory();
    let findingCount = 0;

    for (const page of pages) {
      const result = await executor.visitPage(page.url);

      if (result.status >= 400) {
        executor.reportFinding({
          severity: "critical",
          category: "http_error",
          page: page.url,
          description: `页面返回 HTTP ${result.status}`,
          reproduction: `直接访问 ${page.url}`,
        });
        findingCount++;
      }

      if (result.consoleErrors.length > 0) {
        for (const error of result.consoleErrors) {
          executor.reportFinding({
            severity: "high",
            category: "console_error",
            page: page.url,
            description: `Console error: ${error.slice(0, 120)}`,
            reproduction: `访问 ${page.url} 并观察浏览器控制台`,
          });
          findingCount++;
        }
      }

      if (result.loadTimeMs > 10000) {
        executor.reportFinding({
          severity: "medium",
          category: "performance",
          page: page.url,
          description: `页面加载过慢: ${result.loadTimeMs}ms`,
          reproduction: `访问 ${page.url}`,
        });
        findingCount++;
      }
    }

    // Also verify homepage and meta pages explicitly
    const extraUrls = ["/", "/pages/notice", "/pages/about", "/pages/archives"];
    for (const url of extraUrls) {
      if (ctx.visitedPages.has(url)) continue;

      const result = await executor.visitPage(url);
      if (result.status >= 400) {
        executor.reportFinding({
          severity: "critical",
          category: "http_error",
          page: url,
          description: `页面返回 HTTP ${result.status}`,
          reproduction: `直接访问 ${url}`,
        });
        findingCount++;
      }
    }

    return findingCount;
  }
}
