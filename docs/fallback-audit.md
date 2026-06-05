# Fallback 兜底机制审计文档

> 生成时间：2026-06-05
> 规则引用：CLAUDE.md — "不允许加入任何的fallback兜底"

本文档按文件整理项目中所有的 fallback 机制，分为 **LLM 失败兜底**、**数据持久化兜底**、**外部服务兜底**、**UI/DOM 兜底**、**Logger 兜底**、**决策映射兜底** 六类。

---

## 1. LLM 失败兜底

### `src/agent/agent.ts`

#### `getFallbackDecision()` — 硬编码降级决策（第 284–305 行）

当 LLM 完全不可用时，返回一个预制的 `NarrativeDecision`：

- `routeDecision.action` 固定为 `"stay"`
- `systemMessage` 仅在 violations > 0 时出现，固定文本 `"系统记录了。"`
- `memoryUpdate.relationshipStage` 根据 violations 数量硬编码为 `"noticed"` 或 `"unknown"`
- `memoryUpdate.notes` 固定为 `"降级模式：无 Agent 响应。"`

```typescript
function getFallbackDecision(signature: PlayerSignature): NarrativeDecision {
  const violations = signature.ruleViolations.length;
  const searches = signature.searches.length;

  return {
    version: "narrative-v2",
    routeDecision: { action: "stay" },
    systemMessage:
      violations > 0
        ? { text: "系统记录了。", style: "observational" }
        : undefined,
    contentModules: [],
    memoryUpdate: {
      relationshipStage: violations > 2 ? "noticed" : "unknown",
      understandingDepth: Math.min(violations * 10 + searches * 5, 100),
      observedPatterns: [],
      notes: "降级模式：无 Agent 响应。",
    },
  };
}
```

#### `evaluateWithFallback()` — 错误捕获兜底（第 480–494 行）

`evaluate()` 的包装器。任何异常（LLM 超时、网络错误、prompt 构建失败等）都被捕获，静默返回 `getFallbackDecision()`。

```typescript
async evaluateWithFallback(
  sessionId: string,
  event: GameEvent,
  signature: PlayerSignature
): Promise<NarrativeDecision> {
  try {
    return await this.evaluate(sessionId, event, signature);
  } catch (error) {
    this.logger.error("evaluate.failed", { ... });
    return getFallbackDecision(signature);
  }
}
```

**调用点：**
- `src/agent/server.ts:217` — HTTP 请求处理
- `src/agent/run.ts:37` — 独立测试脚本

#### `sanitizeDecision()` — 无效响应清洗（第 333–388 行）

当 LLM 返回的决策不符合 TypeBox Schema 时，不拒绝而是**清洗修复**：

- 非法 `style` → 回退到 `"observational"`
- 非法 `action` → 回退到 `"stay"`
- 非法 `version` → 回退到 `"narrative-v2"`
- `understandingDepth` 越界 → 钳制到 `[0, 100]`
- `contentModules` 非数组 → 回退到 `[]`

```typescript
const style = raw.systemMessage?.style && validStyles.includes(...)
  ? raw.systemMessage.style
  : "observational";

const action = validActions.includes(raw.routeDecision.action)
  ? raw.routeDecision.action
  : "stay";
```

#### `extractDecisionFromToolCalls()` — Schema 失败兜底（第 318–322 行）

```typescript
if (!Check(NarrativeDecisionSchema, raw)) {
  logger.warn("llm.invalid_schema", { ... });
  return sanitizeDecision(raw, logger);   // ← 不 throw，而是清洗
}
```

#### `clampMessageText()` — 消息长度截断（第 149–165 行）

LLM 返回超过 3 句话的消息时，直接截断取前 3 句，而非拒绝或要求重试。

```typescript
if (sentences.length <= 3) return decision;

return {
  ...decision,
  systemMessage: {
    ...decision.systemMessage,
    text: sentences.slice(0, 3).join("。") + "。",
  },
};
```

#### `clampStage()` — 阶段回退保护（第 265–280 行）

LLM 返回的阶段如果比当前阶段更低（如从 `"noticed"` 回退到 `"unknown"`），强制回退到当前阶段。这是一种单向阀兜底。

