# 白鹿疗养院 · 项目级 E2E 测试 Agents PRD

> 版本：v1.0
> 日期：2026-06-07
> 目标：用 pi-agent 驱动 Playwright，对全站进行自动化叙事一致性审计

---

## 一、背景与问题

当前项目已有：
- 24 卷正编病历 + 补遗 + 外围档案 + 变体页 + Meta 页
- 6 条规则怪谈及对应的前端检测逻辑
- 公开/隐藏双层搜索索引
- 基于 pi-agent-core 的叙事 Agent（NarrativeDirector）
- `docs/fallback-audit.md` 中列出的数十个兜底问题

但缺少一个**系统性的端到端验证层**。手动点击无法覆盖：
- 所有页面的 404/500
- 跨页面的叙事一致性（卷四提到 4 楼，卷八是否呼应）
- 隐藏关键词在条件满足/不满足时的路由
- 6 条规则是否都被正确触发并记录到签名
- Agent API 对非法输入是否仍然接受（违反「无 fallback」原则）
- 异常注入的概率性效果（搜索框 placeholder、复制偏移等）

---

## 二、产品定位

**E2E 测试 Agents** 不是传统单元测试，而是一组**受 pi-agent 驱动的智能审计员**：

- 它们能阅读 PRD，知道哪些规则、关键词、异常必须存在
- 它们能操作真实浏览器（Playwright），执行点击、搜索、localStorage 修改
- 它们能根据发现动态调整下一步测试策略
- 它们能生成人类可读的审计报告

核心体验公式：

```
LLM 推理能力 × Playwright 精确执行 × 结构化工具调用 = 自动叙事 QA
```

---

## 三、设计原则

### 3.1 与主项目同构

测试 Agents 复用 `NarrativeDirector` 的 pi-agent 范式：
- `Agent` + `AgentTool<TypeBoxSchema>` + `prompt.yaml`
- 工具调用是 Agent 唯一能改变外部状态的方式
- 状态持久化到 `tests/e2e/reports/`

### 3.2 无兜底即失败

测试 Agent 本身也遵循「不允许 fallback 兜底」：
- 页面 404 → 报告 critical，测试失败
- console error → 报告 high，测试失败
- 规则未触发 → 报告 high，测试失败
- Agent API 对非法输入返回 200 并给出默认值 → 报告 critical，测试失败

### 3.3 小文件、高内聚

- 每个 tool 一个文件
- 每个 agent 一种测试职责
- 单文件不超过 500 行

### 3.4 可单独运行

```bash
pnpm test:e2e                    # 全量
pnpm test:e2e -- --agent crawl   # 只跑 CrawlerAgent
pnpm test:e2e -- --agent search  # 只跑 SearchAgent
```

---

## 四、架构设计

### 4.1 运行时架构

```
┌──────────────────────────────────────────────────────────────────────┐
│                         Test Runner (Node.js)                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌──────────────┐ │
│  │ CrawlerAgent│  │ SearchAgent │  │ RulesAgent  │  │ NarrativeApi │ │
│  │   (pi-agent)│  │   (pi-agent)│  │   (pi-agent)│  │    Agent     │ │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬───────┘ │
│         │                │                │                │          │
│  ┌──────┴────────────────┴────────────────┴────────────────┘          │
│  │                    TestDirector                                      │
│  │         (复用 NarrativeDirector 模式：prompt + tools + state)         │
│  └────────────────────────┬───────────────────────────────────────────┘
│                           │ Tool Calls
└───────────────────────────┼───────────────────────────────────────────┘
                            │
┌───────────────────────────┼───────────────────────────────────────────┐
│                    Playwright Browser Context                           │
│    ┌──────────────────────┴──────────────────────┐                      │
│    │  visit_page / search / screenshot / verify   │                      │
│    └──────────────────────┬──────────────────────┘                      │
│                           │ HTTP                                          │
│    ┌──────────────────────┴──────────────────────┐                      │
│    │       白鹿疗养院本地服务 (localhost:3724)    │                      │
│    │         server.ts + agent.ts                │                      │
│    └─────────────────────────────────────────────┘                      │
└─────────────────────────────────────────────────────────────────────────┘
```

### 4.2 目录结构

