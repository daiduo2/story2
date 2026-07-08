# 白鹿疗养院 UI/UX 全面改版 PRD

> 版本：v1.0  
> 日期：2026-07-09  
> 状态：已确认，待分阶段实施

## 1. 项目背景与改版范围

### 1.1 背景

「白鹿疗养院」是一个 ARG 风格恐怖网页游戏，伪装成 2000 年代中式医院病历数字化内网。当前项目包含：

- 静态入口页：`public/index.html`
- 动态内容页：由 `src/agent/render.ts` 从 `content/**/*.md` 渲染生成
- 公共样式：`public/css/style.css`
- 前端运行时：`public/js/frontend.js`（加载 behavior/search/main/router/llm-bridge 模块）
- 原型沙盒：`public/prototypes/` 与 `public/prototypes/css/prototype-retro.css`

### 1.2 当前痛点

- **所有内容被 `.container { width: 760px; margin: 0 auto; }` 硬锁在屏幕中央**，宽屏下两侧大量空白。
- 页面为单栏垂直堆叠，缺少医院档案系统的“目录-主内容-元信息”结构感。
- 24 卷在首页以长列表垂直排列，信息密度低、浏览效率差。
- 内容页没有交叉引用面板，缺乏档案之间的网状叙事感。
- 移动端仅有一个简单断点，未充分利用现代响应式能力。

### 1.3 改版范围

本次改版覆盖：

- `public/css/style.css` 全局重构
- `public/index.html` 首页结构重设计
- `src/agent/render.ts` 中 `buildBaseWrapper` 及五个模板函数改造
- 必要时更新 `content/**/*.md` 中使用的样式类（尽量兼容）

不覆盖：

- `public/prototypes/` 与 `prototype-retro.css`（保留为独立沙盒）
- 前端 JS 模块的核心行为逻辑（仅适配 DOM 结构）
- 叙事 agent 的提示词与决策逻辑

---

## 2. 设计目标

### 2.1 氛围目标

伪装成一台 **2004 年仍在运行的医院档案工作站**：

- 真实：像真实的内部系统，而非游戏界面。
- 陈旧：纸张纹理、旧式宋体、低饱和度配色、Win9x 风格按钮。
- 压抑：密集但不杂乱的档案信息，灰绿主调，深红作为异常点缀。
- 系统化：统一的网格、一致的元信息栏、清晰的分类层级。

### 2.2 体验目标

- 打破居中，让页面填满屏幕并建立系统界面感。
- 用左侧目录、右侧元信息栏、中间主内容区的经典“档案柜”布局。
- 提升首页信息密度，24 卷用表格展示。
- 内容页加入目录（TOC）、上一卷/下一卷、相关卷宗等交叉引用。
- 保留并强化异常视觉：变体页触发反色/扫描线，普通页通过 JS 注入 subtle glitch。

### 2.3 非目标

- 不改成现代 SaaS 风格。
- 不引入大段动画干扰阅读。
- 不破坏现有搜索、规则检测、agent 注入等 JS 行为。

---

## 3. 新的布局体系

### 3.1 全局网格

采用 **CSS Grid + Sticky 侧边栏** 的桌面布局，移动优先退化。

```
┌────────────────────────────────────────────────────────────────────┐
│ .system-bar                                                        │
├────────────────────────────────────────────────────────────────────┤
│ .site-header                                            [内部资料]  │
├────────────────────────────────────────────────────────────────────┤
│ .site-nav (home | archives | notice | about)                       │
├──────────────┬──────────────────────────────────┬──────────────────┤
│ 左侧 sidebar │            main                  │  右侧 aside      │
│  220px       │         主内容区                 │   260px          │
│              │                                  │                  │
│  分类目录    │   .doc-header                    │  元信息面板      │
│  快速统计    │   .search-panel                  │  相关档案        │
│  系统公告    │   .content-column                │  上一卷/下一卷   │
│              │                                  │                  │
├──────────────┴──────────────────────────────────┴──────────────────┤
│ .site-footer                                                       │
└────────────────────────────────────────────────────────────────────┘
```

### 3.2 容器策略

- 删除 `.container { width: 760px; margin: 0 auto; }`。
- `.container` 改为“全宽栏条”语义：
  ```css
  .container {
    width: 100%;
    max-width: var(--page-max-width);
    margin: 0 auto;
    padding: 0 var(--space-2);
  }
  ```
