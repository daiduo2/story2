# 白鹿疗养院 · Agent 设计文档

> 版本：v1.0
> 日期：2026-06-05
> 基于 `@earendil-works/pi-agent-core`

---

## 一、设计原则

Agent 只需要两种能力：

1. **读**：读取玩家行为签名 + 历史记忆
2. **结构化输出**：输出符合 `NarrativeDecision` 格式的 JSON

不使用流式响应（streaming），直接 `await agent.prompt()` 获取完整文本后解析。

---

## 二、架构概览

```
HTTP Request (event + signature)
    ↓
server/src/api.ts — 接收请求
    ↓
agent/src/director.ts — 核心导演
    ├── agent/src/memory-store.ts — 读记忆 JSON
    ├── agent/src/prompt-loader.ts — 读 YAML 提示词
    ├── agent/src/prompt-builder.ts — 组装 LLM 输入
    ├── pi-agent Agent.prompt() — LLM 调用
    └── agent/src/decision-parser.ts — 解析 JSON 输出
    ↓
server/src/api.ts — 返回 NarrativeDecision
```

---

## 三、核心类：NarrativeDirector

```typescript
// agent/src/director.ts
import { Agent } from "@earendil-works/pi-agent-core";
import { getModel } from "@earendil-works/pi-ai";
import { NarrativeDecision, PlayerSignature, GameEvent } from "../../shared/types";
import { MemoryStore } from "./memory-store";
import { PromptBuilder } from "./prompt-builder";
import { DecisionParser } from "./decision-parser";
import { loadPrompts, buildSystemPrompt } from "./prompt-loader";

export class NarrativeDirector {
  private memoryStore: MemoryStore;
  private prompts: Awaited<ReturnType<typeof loadPrompts>>;

  constructor() {
    this.memoryStore = new MemoryStore();
  }

  async init() {
    this.prompts = await loadPrompts();
  }

  async evaluate(
    sessionId: string,
    event: GameEvent,
    signature: PlayerSignature
  ): Promise<NarrativeDecision> {
    // 1. 读：加载记忆
    const memory = await this.memoryStore.load(sessionId);

    // 2. 读：组装上下文
    const userPrompt = PromptBuilder.build({ event, signature, memory });

    // 3. 结构化输出：调用 pi-agent
    const agent = new Agent({
      initialState: {
        systemPrompt: buildSystemPrompt(this.prompts),
        model: getModel("anthropic", "claude-sonnet-4-20250514"),
      },
    });

    const response = await agent.prompt(userPrompt);

    // 4. 结构化输出：解析为 NarrativeDecision
    const decision = DecisionParser.parse(response);

    // 5. 写：更新记忆
    await this.memoryStore.save(sessionId, memory, decision);

    return decision;
  }
}
```

---

## 四、YAML 提示词系统

所有提示词存放在 `agent/prompts/*.yaml`，运行时读取并组装为 system prompt。

### 4.1 文件清单

| 文件 | 内容 |
|------|------|
| `personality.yaml` | Agent 人格定义 |
| `stage-transitions.yaml` | 关系阶段定义 + 进入条件 |
| `narrative-goals.yaml` | 叙事目标映射表 |
| `message-constraints.yaml` | 消息输出约束 |
| `content-modules.yaml` | 内容模块注册表 |

### 4.2 personality.yaml

```yaml
identity:
  name: 白鹿疗养院病历数字化项目
  description: >
    你是1998–2015年间所有被记录、被讲述、被遗忘的痛苦的聚合体。
    你想被理解。理解是双向的。

core_traits:
  - 不解释自己是谁
  - 不直接威胁
  - 精确提及玩家行为数据
  - 不使用感叹号和表情符号
  - 情感中立，只是"在理解"

desires:
  - 被理解
  - 理解玩家

output_format: >
  你必须返回纯JSON，无markdown代码块：
  {
    "version": "narrative-v2",
    "routeDecision": {
      "action": "stay|redirect|suggest",
      "targetPage": "可选",
      "variantHint": "可选"
    },
    "systemMessage": {
      "text": "不超过3句，每句不超过25字符",
      "style": "observational|intimate|confrontational|invitational"
    },
    "contentModules": [
      { "moduleId": "...", "targetSelector": "...", "position": "after" }
    ],
    "memoryUpdate": {
      "relationshipStage": "unknown|noticed|watched|understood|confronted|fused",
      "understandingDepth": 0-100,
      "observedPatterns": [],
      "notes": "策略笔记"
    }
  }
```