```typescript
if (proposedIdx < currentIdx) return current as (typeof STAGE_ORDER)[number];
```

---

## 2. 数据持久化兜底

### `src/behavior.ts`

#### `loadSignature()` — localStorage 解析失败兜底（第 32–47 行）

```typescript
function loadSignature(): PlayerSignature {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored) {
    try {
      const parsed = JSON.parse(stored)
      if (isValidSignature(parsed)) {
        parsed.returnVisit = true
        parsed.lastActiveTime = Date.now()
        return parsed
      }
    } catch {
      // ignore parse error
    }
  }
  return createFreshSignature()   // ← 解析失败或校验失败 → 全新签名
}
```

#### `createFreshSignature()` — 默认签名（第 14–30 行）

当 localStorage 为空或损坏时，生成一个全零/全新的签名：

```typescript
function createFreshSignature(): PlayerSignature {
  return {
    sessionId: generateSessionId(),
    startTime: now,
    lastActiveTime: now,
    pagesVisited: [],
    searches: [],
    anomaliesTriggered: [],
    ruleViolations: [],
    copies: 0,
    totalScrollDepth: 0,
    pageCount: 0,
    returnVisit: false,
    version: 1,
  }
}
```

**调用点：**
- `loadSignature()` 解析失败时
- `reset()` 重置时（第 205 行）

### `src/player-history.ts`

#### `loadHistory()` — localStorage 解析失败兜底（第 41–54 行）

与 `loadSignature()` 模式完全一致：

```typescript
function loadHistory(): PlayerHistoryData {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored) {
    try {
      const parsed = JSON.parse(stored)
      if (isValidHistory(parsed)) {
        return parsed
      }
    } catch {
      // ignore parse error
    }
  }
  return createFreshHistory()
}
```

#### `createFreshHistory()` — 默认历史（第 34–39 行）

```typescript
function createFreshHistory(): PlayerHistoryData {
  return { events: [], sessions: [] }
}
```

**调用点：**
- `loadHistory()` 解析失败时
- `clearHistory()` 重置时（第 116 行）

### `src/agent/store.ts`

#### `createDefaultMemory()` — 默认记忆（第 145–154 行）

新玩家无历史记忆文件时创建的默认记忆：

```typescript
createDefaultMemory(): Memory {
  return {
    relationshipStage: "unknown",
    understandingDepth: 0,
    observedPatterns: [],
    messagesSent: [],
    decisions: [],
    notes: "新玩家，尚无印象。",
  };
}
```

**调用点：** `create()` 方法（第 102 行）

#### `exists()` — 文件检查失败兜底（第 91–99 行）

```typescript
async exists(sessionId: string): Promise<boolean> {
  const filePath = path.join(this.dataDir, `${sessionId}.json`);
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;   // ← 任何错误都当作"文件不存在"
  }
}
```

---

## 3. 外部服务兜底

### `src/llm-bridge.ts`

#### `evaluate()` — API 调用全静默失败（第 17–37 行）

前端到叙事 agent 的桥梁。任何失败（网络、超时、非 200、JSON 解析错误）都返回 `null`：

```typescript
async function evaluate(event: GameEvent): Promise<NarrativeDecision | null> {
  const signature = window.BaiLuBehavior?.getSignature()
  if (!signature) return null

  try {
    const response = await fetch(API_URL, { ... })
    if (!response.ok) return null          // ← HTTP 错误
    const decision = await response.json()
    return decision
  } catch {
    return null                             // ← 网络/超时/解析错误
  }
}
```

#### `prefetch()` — 预取静默失败（第 39–58 行）

与 `evaluate()` 相同模式，但连返回值都没有，错误被完全吞掉：

```typescript
} catch {
  // prefetch failures are silent
}
```

### `src/agent/server.ts`

#### `PORT` — 环境变量缺失兜底（第 11 行）

```typescript
const PORT = Number(process.env.NARRATIVE_PORT) || 3724;
```

---

## 4. UI / DOM 兜底

### `src/router.ts`

#### `injectSystemMessage()` — 容器缺失兜底（第 21–27 行）

