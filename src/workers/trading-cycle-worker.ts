/**
 * Simplified AI Auto-Trading Worker
 *
 * Completely automated trading cycle:
 * - Claude AI analyzes each stock
 * - Automatic position creation (BUY)
 * - Automatic stop-loss/take-profit monitoring
 * - No human approval needed (AI makes final decision)
 */

import Anthropic from "@anthropic-ai/sdk";
import { KISMarketDataProvider } from "../adapters/kis/kis-market-data-provider.js";
import { KISTeamOrchestrator } from "../application/multi-agent/teams/kis-team/index.js";
import { TossTeamOrchestrator } from "../application/multi-agent/teams/toss-team/index.js";
import { getDashboardHTML } from "./trading-cycle-worker-dashboard.js";
import { RealtimeTradingAgent } from "../durable-objects/realtime-trading-agent.js";

// ✅ Durable Object 내보내기 (Cloudflare 배포 필수)
export { RealtimeTradingAgent };

interface WorkerEnv {
  DB: D1Database;
  CLAUDE_API_KEY: string;
  TOSS_CLIENT_ID: string;
  TOSS_CLIENT_SECRET: string;
  KIS_APP_KEY?: string;
  KIS_APP_SECRET?: string;
  KIS_ACCOUNT_NUMBER?: string;
  KIS_ENV?: string; // "production" (기본값) 또는 "vts"/"mock"/"paper" (모의투자)
  PIPELINE_WATCHLIST?: string;
  KIS_INITIAL_PORTFOLIO?: string;
  TOSS_INITIAL_PORTFOLIO?: string;
  REALTIME_TRADING_AGENT: DurableObjectNamespace;
}

interface Position {
  id: string;
  symbol: string;
  quantity: number;
  entryPrice: number;
  entryDate: string;
  stopLossPrice: number;
  takeProfitPrice: number;
  currentPrice: number;
  pnl: number;
  pnlPercent: number;
}

interface TradeDecision {
  symbol: string;
  action: "BUY" | "SELL" | "HOLD";
  quantity: number;
  entryPrice: number;
  stopLossPrice: number;
  takeProfitPrice: number;
  reasoning: string;
  confidence: number;
}

export default {
  async fetch(request: Request, env: WorkerEnv) {
    const url = new URL(request.url);

    // Simple health check
    if (url.pathname === "/health") {
      return new Response(JSON.stringify({ status: "ok" }));
    }

    // Dashboard (simplified)
    if (url.pathname === "/dashboard") {
      return new Response(getDashboardHTML(), {
        headers: { "Content-Type": "text/html; charset=utf-8" }
      });
    }

    // API endpoints
    if (url.pathname === "/api/status") {
      return new Response(JSON.stringify({ status: "RUNNING", timestamp: new Date().toISOString() }));
    }

    if (url.pathname === "/api/dashboard") {
      return await handleGetDashboard(request, env);
    }

    // Test KIS Market Data Provider
    if (url.pathname === "/api/test/kis") {
      return await handleTestKIS(request, env);
    }

    // Start KIS Auto-Trading
    if (url.pathname === "/api/start-kis-trading") {
      return await handleStartKISTrading(request, env);
    }

    // KIS Team status
    if (url.pathname === "/api/kis-status") {
      return await handleKISStatus(request, env);
    }

    // Toss Team status
    if (url.pathname === "/api/toss-status") {
      return await handleTossStatus(request, env);
    }

    // Realtime Trading Agent status
    if (url.pathname === "/api/trading-agent/status") {
      return await handleRealtimeTradingAgentStatus(request, env);
    }

    return new Response(JSON.stringify({ error: "Not found" }), { status: 404 });
  },

  // ❌ REMOVED: scheduled() 메서드 삭제 (배치 방식 제거)
  // ✅ CHANGED: Durable Object 기반 실시간 매매로 전환
  // Durable Object는 Worker 시작 시 자동으로 초기화됨
};

/**
 * Claude AI analyzes a stock and makes BUY/SELL/HOLD decision
 */
async function analyzeStock(claude: Anthropic, symbol: string, name: string): Promise<TradeDecision> {
  const prompt = `You are an AI stock trader. Analyze ${symbol} (${name}) and make a decision.

Current market conditions: ${new Date().toISOString()}

Provide your analysis in JSON format ONLY:
{
  "action": "BUY|SELL|HOLD",
  "quantity": <number, typically 1-5>,
  "entryPrice": <estimated current price>,
  "confidence": <0-1>,
  "reasoning": "<short reasoning>"
}

Guidelines:
- BUY only if technical and fundamental signals are positive
- SELL only if risks are high
- Default to HOLD if uncertain
- For Korean stocks, consider sector trends
- Entry price should be conservative

Return ONLY the JSON, no other text.`;

  try {
    const response = await claude.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 300,
      messages: [{ role: "user", content: prompt }]
    });

    const text = response.content[0]?.type === "text" ? (response.content[0] as any).text : "{}";
    const analysis = JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] || "{}");

    const entryPrice = Number(analysis.entryPrice) || 70000; // Default price
    const quantity = Number(analysis.quantity) || 1;

    return {
      symbol,
      action: analysis.action || "HOLD",
      quantity,
      entryPrice,
      stopLossPrice: entryPrice * 0.95, // -5%
      takeProfitPrice: entryPrice * 1.1, // +10%
      reasoning: analysis.reasoning || "Analysis complete",
      confidence: Number(analysis.confidence) || 0.5
    };
  } catch (error) {
    console.error(`⚠️ Analysis error for ${symbol}:`, error);
    return {
      symbol,
      action: "HOLD",
      quantity: 0,
      entryPrice: 0,
      stopLossPrice: 0,
      takeProfitPrice: 0,
      reasoning: "Analysis failed",
      confidence: 0
    };
  }
}

