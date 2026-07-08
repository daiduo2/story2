# 白鹿疗养院 UI 改版迁移计划

> 配套文档：`docs/ui-redesign-prd.md`、`docs/ui-components.md`

## 1. 阶段划分总览

| 阶段 | 目标 | 预计修改文件数 | 预计工作量 |
|---|---|---|---|
| 阶段 1 | CSS 基础重构：Token、网格、间距、断点 | 1-2 | 中 |
| 阶段 2 | 首页重设计：三栏布局、24 卷表格 | 2-3 | 中 |
| 阶段 3 | 内容页模板重设计：volume/supplement/peripheral/variant | 1（render.ts）+ 内容微调 | 大 |
| 阶段 4 | 响应式与移动端适配 | 2-3 | 中 |
| 阶段 5 | 动效、异常视觉、暗黑主题接入 | 3-5 | 中 |

---

## 2. 阶段 1：CSS 基础重构

### 2.1 目标

在不破坏现有 JS 与 Markdown 类名的前提下，建立新 token、新网格、新间距体系，让页面从“居中 760px”变成“流体网格 + 侧边栏”。

### 2.2 修改文件

- `public/css/style.css`（主修改）
- `public/index.html`（可能需要微调 wrapper 结构）
- `src/agent/render.ts`（阶段 1 仅确认类名兼容；实际模板改造放阶段 3）

### 2.3 改动清单

1. 新增 CSS 变量：颜色、间距、断点、字体、布局尺寸。
2. 改造 `.container`：从 `width: 760px` 改为 `max-width: 1280px` + padding。
3. 新增 `.page-layout` 网格类：
   - `.page-layout--home`（三栏）
   - `.page-layout--with-sidebar`（左侧边栏）
   - `.page-layout--with-right-sidebar`（右侧边栏）
4. 新增 `.sidebar`、`.sidebar--sticky`、`.content-column`。
5. 重构响应式断点：从单一 780px 改为 768/1024/1280 多级。
6. 保留所有 JS 依赖选择器的样式：
   - `#search-form`、`#search-input`、`#search-history`
   - `<main>`、`.doc-header`、`.volume-list`
7. 保留/增强 Markdown 语义类：
   - `.handwritten`、`.awakened-insert`、`.transcript-marker`
   - `.red-text`、`.redacted`、`.archive-table`
8. `.doc-header` 从 `text-align: center` 改为 `text-align: left`。
9. `main { padding: 20px 0; }` 取消，改由 `.page-layout` 控制间距。

### 2.4 验证方式

- 启动本地服务器：`pnpm dev` 或 `cd public && python3 -m http.server 8080`
- 访问首页，检查：
  - 页面宽度是否占满容器，不再居中 760px
  - `#search-form` 仍可提交
  - `#search-history` 正常渲染
  - 所有内部链接仍被 behavior 拦截追加 `sid`
- DevTools 切换 375px / 768px / 1024px / 1440px，确认无水平滚动条。
- 运行 `pnpm test` 确保前端单元测试通过。

### 2.5 风险点

- `.container` 语义改变可能影响依赖其宽度的 JS（目前未发现）。
- `main { padding: 20px 0; }` 取消后，旧首页视觉会变化，需同步微调 `public/index.html`。
- `.paper-grain` 的 `z-index` 需复核，确保仍覆盖在正文之上但不遮挡交互。

---

## 3. 阶段 2：首页重设计

### 3.1 目标

将 `public/index.html` 从单栏居中改造成三栏档案系统首页。

### 3.2 修改文件

- `public/index.html`
- `public/css/style.css`（补充首页专用样式）

### 3.3 改动清单

1. 在 `<main>` 外包裹 `<div class="page-layout page-layout--home">`。
2. 新增左侧 `<aside class="sidebar sidebar--sticky">`：
   - 档案分类树（正编病历、补遗档案、外围档案、系统说明）
   - 24 卷可分组折叠（卷一～卷六、卷七～卷十二……）
3. 主内容区 `<main>` 内保留：
   - `.doc-header`（左对齐）
   - `.search-panel`
   - `.home-intro`
   - `.archive-table`：24 卷表格（卷号/题名/年代/科室/状态）
   - 补遗/外围摘要表格
4. 新增右侧 `<aside class="sidebar sidebar--sticky">`：
   - 系统公告
   - 最近更新
   - 快速统计
5. 将原来的 `.volume-list` 长列表改为 `.archive-table` 表格。
6. 保留 `#search-form`、`<main>`、`<a>` 等 JS 依赖结构。

### 3.4 验证方式

- 访问首页，确认三栏布局在 1280px 以上正常显示。
- 1024px-1279px 时右侧边栏应折叠到底部或隐藏。
- 768px 以下侧边栏应隐藏，通过抽屉切换。
- 搜索功能、搜索历史、链接拦截均正常。

