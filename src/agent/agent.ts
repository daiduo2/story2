import { Agent } from "@earendil-works/pi-agent-core";
import { getModel, Type } from "@earendil-works/pi-ai";
import type { AssistantMessage, Static } from "@earendil-works/pi-ai";
import yaml from "js-yaml";
import fs from "fs/promises";
import {
  MemoryStore,
  GameEvent,
  PlayerSignature,
  NarrativeDecision,
  Memory,
} from "./store.js";

// ─── TypeBox Schema ───────────────────────────────────────────────────────────

const NarrativeDecisionSchema = Type.Object({
  version: Type.String(),
  routeDecision: Type.Object({
    action: Type.Union([
      Type.Literal("stay"),
      Type.Literal("redirect"),
      Type.Literal("suggest"),
    ]),
    targetPage: Type.Optional(Type.String()),
    variantHint: Type.Optional(Type.String()),
  }),
  systemMessage: Type.Optional(
    Type.Object({
      text: Type.String(),
      style: Type.Union([
        Type.Literal("observational"),
        Type.Literal("intimate"),
        Type.Literal("confrontational"),
        Type.Literal("invitational"),
      ]),
    })
  ),
  contentModules: Type.Array(
    Type.Object({
      moduleId: Type.String(),
      targetSelector: Type.String(),
      position: Type.Union([
        Type.Literal("before"),
        Type.Literal("after"),
        Type.Literal("replace"),
      ]),
    })
  ),
  memoryUpdate: Type.Object({
    relationshipStage: Type.Union([
      Type.Literal("unknown"),
      Type.Literal("noticed"),
      Type.Literal("watched"),
      Type.Literal("understood"),
      Type.Literal("confronted"),
      Type.Literal("fused"),
    ]),
    understandingDepth: Type.Number({ minimum: 0, maximum: 100 }),
    observedPatterns: Type.Array(Type.String()),
    notes: Type.String(),
  }),
});

type NarrativeDecisionPayload = Static<typeof NarrativeDecisionSchema>;

// ─── Tool Definition ──────────────────────────────────────────────────────────

const narrativeDecisionTool = {
  name: "narrative_decision",
  description: "根据玩家行为和当前情境，输出本轮叙事决策",
  label: "叙事决策",
  parameters: NarrativeDecisionSchema,
  execute: async (_toolCallId: string, params: unknown) => ({
    content: [{ type: "text" as const, text: "" }],
    details: params as NarrativeDecisionPayload,
  }),
};

// ─── Prompt Config Types ──────────────────────────────────────────────────────

interface PromptConfig {
  identity: { name: string; description: string };
  traits: string[];
  desires: string[];
  stages: Record<
    string,
    { description: string; behavior: string; enterConditions?: string[] }
  >;
  stageRules: string[];
  toneStyles: Record<string, { description: string; stages: string[] }>;
  examples: Array<{ stage: string; text: string }>;
  goals: Record<string, { behavior: string; intent: string; agentGoal: string }>;
  modules: Record<
    string,
    { source: string; description: string; trigger: string }
  >;
  constraints: Record<string, number | boolean>;
}

const STAGE_ORDER = [
  "unknown",
  "noticed",
  "watched",
  "understood",
  "confronted",
  "fused",
] as const;

// ─── Prompt Loading ───────────────────────────────────────────────────────────

async function loadPrompt(
  filePath = "./src/agent/prompt.yaml"
): Promise<PromptConfig> {
  const raw = await fs.readFile(filePath, "utf-8");
  return yaml.load(raw) as PromptConfig;
}

// ─── Evaluator ────────────────────────────────────────────────────────────────