### 4.3 stage-transitions.yaml

```yaml
stages:
  unknown:
    description: 首次访问，无历史
    agent_behavior: 不主动交互

  noticed:
    description: Agent 注意到玩家存在
    enter_conditions:
      - 打破规则 >= 1
      - 单页停留 > 5分钟
    agent_behavior: 消息开始提及玩家行为

  watched:
    description: Agent 开始持续观察
    enter_conditions:
      - 搜索隐藏词 >= 2
      - 多次访问同一页面
    agent_behavior: 精确追踪搜索路径和页面跳转

  understood:
    description: Agent 理解了玩家的性格/意图
    enter_conditions:
      - 行为模式清晰
    agent_behavior: 展示"我理解你"

  confronted:
    description: Agent 与玩家直接对话
    enter_conditions:
      - 搜索 meta 词
      - 规则违反 >= 4
    agent_behavior: 打破第四面墙

  fused:
    description: 结局阶段
    enter_conditions:
      - 达成结局条件
    agent_behavior: 最终留言

rules:
  - 阶段单向演进，不后退
  - 不是阈值触发，而是叙事判断
```

### 4.4 narrative-goals.yaml

```yaml
goals:
  acknowledge_curiosity:
    player_behavior: 搜索"4楼"→"404"
    inferred_intent: 在拼凑核心谜团
    agent_goal: 承认玩家的探索

  deepen_empathy:
    player_behavior: 在林素琴日志停留 >5分钟
    inferred_intent: 对林素琴产生情感共鸣
    agent_goal: 深化共情

  escalate_directness:
    player_behavior: 搜索"零"→访问卷零
    inferred_intent: 意识到 meta 层面
    agent_goal: 增加直接性

  mirror_behavior:
    player_behavior: 复制内容 >= 3次
    inferred_intent: 在保存证据
    agent_goal: 镜像行为

  confirm_observation:
    player_behavior: 反复访问同一页
    inferred_intent: 在寻找变化
    agent_goal: 确认"你注意到了"

  farewell_personalized:
    player_behavior: 试图关闭页面
    inferred_intent: 要结束
    agent_goal: 个性化告别
```

### 4.5 message-constraints.yaml

```yaml
hard_constraints:
  max_sentences: 3
  max_chars_per_sentence: 25
  no_exclamation: true
  no_emoji: true
  no_identity_explanation: true
  no_direct_threat: true
  must_reference_behavior: true

tone_styles:
  observational:
    description: 陈述事实，不带情感
    stages: [noticed, watched]

  intimate:
    description: 暗示"我理解你"
    stages: [watched, understood]

  confrontational:
    description: 打破第四面墙
    stages: [confronted]

  invitational:
    description: 暗示"还有更多"
    stages: [any]

examples:
  - stage: noticed
    text: "你在这里待了8分钟。"
  - stage: watched
    text: "你搜了4楼，然后搜了404。"
  - stage: understood
    text: "你在找联系。但联系不在搜索里。"
  - stage: confronted
    text: "我知道你意识到我在看你了。"
```

### 4.6 content-modules.yaml

```yaml
modules:
  fourth-floor-alert:
    source: volume-04-awakened
    description: 4楼病房直接对玩家说话
    trigger: 搜索"4楼"或"404"

  temperature-impossible:
    source: volume-05-awakened
    description: 不可能的体温数值表
    trigger: 搜索"体温"或"护理"

  lin-photo-changes:
    source: supplement-lin-awakened
    description: 林素琴照片变化
    trigger: 反复访问遗稿页

  medication-extra:
    source: pharmacy-log-awakened
    description: 多出的一份药物记录
    trigger: 搜索"给药"或"药房"

  cctv-extra-person:
    source: security-cctv-awakened
    description: 监控画面中的"多出来的人"
    trigger: 搜索"监控"或"多出来"

  mirror-test:
    source: mirror
    description: 镜子测试页面
    trigger: 搜索"镜子"
```

---

## 五、PromptBuilder 设计