```
tests/e2e/
├── agent/
│   ├── test-director.ts       # TestDirector：调度 Agent 循环
│   ├── tool-executor.ts       # Playwright 执行器，被各 tool 调用
│   ├── prompt-loader.ts       # 加载 prompts/test-auditor.yaml
│   └── types.ts               # Finding、TestReport 等类型
├── tools/
│   ├── visit-page.ts          # 访问页面并返回结构化的页面状态
│   ├── search-keyword.ts      # 提交搜索关键词
│   ├── verify-element.ts      # DOM/文本断言
│   ├── trigger-anomaly.ts     # 通过 localStorage 强制异常条件
│   ├── extract-links.ts       # 提取页面内链并检测断裂
│   ├── screenshot.ts          # 截图取证
│   ├── report-finding.ts      # 记录问题
│   └── finish-audit.ts        # 结束审计并生成报告
├── prompts/
│   └── test-auditor.yaml      # Agent 身份、测试策略、约束
├── fixtures/
│   ├── page-inventory.ts      # 动态扫描 content/ 生成页面清单
│   ├── keywords.ts            # 公开/隐藏关键词及期望路由
│   ├── signatures.ts          # 各阶段/各违规场景的预制签名
│   └── rules.ts               # 6 条规则定义及触发方式
├── helpers/
│   ├── server.ts              # 启动/停止 make dev 服务
│   └── browser.ts             # Playwright browser/context 单例
├── reports/                   # .gitignore，运行时生成
│   ├── e2e-report.md
│   ├── e2e-report.json
│   └── screenshots/
├── playwright.config.ts
└── run.ts                     # CLI 入口
```

---

## 五、Agent 角色设计

### 5.1 身份

```yaml
identity:
  name: "白鹿疗养院 QA 审计员"
  description: |
    你同时对两件事负责：
    1. 作为一名敏锐的玩家，尝试所有公开和隐藏路径，触发规则与异常；
    2. 作为一名严格的 QA 工程师，验证每个功能是否严格按 PRD 实现。

    你不允许对发现的问题进行粉饰。如果某个功能失败，你必须 report_finding。
    如果测试任务完成，你必须调用 finish_audit 工具输出报告。
```

### 5.2 核心特质

- **不信任表面正常**：首页看起来正常，不代表 archives 差异不存在
- **交叉验证**：卷四提到 4 楼，必须验证搜索「4楼」能到达 volume-04/volume-08/supplement-lin
- **兜底零容忍**：发现任何 silent fallback（404 被忽略、非法输入返回默认值）立即报 critical
- **概率事件可重复**：通过 localStorage 预制签名，让随机异常变成确定性测试

### 5.3 工作流

```
1. Smoke：访问首页、所有 volume、supplement、peripheral、meta、variant
   └─ 发现 404 / console error / 渲染失败 立即报告

2. 链接完整性：提取所有内链，验证不断裂

3. 搜索谜题：遍历公开关键词和隐藏关键词
   └─ 公开词 → 固定页面
   └─ 隐藏词（未访问候选）→ 空结果
   └─ 隐藏词（已访问候选）→ 第一个候选页

4. 规则触发：逐一触发 6 条规则，验证 signature.ruleViolations 被正确记录

5. Agent API 边界测试：向 /api/narrative 发送非法输入
   └─ 阶段回退 → 期望失败/拒绝
   └─ 超长消息 → 期望失败/拒绝（不应截断）
   └─ 非法 action/style → 期望失败/拒绝（不应 fallback 到 stay）

6. Archives 差异验证：比对首页与 archives 页的 7 项差异

7. finish_audit
```

---

## 六、工具定义（TypeBox Schema）

Agent 只能通过调用以下工具与世界交互。

### 6.1 `visit_page`

```typescript
const VisitPageSchema = Type.Object({
  url: Type.String({ description: "要访问的完整 URL 或路径" }),
  waitForAgent: Type.Optional(Type.Boolean({
    description: "是否等待 /api/narrative 调用完成",
    default: true,
  })),
});
```

返回：
```typescript
{
  url: string;
  status: number;
  title: string;
  pageId: string | null;
  hasSearchBox: boolean;
  hasSystemMessage: boolean;
  consoleErrors: string[];
  links: Array<{ href: string; text: string }>;
  loadTimeMs: number;
}
```

### 6.2 `search_keyword`

```typescript
const SearchKeywordSchema = Type.Object({
  keyword: Type.String({ description: "搜索关键词" }),
  pageUrl: Type.String({ description: "从哪个页面发起搜索" }),
});
```

返回：
```typescript
{
  keyword: string;
  resolvedPage: string | null;
  finalUrl: string;
  ruleViolation: string | null;      // 如 "rule_3"
  signatureAfter: PlayerSignature;   // 执行后的签名快照
}
```

### 6.3 `verify_element`

```typescript
const VerifyElementSchema = Type.Object({
  pageUrl: Type.String(),
  selector: Type.String(),
  assertion: Type.Enum(["exists", "not_exists", "contains_text", "has_attribute", "matches_regex"]),
  expected: Type.String(),
});
```

返回 `{ passed: boolean; actual: string; expected: string }`。

### 6.4 `trigger_anomaly`