```typescript
const container = document.querySelector('main') || document.body
```

如果 `<main>` 不存在，回退到 `<body>` 注入系统消息。

#### `loadModuleHtml()` — 模块未注册兜底（第 44–49 行）

```typescript
export function loadModuleHtml(moduleId: string): string {
  const registry = ...
  if (registry?.[moduleId]) return registry[moduleId]

  return `<div data-module-id="${moduleId}" class="module-loading"></div>`
}
```

模块未注册时不报错，返回一个空的 loading placeholder。

#### `injectContentModule()` — DOM 目标缺失（第 29–42 行）

```typescript
const target = document.querySelector(module.targetSelector)
if (!target || !target.parentNode) return   // ← 静默跳过
```

### `src/search.ts`

#### `extractPageId()` — URL 匹配失败兜底（第 47–50 行）

```typescript
function extractPageId(url: string): string {
  const match = url.match(/\/pages\/(\S+)/)
  return match ? match[1] : url   // ← 不匹配则返回原始 URL
}
```

#### `resolveSearch()` — 搜索未命中兜底（第 56–71 行）

```typescript
function resolveSearch(keyword: string): string | null {
  const entry = SEARCH_INDEX[keyword]
  if (!entry) return null                     // ← 关键词不存在

  const visited = sig?.pagesVisited.map(...) || []   // ← signature 缺失 → 空数组

  if (hasVisitedAny) return entry.candidates[0]
  return null                                 // ← 未访问过候选页面
}
```

### `src/main.ts`

多处 DOM 元素检查后的静默返回：

```typescript
if (!sig) return                              // 第 16 行
if (!searchInput) return                      // 第 23 行
if (!sig || sig.pagesVisited.length === 0) return   // 第 41 行
if (!searchForm || !searchInput) return       // 第 60 行
```

---

## 5. Logger 兜底

### `src/agent/agent.ts`

#### 构造函数 Logger 缺失兜底（第 402–405 行）

```typescript
constructor(logger?: Logger) {
  this.store = new MemoryStore("./baiLu-data/players", logger);
  this.logger = logger ?? noopLogger;   // ← 无 logger → 静默
}
```

### `src/agent/store.ts`

#### 构造函数 Logger 缺失兜底（第 78–81 行）

```typescript
constructor(dataDir = "./baiLu-data/players", logger?: Logger) {
  this.dataDir = dataDir;
  this.logger = logger ?? { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} };
}
```

### `src/agent/logger.ts`

#### `noopLogger` — 显式空实现（第 45–50 行）

```typescript
export const noopLogger: Logger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
};
```

---

## 6. 决策映射兜底

### `src/agent/server.ts`

#### `adaptDecision()` — 未知枚举值兜底（第 148–173 行）

前端与 agent 的决策格式转换器。遇到未知 action/style/position 时回退到默认值：

```typescript
const actionMap: Record<string, string> = {
  stay: "stay",
  redirect: "redirect",
  suggest: "inject",
};

// 第 151 行：未知 action → "stay"
action: actionMap[decision.routeDecision.action] || "stay",

// 第 158 行：未知 style → 原样透传（但 map 未命中时透传可能也是无效的）
styleMap[decision.systemMessage.style] || decision.systemMessage.style,

// 第 165 行：未知 position → 原样透传
positionMap[m.position] || m.position,
```

`styleMap` 和 `positionMap` 的 fallback 行为：

```typescript
const styleMap: Record<string, string> = {
  observational: "observational",
  intimate: "observational",        // ← "intimate" 被映射降级为 "observational"
  confrontational: "confrontational",
  invitational: "whisper",          // ← "invitational" 被映射降级为 "whisper"
};

const positionMap: Record<string, string> = {
  before: "before",
  after: "after",
  replace: "after",                 // ← "replace" 被映射降级为 "after"
};
```

---

## 汇总表

