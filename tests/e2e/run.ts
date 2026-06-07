#!/usr/bin/env node
import { TestDirector } from "./agent/test-director.ts";
import { CrawlerAgent } from "./agents/crawler-agent.ts";
import { SearchAgent } from "./agents/search-agent.ts";
import { NarrativeApiAgent } from "./agents/narrative-api-agent.ts";
import { RulesAgent } from "./agents/rules-agent.ts";
import { AnomalyAgent } from "./agents/anomaly-agent.ts";
import { ArchivesAgent } from "./agents/archives-agent.ts";

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const agentFilter: string[] = [];
  let reportDir = "tests/e2e/reports";

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--agent" && args[i + 1]) {
      agentFilter.push(args[i + 1]);
      i++;
    }
    if (args[i] === "--report-dir" && args[i + 1]) {
      reportDir = args[i + 1];
      i++;
    }
  }

  const director = new TestDirector({ agentFilter, reportDir });

  try {
    await director.setup();

    const agents = [
      new CrawlerAgent(),
      new SearchAgent(),
      new NarrativeApiAgent(`http://localhost:3724`),
      new RulesAgent(),
      new AnomalyAgent(),
      new ArchivesAgent(),
    ];

    const report = await director.run(agents);

    const hasFailures = report.summary.critical > 0 || report.summary.high > 0;

    console.log(
      `\nE2E Audit Complete: ${report.summary.critical} critical, ${report.summary.high} high, ${report.summary.medium} medium, ${report.summary.low} low`
    );

    process.exit(hasFailures ? 1 : 0);
  } catch (error) {
    console.error("E2E audit failed:", error);
    process.exit(1);
  } finally {
    await director.teardown();
  }
}

main();