function getCuriosityVector(signature: PlayerSignature): string[] {
  const vector: string[] = [];
  const queries = signature.searches.map((s) => s.query);

  if (queries.some((q) => ["4楼", "404", "替身"].includes(q))) {
    vector.push("core_mystery");
  }
  if (queries.some((q) => ["林素琴", "第七本", "日志"].includes(q))) {
    vector.push("investigator");
  }
  if (queries.some((q) => ["零", "规则", "不对劲"].includes(q))) {
    vector.push("meta_aware");
  }
  if (queries.some((q) => ["多出来", "体温", "监控"].includes(q))) {
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

// ─── Message Clamp ────────────────────────────────────────────────────────────

function clampMessageText(decision: NarrativeDecision): NarrativeDecision {
  if (!decision.systemMessage?.text) return decision;

  const sentences = decision.systemMessage.text
    .split(/[。！？]/)
    .filter(Boolean);

  if (sentences.length <= 3) return decision;

  return {
    ...decision,
    systemMessage: {
      ...decision.systemMessage,
      text: sentences.slice(0, 3).join("。") + "。",
    },
  };
}

// ─── System Prompt Builder ────────────────────────────────────────────────────

function buildSystemPrompt(config: PromptConfig): string {
  const stageDescriptions = Object.entries(config.stages)
    .map(([k, v]) => `- ${k}: ${v.description} (${v.behavior})`)
    .join("\n");

  const goalDescriptions = Object.entries(config.goals)
    .map(([k, v]) => `- ${k}: ${v.behavior} → ${v.agentGoal}`)
    .join("\n");

  const moduleDescriptions = Object.entries(config.modules)
    .map(([k, v]) => `- ${k}: ${v.description} [${v.trigger}]`)
    .join("\n");

  return `
${config.identity.name}
${config.identity.description}

核心特质：
${config.traits.map((t) => `- ${t}`).join("\n")}

欲望：
${config.desires.map((d) => `- ${d}`).join("\n")}

阶段定义：
${stageDescriptions}

阶段规则：
${config.stageRules.map((r) => `- ${r}`).join("\n")}

叙事目标：
${goalDescriptions}

内容模块：
${moduleDescriptions}

约束：
- 最多 ${config.constraints.maxSentences} 句
- 每句最多 ${config.constraints.maxCharsPerSentence} 字符
- ${config.constraints.noExclamation ? "禁用感叹号" : ""}
- ${config.constraints.noEmoji ? "禁用表情符号" : ""}
- ${config.constraints.noIdentityExplanation ? "不解释身份" : ""}
- ${config.constraints.noDirectThreat ? "不直接威胁" : ""}
- ${config.constraints.mustReferenceBehavior ? "必须引用玩家行为" : ""}

语调示例：
${config.examples.map((e) => `- [${e.stage}] ${e.text}`).join("\n")}

你必须调用 narrative_decision 工具来输出决策。
`.trim();
}

// ─── User Prompt Builder ──────────────────────────────────────────────────────

function buildUserPrompt(
  event: GameEvent,
  signature: PlayerSignature,
  memory: Memory
): string {
  const minutes = Math.floor((Date.now() - signature.startTime) / 60000);
  const curiosity = getCuriosityVector(signature);

  const recentDecisions =
    memory.decisions
      .slice(-5)
      .map(
        (d) =>
          `- ${new Date(d.timestamp).toISOString()}: ${d.decision.routeDecision.action}`
      )
      .join("\n") || "无";

  const recentMessages =
    memory.messagesSent.slice(-5).map((m) => `- "${m}"`).join("\n") || "无";

  return `
## 当前事件
${JSON.stringify(event, null, 2)}

## 玩家行为签名
- 总游玩时间: ${minutes} 分钟
- 访问页面数: ${signature.pagesVisited.length}
- 搜索记录: ${signature.searches.map((s) => s.query).join(", ") || "无"}
- 触发异常: ${signature.anomaliesTriggered.join(", ") || "无"}
- 规则违反: ${signature.ruleViolations.length} 次
- 复制次数: ${signature.copies}
- 好奇心向量: ${curiosity.join(", ") || "无"}

## 历史决策（最近5条）
${recentDecisions}

## 已发送消息（最近5条）
${recentMessages}

## 当前关系阶段
${memory.relationshipStage}
`.trim();
}

// ─── Stage Validation ─────────────────────────────────────────────────────────

function clampStage(
  proposed: string,
  current: string
): (typeof STAGE_ORDER)[number] {
  const proposedIdx = STAGE_ORDER.indexOf(
    proposed as (typeof STAGE_ORDER)[number]
  );
  const currentIdx = STAGE_ORDER.indexOf(
    current as (typeof STAGE_ORDER)[number]
  );

  if (proposedIdx === -1) return current as (typeof STAGE_ORDER)[number];
  if (proposedIdx < currentIdx) return current as (typeof STAGE_ORDER)[number];

  return STAGE_ORDER[proposedIdx];
}

// ─── Fallback Decision ────────────────────────────────────────────────────────

function getFallbackDecision(
  signature: PlayerSignature
): NarrativeDecision {
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

// ─── Extract Decision from Tool Call ──────────────────────────────────────────

function extractDecisionFromToolCalls(agent: Agent): NarrativeDecision {
  const messages = agent.state.messages;
  const lastMessage = messages[messages.length - 1];

  if (lastMessage?.role !== "assistant") {
    throw new Error("Expected assistant message in agent state");
  }

  const assistant = lastMessage as AssistantMessage;

  const toolCalls = assistant.content.filter(
    (c): c is Extract<typeof c, { type: "toolCall" }> =>
      c.type === "toolCall"
  );

  if (toolCalls.length === 0) {
    throw new Error("No tool call found in assistant response");
  }

  return toolCalls[0].arguments as unknown as NarrativeDecision;
}

// ─── Narrative Director ───────────────────────────────────────────────────────

export class NarrativeDirector {
  private store: MemoryStore;
  private prompt: PromptConfig | null = null;

  constructor() {
    this.store = new MemoryStore();
  }

  async init(promptPath?: string) {
    this.prompt = await loadPrompt(promptPath);
  }

  async evaluate(
    sessionId: string,
    event: GameEvent,
    signature: PlayerSignature
  ): Promise<NarrativeDecision> {
    if (!this.prompt) {
      throw new Error("NarrativeDirector not initialized. Call init() first.");
    }

    const memory = await this.store.load(sessionId);
    const userPrompt = buildUserPrompt(event, signature, memory);

    const model = getModel("anthropic", "claude-sonnet-4-6");
    const agent = new Agent({
      initialState: {
        systemPrompt: buildSystemPrompt(this.prompt),
        model: process.env.ANTHROPIC_BASE_URL
          ? { ...model, baseUrl: process.env.ANTHROPIC_BASE_URL }
          : model,
        tools: [narrativeDecisionTool],
      },
    });

    await agent.prompt(userPrompt);

    // Debug: print raw LLM response
    console.error("[debug] messages count:", agent.state.messages.length);
    console.error("[debug] errorMessage:", agent.state.errorMessage);
    const lastMsg = agent.state.messages[agent.state.messages.length - 1];
    console.error("[debug] last message role:", lastMsg?.role);
    if (lastMsg?.role === "assistant") {
      const assistant = lastMsg as AssistantMessage;
      console.error("[debug] content blocks:", JSON.stringify(assistant.content, null, 2));
      console.error("[debug] stopReason:", assistant.stopReason);
      console.error("[debug] errorMessage:", assistant.errorMessage);
    }

    const decision = extractDecisionFromToolCalls(agent);
    const clamped = clampMessageText(decision);

    const safeStage = clampStage(
      clamped.memoryUpdate.relationshipStage,
      memory.relationshipStage
    );

    const safeDecision: NarrativeDecision = {
      ...clamped,
      memoryUpdate: {
        ...clamped.memoryUpdate,
        relationshipStage: safeStage,
      },
    };

    await this.store.save(sessionId, memory, safeDecision);
    return safeDecision;
  }

  async evaluateWithFallback(
    sessionId: string,
    event: GameEvent,
    signature: PlayerSignature
  ): Promise<NarrativeDecision> {
    try {
      return await this.evaluate(sessionId, event, signature);
    } catch (error) {
      console.error("Agent failed:", error);
      return getFallbackDecision(signature);
    }
  }
}