### 3.5 风险点

- 24 卷表格信息密度高，需确保在 1024px 下不换行严重。
- 左侧分类树过长时，sticky 行为需测试。

---

## 4. 阶段 3：内容页模板重设计

### 4.1 目标

改造 `src/agent/render.ts`，让 volume/supplement/peripheral/variant 页面采用新的两栏布局。

### 4.2 修改文件

- `src/agent/render.ts`
- `public/css/style.css`（补充内容页样式）
- 可能需要更新少量 `content/**/*.md` 中的样式类使用

### 4.3 改动清单

#### 4.3.1 `buildBaseWrapper`

将：
```html
<div class="container">
  <main>${options.bodyHtml}</main>
</div>
```

改为支持布局类参数：
```html
<div class="container">
  <div class="page-layout ${options.layoutClass}">
    ${options.sidebarLeft || ""}
    <main>${options.bodyHtml}</main>
    ${options.sidebarRight || ""}
  </div>
</div>
```

#### 4.3.2 `buildVolumeHtml`

- 主内容区：`.doc-header`、`.search-panel`、`.volume-meta-bar`、`.volume-content`
- 右侧 aside：TOC、相关卷宗、上一卷/下一卷

#### 4.3.3 `buildSupplementHtml`

- 左侧 sidebar：作者信息、时间线锚点
- 主内容区：`.doc-header`、`.search-panel`、`.supplement-author`、`.supplement-content`

#### 4.3.4 `buildPeripheralHtml`

- 主内容区：`.doc-header`、`.search-panel`、`.peripheral-source`、`.peripheral-content`
- 右侧 aside：证据摘要、关联补遗/卷宗

#### 4.3.5 `buildMetaHtml`

- about/notice：单栏
- archives：复用首页三栏结构，或指向首页

#### 4.3.6 `buildVariantHtml`

- 继承基础模板布局。
- 保持 `<main data-variant="..." data-variant-of="...">` 的字符串替换逻辑。
- 新增 `body[data-theme="dark"]` 的接入点。

### 4.4 验证方式

- 运行 `npm run build` 编译 agent。
- 启动 agent：`npm run dev`
- 访问以下页面并检查布局：
  - `/pages/volume-01`（正编病历）
  - `/pages/supplement-lin`（补遗档案）
  - `/pages/security-cctv`（外围档案）
  - `/pages/about`（元信息页）
  - `/pages/archives`（档案目录）
  - `/pages/volume-00-awakened`（变体页，如果有）
- 确认 `#search-form`、`<main>`、`<a>` 行为正常。
- 确认 agent 注入的 `.system-message` 出现在 `<main>` 内。

### 4.5 风险点

- `buildBaseWrapper` 改动影响所有动态页，需全面回归。
- 变体页的 `<main>` 字符串替换需保持可用。
- 如果内容 Markdown 中使用了旧布局相关的类名（如依赖 `.container` 宽度的内联样式），需同步调整。

---

## 5. 阶段 4：响应式与移动端适配

### 5.1 目标

完善多断点响应式，确保平板和手机体验可用。

### 5.2 修改文件

- `public/css/style.css`
- `public/js/frontend.js` 或相关模块（移动端菜单切换）

### 5.3 改动清单

1. 补充 768px/1024px/1280px 断点下的细节调整：
   - 手机：单栏、导航变汉堡菜单、搜索全宽
   - 平板：单栏、侧边栏变抽屉
   - 小桌面：两栏、首页右栏折叠
2. 新增 `.site-nav--open`、`.sidebar--open` 等状态类。
3. 前端 JS 增加移动端菜单切换逻辑（可选，若不增加则保留简单堆叠）。
4. 测试 `.volume-meta-bar` 在小屏下的网格退化。
5. 测试 `.archive-table` 横向滚动或列隐藏策略。

### 5.4 验证方式

- DevTools Device Mode 测试：iPhone SE、iPad、1024px 笔记本、1440px 桌面。
- 真机测试（如有）：点击汉堡菜单、侧边栏抽屉、搜索提交。

### 5.5 风险点

- 旧系统风格下，移动端菜单不宜做得太现代，需保持复古感。
- 表格在小屏下可能需要横向滚动，需确保表格容器 `overflow-x: auto`。

---

## 6. 阶段 5：动效、异常视觉、暗黑主题

### 6.1 目标

强化氛围与异常体验，同时不破坏可用性。

### 6.2 修改文件

- `public/css/style.css`（动画、异常主题）
- `public/js/main.ts` 或相关模块（触发异常 class）
- `src/agent/render.ts`（变体页接入暗黑主题）

### 6.3 改动清单

1. 变体页异常视觉：
   - 给 `<main data-variant="awakened"`> 添加反色/扫描线样式
   - 标题/页码 glitch 动画
   - 屏幕轻微闪烁