- 新增 `.page-layout` 负责主内容与侧边栏的网格。
- 主内容区内部保留 `.content-column { max-width: 760px; margin: 0 auto; }`，避免长文行宽过长。

### 3.3 页面类型与对应布局

| 页面类型 | 布局 | 说明 |
|---|---|---|
| 首页 / 档案目录 | 三栏（左 220 + 中 1fr + 右 260） | 左侧分类目录，中间 24 卷表格/搜索，右侧系统公告 |
| 正编病历（volume） | 两栏（左 1fr + 右 260） | 主文档 + 右侧目录/相关卷宗/上一卷下一卷 |
| 补遗档案（supplement） | 两栏（左 220 + 中 1fr） | 左侧时间线锚点，右侧原始日志/手写体 |
| 外围档案（peripheral） | 两栏（左 1fr + 右 260） | 主记录 + 右侧来源/证据摘要/关联补遗 |
| 元信息页（meta） | 单栏或两栏 | about/notice 单栏；archives 与首页一致 |
| 变体页（variant） | 继承基础模板布局 | 通过 `data-variant` 触发异常主题 |

### 3.4 响应式断点

| 断点 | 范围 | 布局 |
|---|---|---|
| 大屏桌面 | `>= 1280px` | 三栏/两栏展开，侧边栏 sticky |
| 桌面 | `1024px - 1279px` | 两栏为主，首页右栏折叠到底部 |
| 平板 | `768px - 1023px` | 单栏，侧边栏变为可切换抽屉 |
| 手机 | `< 768px` | 单栏，导航变汉堡菜单，搜索全宽 |

---

## 4. 各页面类型信息架构

### 4.1 首页（index）

**信息架构：**

- 左侧 sidebar：档案分类树
  - 正编病历（卷一～卷六、卷七～卷十二……可折叠）
  - 补遗档案
  - 外围档案
  - 系统说明
- 主内容区：
  - `.doc-header`：左对齐标题
  - `.search-panel`：全文检索
  - `.home-intro`：系统欢迎说明
  - `.archive-table`：24 卷目录表格（卷号/题名/年代/科室/状态）
  - 补遗/外围表格摘要
- 右侧 aside：
  - 系统公告
  - 最近更新
  - 快速统计（馆藏卷数、未归档数、异常标记数）

### 4.2 正编病历（volume）

**信息架构：**

- 主内容区：
  - `.doc-header`：卷标题 + 页码
  - `.search-panel`
  - `.volume-meta-bar`：卷号、年代、科室、副标题、页码
  - `.volume-content`：正文
- 右侧 aside：
  - 本卷目录（TOC，基于 h2/h3 锚点）
  - 相关卷宗链接
  - 上一卷 / 下一卷
  - 异常标记（如果有）

### 4.3 补遗档案（supplement）

**信息架构：**

- 左侧 sidebar：
  - 作者信息
  - 时间线锚点（按日期）
- 主内容区：
  - `.doc-header`
  - `.search-panel`
  - `.supplement-author`：作者名、身份、年代
  - `.supplement-content`：正文，区分转录/手写体

### 4.4 外围档案（peripheral）

**信息架构：**

- 主内容区：
  - `.doc-header`
  - `.search-panel`
  - `.peripheral-source`：档案编号、来源机构
  - `.peripheral-content`：正文，多为表格/客观记录
- 右侧 aside：
  - 证据摘要
  - 关联补遗/卷宗

### 4.5 元信息页（meta）

- `about`：单栏，项目说明
- `notice`：单栏，保留 `.notice-box` 规则框
- `archives`：与首页结构一致，但可加入 agent 注入的差异项

### 4.6 变体页（variant）

- 继承基础模板布局。
- `<main data-variant="awakened">` 触发异常主题。
- 反色、扫描线、标题闪烁、页码 glitch、系统错误弹窗等。
- 不破坏基础布局骨架，只通过 CSS 与 JS 叠加异常层。

---

## 5. 设计 Token 与组件规范

详见 `docs/ui-components.md`。本节仅列核心 Token。

### 5.1 颜色

保留现有主色，新增层级：

```css
:root {
  --bg-canvas: #dcdcd6;        /* 页面背景 */
  --bg-paper: #e6e6e2;         /* 内容区背景 */
  --bg-sidebar: #deded8;       /* 侧边栏背景 */
  --text-color: #1a1a1a;
  --accent-color: #4a6741;     /* 档案绿 */
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
}
```

暗黑模式仅用于变体页和系统异常，不开放手动切换：

