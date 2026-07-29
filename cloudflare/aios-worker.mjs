const SAFETY_TYPE = "AIOS_CLOUDFLARE_OPERATION_WORKER_STATUS";

const defaultHeaders = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store"
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: defaultHeaders
  });
}

function operationStatus(trigger = "http") {
  return {
    safetyType: SAFETY_TYPE,
    generatedAt: new Date().toISOString(),
    trigger,
    mode: "MONITORING_ONLY",
    liveBrokerWriteAllowed: false,
    tossOrderSubmissionAllowed: false,
    moneyMovementAllowed: false,
    dashboard: "Cloudflare Pages",
    runtime: "Cloudflare Workers Cron",
    jobs: [
      "site_health_check",
      "scheduler_heartbeat",
      "future_market_data_sync_gate",
      "future_account_sync_gate",
      "future_news_ai_candidate_gate",
      "future_reconciliation_gate"
    ],
    blockers: [
      "broker_write_adapter_not_enabled",
      "live_trading_human_gate_not_resolved",
      "secret_bindings_not_verified_in_this_worker"
    ],
    nextHumanChecks: [
      "Add Cloudflare Secrets for Toss, Naver, and AI providers only after legal/broker gates are resolved.",
      "Keep this Worker in monitoring-only mode until broker-write approval is explicit.",
      "Connect alert delivery after sanitized monitoring is verified."
    ]
  };
}

export default {
  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname === "/" || url.pathname === "/operation-status") {
      return json(operationStatus("http"));
    }

    if (url.pathname === "/health") {
      return json({
        safetyType: SAFETY_TYPE,
        status: "OK",
        liveBrokerWriteAllowed: false,
        generatedAt: new Date().toISOString()
      });
    }

    return json(
      {
        safetyType: SAFETY_TYPE,
        error: "not_found",
        availableRoutes: ["/health", "/operation-status"],
        liveBrokerWriteAllowed: false
      },
      404
    );
  },

  async scheduled(controller, env, ctx) {
    const status = operationStatus(`cron:${controller.cron}`);
    console.log(JSON.stringify(status));
  }
};
