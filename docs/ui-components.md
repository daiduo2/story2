# 白鹿疗养院 UI 组件规范

> 配套文档：`docs/ui-redesign-prd.md`

## 1. 组件总览

| 组件类别 | 组件名 | 用途 |
|---|---|---|
| 布局 | `.container`、`.page-layout`、`.sidebar`、`.content-column` | 页面级结构 |
| 导航 | `.site-nav`、`.sidebar-nav`、`.breadcrumb`、`.toc` | 全局与局部导航 |
| 内容 | `.doc-header`、`.search-panel`、`.archive-table`、`.archive-card` | 文档头部、搜索、表格 |
| 元信息 | `.volume-meta-bar`、`.supplement-author`、`.peripheral-source`、`.meta-panel` | 档案元信息 |
| 异常 | `.awakened-insert`、`.scanlines`、`.system-message`、`.glitch` | 氛围/异常视觉 |
| 基础 | `.btn-secondary`、`.stamp`、`.mono`、`.handwritten`、`.redacted` | 原子样式 |

---

## 2. 布局组件

### 2.1 `.container`

**用途**：全宽栏条容器，用于 system-bar、site-header、site-nav、site-footer。

```css
.container {
  width: 100%;
  max-width: var(--page-max-width);
  margin: 0 auto;
  padding: 0 var(--space-2);
}
```

**约束**：不再用于包裹主内容区与侧边栏的网格。

### 2.2 `.page-layout`

**用途**：主内容区与侧边栏的网格容器。

```css
.page-layout {
  display: grid;
  gap: var(--space-3);
  padding: var(--space-2) 0;
}

/* 移动优先：默认单栏 */
.page-layout > main {
  min-width: 0;
}

/* 桌面：左侧边栏 + 主内容 */
@media (min-width: 1024px) {
  .page-layout--with-sidebar {
    grid-template-columns: var(--sidebar-width) minmax(0, 1fr);
  }
  .page-layout--with-right-sidebar {
    grid-template-columns: minmax(0, 1fr) var(--right-sidebar-width);
  }
}

/* 大屏：首页三栏 */
@media (min-width: 1280px) {
  .page-layout--home {
    grid-template-columns: var(--sidebar-width) minmax(0, 1fr) var(--right-sidebar-width);
  }
}
```

### 2.3 `.sidebar`

**用途**：侧边栏容器。

```css
.sidebar {
  background: var(--bg-sidebar);
  border: 1px solid var(--border-color);
  padding: var(--space-2);
  font-size: 0.9em;
}

.sidebar--sticky {
  position: sticky;
  top: 40px;
  align-self: start;
  max-height: calc(100vh - 48px);
  overflow-y: auto;
}

.sidebar h3 {
  font-size: 0.95em;
  margin: 0 0 var(--space-1) 0;
  padding-bottom: var(--space-1);
  border-bottom: 1px solid var(--border-color);
}
```

### 2.4 `.content-column`

**用途**：限制正文行宽，保证长文可读性。

```css
.content-column {
  max-width: var(--content-max-width);
  margin: 0 auto;
}
```

---

## 3. 导航组件

### 3.1 `.site-nav`

**用途**：顶部主导航。

```css
.site-nav {
  background-color: var(--header-bg);
  border-bottom: 1px solid var(--border-color);
}

.site-nav .container {
  display: flex;
  gap: 2px;
}

.site-nav a {
  display: block;
  padding: 8px 18px;
  font-family: "SimHei", "STHeiti", "Heiti SC", "Microsoft YaHei", sans-serif;
  color: var(--text-color);
  text-decoration: none;
  border: 1px solid transparent;
  border-bottom: none;
  background-color: var(--header-bg);
}

.site-nav a:hover {
  background-color: var(--bg-color);
  border-color: var(--border-color);
  text-decoration: underline;
}

.site-nav a.active {
  background-color: var(--bg-color);
  border-color: var(--border-color);
  border-bottom: 1px solid var(--bg-color);
  margin-bottom: -1px;
  font-weight: bold;
}
```