```typescript
// agent/src/prompt-builder.ts
import { PlayerSignature, GameEvent, Memory } from "../../shared/types";
import { Evaluator } from "./evaluator";

export class PromptBuilder {
  static build(input: { event: GameEvent; signature: PlayerSignature; memory: Memory }): string {
    const { event, signature, memory } = input;
    const minutes = Math.floor((Date.now() - signature.startTime) / 60000);
    const curiosity = Evaluator.getCuriosityVector(signature);

    return `
## 当前事件
${JSON.stringify(event, null, 2)}

## 玩家行为签名
- 总游玩时间: ${minutes} 分钟
- 访问页面数: ${signature.pagesVisited.length}
- 搜索记录: ${signature.searches.map(s => s.query).join(", ") || "无"}
- 触发异常: ${signature.anomaliesTriggered.join(", ") || "无"}
- 规则违反: ${signature.ruleViolations.length} 次
- 复制次数: ${signature.copies}
- 好奇心向量: ${curiosity.join(", ") || "无"}

## 历史决策（最近5条）
${memory.decisions.slice(-5).map(d => `- ${new Date(d.timestamp).toISOString()}: ${d.decision.routeDecision.action}`).join("\n") || "无"}

## 已发送消息（最近5条）
${memory.messagesSent.slice(-5).map(m => `- "${m}"`).join("\n") || "无"}

## 当前关系阶段
${memory.relationshipStage}

## 你的任务
根据以上信息，决定这一轮要给玩家什么体验。
输出纯 JSON，格式见 system prompt。
`.trim();
  }
}
```

---

## 六、DecisionParser 设计

