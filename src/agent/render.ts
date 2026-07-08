import fs from "fs/promises";
import path from "path";
import { marked } from "marked";
import yaml from "js-yaml";

export async function findContentFile(pageId: string): Promise<string> {
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

export function parseFrontmatter(content: string): { metadata: Record<string, string>; body: string } {
  const match = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (match) {
    const metadata = yaml.load(match[1]) as Record<string, string>;
    return { metadata, body: match[2].trim() };
  }
  return { metadata: {}, body: content.trim() };
}

function escapeHtml(text: unknown): string {
  const value = text === null || text === undefined ? "" : String(text);
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

interface WrapperOptions {
  title: string;
  pageNum?: string;
  template?: string;
  bodyHtml: string;
  footerText?: string;
  archiveId?: string;
  layoutClass?: string;
  sidebarLeft?: string;
  sidebarRight?: string;
}

function buildBaseWrapper(options: WrapperOptions): string {
  const title = escapeHtml(options.title || "白鹿疗养院数字档案");
  const pageNum = options.pageNum ? `<span class="page-num">${escapeHtml(options.pageNum)}</span>` : "";
  const templateAttr = options.template ? ` data-template="${escapeHtml(options.template)}"` : "";
  const footerText = options.footerText || "白鹿疗养院病历数字化项目 | 内部资料 | 未经批准不得复制";
  const archiveId = escapeHtml(options.archiveId || "BA-ARCH-1998-2015");
  const layoutClass = options.layoutClass ? ` ${options.layoutClass}` : "";
  const sidebarLeft = options.sidebarLeft || "";
  const sidebarRight = options.sidebarRight || "";

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <link rel="stylesheet" href="/css/style.css">
</head>
<body${templateAttr}>
  <div class="system-bar">
    <div class="container">
      <span>系统时间：2004-03-17 14:32:07</span>
      <span>当前用户：guest_researcher</span>
      <span>档案编号：${archiveId}</span>
      <span class="system-status">状态：正常运行</span>
    </div>
  </div>
  <header class="site-header">
    <div class="container">
      <div class="header-left">
        <h1 class="site-title"><a href="/">白鹿疗养院病历数字化项目</a></h1>
        <span class="site-subtitle">市医学会档案分会 · 内部资料 · 仅供医学研究</span>
      </div>
      <div class="header-right">
        <div class="stamp">内部资料</div>
      </div>
    </div>
  </header>
  <nav class="site-nav">
    <div class="container">
      <ul>
        <li><a href="/">首页</a></li>
        <li><a href="/pages/archives">档案目录</a></li>
        <li><a href="/pages/notice">访客须知</a></li>
        <li><a href="/pages/about">关于本项目</a></li>
      </ul>
    </div>
  </nav>
  <div class="container">
    <div class="page-layout${layoutClass}">
      ${sidebarLeft}
      <main>${options.bodyHtml}</main>
      ${sidebarRight}
    </div>
  </div>
  <footer class="site-footer">
    <div class="container">
      <p>${escapeHtml(footerText)}</p>
      <p class="footer-page-num">本页编号：${archiveId}</p>
    </div>
  </footer>
  <div class="paper-grain"></div>
  <script type="module" src="/js/frontend.js"></script>
</body>
</html>`;
}

function buildSearchPanel(placeholder = "搜索档案..."): string {
  return `<div class="search-panel">
  <label for="search-input">全文检索：</label>
  <form id="search-form">
    <input type="text" id="search-input" placeholder="${escapeHtml(placeholder)}" autocomplete="off" />
    <button type="submit">检索</button>
    <button type="button" class="btn-secondary">高级检索</button>
  </form>
</div>`;
}

function extractToc(contentHtml: string): string {
  const headings: Array<{ level: number; text: string; id: string }> = [];
  const headingRegex = /<h([23])[^>]*>(.*?)<\/h\1>/gi;
  let match;
  while ((match = headingRegex.exec(contentHtml)) !== null) {
    const level = parseInt(match[1], 10);
    const rawText = match[2].replace(/<[^>]+>/g, "");
    const id = `toc-${headings.length + 1}`;
    headings.push({ level, text: rawText, id });
  }

  if (headings.length === 0) {
    return "";
  }

  const items = headings
    .map((h) => `        <li class="toc-level-${h.level}"><a href="#${h.id}">${escapeHtml(h.text)}</a></li>`)
    .join("\n");

  return `<nav class="toc" aria-label="页面目录">
      <h3>本页目录</h3>
      <ul>
${items}
      </ul>
    </nav>`;
}

function injectHeadingIds(contentHtml: string): string {
  let index = 0;
  return contentHtml.replace(/<h([23])([^>]*)>/gi, (match, level, attrs) => {
    index += 1;
    const id = `toc-${index}`;
    if (attrs.includes("id=")) {
      return match;
    }
    return `<h${level}${attrs} id="${id}">`;
  });
}

function buildVolumeSidebar(metadata: Record<string, string>, contentHtml: string): string {
  const volumeNo = metadata.volume_no ? parseInt(metadata.volume_no, 10) : 0;
  const toc = extractToc(contentHtml);

  const prevLink = volumeNo > 1
    ? `<li><a href="/pages/volume-${String(volumeNo - 1).padStart(2, "0")}">上一卷</a></li>`
    : "";
  const nextLink = volumeNo > 0 && volumeNo < 24
    ? `<li><a href="/pages/volume-${String(volumeNo + 1).padStart(2, "0")}">下一卷</a></li>`
    : "";

  const relatedVolumes: string[] = [];
  if (metadata.title?.includes("特殊病例")) {
    relatedVolumes.push(`<li><a href="/pages/supplement-lin">林素琴护士长的值班日志</a></li>`);
  }
  if (metadata.title?.includes("事故调查")) {
    relatedVolumes.push(`<li><a href="/pages/security-cctv">安保公司监控备份记录</a></li>`);
  }
  if (metadata.title?.includes("精神科")) {
    relatedVolumes.push(`<li><a href="/pages/volume-04">卷四：精神科评估志</a></li>`);
  }

  const navItems = [prevLink, nextLink].filter(Boolean).join("\n        ");
  const relatedItems = relatedVolumes.join("\n        ");

  const tocPanel = toc
    ? `<div class="meta-panel">
      ${toc}
    </div>`
    : "";

  const navPanel = navItems
    ? `<div class="meta-panel">
      <h3>卷宗导航</h3>
      <ul>
        ${navItems}
      </ul>
    </div>`
    : "";

  const relatedPanel = relatedItems
    ? `<div class="meta-panel">
      <h3>相关档案</h3>
      <ul>
        ${relatedItems}
      </ul>
    </div>`
    : "";

  const panels = [tocPanel, navPanel, relatedPanel].filter(Boolean).join("\n    ");
  return panels ? `<aside class="sidebar sidebar--sticky">\n    ${panels}\n  </aside>` : "";
}

function buildSupplementSidebar(metadata: Record<string, string>, contentHtml: string): string {
  const author = metadata.author || "";
  const authorMeta = metadata.author_meta || "";
  const years = metadata.years || "";
  const toc = extractToc(contentHtml);

  const authorPanel = author
    ? `<div class="meta-panel">
      <h3>作者信息</h3>
      <p><strong>${escapeHtml(author)}</strong></p>
      ${authorMeta ? `<p>${escapeHtml(authorMeta)}</p>` : ""}
      ${years ? `<p class="mono">${escapeHtml(years)}</p>` : ""}
    </div>`
    : "";

  const tocPanel = toc
    ? `<div class="meta-panel">
      ${toc}
    </div>`
    : "";

  const panels = [authorPanel, tocPanel].filter(Boolean).join("\n    ");
  return panels ? `<aside class="sidebar sidebar--sticky">\n    ${panels}\n  </aside>` : "";
}

function buildPeripheralSidebar(metadata: Record<string, string>): string {
  const source = metadata.source || "";
  const archiveId = metadata.archive_id || "";

  const sourcePanel = source || archiveId
    ? `<div class="meta-panel">
      <h3>来源信息</h3>
      ${archiveId ? `<p class="mono">${escapeHtml(archiveId)}</p>` : ""}
      ${source ? `<p>${escapeHtml(source)}</p>` : ""}
    </div>`
    : "";

  const relatedPanel = `<div class="meta-panel">
      <h3>关联档案</h3>
      <ul>
        <li><a href="/pages/supplement-lin">林素琴护士长的值班日志</a></li>
        <li><a href="/pages/volume-20">卷二十：事故调查志·上</a></li>
        <li><a href="/pages/volume-23">卷二十三：异闻录·上</a></li>
      </ul>
    </div>`;

  const panels = [sourcePanel, relatedPanel].filter(Boolean).join("\n    ");
  return panels ? `<aside class="sidebar sidebar--sticky">\n    ${panels}\n  </aside>` : "";
}

function buildMetaHtml(metadata: Record<string, string>, contentHtml: string): string {
  const title = metadata.title || "档案说明";
  const pageNum = metadata.page_num || "";
  const pageNumHtml = pageNum ? `\n          <span class="page-num">${escapeHtml(pageNum)}</span>` : "";
  const body = `<div class="doc-header">
  <h1>${escapeHtml(title)}</h1>
  <div class="doc-meta">
    <span>病历数字化项目 · 内部检索系统</span>${pageNumHtml}
  </div>
</div>
${buildSearchPanel()}
<div class="content-column">
${contentHtml}
</div>`;
  return buildBaseWrapper({
    title,
    pageNum,
    template: "meta",
    bodyHtml: body,
  });
}

function buildVolumeHtml(metadata: Record<string, string>, contentHtml: string): string {
  const title = metadata.title || "病历卷宗";
  const subtitle = metadata.subtitle || "";
  const year = metadata.year || "";
  const department = metadata.department || "";
  const pageNum = metadata.page_num || "";
  const volumeNo = metadata.volume_no || "";
  const archiveId = volumeNo ? `BA-ARCH-VOL-${String(volumeNo).padStart(2, "0")}` : "BA-ARCH-VOL";

  const metaItems: string[] = [];
  if (volumeNo) metaItems.push(`<div><span class="label">卷号：</span>VOL-${escapeHtml(String(volumeNo).padStart(2, "0"))}</div>`);
  if (year) metaItems.push(`<div><span class="label">时间范围：</span>${escapeHtml(year)}</div>`);
  if (department) metaItems.push(`<div><span class="label">科室：</span>${escapeHtml(department)}</div>`);
  if (subtitle) metaItems.push(`<div><span class="label">副标题：</span>${escapeHtml(subtitle)}</div>`);
  if (pageNum) metaItems.push(`<div><span class="label">页码：</span>${escapeHtml(pageNum)}</div>`);

  const metaBar = metaItems.length > 0
    ? `<div class="volume-meta-bar">${metaItems.join("")}</div>`
    : "";

  const contentWithIds = injectHeadingIds(contentHtml);
  const sidebarRight = buildVolumeSidebar(metadata, contentWithIds);

  const pageNumHtml = pageNum ? `\n          <span class="page-num">${escapeHtml(pageNum)}</span>` : "";
  const body = `<div class="doc-header">
  <h1>${escapeHtml(title)}</h1>
  <div class="doc-meta">
    <span>正编病历 · ${department ? escapeHtml(department) : "内部检索系统"}</span>${pageNumHtml}
  </div>
</div>
${buildSearchPanel()}
${metaBar}
<div class="volume-content content-column">
${contentWithIds}
</div>`;

  return buildBaseWrapper({
    title,
    pageNum,
    template: "volume",
    bodyHtml: body,
    archiveId,
    layoutClass: sidebarRight ? "page-layout--with-right-sidebar" : undefined,
    sidebarRight,
  });
}

function buildSupplementHtml(metadata: Record<string, string>, contentHtml: string): string {
  const title = metadata.title || "补遗档案";
  const author = metadata.author || "";
  const authorMeta = metadata.author_meta || "";
  const years = metadata.years || "";
  const pageNum = metadata.page_num || "";
  const id = metadata.id || "";
  const archiveId = id ? `BA-ARCH-SUP-${id.replace(/^supplement-/, "").toUpperCase()}` : "BA-ARCH-SUP";

  const authorBlock = author
    ? `<div class="supplement-author">
  <div class="name">${escapeHtml(author)}</div>
  <div class="meta">${escapeHtml([authorMeta, years].filter(Boolean).join(" · "))}</div>
</div>`
    : "";

  const contentWithIds = injectHeadingIds(contentHtml);
  const sidebarLeft = buildSupplementSidebar(metadata, contentWithIds);

  const pageNumHtml = pageNum ? `\n          <span class="page-num">${escapeHtml(pageNum)}</span>` : "";
  const body = `<div class="doc-header">
  <h1>${escapeHtml(title)}</h1>
  <div class="doc-meta">
    <span>补遗档案 · 护理部</span>${pageNumHtml}
  </div>
</div>
${buildSearchPanel()}
${authorBlock}
<div class="supplement-content content-column">
${contentWithIds}
</div>`;

  return buildBaseWrapper({
    title,
    pageNum,
    template: "supplement",
    bodyHtml: body,
    archiveId,
    layoutClass: sidebarLeft ? "page-layout--with-sidebar" : undefined,
    sidebarLeft,
  });
}

function buildPeripheralHtml(metadata: Record<string, string>, contentHtml: string): string {
  const title = metadata.title || "外围档案";
  const source = metadata.source || "";
  const archiveId = metadata.archive_id || "";
  const pageNum = metadata.page_num || "";
  const displayArchiveId = archiveId || "BA-ARCH-PER";

  const sourceBlock = source || archiveId
    ? `<div class="peripheral-source">
  ${archiveId ? `<div class="archive-id">${escapeHtml(archiveId)}</div>` : ""}
  ${source ? `<div><span class="label">来源机构：</span>${escapeHtml(source)}</div>` : ""}
</div>`
    : "";

  const sidebarRight = buildPeripheralSidebar(metadata);

  const pageNumHtml = pageNum ? `\n          <span class="page-num">${escapeHtml(pageNum)}</span>` : "";
  const body = `<div class="doc-header">
  <h1>${escapeHtml(title)}</h1>
  <div class="doc-meta">
    <span>外围档案 · ${source ? escapeHtml(source) : "外部机构"}</span>${pageNumHtml}
  </div>
</div>
${buildSearchPanel()}
${sourceBlock}
<div class="peripheral-content content-column">
${contentHtml}
</div>`;

  return buildBaseWrapper({
    title,
    pageNum,
    template: "peripheral",
    bodyHtml: body,
    archiveId: displayArchiveId,
    layoutClass: sidebarRight ? "page-layout--with-right-sidebar" : undefined,
    sidebarRight,
  });
}

function buildVariantHtml(metadata: Record<string, string>, contentHtml: string): string {
  const baseTemplate = metadata.template || "volume";
  const variantType = metadata.variant_type || "";
  const variantOf = metadata.variant_of || "";

  // Route to the base template builder, then annotate the body.
  let baseHtml: string;
  switch (baseTemplate) {
    case "supplement":
      baseHtml = buildSupplementHtml(metadata, contentHtml);
      break;
    case "peripheral":
      baseHtml = buildPeripheralHtml(metadata, contentHtml);
      break;
    case "meta":
      baseHtml = buildMetaHtml(metadata, contentHtml);
      break;
    case "volume":
    default:
      baseHtml = buildVolumeHtml(metadata, contentHtml);
      break;
  }

  if (variantType) {
    baseHtml = baseHtml.replace(
      "<main>",
      `<main data-variant="${escapeHtml(variantType)}" data-variant-of="${escapeHtml(variantOf)}">`
    );
    baseHtml = baseHtml.replace("<body", `<body data-theme="dark"`);
    baseHtml = baseHtml.replace("</body>", `  <div class="scanlines"></div>\n</body>`);
  }
  return baseHtml;
}

export function buildPageHtml(metadata: Record<string, string>, contentHtml: string): string {
  if (metadata.category === "variant") {
    return buildVariantHtml(metadata, contentHtml);
  }
  const template = metadata.template || "volume";
  switch (template) {
    case "meta":
      return buildMetaHtml(metadata, contentHtml);
    case "supplement":
      return buildSupplementHtml(metadata, contentHtml);
    case "peripheral":
      return buildPeripheralHtml(metadata, contentHtml);
    case "variant":
      return buildVariantHtml(metadata, contentHtml);
    case "volume":
    default:
      return buildVolumeHtml(metadata, contentHtml);
  }
}

async function readVolumeList(): Promise<Array<{ num: string; title: string }>> {
  const volumesDir = path.join("content", "volumes");
  const files = await fs.readdir(volumesDir);
  const mdFiles = files
    .filter((f) => f.endsWith(".md"))
    .sort((a, b) => {
      const numA = parseInt(a.match(/volume-(\d+)/)?.[1] ?? "0", 10);
      const numB = parseInt(b.match(/volume-(\d+)/)?.[1] ?? "0", 10);
      return numA - numB;
    });

  const volumes: Array<{ num: string; title: string }> = [];
  for (const file of mdFiles) {
    const raw = await fs.readFile(path.join(volumesDir, file), "utf-8");
    const { metadata } = parseFrontmatter(raw);
    const match = metadata.title?.match(/卷([一二三四五六七八九十廿百零\d]+)\s*·\s*(.+)/);
    if (match) {
      volumes.push({ num: match[1], title: match[2] });
    }
  }
  return volumes;
}

function numToChinese(n: number): string {
  const map: Record<string, string> = {
    "0": "零", "1": "一", "2": "二", "3": "三", "4": "四",
    "5": "五", "6": "六", "7": "七", "8": "八", "9": "九",
    "10": "十", "20": "廿", "30": "卅",
  };
  if (n <= 10) return map[String(n)];
  if (n < 20) return "十" + map[String(n - 10)];
  if (n % 10 === 0) return map[String(Math.floor(n / 10))] + "十";
  return map[String(Math.floor(n / 10))] + "十" + map[String(n % 10)];
}

export async function renderArchivesPage(): Promise<string> {
  const volumes = await readVolumeList();

  const visibleVolumes = volumes.filter((v) => v.title !== "未归档记录志");
  const volumeRows = visibleVolumes
    .map((v) => {
      const originalIndex = volumes.indexOf(v) + 1;
      const num = numToChinese(originalIndex);
      const volNum = String(originalIndex).padStart(2, "0");
      let title = v.title;
      if (title === "精神科评估志") {
        title = "精神科观察志（已修订）";
      }
      return `            <tr>
              <td class="mono">VOL-${volNum}</td>
              <td><a href="/pages/volume-${volNum}">卷${num}：${title}</a></td>
              <td class="mono">—</td>
              <td>—</td>
              <td>已数字化</td>
            </tr>`;
    })
    .join("\n");

  const body = `<div class="doc-header">
  <h1>白鹿疗养院数字档案</h1>
  <div class="doc-meta">
    <span>病历数字化项目 · 内部检索系统</span>
    <span class="page-num">01/24</span>
  </div>
</div>
${buildSearchPanel("检索病历...")}
<section class="home-section">
  <h2>档案卷宗</h2>
  <table class="archive-table">
    <thead>
      <tr>
        <th>卷号</th>
        <th>题名</th>
        <th>年代</th>
        <th>科室</th>
        <th>状态</th>
      </tr>
    </thead>
    <tbody>
${volumeRows}
      <tr>
        <td class="mono">VOL-00</td>
        <td><a href="/pages/volume-00" class="pending">卷零 · 未命名（待整理）</a></td>
        <td class="mono">—</td>
        <td>—</td>
        <td>待整理</td>
      </tr>
    </tbody>
  </table>
</section>`;

  return buildBaseWrapper({
    title: "白鹿疗养院数字档案",
    pageNum: "01/24",
    template: "meta",
    bodyHtml: body,
    footerText: "2023 年白鹿疗养院信息科 | 内部资料",
  });
}

export async function renderPage(pageId: string): Promise<string> {
  if (pageId === "archives") {
    return renderArchivesPage();
  }
  const filePath = await findContentFile(pageId);
  const raw = await fs.readFile(filePath, "utf-8");
  const { metadata, body } = parseFrontmatter(raw);
  const contentHtml = await marked.parse(body);
  return buildPageHtml(metadata, contentHtml);
}