### 3.2 `.sidebar-nav`

**用途**：侧边栏分类目录。

```html
<nav class="sidebar-nav">
  <ul>
    <li class="sidebar-nav__group">
      <span class="sidebar-nav__label">正编病历</span>
      <ul>
        <li><a href="/pages/volume-01">卷一：入院登记志</a></li>
        ...
      </ul>
    </li>
  </ul>
</nav>
```

```css
.sidebar-nav ul {
  list-style: none;
  margin: 0;
  padding: 0;
}

.sidebar-nav li {
  margin-bottom: 4px;
}

.sidebar-nav a {
  display: block;
  padding: 4px 8px;
  color: var(--link-color);
  text-decoration: none;
}

.sidebar-nav a:hover {
  background: rgba(0, 0, 0, 0.03);
  color: var(--link-hover);
}

.sidebar-nav__label {
  display: block;
  font-weight: bold;
  padding: 4px 8px;
  color: var(--text-color);
}
```

### 3.3 `.toc`

**用途**：内容页右侧目录。

```css
.toc {
  font-size: 0.9em;
}

.toc ul {
  list-style: none;
  margin: 0;
  padding: 0;
}

.toc li {
  margin-bottom: 4px;
}

.toc a {
  display: block;
  padding: 3px 0;
  color: var(--link-color);
  text-decoration: none;
  border-left: 2px solid transparent;
  padding-left: 8px;
}

.toc a:hover,
.toc a.is-active {
  border-left-color: var(--accent-color);
  color: var(--link-hover);
}
```

---

## 4. 内容组件

### 4.1 `.doc-header`

**用途**：页面标题与元信息头部。

```css
.doc-header {
  text-align: left;
  margin-bottom: var(--space-3);
  padding-bottom: var(--space-2);
  border-bottom: 2px solid var(--border-color);
}

.doc-header h1 {
  margin: 0 0 var(--space-1) 0;
  font-size: 1.5em;
  font-weight: bold;
}

.doc-meta {
  color: var(--meta-color);
  font-size: 0.9em;
  display: flex;
  align-items: center;
  gap: var(--space-2);
}
```

### 4.2 `.search-panel`

**用途**：全文检索框。

```css
.search-panel {
  background: var(--note-bg);
  border: 1px solid var(--border-color);
  padding: var(--space-2);
  margin-bottom: var(--space-3);
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.search-panel label {
  font-family: "SimHei", "STHeiti", "Heiti SC", "Microsoft YaHei", sans-serif;
  font-size: 0.95em;
  white-space: nowrap;
}
```

### 4.3 `.archive-table`

**用途**：首页 24 卷目录、档案列表。

```css
.archive-table {
  width: 100%;
  border-collapse: collapse;
  margin: 0 0 var(--space-2) 0;
  font-size: 0.95em;
  border: 1px solid var(--border-color);
}

.archive-table th,
.archive-table td {
  border: 1px solid var(--border-color);
  padding: 6px 8px;
  text-align: left;
}

.archive-table th {
  background-color: var(--table-header-bg);
  font-family: "SimHei", "STHeiti", "Heiti SC", "Microsoft YaHei", sans-serif;
  font-weight: bold;
}

.archive-table tr:nth-child(even) {
  background-color: var(--table-alt-bg);
}

.archive-table td {
  font-family: "SimSun", "STSong", serif;
}
```

### 4.4 `.archive-card`

**用途**：卡片式档案条目（目前首页用表格，此组件预留）。

```css
.archive-card {
  border: 1px solid var(--border-color);
  padding: var(--space-2);
  background: var(--note-bg);
}

.archive-card__id {
  font-family: "Courier New", "SimSun", "NSimSun", monospace;
  color: var(--meta-color);
  font-size: 0.85em;
}

.archive-card__title {
  font-weight: bold;
  margin: var(--space-1) 0;
}

.archive-card__meta {
  color: var(--meta-color);
  font-size: 0.85em;
}
```

