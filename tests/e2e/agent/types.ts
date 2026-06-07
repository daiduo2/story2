import type { Page } from "@playwright/test";

export type Severity = "critical" | "high" | "medium" | "low";

export type FindingCategory =
  | "http_error"
  | "console_error"
  | "narrative_break"
  | "rule_undetected"
  | "search_misroute"
  | "anomaly_missing"
  | "fallback_detected"
  | "content_inconsistency"
  | "performance";

export interface Finding {
  severity: Severity;
  category: FindingCategory;
  page: string;
  description: string;
  reproduction: string;
}

export interface PageVisitResult {
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

export interface SearchResult {
  keyword: string;
  resolvedPage: string | null;
  finalUrl: string;
  ruleViolation: string | null;
}

export interface VerifyResult {
  passed: boolean;
  actual: string;
  expected: string;
}

export interface LinkInfo {
  href: string;
  text: string;
  status: number | null;
  isBroken: boolean;
}

export interface TestReport {
  startedAt: string;
  finishedAt: string;
  summary: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  agents: Array<{
    name: string;
    pagesVisited?: number;
    keywordsTested?: number;
    cases?: number;
    findings: number;
  }>;
  findings: Finding[];
}

export interface AgentContext {
  page: Page;
  baseUrl: string;
  findings: Finding[];
  visitedPages: Set<string>;
}

export interface TestAgent {
  name: string;
  run(ctx: AgentContext): Promise<number>; // returns finding count
}