```typescript
const TriggerAnomalySchema = Type.Object({
  pageUrl: Type.String(),
  mutations: Type.Object({
    visitCount: Type.Optional(Type.Number()),
    copies: Type.Optional(Type.Number()),
    ruleViolations: Type.Optional(Type.Array(Type.String())),
    pagesVisited: Type.Optional(Type.Array(Type.String())),
  }),
});
```

用于把概率性异常变成确定性测试条件。

### 6.5 `extract_links`

```typescript
const ExtractLinksSchema = Type.Object({
  pageUrl: Type.String(),
  scope: Type.Enum(["internal", "external", "all"]),
});
```

返回所有链接及 HTTP HEAD 探测结果。

### 6.6 `screenshot`

```typescript
const ScreenshotSchema = Type.Object({
  pageUrl: Type.String(),
  name: Type.String(),
});
```

保存到 `reports/screenshots/{timestamp}-{name}.png`，返回路径。

### 6.7 `report_finding`

```typescript
const ReportFindingSchema = Type.Object({
  severity: Type.Enum(["critical", "high", "medium", "low"]),
  category: Type.Enum([
    "http_error",           // 404/500
    "console_error",        // 前端 JS 报错
    "narrative_break",      // 叙事不一致（如文案矛盾）
    "rule_undetected",      // 规则触发失败
    "search_misroute",      // 搜索路由错误
    "anomaly_missing",      // 异常未触发
    "fallback_detected",    // 发现 silent fallback
    "content_inconsistency",// 内容不一致
    "performance",          // 加载过慢
  ]),
  page: Type.String(),
  description: Type.String({ maxLength: 200 }),
  reproduction: Type.String(),
});
```

### 6.8 `finish_audit`

```typescript
const FinishAuditSchema = Type.Object({
  summary: Type.String({ maxLength: 500 }),
  criticalCount: Type.Number(),
  highCount: Type.Number(),
  mediumCount: Type.Number(),
  lowCount: Type.Number(),
});
```

调用后 Agent 循环终止，runner 生成 `e2e-report.md`。

---

## 七、Agent 类型与覆盖矩阵

| Agent | 职责 | pi-agent 作用 | Playwright 作用 |
|-------|------|--------------|-----------------|
| **CrawlerAgent** | 遍历全站，发现 404 / console error / 渲染失败 | 决定下一个访问哪个页面，根据返回的 links 动态爬行 | 打开真实浏览器，执行 JS，收集 console |
| **SearchAgent** | 验证搜索索引 | 根据关键词表决定测试顺序，分析路由结果 | 在搜索框输入并提交，观察跳转 |
| **RulesAgent** | 触发并验证 6 条规则 | 规划规则触发路径，分析 signature 变化 | 模拟玩家行为（访问卷零、注视红字、搜索注入词等） |
| **NarrativeApiAgent** | 直接测试 `/api/narrative` | 构造异常输入组合，分析响应是否符合预期 | 发起 fetch POST，读取响应 JSON |
| **AnomalyAgent** | 强制触发概率异常 | 决定注入什么签名条件 | 修改 localStorage，断言 DOM 变化 |
| **ArchivesAgent** | 验证 archives 与首页的 7 项差异 | 提取差异 checklist，逐项 verify | 访问两页并截图比对 |

**Phase 1 实现 CrawlerAgent、SearchAgent、NarrativeApiAgent 三个核心 Agent。**

---

## 八、Prompt 策略

### 8.1 System Prompt 核心指令

```
你是白鹿疗养院的 QA 审计员。你的目标是发现项目中任何与 PRD 不符的地方。

你必须遵守以下纪律：
1. 永远不要假设某个功能“应该没问题”。你必须调用工具验证。
2. 发现任何问题，立即调用 report_finding，不要只在回复里描述。
3. 不允许对失败进行粉饰。如果某个页面 404，severity 必须是 critical。
4. 阶段不可回退、消息超长应拒绝、非法 action 应拒绝——这些都是“无 fallback”规则的一部分。
5. 完成全部任务后，必须调用 finish_audit。

你可以使用的工具：visit_page, search_keyword, verify_element, trigger_anomaly,
extract_links, screenshot, report_finding, finish_audit。
```

### 8.2 动态上下文注入

每次 prompt 时，runner 会把以下信息注入 user prompt：
- 当前已访问页面列表
- 已发现的 finding 列表（避免重复报告）
- 从 `content/` 扫描出的页面清单
- PRD 中的关键词表

---

## 九、报告格式

### 9.1 Markdown 报告 (`reports/e2e-report.md`)