---

## 5. 元信息组件

### 5.1 `.volume-meta-bar`

**用途**：正编病历卷宗元信息栏。

```css
.volume-meta-bar {
  background: var(--note-bg);
  border: 1px solid var(--border-color);
  padding: var(--space-2);
  margin-bottom: var(--space-3);
  font-size: 0.9em;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-1) var(--space-2);
}

.volume-meta-bar .label {
  font-family: "SimHei", "STHeiti", "Heiti SC", sans-serif;
  font-weight: bold;
}

@media (max-width: 767px) {
  .volume-meta-bar {
    grid-template-columns: 1fr;
  }
}
```

### 5.2 `.supplement-author`

**用途**：补遗档案作者信息块。

```css
.supplement-author {
  background: var(--note-bg);
  border: 1px solid var(--border-color);
  border-left: 4px solid var(--accent-color);
  padding: var(--space-2);
  margin-bottom: var(--space-3);
  font-size: 0.95em;
}

.supplement-author .name {
  font-size: 1.15em;
  font-weight: bold;
  margin-bottom: 6px;
}

.supplement-author .meta {
  color: var(--meta-color);
  font-size: 0.9em;
}
```

### 5.3 `.peripheral-source`

**用途**：外围档案来源信息块。

```css
.peripheral-source {
  background: var(--note-bg);
  border: 1px solid var(--border-color);
  padding: var(--space-2);
  margin-bottom: var(--space-3);
  font-size: 0.95em;
}

.peripheral-source .label {
  font-family: "SimHei", "STHeiti", "Heiti SC", sans-serif;
  font-weight: bold;
}

.peripheral-source .archive-id {
  font-family: "Courier New", "SimSun", monospace;
  color: var(--accent-color);
  font-weight: bold;
}
```

### 5.4 `.meta-panel`

**用途**：右侧通用元信息面板。

```css
.meta-panel {
  border: 1px solid var(--border-color);
  background: var(--note-bg);
  padding: var(--space-2);
  margin-bottom: var(--space-2);
}

.meta-panel h3 {
  margin: 0 0 var(--space-1) 0;
  font-size: 0.95em;
  border-bottom: 1px solid var(--border-color);
  padding-bottom: var(--space-1);
}

.meta-panel ul {
  list-style: none;
  margin: 0;
  padding: 0;
}

.meta-panel li {
  margin-bottom: 6px;
}
```

---

## 6. 异常组件

### 6.1 `.awakened-insert`

**用途**：变体页中系统入侵式的插入内容。

```css
.awakened-insert {
  border-left: 3px solid var(--red-text);
  background: rgba(178, 34, 34, 0.06);
  padding: var(--space-2) var(--space-3);
  margin: 1.5em 0 1.5em 1.5em;
  color: #5a2222;
  font-family: "SimHei", "STHeiti", sans-serif;
}
```

### 6.2 `.scanlines`

**用途**：CRT 扫描线效果。

```css
.scanlines {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
  z-index: 9998;
  background-image: repeating-linear-gradient(
    0deg,
    rgba(0, 0, 0, 0.08) 0,
    rgba(0, 0, 0, 0.08) 1px,
    transparent 1px,
    transparent 2px
  );
}
```

### 6.3 `.system-message`

**用途**：系统提示/对峙式提示。

```css
.system-message {
  padding: var(--space-2);
  margin: var(--space-2) 0;
  border: 1px solid var(--border-color);
  border-left: 3px solid var(--accent-color);
  background: var(--note-bg);
  font-family: "SimHei", "STHeiti", sans-serif;
}

.system-message.style-confrontational {
  border-left-color: var(--red-text);
  background: rgba(178, 34, 34, 0.08);
}
```

