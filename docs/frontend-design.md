# 白鹿疗养院 · 前端设计文档

> 版本：v1.0
> 日期：2026-06-05
> 前端运行时：纯 JavaScript（由 TypeScript 编译输出）

---

## 一、模块架构

```
src/
├── main.ts           # 规则检测 + 视觉异常 + 控制台彩蛋
├── search.ts         # 搜索系统 + 关键词索引
├── behavior.ts       # 行为签名收集器
├── router.ts         # 路由执行引擎
├── llm-bridge.ts     # Agent 桥接层
├── player-history.ts # 玩家历史记录
└── types.ts          # 前端类型定义
```

### 1.1 模块职责

| 模块 | 输入 | 输出 | 职责 |
|------|------|------|------|
| `behavior.ts` | DOM 事件 | 行为签名 JSON | 收集页面访问、搜索、复制、滚动等行为 |
| `search.ts` | 用户输入关键词 | 目标页面 URL | 精确路由：关键词 → 页面 |
| `main.ts` | 页面加载 + DOM | 视觉异常 | 规则检测、异常触发、控制台彩蛋 |
| `llm-bridge.ts` | 行为签名 + 事件 | Agent 决策 JSON | HTTP POST + 降级链 |
| `router.ts` | Agent 决策 | DOM 修改/页面跳转 | 执行路由、注入内容、触发异常 |
| `player-history.ts` | 行为签名 | localStorage 读写 | 持久化玩家历史 |

### 1.2 模块依赖关系

```
behavior.ts ←── DOM 事件（页面访问、搜索、复制、滚动）
    ↓
llm-bridge.ts ←── 行为签名 + 事件类型
    ↓ (HTTP POST /api/narrative)
router.ts ←── NarrativeDecision JSON
    ↓
main.ts ←── 路由执行 + 异常触发
    ↓
search.ts ←── 用户搜索输入
```

---

## 二、核心数据流

### 2.1 单次页面加载完整流程

```
1. 玩家打开 /pages/volume-04.html
        ↓
2. behavior.ts: recordPageVisit() — 记录页面访问
        ↓
3. main.ts: DOMContentLoaded
   ├── 初始化搜索框异常注入
   ├── 初始化页码闪烁检测
   ├── 初始化内容偏移
   └── 初始化滚动隐藏文字
        ↓
4. llm-bridge.ts: evaluate()
   ├── 收集当前行为签名
   ├── HTTP POST localhost:3456/api/narrative
   ├── 等待 Agent 响应（1-3秒）
   └── 降级链：L1 → L2 → L3 → L4
        ↓
5. router.ts: executeDecision()
   ├── routeDecision: 重定向？注入？保持？
   ├── systemMessage: 在页面插入消息
   ├── contentModules: 动态注入 HTML 模块
   └── 异常触发
        ↓
6. 玩家看到个性化后的页面
```

### 2.2 预取策略（零延迟体验）

Agent 调用有 1-3 秒延迟，不能阻塞页面渲染。

```
页面加载 ──→ 立即渲染基础页面（玩家无感知）
     │
     └──→ 5秒后静默调用 Agent（prefetch）
              ↓
         缓存到 window.__bailu_prefetch_state
              ↓
         下次事件触发时直接使用缓存
```

---

## 三、行为签名系统（behavior.ts）

### 3.1 签名数据结构

```typescript
// shared/types.ts — 跨前后端共享
interface PlayerSignature {
  sessionId: string;
  startTime: number;
  lastActiveTime: number;
  pagesVisited: PageVisit[];
  searches: SearchRecord[];
  anomaliesTriggered: string[];
  ruleViolations: RuleViolation[];
  copies: number;
  totalScrollDepth: number;
  pageCount: number;
  returnVisit: boolean;
  version: number;
}

interface PageVisit {
  url: string;
  title: string;
  firstVisit: number;
  lastVisit: number;
  visitCount: number;
  dwellTime: number;
  maxScrollDepth: number;
}

interface SearchRecord {
  query: string;
  timestamp: number;
  pageUrl: string;
}

interface RuleViolation {
  ruleId: string;      // "rule_1" ~ "rule_6"
  detail: string;
  timestamp: number;
  pageUrl: string;
}
```

