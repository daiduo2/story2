import { describe, it, expect } from "vitest";
import { buildPageHtml, parseFrontmatter, renderPage } from "./render.js";

describe("buildPageHtml", () => {
  it("should contain navigation with home and archive links", () => {
    const html = buildPageHtml({ title: "测试" }, "<p>内容</p>");
    expect(html).toContain("<a href=\"/\">首页</a>");
    expect(html).toContain("/pages/archives");
    expect(html).toContain("访客须知");
    expect(html).toContain("关于本项目");
  });

  it("should contain search box with default placeholder", () => {
    const html = buildPageHtml({ title: "测试" }, "<p>内容</p>");
    expect(html).toContain('placeholder="搜索档案..."');
  });

  it("should handle numeric metadata values by coercing to strings", () => {
    const html = buildPageHtml(
      { title: "卷十九", template: "volume", year: 2015 as unknown as string, department: "精神科" },
      "<p>正文</p>"
    );
    expect(html).toContain("2015");
    expect(html).toContain("精神科");
  });
});

describe("parseFrontmatter", () => {
  it("should parse frontmatter and body", () => {
    const content = `---
id: volume-01
title: 卷一 · 入院登记志
---

正文内容`;
    const result = parseFrontmatter(content);
    expect(result.metadata.id).toBe("volume-01");
    expect(result.metadata.title).toBe("卷一 · 入院登记志");
    expect(result.body).toBe("正文内容");
  });

  it("should handle content without frontmatter", () => {
    const content = "纯正文内容";
    const result = parseFrontmatter(content);
    expect(result.metadata).toEqual({});
    expect(result.body).toBe("纯正文内容");
  });
});

describe("renderPage archives snapshot", () => {
  it("should render archives page as homepage snapshot with anomalies", async () => {
    const html = await renderPage("archives");

    // 首页结构
    expect(html).toContain("<title>白鹿疗养院数字档案</title>");
    expect(html).toContain("<h1>白鹿疗养院数字档案</h1>");

    // 导航栏包含完整链接
    expect(html).toContain("<a href=\"/\">首页</a>");
    expect(html).toContain("/pages/archives");

    // 搜索框 placeholder 差异
    expect(html).toContain('placeholder="检索病历..."');
    expect(html).not.toContain('placeholder="搜索档案..."');

    // 动态读取的卷列表（至少包含几个已知卷）
    expect(html).toContain("卷一");
    expect(html).toContain("卷二");
    expect(html).toContain("卷二十四");

    // 卷四标题差异
    expect(html).toContain("精神科观察志（已修订）");

    // 卷廿二被删除
    expect(html).not.toContain("未归档记录志");

    // 卷零待整理
    expect(html).toContain("卷零 · 未命名");
    expect(html).toContain("待整理");

    // 页码矛盾
    expect(html).toContain("01/24");

    // 页脚差异
    expect(html).toContain("2023 年白鹿疗养院信息科");
    expect(html).not.toContain("2024 年市医学会档案分会");
  });

  it("should render regular pages using buildPageHtml", async () => {
    const html = await renderPage("volume-01");
    expect(html).toContain("入院登记志");
    expect(html).toContain('placeholder="搜索档案..."');
  });
});

describe("template routing", () => {
  it("should route volume template to volume layout", () => {
    const html = buildPageHtml(
      { title: "卷四 · 精神科评估志", template: "volume", department: "精神科", year: "2005–2010", page_num: "07/24" },
      "<p>正文</p>"
    );
    expect(html).toContain('data-template="volume"');
    expect(html).toContain("科室：");
    expect(html).toContain("精神科");
    expect(html).toContain("时间范围：");
    expect(html).toContain("2005–2010");
  });

  it("should route supplement template to supplement layout", () => {
    const html = buildPageHtml(
      { title: "林素琴护士长的值班日志", template: "supplement", author: "林素琴", author_meta: "1960–2015 · 护士长", years: "1998–2015" },
      "<p>正文</p>"
    );
    expect(html).toContain('data-template="supplement"');
    expect(html).toContain("林素琴");
    expect(html).toContain("1960–2015 · 护士长");
  });

  it("should route peripheral template to peripheral layout", () => {
    const html = buildPageHtml(
      { title: "市第三人民医院药房发药记录", template: "peripheral", source: "市第三人民医院药房", archive_id: "PH-2015-0315" },
      "<p>正文</p>"
    );
    expect(html).toContain('data-template="peripheral"');
    expect(html).toContain("PH-2015-0315");
    expect(html).toContain("市第三人民医院药房");
  });

  it("should route meta template to meta layout", () => {
    const html = buildPageHtml(
      { title: "访客须知", template: "meta", page_num: "02/24" },
      "<p>正文</p>"
    );
    expect(html).toContain('data-template="meta"');
    expect(html).toContain("02/24");
  });
});
