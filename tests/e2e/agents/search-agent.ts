import { ToolExecutor } from "../agent/tool-executor.ts";
import type { AgentContext, TestAgent } from "../agent/types.ts";
import {
  PUBLIC_KEYWORDS,
  HIDDEN_KEYWORDS,
  getExpectedRoute,
} from "../fixtures/keywords.ts";
import { getPageInventory } from "../fixtures/page-inventory.ts";

export class SearchAgent implements TestAgent {
  name = "SearchAgent";

  async run(ctx: AgentContext): Promise<number> {
    const executor = new ToolExecutor(ctx);
    let findingCount = 0;

    // Clear localStorage to ensure clean state from other agents
    await ctx.page.goto(ctx.baseUrl);
    await ctx.page.evaluate(() => localStorage.clear());

    // Test all public keywords
    for (const [keyword, entry] of Object.entries(PUBLIC_KEYWORDS)) {
      const result = await executor.searchKeyword(keyword, "/");

      if (result.resolvedPage !== entry.page) {
        executor.reportFinding({
          severity: "high",
          category: "search_misroute",
          page: "/",
          description: `公开关键词「${keyword}」路由错误: 期望 ${entry.page}, 实际 ${result.resolvedPage}`,
          reproduction: `在首页搜索「${keyword}」`,
        });
        findingCount++;
      }
    }

    // Test hidden keywords without prior visits → should not resolve
    // Clear localStorage again to remove any public keyword search history
    await ctx.page.evaluate(() => localStorage.clear());

    for (const [keyword, entry] of Object.entries(HIDDEN_KEYWORDS)) {
      const result = await executor.searchKeyword(keyword, "/");
      const expected = getExpectedRoute(keyword, []);

      if (result.resolvedPage !== expected) {
        executor.reportFinding({
          severity: "high",
          category: "search_misroute",
          page: "/",
          description: `隐藏关键词「${keyword}」未访问时应返回 null, 实际 ${result.resolvedPage}`,
          reproduction: `在首页搜索「${keyword}」（无前置访问）`,
        });
        findingCount++;
      }
    }

    // Test hidden keywords with prior visits → should resolve to first candidate
    const existingPageIds = new Set(getPageInventory().map((p) => p.id));

    for (const [keyword, entry] of Object.entries(HIDDEN_KEYWORDS)) {
      const candidateId = entry.candidates[0];

      // Skip if candidate page does not exist in content/
      if (!existingPageIds.has(candidateId)) {
        executor.reportFinding({
          severity: "medium",
          category: "content_inconsistency",
          page: "/",
          description: `隐藏关键词「${keyword}」的候选页「${candidateId}」在 content/ 中不存在`,
          reproduction: `检查 content/ 是否包含 ${candidateId}.md`,
        });
        findingCount++;
        continue;
      }

      // Clear localStorage and visit the candidate page to unlock the keyword
      await ctx.page.evaluate(() => localStorage.clear());
      const candidateUrl = `/pages/${candidateId}`;
      const visitResult = await executor.visitPage(candidateUrl);

      if (visitResult.status >= 400) {
        executor.reportFinding({
          severity: "high",
          category: "http_error",
          page: candidateUrl,
          description: `候选页返回 HTTP ${visitResult.status}，无法测试隐藏关键词「${keyword}」`,
          reproduction: `访问 ${candidateUrl}`,
        });
        findingCount++;
        continue;
      }

      const result = await executor.searchKeyword(keyword, "/");
      const expected = getExpectedRoute(keyword, [candidateId]);

      if (result.resolvedPage !== expected) {
        executor.reportFinding({
          severity: "high",
          category: "search_misroute",
          page: "/",
          description: `隐藏关键词「${keyword}」访问候选后路由错误: 期望 ${expected}, 实际 ${result.resolvedPage}`,
          reproduction: `先访问 ${candidateUrl}, 再在首页搜索「${keyword}」`,
        });
        findingCount++;
      }
    }

    return findingCount;
  }
}