### 3.2 自动追踪的事件

| 事件 | 追踪方式 | 存储位置 |
|------|---------|---------|
| 页面访问 | `DOMContentLoaded` 时记录 | `pagesVisited[]` |
| 搜索 | `search.ts` 调用时记录 | `searches[]` |
| 复制 | `document.addEventListener('copy')` | `copies` |
| 滚动深度 | `window.addEventListener('scroll')` | `totalScrollDepth`, `maxScrollDepth` |
| 停留时间 | `setInterval` 每 5 秒更新 | `dwellTime` |
| 规则违反 | `main.ts` 各规则检测触发 | `ruleViolations[]` |
| 异常触发 | 各异常函数调用时 | `anomaliesTriggered[]` |

### 3.3 API 暴露

```typescript
// behavior.ts 暴露的全局对象
window.BaiLuBehavior = {
  getSignature: () => PlayerSignature,
  getSummary: () => BehaviorSummary,
  recordSearch: (query: string) => void,
  recordAnomaly: (anomalyId: string) => void,
  recordRuleViolation: (ruleId: string, detail: string) => void,
  recordCopy: () => void,
  getPhase: () => string,
  reset: () => void,
};
```

---

## 四、搜索系统（search.ts）

### 4.1 索引结构

```typescript
const SEARCH_INDEX: Record<string, SearchEntry> = {
  // === 公开关键词 ===
  "入院": { page: "volume-01", tier: "public" },
  "内科": { page: "volume-02", tier: "public" },
  "精神科": { page: "volume-04", tier: "public" },
  "护理": { page: "volume-05", tier: "public" },
  "药房": { page: "volume-06", tier: "public" },
  "临终": { page: "volume-07", tier: "public" },
  "林素琴": { page: "supplement-lin", tier: "public" },
  "监控": { page: "security-cctv", tier: "public" },
  "停电": { page: "power-outage", tier: "public" },

  // === 隐藏关键词（Agent 路由）===
  "4楼": {
    type: "agent-routed",
    candidates: ["volume-04", "volume-08", "supplement-lin"],
    tier: "hidden",
  },
  "404": {
    type: "agent-routed",
    candidates: ["volume-04", "supplement-lin"],
    tier: "hidden",
  },
  "体温": {
    type: "agent-routed",
    candidates: ["volume-05", "volume-18"],
    tier: "hidden",
  },
  "多出来": {
    type: "agent-routed",
    candidates: ["volume-09", "food-supply", "security-cctv"],
    tier: "hidden",
  },
  "2:47": {
    type: "agent-routed",
    candidates: ["volume-10", "security-cctv"],
    tier: "hidden",
  },
  "集体癔症": {
    type: "agent-routed",
    candidates: ["volume-04", "volume-18", "volume-19"],
    tier: "hidden",
  },
  "不像自己": {
    type: "agent-routed",
    candidates: ["volume-17", "volume-21"],
    tier: "hidden",
  },
  "第七本": {
    type: "agent-routed",
    candidates: ["supplement-lin", "lin-note-7"],
    tier: "hidden",
  },
  "给药": {
    type: "agent-routed",
    candidates: ["volume-06", "pharmacy-log"],
    tier: "hidden",
  },
  "零": {
    type: "agent-routed",
    candidates: ["volume-00"],
    tier: "hidden",
  },
  "规则": {
    type: "agent-routed",
    candidates: ["notice", "volume-00"],
    tier: "hidden",
  },
  "不对劲": {
    type: "agent-routed",
    candidates: ["supplement-lin", "volume-04-awakened"],
    tier: "hidden",
  },
  "镜子": {
    type: "agent-routed",
    candidates: ["mirror"],
    tier: "hidden",
  },
  "融合": {
    type: "agent-routed",
    candidates: ["ending-awakened"],
    tier: "hidden",
  },
  "理解": {
    type: "agent-routed",
    candidates: ["ending-empath"],
    tier: "hidden",
  },
  "真相": {
    type: "agent-routed",
    candidates: ["ending-curious"],
    tier: "hidden",
  },
};
```

