import type { BrowserContext, Page } from "@playwright/test";
import type { AgentContext, TestReport, TestAgent } from "./types.ts";
import { getContext, closeBrowser } from "../helpers/browser.ts";
import { startServer, stopServer, SERVER_PORT } from "../helpers/server.ts";
import type { ChildProcess } from "child_process";
import fs from "fs/promises";
import path from "path";

export interface DirectorOptions {
  baseUrl?: string;
  reportDir?: string;
  agentFilter?: string[];
}

export class TestDirector {
  private options: Required<DirectorOptions>;
  private serverProc: ChildProcess | null = null;
  private context: BrowserContext | null = null;

  constructor(options: DirectorOptions = {}) {
    this.options = {
      baseUrl: options.baseUrl || `http://localhost:${SERVER_PORT}`,
      reportDir: options.reportDir || "tests/e2e/reports",
      agentFilter: options.agentFilter || [],
    };
  }

  async setup(): Promise<void> {
    this.serverProc = await startServer();
    this.context = await getContext();
  }

  async teardown(): Promise<void> {
    if (this.context) {
      await this.context.close();
      this.context = null;
    }
    await closeBrowser();
    if (this.serverProc) {
      await stopServer(this.serverProc);
      this.serverProc = null;
    }
  }

  async run(agents: TestAgent[]): Promise<TestReport> {
    const startedAt = new Date().toISOString();
    const allFindings = [...(await this.loadExistingFindings())];
    const reportAgents: TestReport["agents"] = [];

    const filteredAgents =
      this.options.agentFilter.length > 0
        ? agents.filter((a) => this.options.agentFilter.includes(a.name))
        : agents;

    for (const agent of filteredAgents) {
      const page = await this.context!.newPage();
      const ctx: AgentContext = {
        page,
        baseUrl: this.options.baseUrl,
        findings: allFindings,
        visitedPages: new Set(),
      };

      try {
        const findingCount = await agent.run(ctx);
        reportAgents.push({
          name: agent.name,
          findings: findingCount,
        });
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        ctx.findings.push({
          severity: "critical",
          category: "http_error",
          page: "agent-runtime",
          description: `${agent.name} 运行时崩溃: ${errMsg.slice(0, 120)}`,
          reproduction: `运行 ${agent.name}`,
        });
        reportAgents.push({
          name: agent.name,
          findings: 1,
        });
      } finally {
        await page.close();
      }
    }

    const finishedAt = new Date().toISOString();
    const findings = allFindings;

    const report: TestReport = {
      startedAt,
      finishedAt,
      summary: {
        critical: findings.filter((f) => f.severity === "critical").length,
        high: findings.filter((f) => f.severity === "high").length,
        medium: findings.filter((f) => f.severity === "medium").length,
        low: findings.filter((f) => f.severity === "low").length,
      },
      agents: reportAgents,
      findings,
    };

    await this.writeReport(report);
    return report;
  }

  private async loadExistingFindings() {
    // Agents share findings via the context, so no persistent loading needed
    return [];
  }

  private async writeReport(report: TestReport): Promise<void> {
    await fs.mkdir(this.options.reportDir, { recursive: true });

    // JSON report
    const jsonPath = path.join(this.options.reportDir, "e2e-report.json");
    await fs.writeFile(jsonPath, JSON.stringify(report, null, 2));

    // Markdown report
    const mdPath = path.join(this.options.reportDir, "e2e-report.md");
    const md = this.buildMarkdown(report);
    await fs.writeFile(mdPath, md);

    console.log(`\nReports written to:\n  ${jsonPath}\n  ${mdPath}`);
  }

  private buildMarkdown(report: TestReport): string {
    const lines: string[] = [
      "# 白鹿疗养院 E2E 审计报告",
      "",
      `- 运行时间：${report.startedAt}`,
      `- 完成时间：${report.finishedAt}`,
      `- 发现问题：${report.summary.critical} critical / ${report.summary.high} high / ${report.summary.medium} medium / ${report.summary.low} low`,
      "",
      "## 测试覆盖",
      "",
      "| Agent | 发现问题 |",
      "|-------|---------|",
      ...report.agents.map(
        (a) => `| ${a.name} | ${a.findings} |`
      ),
      "",
    ];

    if (report.findings.length > 0) {
      lines.push("## 发现详情", "");

      const critical = report.findings.filter((f) => f.severity === "critical");
      const high = report.findings.filter((f) => f.severity === "high");
      const medium = report.findings.filter((f) => f.severity === "medium");
      const low = report.findings.filter((f) => f.severity === "low");

      for (const group of [
        { label: "CRITICAL", findings: critical },
        { label: "HIGH", findings: high },
        { label: "MEDIUM", findings: medium },
        { label: "LOW", findings: low },
      ]) {
        if (group.findings.length === 0) continue;
        for (const f of group.findings) {
          lines.push(
            `### [${group.label}] ${f.page} — ${f.category}`,
            "",
            `- **描述**：${f.description}`,
            `- **复现**：${f.reproduction}`,
            ""
          );
        }
      }
    } else {
      lines.push("## 结果", "", "未发现任何问题。", "");
    }

    return lines.join("\n");
  }
}
