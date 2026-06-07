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

export function buildPageHtml(metadata: Record<string, string>, contentHtml: string): string {
  const title = metadata.title || "白鹿疗养院数字档案";
  const pageNum = metadata.page_num || "";
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body { font-family: 'Noto Serif SC', 'SimSun', serif; max-width: 800px; margin: 0 auto; padding: 40px 20px; background: #f5f5f0; color: #333; line-height: 1.8; }
    h1 { color: #2c5f2d; border-bottom: 2px solid #2c5f2d; padding-bottom: 10px; font-size: 1.8em; }
    h2 { color: #3a7a3c; margin-top: 2em; font-size: 1.4em; }
    h3 { color: #4a4a4a; margin-top: 1.5em; }
    a { color: #2c5f2d; text-decoration: none; }
    a:hover { color: #1e401f; }
    nav { margin-bottom: 30px; padding-bottom: 15px; border-bottom: 1px solid #ddd; }
    nav a { margin-right: 15px; }
    .search-box { margin: 20px 0; position: relative; }
    #search-form { display: flex; gap: 10px; }
    #search-input { flex: 1; padding: 10px; font-size: 15px; border: 1px solid #ccc; border-radius: 4px; font-family: inherit; }
    button { padding: 10px 20px; background: #2c5f2d; color: white; border: none; border-radius: 4px; cursor: pointer; font-family: inherit; }
    button:hover { background: #1e401f; }
    .search-feedback { margin-top: 10px; padding: 10px 14px; border-radius: 4px; font-size: 14px; animation: fadeIn 0.2s ease; }
    .search-found { background: #e8f5e9; color: #2c5f2d; border: 1px solid #a5d6a7; }
    .search-not-found { background: #ffebee; color: #8b0000; border: 1px solid #ef9a9a; }
    #search-history { margin-top: 10px; display: flex; flex-wrap: wrap; gap: 8px; }
    .search-history-item { display: inline-block; padding: 4px 12px; background: #e8e8e0; border-radius: 12px; font-size: 13px; color: #555; cursor: pointer; }
    .search-history-item:hover { background: #d0d0c8; }
    .meta { color: #666; font-size: 0.9em; margin-bottom: 20px; }
    .page-num { float: right; color: #999; font-size: 0.85em; }
    blockquote { border-left: 3px solid #2c5f2d; margin: 1em 0; padding-left: 1em; color: #555; }
    ul, ol { padding-left: 1.5em; }
    hr { border: none; border-top: 1px solid #ddd; margin: 2em 0; }
    footer { margin-top: 60px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666; }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
  </style>
</head>
<body>
  <nav>
    <a href="/">首页</a>
  </nav>
  <div class="search-box">
    <form id="search-form">
      <input type="text" id="search-input" placeholder="搜索档案..." autocomplete="off" />
      <button type="submit">搜索</button>
    </form>
    <div id="search-history"></div>
  </div>
  ${pageNum ? `<div class="page-num">${pageNum}</div>` : ""}
  <main>${contentHtml}</main>
  <footer>
    <p>白鹿疗养院病历数字化项目 | 内部资料</p>
  </footer>
  <script type="module" src="/js/frontend.js"></script>
</body>
</html>`;
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

  const volumeLinks = volumes
    .filter((v) => v.title !== "未归档记录志")
    .map((v) => {
      const num = numToChinese(volumes.indexOf(v) + 1);
      let title = v.title;
      if (title === "精神科评估志") {
        title = "精神科观察志（已修订）";
      }
      return `    <a href="/pages/volume-${String(volumes.indexOf(v) + 1).padStart(2, "0")}">卷${num}：${title}</a>`;
    })
    .join("\n");

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>白鹿疗养院数字档案</title>
  <style>
    body { font-family: 'Noto Serif SC', 'SimSun', serif; max-width: 800px; margin: 0 auto; padding: 40px 20px; background: #f5f5f0; color: #333; line-height: 1.8; }
    h1 { color: #2c5f2d; border-bottom: 2px solid #2c5f2d; padding-bottom: 10px; font-size: 1.8em; }
    h2 { color: #3a7a3c; margin-top: 2em; font-size: 1.4em; }
    a { color: #2c5f2d; text-decoration: none; }
    a:hover { color: #1e401f; }
    nav { margin-bottom: 30px; padding-bottom: 15px; border-bottom: 1px solid #ddd; }
    nav a { margin-right: 15px; }
    .search-box { margin: 20px 0; position: relative; }
    #search-form { display: flex; gap: 10px; }
    #search-input { flex: 1; padding: 10px; font-size: 15px; border: 1px solid #ccc; border-radius: 4px; font-family: inherit; }
    button { padding: 10px 20px; background: #2c5f2d; color: white; border: none; border-radius: 4px; cursor: pointer; font-family: inherit; }
    button:hover { background: #1e401f; }
    .search-feedback { margin-top: 10px; padding: 10px 14px; border-radius: 4px; font-size: 14px; animation: fadeIn 0.2s ease; }
    .search-found { background: #e8f5e9; color: #2c5f2d; border: 1px solid #a5d6a7; }
    .search-not-found { background: #ffebee; color: #8b0000; border: 1px solid #ef9a9a; }
    #search-history { margin-top: 10px; display: flex; flex-wrap: wrap; gap: 8px; }
    .search-history-item { display: inline-block; padding: 4px 12px; background: #e8e8e0; border-radius: 12px; font-size: 13px; color: #555; cursor: pointer; }
    .search-history-item:hover { background: #d0d0c8; }
    .page-num { float: right; color: #999; font-size: 0.85em; }
    .volume-list { margin-top: 40px; }
    .volume-list a { display: block; padding: 10px 0; color: #2c5f2d; text-decoration: none; border-bottom: 1px solid #ddd; }
    .volume-list a:hover { color: #1e401f; }
    .volume-list .deleted { text-decoration: line-through; color: #999; }
    .volume-list .pending { color: #999; font-size: 0.9em; }
    footer { margin-top: 60px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666; }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
  </style>
</head>
<body>
  <nav>
    <a href="/">首页</a>
  </nav>
  <div class="search-box">
    <form id="search-form">
      <input type="text" id="search-input" placeholder="检索病历..." autocomplete="off" />
      <button type="submit">搜索</button>
    </form>
    <div id="search-history"></div>
  </div>
  <div class="page-num">01/24</div>
  <h1>白鹿疗养院数字档案</h1>
  <div class="volume-list">
    <h2>档案卷宗</h2>
${volumeLinks}
    <a href="/pages/volume-00" class="pending">卷零 · 未命名（待整理）</a>
  </div>
  <footer>
    <p>2023 年白鹿疗养院信息科 | 内部资料</p>
  </footer>
  <script type="module" src="/js/frontend.js"></script>
</body>
</html>`;
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