### 4.2 路由逻辑

```typescript
function resolveSearch(keyword: string): string | null {
  const entry = SEARCH_INDEX[keyword];
  if (!entry) return null;

  // 公开关键词：直接路由
  if (entry.tier === "public") return entry.page;

  // 隐藏关键词：查询 Agent 覆盖
  const overrides = getSearchOverrides();
  if (overrides?.[keyword]) return overrides[keyword];

  // 条件回退：玩家需已访问过 candidates 中至少一个
  const sig = window.BaiLuBehavior?.getSignature();
  const visited = sig?.pagesVisited.map(p => extractPageId(p.url)) || [];
  const hasVisitedAny = entry.candidates.some(c => visited.includes(c));

  if (hasVisitedAny) return entry.candidates[0];
  return null; // 条件不满足 → 空结果页
}
```

### 4.3 暴露 API

```typescript
window.BaiLuSearch = {
  handleSearch: (keyword: string) => void,
  resolveSearch: (keyword: string) => string | null,
  getIndex: () => SEARCH_INDEX,
};
```

---

## 五、异常系统（main.ts）

### 5.1 异常清单

| 异常 ID | 触发条件 | 效果 | 实现 |
|---------|---------|------|------|
| `anom-search-inject` | visitCount >= 3, random < 0.15 | 搜索框 placeholder 变成隐藏关键词 | `maybeInjectSearch()` |
| `anom-page-number` | random < 0.01 | 页码短暂闪烁（如 15/24 → 00/24 → 15/24） | `maybeGlitchPageNumber()` |
| `anom-content-shift` | copies >= 3 | 复制某段落时，粘贴内容多出前缀/后缀 | `handleCopyWithShift()` |
| `anom-scroll-depth` | scroll > 80% | 页面底部出现隐藏段落，淡入 | `maybeInitScrollDepthAnomaly()` |
| `anom-red-text` | rule_2 触发后 | 随机段落中短暂出现红色文字，5秒后消失 | `triggerRedTextAnomaly()` |
| `anom-timeout` | 单页停留 > 10 分钟 | 页脚颜色渐变暗红 | `checkPageTimeout()` |
| `anom-console` | 页面加载即触发 | 控制台输出隐藏信息 | 页面加载时执行 |
| `anom-title-breath` | 变体页特定 | 浏览器标签页标题缓慢变化 | 变体页内联 JS |

### 5.2 异常文案（疗养院主题）

```typescript
// 搜索框注入候选词
const ANOMALY_SEARCH_TERMS = ["4楼", "第七本", "2:47", "不对劲", "多出来"];

// 内容偏移追加文本
const SHIFT_DATA = [
  { suffix: "，患者说看到4楼有人" },
  { suffix: "。不要看镜子。" },
  { suffix: "（此记录于2015年后补入，来源不明）" },
  { prefix: "【系统批注】", suffix: "" },
];

// 滚动隐藏文本
const HIDDEN_TEXTS = [
  "你看到了这里。大多数研究者不会翻到这一页。",
  "继续滚动。还有。",
  "此页下方另有批注，然字迹为红色，系统无法识别。",
  "（该记录于2015年后补入，录入者未署名。）",
];

// 控制台输出
console.log("%c白鹿疗养院病历数字化项目", "font-size: 20px; color: #2c5f2d;");
console.log("%c系统运行正常。", "color: #666;");
console.log("%c...", "color: #f0f2f5;");
console.log("%c如果你能看到这行字，说明你已经比大多数研究者走得更远了。", "color: #c8cdd5; font-size: 10px;");
```

### 5.3 规则检测

