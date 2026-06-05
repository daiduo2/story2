# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Rules

- Do what has been asked; nothing more, nothing less
- NEVER create files unless absolutely necessary — prefer editing existing files
- NEVER create documentation files unless explicitly requested
- NEVER save working files or tests to root — use `/src`, `/tests`, `/docs`, `/config`, `/scripts`
- ALWAYS read a file before editing it
- NEVER commit secrets, credentials, or `.env` files
- Keep files under 500 lines
- Validate input at system boundaries
- **不允许加入任何的fallback兜底** — 禁止在代码中添加任何fallback兜底机制。如果某个功能失败，就让它失败，不要静默回退到默认值或简化逻辑。失败应该被暴露和处理，而不是被隐藏。

## Project Overview

**白鹿疗养院** is a text-to-interactive-game engine that generates ARG-style horror web experiences. Players browse a fake hospital medical-record digitization site and discover hidden anomalies. The project has two halves:

1. **Frontend engine** (`src/*.ts`): Browser runtime that tracks player behavior, runs a keyword search puzzle system, injects visual anomalies, and bridges to a narrative AI agent.
2. **Narrative agent** (`src/agent/`): Node.js service using `@earendil-works/pi-agent-core` that evaluates player behavior and returns structured narrative decisions.

Story content lives in `content/` (volumes, supplements, peripherals, variants, meta documents). Full design specs are in `docs/`.

## Package Manager

This project uses **pnpm** as its package manager. Do not use `npm install` or `yarn add`; always use `pnpm` commands to avoid lockfile conflicts.

```bash
# Check pnpm version
pnpm -v

# Install all dependencies from pnpm-lock.yaml
pnpm install

# Add a runtime dependency
pnpm add <package>

# Add a dev dependency
pnpm add -D <package>

# Remove a dependency
pnpm remove <package>

# Update dependencies interactively
pnpm update --interactive
```

## Development Commands

```bash
# Install dependencies
pnpm install

# Add a dependency
pnpm add <package>

# Add a dev dependency
pnpm add -D <package>

# Remove a dependency
pnpm remove <package>

# Build agent/backend (compiles src/agent/**/* via tsconfig.json)
npm run build

# Run tests (jsdom environment, coverage thresholds at 80%)
npm run test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage report
npm run test:coverage

# Run a single test file
npx vitest run src/behavior.test.ts

# Run the narrative agent standalone
npm run dev
```

**Note:** `package.json` references `tsconfig.frontend.json` and `dist/agent.js`, but these do not yet exist. The current `tsconfig.json` only compiles `src/agent/**/*` to `dist/`. Frontend modules are tested under Vitest/jsdom but have no separate build config yet.

## Architecture

### Frontend Runtime (`src/`)

The frontend is a set of browser modules that attach to `window` under distinct namespaces. They are tested in jsdom via Vitest.

| Module | Global API | Responsibility |
|--------|-----------|----------------|
| `behavior.ts` | `window.BaiLuBehavior` | Tracks player signature (page visits, searches, copies, scroll depth, rule violations) in `localStorage`. Computes relationship phase. |
| `search.ts` | `window.BaiLuSearch` | Hardcoded keyword-to-page index. Public keywords map directly; hidden keywords return `agent-routed` candidates resolved by visit history. |
| `router.ts` | — | Executes `NarrativeDecision`: page redirects, system-message injection, content-module DOM insertion. |
| `llm-bridge.ts` | `window.BaiLuLLM` | POSTs player signature to `http://localhost:3456/api/narrative`. Returns `NarrativeDecision` with 5-second timeout. |
| `player-history.ts` | `window.BaiLuPlayerHistory` | Extended event log in `localStorage` for session timelines. |
| `main.ts` | — | Boots console easter egg, rule violation detectors, search injection anomaly, and page-timeout color shift. |
| `types.ts` | — | Shared TypeScript types and exhaustive runtime type guards (`isPlayerSignature`, `isNarrativeDecision`, etc.). |

**Key design patterns:**
- **Behavior signature**: A JSON blob stored in `localStorage` under `bailu_behavior_signature`. It is the single source of truth for the agent.
- **Search as puzzle**: `SEARCH_INDEX` in `search.ts` has two tiers. Public keywords go to fixed pages; hidden keywords (e.g., "4楼", "第七本") require the agent or prior visits to resolve.
- **Rule detection**: `main.ts` detects rule violations (e.g., visiting `volume-00`, submitting an injected search term) and reports them via `BaiLuBehavior.recordRuleViolation()`.
- **Anomaly injection**: Low-probability frontend effects (search placeholder hijack, copy-event tracking, footer color shift after 600s dwell) are deliberately subtle.

### Narrative Agent (`src/agent/`)

The agent is a Node.js class (`NarrativeDirector`) that wraps an LLM call and persists memory to disk.

| File | Role |
|------|------|
| `agent.ts` | `NarrativeDirector` class. Loads YAML prompt config, builds system/user prompts, calls `pi-agent-core` Agent, validates output, clamps stage progression, and persists memory. |
| `store.ts` | `MemoryStore` class. Reads/writes per-session memory JSON from `./baiLu-data/players/{sessionId}.json`. |
| `logger.ts` | Structured JSON logger + no-op fallback. |
| `run.ts` | Standalone script for manual agent testing. |
| `prompt.yaml` | Agent identity, personality traits, stage definitions, tone styles, narrative goals, content modules, and hard constraints (max 3 sentences, 25 chars each, no exclamation marks, etc.). |

**Agent flow:**
1. HTTP request arrives with `sessionId`, `event`, and `signature`.
2. `NarrativeDirector.evaluate()` loads prior `Memory` from `MemoryStore`.
3. Builds a system prompt from `prompt.yaml` and a user prompt containing the event, signature summary, curiosity vector, and last 5 decisions/messages.
4. Calls `pi-agent-core` Agent with a single tool (`narrative_decision`) and TypeBox schema.
5. Extracts the tool-call arguments as a `NarrativeDecision`.
6. Clamps message length (max 3 sentences) and validates stage cannot regress.
7. Saves updated memory back to disk.

**Fallback chain:** If the agent fails or times out, `evaluateWithFallback()` returns a basic rule-engine decision based on violation/search counts.

### Content Organization (`content/`)

```
content/
├── volumes/        # 正编病历 (volume-01 … volume-24)
├── supplements/    # 补遗/个人档案 (supplement-lin.html)
├── peripherals/    # 机构外围档案 (pharmacy-log, security-cctv, etc.)
├── variants/       # 变体页 (e.g., volume-04-awakened.html)
└── meta/           # Meta documents (notice.html, about.html, archives.html)
```

### Relationship Stage Model

The agent and frontend share a six-stage progression. Stages only move forward:

```
unknown → noticed → watched → understood → confronted → fused
```

Phase transitions are driven by rule violations, hidden searches, anomaly triggers, and dwell time. The `behavior.ts` `getPhase()` function computes the frontend view of this; the agent's `clampStage()` enforces it server-side.

## Testing Notes

- Vitest runs in `jsdom` with globals enabled.
- Coverage thresholds are set at 80% for statements, branches, functions, and lines.
- Agent tests need `ANTHROPIC_API_KEY` (or `ANTHROPIC_BASE_URL`) in `.env`. The `run.ts` script uses `dotenv`.

## Environment Variables

```bash
ANTHROPIC_API_KEY=      # Required for agent LLM calls
ANTHROPIC_BASE_URL=     # Optional proxy/base URL
```
