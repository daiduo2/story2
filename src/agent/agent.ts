import { Agent } from "@earendil-works/pi-agent-core";
import type { AgentTool } from "@earendil-works/pi-agent-core";
import { getModel, Type } from "@earendil-works/pi-ai";
import type { AssistantMessage, Static } from "@earendil-works/pi-ai";
import { Check, Errors } from "typebox/value";
import yaml from "js-yaml";
import fs from "fs/promises";
import {
  MemoryStore,
  GameEvent,
  PlayerSignature,
  NarrativeDecision,
  Memory,
  SystemMessage,
  RouteDecision,
} from "./store.js";
import type { Logger } from "./logger.js";
import { noopLogger } from "./logger.js";

// ─── TypeBox Schema ───────────────────────────────────────────────────────────

const NarrativeDecisionSchema = Type.Object({
  version: Type.String(),
  routeDecision: Type.Object({
    action: Type.String(),
    targetPage: Type.Optional(Type.String()),
    variantHint: Type.Optional(Type.String()),
  }),
  systemMessage: Type.Optional(
    Type.Object({
      text: Type.String(),
      style: Type.String(),
    })
  ),
  contentModules: Type.Array(
    Type.Object({
      moduleId: Type.String(),
      targetSelector: Type.String(),
      position: Type.String(),
    })
  ),
  memoryUpdate: Type.Object({
    relationshipStage: Type.String(),
    understandingDepth: Type.Number(),
    observedPatterns: Type.Array(Type.String()),
    notes: Type.String(),
  }),
});

type NarrativeDecisionPayload = Static<typeof NarrativeDecisionSchema>;

// ─── Tool Definition ──────────────────────────────────────────────────────────

export const narrativeDecisionTool: AgentTool<typeof NarrativeDecisionSchema> = {
  name: "narrative_decision",
  description: "根据玩家行为和当前情境，输出本轮叙事决策",
  label: "叙事决策",
  parameters: NarrativeDecisionSchema,
  execute: async (_toolCallId, params) => {
    const safeParams = params as Record<string, unknown>;
    return {
      content: [{ type: "text" as const, text: "决策已接收" }],
      details: safeParams,
      terminate: true,
    };
  },
};

// ─── Prompt Config Types ──────────────────────────────────────────────────────

interface PromptConfig {
  identity: { name: string; description: string };
  personality: string[];
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

export function getCuriosityVector(signature: PlayerSignature): string[] {
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

export function clampMessageText(decision: NarrativeDecision): NarrativeDecision {
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
${config.personality.map((t) => `- ${t}`).join("\n")}

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

export function clampStage(
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

// ─── Extract Decision from Messages ───────────────────────────────────────────

export function extractDecision(agent: Agent): NarrativeDecision {
  const messages = agent.state.messages;

  // 优先从 tool result message 的 details 提取
  // details 来自 execute 的参数，已经过 validateToolArguments coerce
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.role === "toolResult" && msg.toolName === "narrative_decision") {
      return sanitizeDecision(msg.details as NarrativeDecision);
    }
  }

  // fallback：从 assistant message 的原始 toolCall 提取
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.role === "assistant") {
      const toolCalls = msg.content.filter(
        (c): c is Extract<typeof c, { type: "toolCall" }> =>
          c.type === "toolCall"
      );
      if (toolCalls.length > 0) {
        const raw = toolCalls[0].arguments as unknown as NarrativeDecision;
        if (!Check(NarrativeDecisionSchema, raw)) {
          return sanitizeDecision(raw);
        }
        return raw;
      }
    }
  }

  throw new Error("No narrative_decision found in agent messages");
}

export function sanitizeDecision(raw: NarrativeDecision): NarrativeDecision {
  const validStyles = ["observational", "intimate", "confrontational", "invitational"] as const;
  const validActions = ["stay", "redirect", "suggest"] as const;
  const validStages = ["unknown", "noticed", "watched", "understood", "confronted", "fused"] as const;

  const style = validStyles.includes(raw.systemMessage?.style as any)
    ? raw.systemMessage!.style
    : "observational";

  const action = validActions.includes(raw.routeDecision?.action as any)
    ? raw.routeDecision!.action
    : "stay";

  const stage = validStages.includes(raw.memoryUpdate?.relationshipStage as any)
    ? raw.memoryUpdate!.relationshipStage
    : "unknown";

  const version = raw.version === "narrative-v2" ? raw.version : "narrative-v2";

  const depth = raw.memoryUpdate?.understandingDepth;
  const clampedDepth = Math.max(
    0,
    Math.min(100, depth === undefined ? 0 : depth)
  );

  return {
    version,
    routeDecision: {
      ...raw.routeDecision,
      action,
    },
    systemMessage: raw.systemMessage
      ? { ...raw.systemMessage, style }
      : undefined,
    contentModules: Array.isArray(raw.contentModules) ? raw.contentModules : [],
    memoryUpdate: {
      ...raw.memoryUpdate,
      relationshipStage: stage,
      understandingDepth: clampedDepth,
    },
  };
}