```typescript
// 规则 1：访问卷零
if (location.href.includes("volume-00")) {
  recordViolation("rule_1", "访问了卷零页面");
}

// 规则 2：注视红字
const redElements = document.querySelectorAll(".red-text, .redacted");
redElements.forEach(el => {
  el.addEventListener("mouseenter", startRedWatch);
  el.addEventListener("mouseleave", stopRedWatch);
});

// 规则 3：搜索注入内容
searchForm.addEventListener("submit", (e) => {
  const injected = searchInput.dataset.injected;
  if (injected && query === injected) {
    recordViolation("rule_3", "搜索了注入的关键词：" + injected);
  }
});

// 规则 4：单页超时
setInterval(checkPageTimeout, 60000);

// 规则 5：高频访问（在 behavior.ts 中检测）

// 规则 6：发现须知矛盾
function initNoticeAnomaly() {
  let dwellTime = 0;
  let maxScroll = 0;
  // 停留 12 秒 + 滚动 40% → 触发
}
```

---

## 六、LLM 桥接层（llm-bridge.ts）

### 6.1 四级降级链

```typescript
async function evaluate(event: GameEvent): Promise<NarrativeDecision | null> {
  const signature = window.BaiLuBehavior.getSignature();

  // L1: Agent 决策
  try {
    const response = await fetch("http://localhost:3456/api/narrative", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: signature.sessionId, event, signature }),
      signal: AbortSignal.timeout(5000),
    });
    if (response.ok) {
      const decision = await response.json();
      cacheDecision(decision);
      return decision;
    }
  } catch {
    // 降级
  }

  // L2: 缓存决策
  const cached = getCachedDecision();
  if (cached) return cached;

  // L3: 规则引擎降级
  return ruleEngineEvaluate(event, signature);
}
```

### 6.2 规则引擎降级（L3）

```typescript
function ruleEngineEvaluate(event: GameEvent, signature: PlayerSignature): NarrativeDecision {
  const violations = signature.ruleViolations.length;
  const hiddenSearches = signature.searches.filter(s =>
    ["4楼", "404", "体温", "多出来", "2:47", "集体癔症"].includes(s.query)
  );

  return {
    version: "narrative-v2",
    routeDecision: { action: "stay" },
    systemMessage: violations > 0
      ? { text: "系统记录了。", style: "observational" }
      : hiddenSearches.length > 0
      ? { text: "你找到了不该找到的东西。", style: "observational" }
      : undefined,
    contentModules: [],
    memoryUpdate: {
      relationshipStage: violations > 2 ? "noticed" : "unknown",
      understandingDepth: Math.min(violations * 10, 100),
      observedPatterns: [],
      notes: "L3 降级决策。",
    },
  };
}
```

---

## 七、路由执行引擎（router.ts）

### 7.1 决策执行

```typescript
function executeDecision(decision: NarrativeDecision) {
  const { routeDecision, systemMessage, contentModules } = decision;

  // 1. 路由决策
  if (routeDecision.action === "redirect" && routeDecision.targetPage) {
    const prefix = location.pathname.includes("/pages/") ? "" : "pages/";
    location.href = prefix + routeDecision.targetPage + ".html";
    return;
  }

  // 2. 系统消息注入
  if (systemMessage?.text) {
    injectSystemMessage(systemMessage);
  }

  // 3. 内容模块注入
  contentModules.forEach(module => {
    injectContentModule(module);
  });
}

function injectSystemMessage(msg: SystemMessage) {
  const container = document.querySelector("main") || document.body;
  const el = document.createElement("div");
  el.className = `system-message style-${msg.style}`;
  el.textContent = msg.text;
  container.appendChild(el);
}

function injectContentModule(module: ContentModuleRef) {
  const target = document.querySelector(module.targetSelector);
  if (!target) return;

  // 从变体页或预注册模块中加载 HTML
  const html = loadModuleHtml(module.moduleId);
  const temp = document.createElement("div");
  temp.innerHTML = html;

  if (module.position === "after") {
    target.parentNode?.insertBefore(temp, target.nextSibling);
  } else {
    target.parentNode?.insertBefore(temp, target);
  }
}
```

