import { config } from "dotenv";
config({ override: true });

import { NarrativeDirector } from "./agent.js";

async function main() {
  console.log("[run] Initializing NarrativeDirector...");
  const director = new NarrativeDirector();
  await director.init();

  const sessionId = `test_${Date.now()}`;
  const startTime = Date.now() - 8 * 60 * 1000; // 8 minutes ago

  const event = {
    type: "page_load",
    pageId: "volume-04",
    timestamp: Date.now(),
  };

  const signature = {
    sessionId,
    startTime,
    pagesVisited: ["index", "search-results", "volume-04"],
    searches: [
      { query: "4楼", timestamp: startTime + 120000 },
      { query: "404", timestamp: startTime + 180000 },
    ],
    anomaliesTriggered: ["scrollbar-glitched"],
    ruleViolations: ["scrollbar", "copy-hijack"],
    copies: 2,
    totalScrollDepth: 4.2,
  };

  console.log("[run] Calling evaluate...");
  const decision = await director.evaluateWithFallback(
    sessionId,
    event,
    signature
  );

  console.log("\n=== NarrativeDecision ===");
  console.log(JSON.stringify(decision, null, 2));
}

main().catch((err) => {
  console.error("[run] Failed:", err);
  process.exit(1);
});