2. 普通页 subtle 异常：
   - 搜索框占位符注入时增加轻微抖动
   - 页脚超时变红保留并强化
3. 暗黑主题接入：
   - 变体页自动 `body[data-theme="dark"]`
   - 系统异常状态由 JS 动态设置
4. 页面切换：保留当前无过渡刷新，但搜索反馈增加即时动效。
5. 目录高亮：内容页 TOC 高亮当前章节（IntersectionObserver）。

### 6.4 验证方式

- 访问变体页，确认异常视觉效果正常。
- 触发搜索框异常注入，观察占位符变化与动效。
- 长时间停留页面，确认页脚颜色变化。
- 运行 `pnpm test` 确保 JS 行为测试通过。

### 6.5 风险点

- 动画需使用 CSS keyframes，避免 JS 频繁操作 DOM 导致性能问题。
- 异常效果不宜过重，保持“玩家可能怀疑自己眼花”的微妙感。

---

## 7. 依赖保护清单

以下 DOM 结构与选择器在全部阶段中必须保留：

| 选择器 | 用途 | 来源 |
|---|---|---|
| `#search-form` | 搜索提交、规则 3 检测 | `search.ts`、`main.ts` |
| `#search-input` | 输入关键词、异常占位符注入 | `search.ts`、`main.ts` |
| `#search-history` | 渲染最近搜索记录 | `search.ts` |
| `<main>` | 系统消息默认挂载点 | `router.ts` |
| `<a>` | 内部链接 `sid` 拦截 | `behavior.ts` |
| `.doc-header` | 可能被 agent 注入内容 | `NarrativeDecision.targetSelector` |
| `.container` | 可能被 agent 注入内容 | `NarrativeDecision.targetSelector` |
| `.volume-list` | 可能被 agent 注入内容 | `NarrativeDecision.targetSelector` |
| `--footer-color` | 页面超时变红 | `main.ts` |

---

## 8. 原型页面处理

- `public/prototypes/` 与 `public/prototypes/css/prototype-retro.css` 保留为独立沙盒。
- 新设计系统稳定后，再决定是否：
  - 将 prototypes 迁移到新 CSS
  - 废弃 prototypes
  - 将 prototypes 中优秀的视觉元素反向合并到生产样式

---

## 9. 验收 Checklist

### 9.1 全阶段通用

- [ ] 所有页面无水平滚动条（在正常视口下）。
- [ ] `#search-form` 提交正常。
- [ ] `#search-history` 渲染正常。
- [ ] 内部链接点击后 URL 带有 `?sid=...`。
- [ ] agent 注入的 `.system-message` 出现在 `<main>` 内。
- [ ] `pnpm test` 全部通过。
- [ ] `npm run build` 成功。

### 9.2 阶段 1 验收

- [ ] `.container` 已改为 `max-width: 1280px`。
- [ ] 新增 `.page-layout`、`.sidebar`、`.content-column`。
- [ ] 响应式断点已改为 768/1024/1280。
- [ ] `.doc-header` 已左对齐。

### 9.3 阶段 2 验收

- [ ] 首页为三栏布局（1280px+）。
- [ ] 24 卷以 `.archive-table` 表格展示。
- [ ] 左侧分类目录可点击跳转。
- [ ] 右侧系统公告/统计面板存在。

### 9.4 阶段 3 验收

- [ ] volume 页右侧有相关卷宗与上一卷/下一卷。
- [ ] supplement 页左侧有时间线。
- [ ] peripheral 页右侧有来源/证据摘要。
- [ ] variant 页继承基础布局并带有 `data-variant`。

### 9.5 阶段 4 验收

- [ ] 手机下单栏无布局错乱。
- [ ] 平板下侧边栏抽屉或堆叠正常。
- [ ] 表格在小屏下可横向滚动。

### 9.6 阶段 5 验收

- [ ] 变体页有异常视觉效果。
- [ ] 暗黑主题不开放手动切换，仅变体/异常触发。
- [ ] 搜索框异常注入时有动效反馈。
- [ ] 目录 TOC 高亮当前章节（如已实现）。

---

## 10. 回滚策略

每个阶段独立完成后提交一次 commit，若发现严重回归可单独回滚该阶段：

```bash
# 阶段 N 回滚示例
git log --oneline
git revert <阶段 N 的 commit hash>
```

建议阶段 1 和阶段 2 一起提交（首页可见性高），阶段 3 单独提交（影响动态页），阶段 4 和阶段 5 可合并或分开提交。

---

## 11. 下一步行动

1. 用户确认本迁移计划。
2. 开始阶段 1：CSS 基础重构。
3. 阶段 1 完成后本地验证并提交。
4. 进入阶段 2：首页重设计。