---

## 7. 基础组件

### 7.1 `.stamp`

**用途**：内部资料印章。

```css
.stamp {
  color: var(--stamp-color);
  font-family: "SimHei", "STHeiti", "Heiti SC", "Microsoft YaHei", sans-serif;
  font-weight: bold;
  font-size: 1.1em;
  border: 2px solid var(--stamp-color);
  display: inline-block;
  padding: 4px 10px;
  transform: rotate(-3deg);
  opacity: 0.85;
  letter-spacing: 0.1em;
}
```

### 7.2 `.mono`

**用途**：等宽编号、代码、档案号。

```css
.mono {
  font-family: "Courier New", "SimSun", "NSimSun", monospace;
}
```

### 7.3 `.handwritten`

**用途**：手写体段落。

```css
.handwritten {
  font-family: "KaiTi", "STKaiti", "楷体", serif;
  font-size: 1.05em;
  line-height: 1.8;
  color: #2a2a2a;
}
```

### 7.4 `.redacted`

**用途**：涂黑文字，悬停显示。

```css
.redacted {
  background: #1a1a1a;
  color: #1a1a1a;
  padding: 0 2px;
  cursor: help;
}

.redacted:hover {
  background: transparent;
  color: var(--text-color);
}
```

---

## 8. Token 速查表

```css
:root {
  /* 颜色 */
  --bg-canvas: #dcdcd6;
  --bg-paper: #e6e6e2;
  --bg-sidebar: #deded8;
  --text-color: #1a1a1a;
  --accent-color: #4a6741;
  --accent-dark: #2f4528;
  --accent-muted: #6b8a63;
  --border-color: #999999;
  --divider-color: #a0a09a;
  --header-bg: #d4d4d0;
  --link-color: #1e3a5f;
  --link-hover: #8b0000;
  --red-text: #8b0000;
  --meta-color: #555555;
  --stamp-color: #aa0000;
  --note-bg: #ddddda;
  --table-header-bg: #c8c8c4;
  --table-alt-bg: #e0e0dc;
  --button-bg: #d4d4d0;
  --button-active-bg: #b8b8b4;
  --input-bg: #ffffff;
  --footer-color: var(--meta-color);

  /* 间距 */
  --space-1: 8px;
  --space-2: 16px;
  --space-3: 24px;
  --space-4: 32px;
  --space-5: 48px;

  /* 布局 */
  --sidebar-width: 220px;
  --right-sidebar-width: 260px;
  --content-max-width: 760px;
  --page-max-width: 1280px;
}
```

---

## 9. 暗黑模式（仅变体/异常）

```css
body[data-theme="dark"] {
  --bg-canvas: #0f1419;
  --bg-paper: #161a20;
  --bg-sidebar: #1a1a1e;
  --text-color: #c8cdd5;
  --accent-color: #8b6b4a;
  --border-color: #3a3530;
  --header-bg: #1a1a1e;
  --link-color: #8ba4be;
  --link-hover: #c8cdd5;
  --red-text: #c85555;
  --meta-color: #888888;
  --stamp-color: #c85555;
  --note-bg: #1a1a1e;
  --table-header-bg: #2a2a2e;
  --table-alt-bg: #15151a;
  --input-bg: #0a0a0a;
}
```

---

## 10. 响应式断点

```css
/* 手机 */
@media (max-width: 767px) { ... }

/* 平板 */
@media (min-width: 768px) and (max-width: 1023px) { ... }

/* 桌面 */
@media (min-width: 1024px) and (max-width: 1279px) { ... }

/* 大屏桌面 */
@media (min-width: 1280px) { ... }
```

---

## 11. 文件变更关联

- `public/css/style.css`：所有组件样式的最终落地文件。
- `docs/ui-redesign-prd.md`：设计目标与信息架构。
- `docs/ui-migration-plan.md`：分阶段实施与验收清单。