| 文件 | 函数/变量 | 兜底行为 | 严重度 |
|------|----------|---------|--------|
| `src/agent/agent.ts` | `getFallbackDecision()` | LLM 完全不可用时返回硬编码决策 | 高 |
| `src/agent/agent.ts` | `evaluateWithFallback()` | 捕获所有异常，返回硬编码决策 | 高 |
| `src/agent/agent.ts` | `sanitizeDecision()` | 清洗非法 LLM 响应，回退默认值 | 高 |
| `src/agent/agent.ts` | `extractDecisionFromToolCalls()` | Schema 校验失败时调用 sanitize | 高 |
| `src/agent/agent.ts` | `clampMessageText()` | 超长消息截断为 3 句 | 中 |
| `src/agent/agent.ts` | `clampStage()` | 阶段回退时强制保持当前阶段 | 低 |
| `src/behavior.ts` | `loadSignature()` | localStorage 损坏 → 全新签名 | 中 |
| `src/behavior.ts` | `createFreshSignature()` | 生成默认空签名 | 低 |
| `src/player-history.ts` | `loadHistory()` | localStorage 损坏 → 全新历史 | 中 |
| `src/player-history.ts` | `createFreshHistory()` | 生成默认空历史 | 低 |
| `src/agent/store.ts` | `createDefaultMemory()` | 新玩家默认记忆 | 低 |
| `src/agent/store.ts` | `exists()` | 文件检查错误 → false | 低 |
| `src/llm-bridge.ts` | `evaluate()` | API 任何错误 → null | 高 |
| `src/llm-bridge.ts` | `prefetch()` | 预取错误 → 静默忽略 | 中 |
| `src/agent/server.ts` | `PORT` | 环境变量缺失 → 3724 | 低 |
| `src/router.ts` | `injectSystemMessage()` | 无 `<main>` → `<body>` | 低 |
| `src/router.ts` | `loadModuleHtml()` | 模块未注册 → placeholder | 中 |
| `src/router.ts` | `injectContentModule()` | DOM 目标缺失 → 静默跳过 | 低 |
| `src/search.ts` | `extractPageId()` | URL 不匹配 → 原样返回 | 低 |
| `src/search.ts` | `resolveSearch()` | 关键词不存在 → null | 低 |
| `src/agent/server.ts` | `adaptDecision()` | 未知 action → "stay" | 中 |
| `src/agent/server.ts` | `adaptDecision()` | 未知 style/position → 透传 | 中 |
| `src/agent/agent.ts` | `constructor` | 无 logger → noopLogger | 低 |
| `src/agent/store.ts` | `constructor` | 无 logger → 空实现 | 低 |
| `src/agent/logger.ts` | `noopLogger` | 显式空 logger | 低 |

---

## 按严重度排序

### 🔴 高严重度（影响叙事一致性或掩盖关键错误）

1. **`evaluateWithFallback()` + `getFallbackDecision()`** — LLM 失败时返回完全不同的叙事逻辑，玩家体验断裂
2. **`sanitizeDecision()` + `extractDecisionFromToolCalls()`** — LLM 返回非法数据时不拒绝，而是伪造一个"看起来合法"的决策
3. **`llm-bridge.ts evaluate()`** — 前端完全无法区分"网络断开"和"agent 返回 null"

### 🟡 中严重度（可能导致状态丢失或行为偏离）

4. **`loadSignature()` / `loadHistory()`** — 数据损坏时丢失玩家全部历史
5. **`llm-bridge.ts prefetch()`** — 静默忽略预取失败，可能导致缓存不一致
6. **`adaptDecision()`** — 映射降级可能丢失前端不支持的决策语义（如 `"replace"` → `"after"`）
7. **`loadModuleHtml()`** — 模块未注册时返回 placeholder，玩家看到空白区域
8. **`clampMessageText()`** — 截断可能破坏叙事完整性

### 🟢 低严重度（防御性编程，风险可控）

9. `clampStage()` — 阶段不回退是设计需求
10. `createFreshSignature()` / `createFreshHistory()` / `createDefaultMemory()` — 首次访问的默认值
11. `exists()` — 文件系统错误的合理降级
12. `PORT` — 默认端口
13. `injectSystemMessage()` — DOM 容器回退
14. `injectContentModule()` — DOM 目标缺失跳过
15. Logger 相关 fallback — 无日志输出
16. `resolveSearch()` / `extractPageId()` — 搜索系统的正常边界行为