function textPreview(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen) + "...";
}

// ─── Agent Prompt with Timeout ────────────────────────────────────────────────

export async function promptWithTimeout(
  agent: Agent,
  message: string,
  timeoutMs: number
): Promise<void> {
  let timer: ReturnType<typeof setTimeout>;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      agent.abort();
      reject(new Error(`Agent timeout after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  try {
    await Promise.race([agent.prompt(message), timeoutPromise]);
  } finally {
    clearTimeout(timer!);
  }
}

// ─── Subscribe Agent Events for Logging ───────────────────────────────────────

function subscribeAgentEvents(agent: Agent, logger: Logger): () => void {
  return agent.subscribe((event, _signal) => {
    switch (event.type) {
      case "agent_start":
        logger.debug("agent.agent_start", {});
        break;
      case "agent_end":
        logger.info("agent.agent_end", { messageCount: event.messages.length });
        break;
      case "turn_start":
        logger.info("agent.turn_start", {});
        break;
      case "turn_end": {
        const msg = event.message as AssistantMessage;
        logger.info("agent.turn_end", {
          stopReason: msg.stopReason,
          usage: msg.usage,
        });
        break;
      }
      case "tool_execution_start":
        logger.info("agent.tool_execution_start", {
          toolName: event.toolName,
        });
        break;
      case "tool_execution_end": {
        const toolEnd = event as unknown as Record<string, unknown>;
        logger.info("agent.tool_execution_end", {
          toolName: (event as { toolName?: string }).toolName,
          isError: (event as { isError?: boolean }).isError,
          detailsPreview: toolEnd.details
            ? JSON.stringify(toolEnd.details).slice(0, 500)
            : undefined,
          errorPreview: toolEnd.error
            ? String(toolEnd.error).slice(0, 500)
            : undefined,
        });
        break;
      }
    }
  });
}

// ─── Narrative Director ───────────────────────────────────────────────────────

export class NarrativeDirector {
  private store: MemoryStore;
  private prompt: PromptConfig | null = null;
  private logger: Logger;

  constructor(logger?: Logger) {
    this.store = new MemoryStore("./baiLu-data/players", logger);
    this.logger = logger || noopLogger;
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

    const startMs = performance.now();
    this.logger.info("evaluate.start", { sessionId, eventType: event.type });

    const memory = await this.store.load(sessionId);
    const userPrompt = buildUserPrompt(event, signature, memory);

    const model = getModel("anthropic", "claude-sonnet-4-6");
    const resolvedModel = process.env.ANTHROPIC_BASE_URL
      ? { ...model, baseUrl: process.env.ANTHROPIC_BASE_URL }
      : model;

    const agent = new Agent({
      initialState: {
        systemPrompt: buildSystemPrompt(this.prompt),
        model: resolvedModel,
        tools: [narrativeDecisionTool],
      },
    });

    const unsubscribe = subscribeAgentEvents(agent, this.logger);

    try {
      await promptWithTimeout(agent, userPrompt, 30000);
    } finally {
      unsubscribe();
    }

    const decision = extractDecision(agent);
    const clamped = clampMessageText(decision);

    const safeStage = clampStage(
      clamped.memoryUpdate.relationshipStage,
      memory.relationshipStage
    );

    if (safeStage !== memory.relationshipStage) {
      this.logger.info("stage.transition", {
        sessionId,
        from: memory.relationshipStage,
        to: safeStage,
      });
    }

    const safeDecision: NarrativeDecision = {
      ...clamped,
      memoryUpdate: {
        ...clamped.memoryUpdate,
        relationshipStage: safeStage,
      },
    };

    await this.store.save(sessionId, memory, safeDecision);

    const latencyMs = Math.round(performance.now() - startMs);
    const lastMsg = agent.state.messages[agent.state.messages.length - 1];
    const usage =
      lastMsg?.role === "assistant"
        ? (lastMsg as AssistantMessage).usage
        : undefined;

    this.logger.info("evaluate.end", {
      sessionId,
      latencyMs,
      stage: safeDecision.memoryUpdate.relationshipStage,
      action: safeDecision.routeDecision.action,
      inputTokens: usage?.input,
      outputTokens: usage?.output,
      totalTokens: usage?.totalTokens,
    });

    return safeDecision;
  }

  async ensureSession(sessionId: string): Promise<void> {
    const exists = await this.store.exists(sessionId);
    if (!exists) {
      await this.store.create(sessionId);
    }
  }
}
