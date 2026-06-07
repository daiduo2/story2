import { describe, it, expect } from "vitest";
import { buildPageHtml, parseFrontmatter, renderPage } from "./render.js";

describe("buildPageHtml", () => {
  it("should not contain archives link in nav", () => {
    const html = buildPageHtml({ title: "测试" }, "<p>内容</p>");
    expect(html).toContain("<a href=\"/\">首页</a>");
    expect(html).not.toContain("档案检索");
    expect(html).not.toContain("/pages/archives");
  });

  it("should contain search box with default placeholder", () => {
    const html = buildPageHtml({ title: "测试" }, "<p>内容</p>");
    expect(html).toContain('placeholder="搜索档案..."');
  });

  it("should contain default footer", () => {
    const html = buildPageHtml({ title: "测试" }, "<p>内容</p>");
    expect(html).toContain("白鹿疗养院病历数字化项目 | 内部资料");
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

    // 导航栏只保留首页
    expect(html).toContain("<a href=\"/\">首页</a>");
    expect(html).not.toContain("档案检索");

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