```css
body[data-theme="dark"] { ... }
```

### 5.2 字体层级

| 用途 | 字体 | 大小 |
|---|---|---|
| 站点标题 | 宋体 | 1.6em |
| 文档标题 | 宋体 | 1.5em |
| 二级标题 | 宋体 | 1.25em，带下边框 |
| 正文 | 宋体 | 14px/1.6 |
| 元信息/标签 | 黑体 | 0.875em |
| 等宽编号 | Courier New | 0.9em |
| 手写体 | 楷体 | 1.05em |

### 5.3 间距体系

以 8px 为基线：

```css
--space-1: 8px;
--space-2: 16px;
--space-3: 24px;
--space-4: 32px;
--space-5: 48px;
```

### 5.4 布局 Token

```css
--sidebar-width: 220px;
--right-sidebar-width: 260px;
--content-max-width: 760px;
--page-max-width: 1280px;
```

---

## 6. 交互与动效

### 6.1 侧边栏

- 桌面端：`.sidebar--sticky` 跟随滚动，top 预留 system-bar 空间。
- 内容页目录高亮当前章节（通过 IntersectionObserver 或 scroll 计算）。
- 平板/手机：侧边栏隐藏，通过汉堡按钮切换抽屉。

### 6.2 搜索

- 保留现有 `#search-form`、`#search-input`、`#search-history` 行为。
- 搜索成功：搜索框轻微高亮。
- 搜索失败：输入框短促 shake。
- 异常注入的关键词仍由 `main.ts` 控制。

### 6.3 异常动效

- 变体页：`body[data-variant="awakened"]` 触发：
  - 反色主题
  - `.scanlines` 扫描线
  - 页码/标题 glitch
  - 屏幕轻微闪烁
- 普通页异常：通过 JS 动态添加 class，全部用 CSS keyframes，避免 reflow。

### 6.4 暗黑模式

- 不开放手动切换。
- 变体页自动进入暗黑/异常主题。
- 系统异常状态由 JS 动态设置 `body[data-theme="dark"]`。

---

## 7. 风险与约束

### 7.1 必须保留的 DOM 结构

重构时以下选择器不能移除或重命名：

- `#search-form`、`#search-input`、`#search-history`
- `<main>`（`router.ts` 系统消息默认挂载点）
- `<a>`（`behavior.ts` 链接点击拦截）
- `.doc-header`、`.container`、`.volume-list`（可能被 `NarrativeDecision.contentModules[].targetSelector` 注入）

### 7.2 必须保留的 Markdown 样式类

内容中直接使用的语义类需继续有效：

- `.handwritten`、`.awakened-insert`、`.system-tag`
- `.transcript-marker`、`.red-text`、`.redacted`
- `.archive-table`、`.archive-note`、`.log-entry`、`.log-date`
- `.cctv-frame`、`.cctv-placeholder`、`.cctv-caption`
- `.system-message`、`.system-message.style-confrontational`

### 7.3 render.ts 改造风险

- `buildBaseWrapper` 被所有模板共用，改动会影响全部内容页。
- 新增 `.page-layout` 与 `<aside>` 需同步到 `buildBaseWrapper`。
- 变体页通过字符串替换 `<main>` 添加 `data-variant`，布局改造后仍需保证可替换。

### 7.4 原型页面

- `public/prototypes/` 与 `prototype-retro.css` 保留为独立沙盒。
- 新设计系统稳定后再决定是否迁移或废弃。

---

## 8. 附录

### 8.1 术语表

- **ARG**：Alternate Reality Game，替代现实游戏。
- **Meta 页**：框架性页面，如首页、关于、访客须知、档案目录。
- **Variant 页**：变体页，基于基础模板生成的觉醒/好奇/共情等异常版本。
- **Token**：设计系统中的颜色、间距、字体等基础变量。

### 8.2 相关文档

- `docs/ui-components.md`：组件规范与 Token 速查
- `docs/ui-migration-plan.md`：分阶段迁移计划与验收清单
- `public/css/style.css`：主样式表
- `src/agent/render.ts`：页面渲染器
- `public/js/frontend.js`：前端入口

---

## 9. 待确认遗留问题

本次 PRD 基于以下已确认决策：

- 暗黑模式不开放手动切换。
- 首页 24 卷采用表格目录形式。
- 原型页面保留为独立沙盒，暂不迁移。

后续阶段实施前，如遇到涉及叙事节奏或异常触发时机的设计决策，将单独与用户确认。
