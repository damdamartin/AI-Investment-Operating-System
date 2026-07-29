import { appendFile } from "node:fs/promises";
import { loadPipelineConfig } from "../config/pipeline-config.js";
import { D1HttpClient } from "../persistence/d1-http-client.js";
import { PipelineRepository } from "../persistence/pipeline-repository.js";
import { runAutoRecommendationCycle } from "../application/pipeline/auto-recommendation-orchestrator.js";
import { PlaceholderMarketDataProvider } from "../application/pipeline/market-data-provider.js";

/**
 * Entrypoint invoked by the scheduled GitHub Actions workflow
 * (.github/workflows/trading-cycle.yml). Runs one full automated
 * recommendation cycle and prints a human-readable summary. This process
 * never places a real broker order - see
 * src/application/pipeline/auto-recommendation-orchestrator.ts.
 */
async function main(): Promise<void> {
  const config = loadPipelineConfig(process.env);
  const db = new D1HttpClient({
    accountId: config.d1.accountId,
    databaseId: config.d1.databaseId,
    apiToken: config.d1.apiToken
  });
  const repository = new PipelineRepository(db);
  const marketDataProvider = new PlaceholderMarketDataProvider();

  const result = await runAutoRecommendationCycle({
    repository,
    marketDataProvider,
    config,
    now: () => new Date()
  });

  const lines: string[] = [];
  lines.push(`# Auto-trading cycle ${result.cycleRunId}`);
  lines.push("");
  lines.push("| Symbol | Outcome | Detail |");
  lines.push("| --- | --- | --- |");
  for (const asset of result.assetOutcomes) {
    lines.push(`| ${asset.symbol} | ${asset.outcome} | ${asset.detail?.join(", ") ?? ""} |`);
  }

  const recommendations = await repository.listPendingRecommendations();
  lines.push("");
  lines.push(`## Pending human-submission recommendations (${recommendations.length})`);
  if (recommendations.length === 0) {
    lines.push("");
    lines.push("None. This pipeline never places a real order - a recommendation only appears here after passing risk and money checks, and a human must place any real order themselves.");
  } else {
    lines.push("");
    lines.push("| Direction | Quantity | Amount | Currency | Reasoning |");
    lines.push("| --- | --- | --- | --- | --- |");
    for (const rec of recommendations) {
      lines.push(
        `| ${rec.direction} | ${rec.recommended_quantity} | ${rec.recommended_amount_major} | ${rec.recommended_currency} | ${rec.reasoning ?? ""} |`
      );
    }
  }

  const summary = lines.join("\n");
  console.log(summary);

  if (process.env.GITHUB_STEP_SUMMARY) {
    await appendFile(process.env.GITHUB_STEP_SUMMARY, `${summary}\n`);
  }
}

main().catch((error) => {
  console.error("Trading cycle failed:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
