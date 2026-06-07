import { ToolExecutor } from "../agent/tool-executor.ts";
import type { AgentContext, TestAgent } from "../agent/types.ts";

interface DiffCheck {
  name: string;
  selector: string;
  homepageCheck: (el: string | null) => boolean;
  archivesCheck: (el: string | null) => boolean;
}

export class ArchivesAgent implements TestAgent {
  name = "ArchivesAgent";

  async run(ctx: AgentContext): Promise<number> {
    const executor = new ToolExecutor(ctx);
    let findingCount = 0;

    // Diff 1: Search placeholder — must read homepage BEFORE navigating away
    await executor.visitPage("/");
    const homePlaceholder = await ctx.page.evaluate(() => {
      const input = document.getElementById("search-input") as HTMLInputElement | null;
      return input ? input.getAttribute("placeholder") : null;
    });

    await executor.visitPage("/pages/archives");
    const archivesPlaceholder = await ctx.page.evaluate(() => {
      const input = document.getElementById("search-input") as HTMLInputElement | null;
      return input ? input.getAttribute("placeholder") : null;
    });

    if (homePlaceholder === archivesPlaceholder) {
      executor.reportFinding({
        severity: "high",
        category: "content_inconsistency",
        page: "/pages/archives",
        description: `首页与 archives 搜索框 placeholder 应不同，实际均为「${homePlaceholder}」`,
        reproduction: "比较首页和 /pages/archives 的 #search-input placeholder",
      });
      findingCount++;
    }

    // Diff 2: Archives has fixed page-num 01/24
    const hasPageNum = await ctx.page.evaluate(() => {
      return document.querySelector(".page-num") !== null;
    });
    if (!hasPageNum) {
      executor.reportFinding({
        severity: "high",
        category: "content_inconsistency",
        page: "/pages/archives",
        description: "archives 页应包含固定页码 .page-num（01/24）",
        reproduction: "访问 /pages/archives，检查 .page-num 元素",
      });
      findingCount++;
    }

    // Diff 3: Archives has volume-list structure
    const hasVolumeList = await ctx.page.evaluate(() => {
      return document.querySelector(".volume-list") !== null;
    });
    if (!hasVolumeList) {
      executor.reportFinding({
        severity: "high",
        category: "content_inconsistency",
        page: "/pages/archives",
        description: "archives 页应包含 .volume-list 卷宗列表",
        reproduction: "访问 /pages/archives，检查 .volume-list 元素",
      });
      findingCount++;
    }

    // Diff 4: Archives includes volume-00 as pending
    const hasVolume00 = await ctx.page.evaluate(() => {
      const links = Array.from(document.querySelectorAll(".volume-list a"));
      return links.some((a) => a.textContent?.includes("卷零") && a.classList.contains("pending"));
    });
    if (!hasVolume00) {
      executor.reportFinding({
        severity: "high",
        category: "content_inconsistency",
        page: "/pages/archives",
        description: "archives 页应包含「卷零 · 未命名（待整理）」pending 链接",
        reproduction: "访问 /pages/archives，检查 .volume-list 中是否有 pending 类且包含「卷零」的链接",
      });
      findingCount++;
    }

    // Diff 5: Footer text differs
    const archivesFooter = await ctx.page.evaluate(() => {
      const footer = document.querySelector("footer");
      return footer ? footer.textContent : null;
    });
    await executor.visitPage("/");
    const homeFooter = await ctx.page.evaluate(() => {
      const footer = document.querySelector("footer");
      return footer ? footer.textContent : null;
    });

    if (homeFooter === archivesFooter) {
      executor.reportFinding({
        severity: "high",
        category: "content_inconsistency",
        page: "/pages/archives",
        description: "archives 页 footer 文案应与首页不同",
        reproduction: "比较首页和 /pages/archives 的 footer textContent",
      });
      findingCount++;
    }

    // Diff 6: Title modification (精神科评估志 -> 精神科观察志（已修订）)
    await executor.visitPage("/pages/archives");
    const hasModifiedTitle = await ctx.page.evaluate(() => {
      const links = Array.from(document.querySelectorAll(".volume-list a"));
      return links.some((a) => a.textContent?.includes("精神科观察志（已修订）"));
    });
    if (!hasModifiedTitle) {
      executor.reportFinding({
        severity: "medium",
        category: "content_inconsistency",
        page: "/pages/archives",
        description: "archives 页应将「精神科评估志」显示为「精神科观察志（已修订）」",
        reproduction: "访问 /pages/archives，检查 volume-list 中是否有「精神科观察志（已修订）」",
      });
      findingCount++;
    }

    // Diff 7: 未归档记录志 is filtered out
    const hasUnarchived = await ctx.page.evaluate(() => {
      const links = Array.from(document.querySelectorAll(".volume-list a"));
      return links.some((a) => a.textContent?.includes("未归档记录志"));
    });
    if (hasUnarchived) {
      executor.reportFinding({
        severity: "medium",
        category: "content_inconsistency",
        page: "/pages/archives",
        description: "archives 页不应包含「未归档记录志」",
        reproduction: "访问 /pages/archives，检查 volume-list 中是否没有「未归档记录志」",
      });
      findingCount++;
    }

    return findingCount;
  }
}