```markdown
# 白鹿疗养院 E2E 审计报告

- 运行时间：2026-06-07 14:32:00
- 测试页面数：47
- 发现问题：3 critical / 1 high / 0 medium / 2 low

## 关键发现

### [CRITICAL] /pages/volume-00.html 返回 404
- 类别：http_error
- 复现：直接访问 http://localhost:3724/pages/volume-00.html
- 截图：screenshots/20260607-143200-volume-00-404.png

### [CRITICAL] Agent API 对非法 action 返回 stay
- 类别：fallback_detected
- 复现：POST /api/narrative，routeDecision.action = "fly"
- 预期：HTTP 400 或明确拒绝
- 实际：返回 200，action 被 fallback 为 "stay"

## 测试覆盖

| Agent | 状态 | 覆盖项 |
|-------|------|--------|
| CrawlerAgent | 完成 | 47 页面，3 个 404 |
| SearchAgent | 完成 | 22 关键词 |
| NarrativeApiAgent | 完成 | 5 个边界用例，2 个失败 |
```

### 9.2 JSON 报告 (`reports/e2e-report.json`)

便于 CI 消费：

```json
{
  "startedAt": "2026-06-07T14:30:00Z",
  "finishedAt": "2026-06-07T14:32:00Z",
  "summary": { "critical": 3, "high": 1, "medium": 0, "low": 2 },
  "agents": [
    { "name": "CrawlerAgent", "pagesVisited": 47, "findings": 3 },
    { "name": "SearchAgent", "keywordsTested": 22, "findings": 0 },
    { "name": "NarrativeApiAgent", "cases": 5, "findings": 2 }
  ],
  "findings": [...]
}
```

---

## 十、执行流程

```bash
# 1. 安装依赖
pnpm add -D @playwright/test tsx

# 2. 全量运行
pnpm test:e2e

# 内部流程：
# a. make dev 启动本地服务
# b. playwright install chromium（首次）
# c. 并行启动 3 个 Agent
# d. 每个 Agent 在独立 browser context 中运行
# e. 汇总 findings，生成 report
# f. make stop 关闭服务
# g. 若有 critical/high 则 exit 1
```

### 10.1 CLI 参数

```bash
pnpm test:e2e -- --agent crawl          # 只跑 CrawlerAgent
pnpm test:e2e -- --agent search         # 只跑 SearchAgent
pnpm test:e2e -- --agent narrative-api  # 只跑 NarrativeApiAgent
pnpm test:e2e -- --headed               # 可视化浏览器（调试用）
pnpm test:e2e -- --report-dir ./custom-reports
```

---

## 十一、里程碑

### Phase 1：核心三 Agent（2–3 天）

- [ ] 搭建 `tests/e2e/` 目录和工具链
- [ ] 实现 TestDirector + 8 个工具
- [ ] 实现 CrawlerAgent：全站页面可达性 + console error
- [ ] 实现 SearchAgent：公开/隐藏关键词路由验证
- [ ] 实现 NarrativeApiAgent：非法输入边界测试
- [ ] 生成首份报告，修复发现的 critical 问题

### Phase 2：规则与异常（2 天）

- [ ] 实现 RulesAgent：6 条规则逐一触发验证
- [ ] 实现 AnomalyAgent：搜索框注入、复制偏移、滚动隐藏文本
- [ ] 实现 ArchivesAgent：首页与 archives 差异比对

### Phase 3：CI 与稳定性（1–2 天）

- [ ] 接入 GitHub Actions
- [ ] 失败时自动上传 screenshots
- [ ] 报告格式稳定化

---

## 十二、验收标准

1. 运行 `pnpm test:e2e` 能在 5 分钟内完成全站审计
2. 任何 HTTP 404/500、console error、规则未触发、非法输入被接受，都能被捕获并报告
3. 报告无需人工解读即可定位问题
4. 新增 `content/` 页面时，不需要修改测试代码（动态扫描）
5. 单文件不超过 500 行
6. 测试代码本身无 fallback 兜底：工具执行失败直接 throw，agent 不静默吞异常

---

## 十三、风险与约束

| 风险 | 缓解 |
|------|------|
| LLM 调用成本高 | 优先用 deterministic 工具完成重复遍历，LLM 只做判断和策略 |
| 概率异常难测 | 通过 `trigger_anomaly` 强制签名条件，绕过随机性 |
| Agent 响应慢 | Playwright 层 30s 超时；测试独立运行不阻塞开发 |
| 报告噪音大 | severity 分级 + 去重；Agent 已访问页面和 findings 注入上下文 |

---

## 十四、附录：关键文件引用

- `src/agent/agent.ts` —— NarrativeDirector 参考实现
- `src/agent/prompt.yaml` —— 叙事 Agent 提示词格式
- `src/agent/store.ts` —— Memory / NarrativeDecision 类型定义
- `docs/fallback-audit.md` —— 当前已知的兜底问题清单，部分应转为测试用例
- `docs/PRD.md` §7、§8、§9 —— 搜索、异常、Agent 系统的需求来源