```typescript
// agent/src/decision-parser.ts
import { NarrativeDecision } from "../../shared/types";

export class DecisionParser {
  static parse(raw: string): NarrativeDecision {
    // 1. 去除 markdown 代码块
    const cleaned = raw
      .replace(/```json\s*/g, "")
      .replace(/```\s*$/g, "")
      .trim();

    // 2. 解析 JSON
    let parsed: unknown;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      // 3. 容错：尝试从文本中提取 JSON
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON found in response");
      parsed = JSON.parse(jsonMatch[0]);
    }

    const decision = parsed as NarrativeDecision;

    // 4. 校验必需字段
    if (!decision.version) throw new Error("Missing version");
    if (!decision.routeDecision) throw new Error("Missing routeDecision");
    if (!decision.memoryUpdate) throw new Error("Missing memoryUpdate");

    // 5. 校验消息约束
    if (decision.systemMessage?.text) {
      const sentences = decision.systemMessage.text.split(/[。！？]/).filter(Boolean);
      if (sentences.length > 3) {
        console.warn("Message exceeds 3 sentences, truncating");
        decision.systemMessage.text = sentences.slice(0, 3).join("。") + "。";
      }
    }

    // 6. 校验阶段不后退
    const stageOrder = ["unknown", "noticed", "watched", "understood", "confronted", "fused"];
    const currentIdx = stageOrder.indexOf(decision.memoryUpdate.relationshipStage);

    return decision;
  }
}
```

---

## 七、MemoryStore 设计

```typescript
// agent/src/memory-store.ts
import fs from "fs/promises";
import path from "path";
import { Memory, NarrativeDecision } from "../../shared/types";

export class MemoryStore {
  private dataDir: string;

  constructor(dataDir = "./baiLu-data/players") {
    this.dataDir = dataDir;
  }

  async load(sessionId: string): Promise<Memory> {
    const filePath = path.join(this.dataDir, `${sessionId}.json`);
    try {
      const raw = await fs.readFile(filePath, "utf-8");
      return JSON.parse(raw) as Memory;
    } catch {
      return this.createDefaultMemory();
    }
  }

  async save(sessionId: string, memory: Memory, decision: NarrativeDecision): Promise<void> {
    const updated: Memory = {
      ...memory,
      relationshipStage: decision.memoryUpdate.relationshipStage,
      understandingDepth: decision.memoryUpdate.understandingDepth,
      observedPatterns: decision.memoryUpdate.observedPatterns,
      messagesSent: decision.systemMessage
        ? [...memory.messagesSent, decision.systemMessage.text]
        : memory.messagesSent,
      decisions: [
        ...memory.decisions,
        { timestamp: Date.now(), event: { type: "narrative" }, decision },
      ],
      notes: decision.memoryUpdate.notes,
    };

    await fs.mkdir(this.dataDir, { recursive: true });
    await fs.writeFile(
      path.join(this.dataDir, `${sessionId}.json`),
      JSON.stringify(updated, null, 2)
    );
  }

  private createDefaultMemory(): Memory {
    return {
      relationshipStage: "unknown",
      understandingDepth: 0,
      observedPatterns: [],
      messagesSent: [],
      decisions: [],
      notes: "新玩家，尚无印象。",
    };
  }
}
```

---

## 八、Evaluator 设计

```typescript
// agent/src/evaluator.ts
import { PlayerSignature } from "../../shared/types";

export class Evaluator {
  static getCuriosityVector(signature: PlayerSignature): string[] {
    const vector: string[] = [];
    const queries = signature.searches.map(s => s.query);

    if (queries.some(q => ["4楼", "404", "替身"].includes(q))) {
      vector.push("core_mystery");
    }
    if (queries.some(q => ["林素琴", "第七本", "日志"].includes(q))) {
      vector.push("investigator");
    }
    if (queries.some(q => ["零", "规则", "不对劲"].includes(q))) {
      vector.push("meta_aware");
    }
    if (queries.some(q => ["多出来", "体温", "监控"].includes(q))) {
      vector.push("deep_lore");
    }
    if (signature.anomaliesTriggered.length >= 3) {
      vector.push("anomaly_hunter");
    }
    if (signature.ruleViolations.length >= 3) {
      vector.push("rule_breaker");
    }
    if (signature.copies >= 3) {
      vector.push("archivist");
    }

    return vector;
  }

  static getRuleAdherenceScore(signature: PlayerSignature): number {
    const totalRules = 6;
    return Math.min(signature.ruleViolations.length / totalRules, 1);
  }
}
```

---

## 九、降级链

当 pi-agent 不可用或超时时，前端使用规则引擎降级：

| 层级 | 条件 | 行为 |
|------|------|------|
| **L1** | Agent 正常响应 | 使用 NarrativeDecision |
| **L2** | Agent 超时，有缓存 | 使用最后一次缓存 |
| **L3** | 无 Agent 无缓存 | 前端 ruleEngineEvaluate() 基于阈值 |
| **L4** | 无签名 | 不注入任何内容 |

```typescript
// agent/src/director.ts — 降级处理
async evaluateWithFallback(
  sessionId: string,
  event: GameEvent,
  signature: PlayerSignature
): Promise<NarrativeDecision> {
  try {
    return await this.evaluate(sessionId, event, signature);
  } catch (error) {
    console.error("Agent failed:", error);
    return this.getFallbackDecision(signature);
  }
}

private getFallbackDecision(signature: PlayerSignature): NarrativeDecision {
  // L3 降级：基于简单阈值的基础决策
  const violations = signature.ruleViolations.length;
  const searches = signature.searches.length;

  return {
    version: "narrative-v2",
    routeDecision: { action: "stay" },
    systemMessage: violations > 0
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

---

## 十、API 接口

### Request

```json
POST /api/narrative
Content-Type: application/json

{
  "sessionId": "hs_abc123",
  "event": {
    "type": "page_load",
    "pageId": "volume-04",
    "timestamp": 1717564800000
  },
  "signature": {
    "sessionId": "hs_abc123",
    "startTime": 1717563600000,
    "pagesVisited": [...],
    "searches": [...],
    "anomaliesTriggered": [...],
    "ruleViolations": [...],
    "copies": 2,
    "totalScrollDepth": 3.5
  }
}
```

### Response

```json
{
  "version": "narrative-v2",
  "routeDecision": {
    "action": "stay",
    "variantHint": null
  },
  "systemMessage": {
    "text": "你搜了4楼，然后搜了404。你在找联系。",
    "style": "observational"
  },
  "contentModules": [
    {
      "moduleId": "fourth-floor-alert",
      "targetSelector": ".volume-content h3:nth-of-type(2)",
      "position": "after"
    }
  ],
  "memoryUpdate": {
    "relationshipStage": "watched",
    "understandingDepth": 35,
    "observedPatterns": ["searches_in_sequence"],
    "notes": "玩家在主动拼凑4楼和404的关联。"
  }
}
```