### 7.2 内容模块加载策略

```typescript
function loadModuleHtml(moduleId: string): string {
  // 方案 1：预注册（内联在 JS 中）
  const registry = window.__bailu_module_registry || {};
  if (registry[moduleId]) return registry[moduleId];

  // 方案 2：从变体页 fetch（异步）
  // 返回占位符，由后续异步加载替换
  return `<div data-module-id="${moduleId}" class="module-loading"></div>`;
}
```

---

## 八、CSS 设计

### 8.1 变量定义

```css
:root {
  --bg-color: #f0f2f5;           /* 医院白墙灰蓝 */
  --text-color: #1a1a2e;          /* 深色文字 */
  --accent-color: #2c5f2d;        /* 医疗绿 */
  --border-color: #c8cdd5;        /* 冷淡灰 */
  --header-bg: #e8ecf1;           /* 浅灰 */
  --link-color: #1e4d6b;          /* 医疗蓝 */
  --link-hover: #2c5f2d;          /* 医疗绿 */
  --red-text: #b22222;            /* 异常红 */
}
```

### 8.2 卷零反色主题

```css
/* volume-00.html 内联样式 */
body.dark-theme {
  background: #0f1419;
  color: #c8cdd5;
  --accent-color: #8b6b4a;
  --border-color: #3a3530;
}
```

### 8.3 异常样式

```css
.red-text {
  color: var(--red-text) !important;
}

.awakened-insert {
  border-left: 3px solid var(--red-text);
  padding-left: 1.5em;
  margin: 1.5em 0 1.5em 2em;
  color: #8b2222;
  font-style: italic;
  background: rgba(178, 34, 34, 0.03);
}

.system-message {
  padding: 1em;
  margin: 1em 0;
  border-left: 3px solid var(--accent-color);
  background: rgba(44, 95, 45, 0.05);
}

.system-message.style-confrontational {
  border-left-color: var(--red-text);
  background: rgba(178, 34, 34, 0.05);
}

.scroll-hidden-text {
  opacity: 0;
  transition: opacity 2s ease;
  margin-top: 3em;
  font-style: italic;
  color: #8b7355;
}

@keyframes subtle-flicker {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.97; }
}
```

---

## 九、命名空间替换清单

从槐安镇志迁移到白鹿疗养院的全局替换：

| 原标识 | 新标识 |
|--------|--------|
| `HuaianBehavior` | `BaiLuBehavior` |
| `HuaianSearch` | `BaiLuSearch` |
| `HuaianLLM` | `BaiLuLLM` |
| `HuaianPlayerHistory` | `BaiLuPlayerHistory` |
| `huaian_visit_count` | `bailu_visit_count` |
| `huaian_behavior_signature` | `bailu_behavior_signature` |
| `__huaian_search_overrides` | `__bailu_search_overrides` |
| `__huaian_prefetch_state` | `__bailu_prefetch_state` |
| `__huaian_last_phase` | `__bailu_last_phase` |
| `__huaian_session_id` | `__bailu_session_id` |
| `huaian-archivist.md` | `baiLu-nurse.md` |
| `huaian-data` | `baiLu-data` |

---

## 十、页面模板变量

HTML 模板中可用的变量（由 build-pages.ts 注入）：

| 变量 | 来源 | 示例 |
|------|------|------|
| `{{id}}` | frontmatter.id | `volume-04` |
| `{{title}}` | frontmatter.title | `卷四 · 精神科评估志` |
| `{{page_num}}` | frontmatter.page_num | `10/24` |
| `{{content}}` | Markdown → HTML | 正文 HTML |
| `{{author}}` | frontmatter.author | `林素琴` |
| `{{year}}` | frontmatter.year | `2005–2010` |
| `{{subtitle}}` | frontmatter.subtitle | `精神科评估志` |
| `{{department}}` | frontmatter.department | `精神科` |
| `{{source}}` | frontmatter.source | `市第三人民医院药房` |