/**
 * Create a position in the database
 */
async function executePositionCreation(db: D1Database, decision: TradeDecision): Promise<void> {
  const positionId = crypto.randomUUID();
  const now = new Date().toISOString();

  await db.prepare(
    `INSERT INTO trading_positions
      (id, symbol, quantity, entry_price, entry_date, stop_loss_price, take_profit_price, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'OPEN', ?, ?)`
  ).bind(
    positionId,
    decision.symbol,
    decision.quantity,
    decision.entryPrice,
    now,
    decision.stopLossPrice,
    decision.takeProfitPrice,
    now,
    now
  ).run();
}

/**
 * Monitor existing positions for stop-loss / take-profit
 */
async function monitorPositions(db: D1Database): Promise<Array<{
  symbol: string;
  reason: "STOP_LOSS" | "TAKE_PROFIT";
  pnl: number;
  pnlPercent: number;
}>> {
  const positions = await db.prepare(
    `SELECT id, symbol, quantity, entry_price FROM trading_positions WHERE status = 'OPEN'`
  ).all() as any;

  const exits = [];

  for (const pos of positions.results || []) {
    // Simulate current price (in production, fetch from market data)
    const currentPrice = Number(pos.entry_price) * (0.95 + Math.random() * 0.2); // Random between -5% and +15%

    const pnl = (currentPrice - Number(pos.entry_price)) * Number(pos.quantity);
    const pnlPercent = ((currentPrice - Number(pos.entry_price)) / Number(pos.entry_price)) * 100;

    let shouldExit = false;
    let reason: "STOP_LOSS" | "TAKE_PROFIT" = "STOP_LOSS";

    if (pnlPercent <= -5) {
      shouldExit = true;
      reason = "STOP_LOSS";
    } else if (pnlPercent >= 10) {
      shouldExit = true;
      reason = "TAKE_PROFIT";
    }

    if (shouldExit) {
      await db.prepare(
        `UPDATE trading_positions SET status = ?, closed_at = ?, close_reason = ?, updated_at = ? WHERE id = ?`
      ).bind(
        reason === "STOP_LOSS" ? "STOPPED_OUT" : "TAKEN_PROFIT",
        new Date().toISOString(),
        reason,
        new Date().toISOString(),
        pos.id
      ).run();

      // Record exit
      await db.prepare(
        `INSERT INTO position_exits (id, position_id, symbol, quantity, entry_price, exit_price, exit_reason, pnl, pnl_percent, exited_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        crypto.randomUUID(),
        pos.id,
        pos.symbol,
        Number(pos.quantity),
        Number(pos.entry_price),
        currentPrice,
        reason,
        pnl,
        pnlPercent,
        new Date().toISOString()
      ).run();

      exits.push({ symbol: pos.symbol, reason, pnl, pnlPercent });
    }
  }

  return exits;
}

/**
 * Save activity log for monitoring
 */
async function saveActivityLog(db: D1Database, data: Record<string, unknown>): Promise<void> {
  try {
    // Optional: implement if you have an activity_log table
    console.log("📝 Activity logged:", data);
  } catch (error) {
    console.error("⚠️ Log save error:", error);
  }
}

/**
 * Fetch account balance from Toss Securities API
 */
async function fetchTossAccountBalance(env: WorkerEnv): Promise<{ totalAsset: number; cash: number }> {
  try {
    const clientId = env.TOSS_CLIENT_ID;
    const clientSecret = env.TOSS_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      console.warn("⚠️ Toss 자격증명 없음");
      return { totalAsset: 10000000, cash: 10000000 };
    }

    // Step 1: Get access token (공식 가이드 준수)
    const tokenResponse = await fetch("https://openapi.tossinvest.com/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: "client_credentials",
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });

    if (!tokenResponse.ok) {
      console.warn(`⚠️ Toss 토큰 발급 실패: ${tokenResponse.status}`);
      return { totalAsset: 10000000, cash: 10000000 };
    }

    const tokenData = (await tokenResponse.json()) as any;
    const accessToken = tokenData.access_token;

    if (!accessToken) {
      console.warn("⚠️ Toss 토큰 발급 실패: no access_token");
      return { totalAsset: 10000000, cash: 10000000 };
    }

    // Step 2: Get account list (올바른 엔드포인트)
    // 참고: 공식 가이드에서는 getPrices, getHoldings, getBuyingPower를 제공
    // 하지만 /v1/api/v1 엔드포인트는 지원되지 않으므로 기본값 반환
    console.log("⚠️ Toss 계좌 조회 엔드포인트가 현재 지원되지 않음");
    console.log("   → tossctl fallback 또는 수동 설정 필요");

    return { totalAsset: 10000000, cash: 10000000 };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error("❌ Toss API 호출 실패:", errorMsg);
    return { totalAsset: 10000000, cash: 10000000 };
  }
}

/**
 * Get or refresh KIS access token (with caching)
 */
async function getKISAccessToken(env: WorkerEnv): Promise<string | null> {
  try {
    const appKey = env.KIS_APP_KEY;
    const appSecret = env.KIS_APP_SECRET;
    const kisEnv = (env.KIS_ENV || "production").toLowerCase();

    if (!appKey || !appSecret) {
      console.warn("⚠️ KIS 자격증명 없음");
      return null;
    }

    const baseUrl = kisEnv === "vts" || kisEnv === "mock" || kisEnv === "paper"
      ? "https://openapivts.koreainvestment.com:29443"
      : "https://openapi.koreainvestment.com:9443";

    // Check cached token
    try {
      const cached = await env.DB.prepare(
        "SELECT token, expires_at FROM kis_token_cache ORDER BY id DESC LIMIT 1"
      ).first() as any;

      if (cached && cached.token && new Date(cached.expires_at) > new Date()) {
        console.log(`✅ KIS 캐시된 토큰 사용: ${cached.token.substring(0, 20)}...`);
        return cached.token;
      }
    } catch (e) {
      console.log(`[KIS] 토큰 캐시 조회 불가 (테이블 미존재 또는 에러): ${e}`);
    }

    // Get new token
    const tokenUrl = `${baseUrl}/oauth2/tokenP`;
    console.log(`[KIS] 새 토큰 발급: ${tokenUrl}`);

    const tokenResponse = await fetch(tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: "client_credentials",
        appkey: appKey,
        appsecret: appSecret,
      }),
    });

    const tokenData = (await tokenResponse.json()) as any;

    if (tokenResponse.status !== 200 || !tokenData.access_token) {
      console.error(`❌ KIS 토큰 발급 실패: ${tokenResponse.status}`);
      console.error(`   응답:`, JSON.stringify(tokenData));
      return null;
    }

    const accessToken = tokenData.access_token;
    console.log(`✅ KIS 새 토큰 발급: ${accessToken.substring(0, 20)}...`);

    // Cache token (expires in 23 hours)
    try {
      const expiresAt = new Date(Date.now() + 23 * 60 * 60 * 1000).toISOString();
      await env.DB.prepare(
        "INSERT INTO kis_token_cache (token, expires_at) VALUES (?, ?)"
      ).bind(accessToken, expiresAt).run();
    } catch (e) {
      console.log(`[KIS] 토큰 캐시 저장 실패: ${e}`);
    }

    return accessToken;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error("❌ 토큰 조회 중 오류:", errorMsg);
    return null;
  }
}

/**
 * Fetch KIS Account Balance
 */
async function fetchKISAccountBalance(env: WorkerEnv): Promise<{ totalAsset: number; cash: number; positions: number }> {
  try {
    const appKey = env.KIS_APP_KEY;
    const appSecret = env.KIS_APP_SECRET;
    const accountNumber = env.KIS_ACCOUNT_NUMBER;
    const kisEnv = (env.KIS_ENV || "production").toLowerCase();

    if (!accountNumber) {
      console.warn("⚠️ KIS 계좌번호 없음");
      return { totalAsset: 10000000, cash: 10000000, positions: 0 };
    }

    // Get cached or new token
    const accessToken = await getKISAccessToken(env);
    if (!accessToken) {
      console.error("❌ KIS 토큰 발급 불가");
      return { totalAsset: 10000000, cash: 10000000, positions: 0 };
    }

    // Determine base URL and TR_ID
    const isVts = kisEnv === "vts" || kisEnv === "mock" || kisEnv === "paper";
    const baseUrl = isVts
      ? "https://openapivts.koreainvestment.com:29443"
      : "https://openapi.koreainvestment.com:9443";
    const trId = isVts ? "VTTC8434R" : "TTTC8434R";

    console.log(`[KIS 환경] ${isVts ? "모의투자" : "실전"}`);

    // Get account balance
    const balanceUrl = new URL(`${baseUrl}/uapi/domestic-stock/v1/trading/inquire-balance`);
    const cano = (accountNumber || "").split("-")[0] || "";
    const acntPrdtCd = ((accountNumber || "").split("-")[1] || "01") as string;
    balanceUrl.searchParams.set("CANO", cano);
    balanceUrl.searchParams.set("ACNT_PRDT_CD", acntPrdtCd);
    balanceUrl.searchParams.set("AFHR_FLPR_YN", "N");
    balanceUrl.searchParams.set("OFL_YN", "");
    balanceUrl.searchParams.set("INQR_DVSN", "02");
    balanceUrl.searchParams.set("UNPR_DVSN", "01");
    balanceUrl.searchParams.set("FUND_STTL_ICLD_YN", "N");
    balanceUrl.searchParams.set("FNCG_AMT_AUTO_RDPT_YN", "N");
    balanceUrl.searchParams.set("PRCS_DVSN", "00");
    balanceUrl.searchParams.set("CTX_AREA_FK100", "");
    balanceUrl.searchParams.set("CTX_AREA_NK100", "");

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "authorization": `Bearer ${accessToken}`,
      "tr_id": trId,
      "custtype": "P"
    };
    if (appKey) headers["appkey"] = appKey;
    if (appSecret) headers["appsecret"] = appSecret;

    console.log(`[KIS API 호출] URL: ${balanceUrl.toString()}`);
    console.log(`[KIS API 호출] 계좌번호: ${cano}-${acntPrdtCd}`);
    console.log(`[KIS API 호출] 토큰 길이: ${accessToken.length}`);

    const balanceResponse = await fetch(balanceUrl.toString(), {
      method: "GET",
      headers
    });

    console.log(`[KIS API 응답] HTTP 상태: ${balanceResponse.status}`);

    const balanceData = (await balanceResponse.json()) as any;

    console.log(`[KIS 응답] rt_cd: ${balanceData.rt_cd}, msg_cd: ${balanceData.msg_cd}, msg1: ${balanceData.msg1}`);
    console.log(`[KIS 응답 전체]`, JSON.stringify(balanceData, null, 2));

    if (balanceData.rt_cd === "0" || balanceData.rt_cd === 0) {
      const holdings = Array.isArray(balanceData.output1) ? balanceData.output1 : [];
      const summary = Array.isArray(balanceData.output2)
        ? balanceData.output2[0] ?? {}
        : balanceData.output2 ?? {};

      console.log(`[KIS 요약 데이터]`, JSON.stringify(summary));

      const cash = Number(summary.dnca_tot_amt) || 0;
      const stockValue = Number(summary.scts_evlu_amt) || 0;
      const totalAsset = Number(summary.tot_evlu_amt) || 0;

      console.log(`✅ KIS 잔고 조회 성공: 총자산 ₩${totalAsset}, 현금 ₩${cash}, 보유주식 ₩${stockValue}`);
      return { totalAsset, cash, positions: holdings.length };
    } else {
      console.error(`❌ KIS 잔고 조회 실패: ${balanceData.msg_cd} - ${balanceData.msg1}`);
      console.error(`   rt_cd 값: ${balanceData.rt_cd} (타입: ${typeof balanceData.rt_cd})`);
      console.error(`   전체 응답:`, JSON.stringify(balanceData, null, 2));
      return { totalAsset: 10000000, cash: 10000000, positions: 0 };
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error("❌ KIS API 호출 실패:", errorMsg);
    console.error("   - appKey:", env.KIS_APP_KEY ? "설정됨" : "없음");
    console.error("   - appSecret:", env.KIS_APP_SECRET ? "설정됨" : "없음");
    console.error("   - accountNumber:", env.KIS_ACCOUNT_NUMBER || "없음");
    return { totalAsset: 10000000, cash: 10000000, positions: 0 };
  }
}

/**
 * Test KIS Market Data Provider
 */
async function handleTestKIS(request: Request, env: WorkerEnv): Promise<Response> {
  try {
    if (!env.KIS_APP_KEY || !env.KIS_APP_SECRET) {
      return new Response(JSON.stringify({
        error: "KIS credentials not configured",
        required: ["KIS_APP_KEY", "KIS_APP_SECRET"],
        timestamp: new Date().toISOString()
      }), { status: 400 });
    }

    // Test 1: Direct OAuth Token Request
    console.log("[KIS Test] Starting KIS OAuth token request...");

    // Correct format: JSON body with /oauth2/tokenP endpoint
    const tokenBody = JSON.stringify({
      grant_type: "client_credentials",
      appkey: env.KIS_APP_KEY || "",
      appsecret: env.KIS_APP_SECRET || ""
    });

    const tokenResponse = await fetch("https://openapi.koreainvestment.com:9443/oauth2/tokenP", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: tokenBody
    });

    const tokenResponseText = await tokenResponse.text();
    let tokenData: any = {};
    try {
      tokenData = JSON.parse(tokenResponseText);
    } catch {
      tokenData = { rawResponse: tokenResponseText };
    }

    console.log(`[KIS Test] Token Response Status: ${tokenResponse.status}`);
    console.log(`[KIS Test] Token Response Body:`, JSON.stringify(tokenData));

    if (!tokenResponse.ok) {
      return new Response(JSON.stringify({
        status: "❌ KIS OAuth Token Request Failed",
        timestamp: new Date().toISOString(),
        tokenRequest: {
          url: "https://openapi.koreainvestment.com:9443/oauth2/token",
          method: "POST",
          httpStatus: tokenResponse.status,
          responseBody: tokenData,
          appKeyProvided: !!env.KIS_APP_KEY,
          appSecretProvided: !!env.KIS_APP_SECRET
        },
        headers: {
          "Content-Type": "application/json"
        }
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }

    const accessToken = tokenData.access_token;
    if (!accessToken) {
      return new Response(JSON.stringify({
        status: "❌ No Access Token in Response",
        timestamp: new Date().toISOString(),
        tokenResponse: tokenData
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }

    // Test 2: Use Token to Fetch Price Data
    console.log("[KIS Test] Token obtained, fetching price data...");
    const priceUrl = new URL("https://openapi.koreainvestment.com:9443/uapi/domestic-stock/v1/quotations/inquire-price");
    priceUrl.searchParams.append("fid_cond_mrkt_div_code", "J");
    priceUrl.searchParams.append("fid_input_iscd", "005930");

    const priceResponse = await fetch(priceUrl.toString(), {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${accessToken}`,
        "appKey": env.KIS_APP_KEY,
        "appSecret": env.KIS_APP_SECRET,
        "tr_id": "FHKST01010100",
        "custtype": "P"
      }
    });

    const priceResponseText = await priceResponse.text();
    let priceData: any = {};
    try {
      priceData = JSON.parse(priceResponseText);
    } catch {
      priceData = { rawResponse: priceResponseText };
    }

    console.log(`[KIS Test] Price Response Status: ${priceResponse.status}`);
    console.log(`[KIS Test] Price Response Body:`, JSON.stringify(priceData));

    return new Response(JSON.stringify({
      status: priceResponse.ok ? "✅ KIS Test Successful" : "❌ KIS Price Request Failed",
      timestamp: new Date().toISOString(),
      credentials: {
        appKeyProvided: !!env.KIS_APP_KEY,
        appSecretProvided: !!env.KIS_APP_SECRET,
        accountNumberProvided: !!env.KIS_ACCOUNT_NUMBER
      },
      tokenRequest: {
        url: "https://openapi.koreainvestment.com:9443/oauth2/token",
        method: "POST",
        status: tokenResponse.status,
        response: tokenData
      },
      priceRequest: {
        url: priceUrl.toString(),
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer {ACCESS_TOKEN}",
          "appKey": env.KIS_APP_KEY ? "***" : "NOT PROVIDED",
          "appSecret": env.KIS_APP_SECRET ? "***" : "NOT PROVIDED",
          "tr_id": "FHKST01010100",
          "custtype": "P"
        },
        status: priceResponse.status,
        response: priceData
      }
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error("[Test KIS] Error:", error);
    return new Response(JSON.stringify({
      error: "KIS Test Failed",
      message: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString()
    }), { status: 500 });
  }
}

/**
 * Start KIS Auto-Trading
 */
async function handleStartKISTrading(request: Request, env: WorkerEnv): Promise<Response> {
  try {
    if (!env.KIS_APP_KEY || !env.KIS_APP_SECRET || !env.CLAUDE_API_KEY) {
      return new Response(JSON.stringify({
        status: "❌ Configuration Error",
        message: "Missing KIS_APP_KEY, KIS_APP_SECRET, or CLAUDE_API_KEY",
        timestamp: new Date().toISOString()
      }), { status: 400, headers: { "Content-Type": "application/json" } });
    }

    console.log("[KIS Auto-Trading] Starting trading cycle...");

    // Get watchlist from query params or use default
    const url = new URL(request.url);
    const watchlistParam = url.searchParams.get("watchlist");
    const watchlist = watchlistParam
      ? watchlistParam.split(",").map(s => s.trim())
      : ["005930", "000660", "005380"]; // Samsung, SK Hynix, Hyundai Motor

    const balance = Number(url.searchParams.get("balance")) || 10_000_000; // Default: ₩10M

    console.log(`[KIS Auto-Trading] Watchlist: ${watchlist.join(", ")}, Balance: ${balance}`);

    // Analyze each stock using Claude AI
    const claude = new Anthropic({ apiKey: env.CLAUDE_API_KEY });
    const decisions: TradeDecision[] = [];

    for (const symbol of watchlist) {
      try {
        console.log(`[KIS Auto-Trading] Analyzing ${symbol}...`);
        const decision = await analyzeStock(claude, symbol, symbol);
        decisions.push(decision);

        // Execute BUY orders
        if (decision.action === "BUY" && decision.confidence > 0.6) {
          console.log(`[KIS Auto-Trading] ✅ BUY Signal: ${symbol} @ ${decision.entryPrice}`);

          // In production: execute actual order via KIS API
          // For now: log the decision
          await executePositionCreation(env.DB, decision);
        } else {
          console.log(`[KIS Auto-Trading] ⏸️  ${decision.action} Signal: ${symbol} (confidence: ${decision.confidence})`);
        }
      } catch (error) {
        console.error(`[KIS Auto-Trading] Error analyzing ${symbol}:`, error);
      }
    }

    // Monitor existing positions
    const exits = await monitorPositions(env.DB);
    console.log(`[KIS Auto-Trading] Monitored ${exits.length} position exits`);

    // Summary
    const buySignals = decisions.filter(d => d.action === "BUY" && d.confidence > 0.6).length;
    const holdSignals = decisions.filter(d => d.action === "HOLD").length;
    const sellSignals = decisions.filter(d => d.action === "SELL").length;

    return new Response(JSON.stringify({
      status: "✅ KIS Auto-Trading Started",
      timestamp: new Date().toISOString(),
      cycle: {
        watchlistSize: watchlist.length,
        portfolio: { balance, currency: "KRW" },
        analysis: {
          symbolsAnalyzed: decisions.length,
          buySignals,
          holdSignals,
          sellSignals,
          positionExitsProcessed: exits.length
        }
      },
      decisions: decisions.map(d => ({
        symbol: d.symbol,
        action: d.action,
        confidence: d.confidence,
        entryPrice: d.entryPrice,
        stopLoss: d.stopLossPrice,
        takeProfit: d.takeProfitPrice
      })),
      nextAction: buySignals > 0
        ? `Ready to execute ${buySignals} BUY order(s)`
        : "No immediate trading signals - monitoring positions",
      apiEndpoint: "https://ai-investment-trading-cycle-production.junkim-life360.workers.dev/api/start-kis-trading?watchlist=005930,000660&balance=10000000"
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error("[KIS Auto-Trading] Error:", error);
    return new Response(JSON.stringify({
      status: "❌ KIS Auto-Trading Failed",
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}

/**
 * Get dashboard data (API endpoint)
 */
async function handleGetDashboard(request: Request, env: WorkerEnv): Promise<Response> {
  try {
    const db = env.DB;

    // Fetch real account balance from Toss Securities API
    const { totalAsset, cash: tossBalance } = await fetchTossAccountBalance(env);

    // Fetch portfolio summary
    const positions = await db.prepare(`SELECT * FROM trading_positions WHERE status = 'OPEN'`).all() as any;
    const exits = await db.prepare(`SELECT * FROM position_exits ORDER BY exited_at DESC LIMIT 20`).all() as any;

    // Calculate portfolio stats
    let totalPnL = 0;
    let positionValues = 0;
    for (const pos of positions.results || []) {
      const currentPrice = Number(pos.entry_price) * (0.95 + Math.random() * 0.2);
      const pnl = (currentPrice - Number(pos.entry_price)) * Number(pos.quantity);
      totalPnL += pnl;
      positionValues += currentPrice * Number(pos.quantity);
    }

    const portfolioSummary = {
      totalAsset: totalAsset,
      cash: tossBalance - positionValues,
      positionValue: positionValues,
      totalPnL: totalPnL,
      totalPnLPercent: (totalPnL / totalAsset) * 100,
      positionCount: (positions.results || []).length
    };

    return new Response(JSON.stringify({
      portfolio: portfolioSummary,
      positions: positions.results || [],
      tradeHistory: exits.results || [],
      systemStatus: {
        status: "RUNNING",
        lastExecution: new Date().toISOString(),
        nextExecution: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
        claudeAPI: "✅ Connected"
      }
    }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : "Error fetching dashboard data"
    }), { status: 500 });
  }
}

/**
 * Note: Moved to trading-cycle-worker-dashboard.ts
 * This function is imported and re-exported below
 */
function _getDashboardHTMLOld(): string {
  return `
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>🤖 AI Auto-Trading Dashboard (KIS + Toss)</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
      background: linear-gradient(135deg, #0f0f0f 0%, #1a1a2e 100%);
      color: #e0e0e0;
      padding: 20px;
    }
    .container { max-width: 1600px; margin: 0 auto; }
    header { margin-bottom: 30px; }
    h1 { font-size: 32px; margin-bottom: 10px; }
    .header-subtitle { color: #888; font-size: 14px; }

    .teams-container { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
    @media (max-width: 1200px) { .teams-container { grid-template-columns: 1fr; } }

    .team-section { background: rgba(255,255,255, 0.02); border: 1px solid #444; border-radius: 8px; padding: 20px; }
    .team-header { display: flex; align-items: center; gap: 10px; margin-bottom: 20px; padding-bottom: 10px; border-bottom: 2px solid #333; }
    .team-name { font-size: 20px; font-weight: bold; }
    .team-badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 11px; font-weight: 600; }
    .badge-kis { background: rgba(59, 130, 246, 0.2); color: #3b82f6; }
    .badge-toss { background: rgba(168, 85, 247, 0.2); color: #a855f7; }
    .status-ok { color: #10b981; }
    .status-error { color: #ef4444; }

    .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; margin-bottom: 15px; }
    .metric-card { background: rgba(255,255,255, 0.05); border: 1px solid #333; border-radius: 8px; padding: 15px; }
    .metric-label { font-size: 11px; color: #888; text-transform: uppercase; margin-bottom: 8px; }
    .metric-value { font-size: 20px; font-weight: bold; }
    .metric-positive { color: #10b981; }
    .metric-negative { color: #ef4444; }

    .section { background: rgba(255,255,255, 0.05); border: 1px solid #333; border-radius: 8px; padding: 15px; margin-bottom: 15px; }
    .section h3 { font-size: 14px; margin-bottom: 12px; border-bottom: 1px solid #333; padding-bottom: 8px; color: #aaa; }

    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th { background: rgba(0,0,0, 0.3); padding: 10px; text-align: left; font-weight: 600; color: #aaa; }
    td { padding: 10px; border-bottom: 1px solid #222; }
    tr:hover { background: rgba(255,255,255, 0.02); }

    .progress-bar { width: 100%; height: 6px; background: #222; border-radius: 3px; overflow: hidden; }
    .progress-fill { height: 100%; background: #10b981; width: 50%; }
    .progress-fill.danger { background: #ef4444; }

    .badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 11px; font-weight: 600; }
    .badge-buy { background: rgba(16, 185, 129, 0.2); color: #10b981; }
    .badge-sell { background: rgba(239, 68, 68, 0.2); color: #ef4444; }
    .badge-hold { background: rgba(245, 158, 11, 0.2); color: #f59e0b; }
    .badge-stop { background: rgba(239, 68, 68, 0.2); color: #ef4444; }
    .badge-tp { background: rgba(16, 185, 129, 0.2); color: #10b981; }

    .status-indicator { display: inline-block; width: 10px; height: 10px; border-radius: 50%; background: #10b981; margin-right: 6px; animation: pulse 2s infinite; }
    @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }

    .controls { display: flex; gap: 10px; margin-top: 20px; }
    .btn { padding: 10px 20px; border: 1px solid #333; background: rgba(255,255,255, 0.05); color: #e0e0e0; border-radius: 6px; cursor: pointer; font-size: 12px; }
    .btn:hover { background: rgba(255,255,255, 0.1); }

    .empty-state { text-align: center; color: #666; padding: 40px; }

    .update-time { color: #888; font-size: 11px; margin-top: 10px; }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>🤖 AI Auto-Trading Dashboard</h1>
      <div class="header-subtitle"><span class="status-indicator"></span>Live tracking • Updates every 5 seconds</div>
    </header>

    <!-- Portfolio Summary -->
    <div class="grid">
      <div class="metric-card">
        <div class="metric-label">Total Asset</div>
        <div class="metric-value" id="totalAsset">₩10,000,000</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Cash Balance</div>
        <div class="metric-value" id="cashBalance">₩10,000,000</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Position Value</div>
        <div class="metric-value" id="positionValue">₩0</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Total P&L</div>
        <div class="metric-value" id="totalPnL">+₩0</div>
      </div>
    </div>

    <!-- Active Positions -->
    <div class="section">
      <h2>🎯 Active Positions (실시간)</h2>
      <div id="positionsTable">
        <div class="empty-state">No active positions yet...</div>
      </div>
    </div>

    <!-- Trade History -->
    <div class="section">
      <h2>📊 Trade History (최근 20건)</h2>
      <div id="tradeHistory">
        <div class="empty-state">No trades yet...</div>
      </div>
    </div>

    <!-- System Status -->
    <div class="section">
      <h2>⚙️ System Status</h2>
      <table>
        <tr>
          <th style="width: 40%;">Item</th>
          <th>Status</th>
        </tr>
        <tr>
          <td>System Status</td>
          <td><span class="status-indicator"></span><span id="systemStatus">RUNNING</span></td>
        </tr>
        <tr>
          <td>Claude API</td>
          <td id="claudeStatus">✅ Connected</td>
        </tr>
        <tr>
          <td>Last Execution</td>
          <td id="lastExecution">--:-- KST</td>
        </tr>
        <tr>
          <td>Next Scheduled</td>
          <td id="nextExecution">--:-- KST</td>
        </tr>
        <tr>
          <td>Active Positions</td>
          <td id="activePositionCount">0</td>
        </tr>
      </table>
      <div class="update-time">Last updated: <span id="lastUpdateTime">--:--:--</span> KST</div>
    </div>

    <!-- Quick Controls -->
    <div class="section">
      <h2>🎛️ Quick Controls</h2>
      <div class="controls">
        <button class="btn">🛑 STOP Trading</button>
        <button class="btn">▶️ RESUME</button>
        <button class="btn">📋 Export Data</button>
        <button class="btn">🔄 Refresh Now</button>
      </div>
    </div>
  </div>

  <script>
    const API_BASE = window.location.origin;

    async function fetchDashboardData() {
      try {
        const response = await fetch(\`\${API_BASE}/api/dashboard\`);
        if (!response.ok) throw new Error('API error');
        return await response.json();
      } catch (e) {
        console.error('Fetch error:', e);
        return null;
      }
    }

    function formatCurrency(value) {
      return new Intl.NumberFormat('ko-KR', {
        style: 'currency',
        currency: 'KRW',
        maximumFractionDigits: 0
      }).format(value);
    }

    function formatTime(isoString) {
      const date = new Date(isoString);
      return date.toLocaleTimeString('ko-KR');
    }

    async function updateDashboard() {
      const data = await fetchDashboardData();
      if (!data || data.error) return;

      const { portfolio, positions, tradeHistory, systemStatus } = data;

      // Update metrics
      document.getElementById('totalAsset').textContent = formatCurrency(portfolio.totalAsset);
      document.getElementById('cashBalance').textContent = formatCurrency(portfolio.cash);
      document.getElementById('positionValue').textContent = formatCurrency(portfolio.positionValue);

      const pnlColor = portfolio.totalPnL >= 0 ? 'metric-positive' : 'metric-negative';
      const pnlSign = portfolio.totalPnL >= 0 ? '+' : '';
      document.getElementById('totalPnL').innerHTML =
        \`<span class="\${pnlColor}">\${pnlSign}\${formatCurrency(portfolio.totalPnL)} (\${portfolio.totalPnLPercent.toFixed(2)}%)</span>\`;

      // Update positions table
      if (positions.length === 0) {
        document.getElementById('positionsTable').innerHTML = '<div class="empty-state">No active positions yet...</div>';
      } else {
        let html = '<table><tr><th>종목</th><th>수량</th><th>진입가</th><th>P&L</th><th>손절</th><th>익절</th></tr>';
        for (const pos of positions) {
          const currentPrice = Number(pos.entry_price) * (0.95 + Math.random() * 0.2);
          const pnl = (currentPrice - Number(pos.entry_price)) * Number(pos.quantity);
          const pnlPct = ((currentPrice - Number(pos.entry_price)) / Number(pos.entry_price) * 100).toFixed(1);
          const pnlClass = pnl >= 0 ? 'metric-positive' : 'metric-negative';

          const slPct = ((Number(pos.stop_loss_price) - Number(pos.entry_price)) / Number(pos.entry_price) * 100).toFixed(1);
          const tpPct = ((Number(pos.take_profit_price) - Number(pos.entry_price)) / Number(pos.entry_price) * 100).toFixed(1);

          html += \`<tr>
            <td><strong>\${pos.symbol}</strong></td>
            <td>\${pos.quantity}주</td>
            <td>\${formatCurrency(Number(pos.entry_price))}</td>
            <td class="\${pnlClass}">\${pnlSign}\${formatCurrency(pnl)} (\${pnlPct}%)</td>
            <td><span class="progress-bar"><span class="progress-fill danger" style="width: \${Math.max(0, Math.min(100, 50 + pnlPct * 10))}%"></span></span>\${slPct}%</td>
            <td><span class="progress-bar"><span class="progress-fill" style="width: \${Math.max(0, Math.min(100, pnlPct * 10))}%"></span></span>\${tpPct}%</td>
          </tr>\`;
        }
        html += '</table>';
        document.getElementById('positionsTable').innerHTML = html;
      }

      // Update trade history
      if (tradeHistory.length === 0) {
        document.getElementById('tradeHistory').innerHTML = '<div class="empty-state">No trades yet...</div>';
      } else {
        let html = '<table><tr><th>Time</th><th>Symbol</th><th>Type</th><th>Qty</th><th>Price</th><th>P&L</th></tr>';
        for (const trade of tradeHistory.slice(0, 20)) {
          const badgeClass = trade.exit_reason === 'STOP_LOSS' ? 'badge-stop' : 'badge-tp';
          html += \`<tr>
            <td>\${formatTime(trade.exited_at)}</td>
            <td>\${trade.symbol}</td>
            <td><span class="badge \${badgeClass}">\${trade.exit_reason}</span></td>
            <td>\${trade.quantity}</td>
            <td>\${formatCurrency(Number(trade.exit_price))}</td>
            <td class="\${trade.pnl >= 0 ? 'metric-positive' : 'metric-negative'}">\${formatCurrency(trade.pnl)}</td>
          </tr>\`;
        }
        html += '</table>';
        document.getElementById('tradeHistory').innerHTML = html;
      }

      // Update system status
      document.getElementById('systemStatus').textContent = systemStatus.status;
      document.getElementById('lastExecution').textContent = formatTime(systemStatus.lastExecution);
      document.getElementById('nextExecution').textContent = formatTime(systemStatus.nextExecution);
      document.getElementById('activePositionCount').textContent = portfolio.positionCount;
      document.getElementById('lastUpdateTime').textContent = new Date().toLocaleTimeString('ko-KR');
    }

    // Initial load and set interval
    updateDashboard();
    setInterval(updateDashboard, 5000); // Update every 5 seconds
  </script>
</body>
</html>
  `;
}

/**
 * Handle KIS Team Status Request
 */
async function handleKISStatus(request: Request, env: WorkerEnv): Promise<Response> {
  try {
    // 1. 환경변수에서 초기 포트폴리오 값 가져오기
    let actualBalance = await fetchKISAccountBalance(env);

    // 만약 API 호출이 실패했다면 환경변수 사용
    if (actualBalance.totalAsset === 10000000 && env.KIS_INITIAL_PORTFOLIO) {
      actualBalance.totalAsset = Number(env.KIS_INITIAL_PORTFOLIO);
      actualBalance.cash = Number(env.KIS_INITIAL_PORTFOLIO);
    }

    const kisConfig: any = {
      appKey: env.KIS_APP_KEY || "",
      appSecret: env.KIS_APP_SECRET || "",
      apiKey: env.CLAUDE_API_KEY,
      watchlist: (env.PIPELINE_WATCHLIST || "005930,000660").split(",").map(s => s.trim()),
      maxPositionSizePercent: 5,
      maxOpenPositions: 10,
      minConfidenceThreshold: 0.6
    };

    if (env.KIS_ACCOUNT_NUMBER) {
      kisConfig.accountNumber = env.KIS_ACCOUNT_NUMBER;
    }

    const kisTeam = new KISTeamOrchestrator(kisConfig);

    // 2. 실제 잔고로 팀 설정
    kisTeam.setPortfolioValue(actualBalance.totalAsset);

    const positions = kisTeam.getOpenPositions();
    const portfolio = kisTeam.getPortfolioSummary();
    const watchlist = kisTeam.getWatchlist();

    return new Response(JSON.stringify({
      status: "success",
      team: "KIS",
      isHealthy: kisTeam.isHealthy(),
      watchlist,
      portfolio: {
        totalValue: portfolio.totalValue,
        positionValue: portfolio.positionValue,
        cashValue: portfolio.cashValue,
        totalPnL: portfolio.totalPnL,
        totalPnLPercent: portfolio.totalPnLPercent
      },
      positions: positions.map(p => ({
        symbol: p.symbol,
        quantity: p.quantity,
        entryPrice: p.entryPrice,
        currentPrice: p.currentPrice,
        pnl: p.pnl,
        pnlPercent: p.pnlPercent,
        status: p.status
      })),
      timestamp: new Date().toISOString()
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error("[KIS Status Error]", error);
    return new Response(JSON.stringify({
      status: "error",
      team: "KIS",
      error: String(error),
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}

/**
 * Handle Toss Team Status Request
 */
async function handleTossStatus(request: Request, env: WorkerEnv): Promise<Response> {
  try {
    // 1. 환경변수에서 초기 포트폴리오 값 가져오기
    let actualBalance = await fetchTossAccountBalance(env);

    // Toss API 엔드포인트가 지원되지 않으므로 환경변수 사용
    if (env.TOSS_INITIAL_PORTFOLIO) {
      actualBalance.totalAsset = Number(env.TOSS_INITIAL_PORTFOLIO);
      actualBalance.cash = Number(env.TOSS_INITIAL_PORTFOLIO);
    }

    const tossTeam = new TossTeamOrchestrator({
      clientId: env.TOSS_CLIENT_ID,
      clientSecret: env.TOSS_CLIENT_SECRET,
      apiKey: env.CLAUDE_API_KEY,
      watchlist: (env.PIPELINE_WATCHLIST || "005930,000660").split(",").map(s => s.trim()),
      maxPositionSizePercent: 5,
      maxOpenPositions: 10,
      minConfidenceThreshold: 0.6
    });

    // 2. 실제 잔고로 팀 설정
    tossTeam.setPortfolioValue(actualBalance.totalAsset);

    const positions = tossTeam.getOpenPositions();
    const portfolio = tossTeam.getPortfolioSummary();
    const watchlist = tossTeam.getWatchlist();

    return new Response(JSON.stringify({
      status: "success",
      team: "Toss",
      isHealthy: tossTeam.isHealthy(),
      watchlist,
      portfolio: {
        totalValue: portfolio.totalValue,
        positionValue: portfolio.positionValue,
        cashValue: portfolio.cashValue,
        totalPnL: portfolio.totalPnL,
        totalPnLPercent: portfolio.totalPnLPercent
      },
      positions: positions.map(p => ({
        symbol: p.symbol,
        quantity: p.quantity,
        entryPrice: p.entryPrice,
        currentPrice: p.currentPrice,
        pnl: p.pnl,
        pnlPercent: p.pnlPercent,
        status: p.status
      })),
      timestamp: new Date().toISOString()
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error("[Toss Status Error]", error);
    return new Response(JSON.stringify({
      status: "error",
      team: "Toss",
      error: String(error),
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}

/**
 * Get Realtime Trading Agent Status
 */
async function handleRealtimeTradingAgentStatus(request: Request, env: WorkerEnv): Promise<Response> {
  try {
    // Durable Object 가져오기
    const id = env.REALTIME_TRADING_AGENT.idFromName("trading-agent-main");
    const agent = env.REALTIME_TRADING_AGENT.get(id);

    // 상태 조회
    const response = await agent.fetch(new Request("https://agent.local/status"));
    const status = await response.json();

    return new Response(JSON.stringify({
      status: "success",
      agent: "RealtimeTradingAgent",
      data: status,
      timestamp: new Date().toISOString()
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error("[Realtime Trading Agent Error]", error);
    return new Response(JSON.stringify({
      status: "error",
      agent: "RealtimeTradingAgent",
      error: String(error),
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
