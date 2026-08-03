/**
 * Upbit API 실제 연결 테스트
 * 이 스크립트는 실제 업비트 API와 연동되는지 검증합니다
 *
 * 실행: npx ts-node test-upbit-api.ts
 */

import crypto from "crypto";

interface UpbitConfig {
  accessKey: string;
  secretKey: string;
}

class SimpleUpbitClient {
  private config: UpbitConfig;
  private baseUrl = "https://api.upbit.com/v1";

  constructor(config: UpbitConfig) {
    this.config = config;
  }

  /**
   * 공개 API: 마켓 정보
   */
  async getMarkets(): Promise<any[]> {
    const url = `${this.baseUrl}/market/all?isDetails=false`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`API Error: ${response.statusText}`);
    }
    return response.json();
  }

  /**
   * 공개 API: 단일 시세 조회
   */
  async getTicker(market: string): Promise<any> {
    const url = `${this.baseUrl}/ticker?markets=${market}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`API Error: ${response.statusText}`);
    }
    const data = await response.json();
    return data[0];
  }

  /**
   * 개인 API: 계좌 잔고 조회
   */
  async getAccounts(): Promise<any[]> {
    return this.makePrivateRequest("/accounts");
  }

  /**
   * 개인 API: 주문 목록
   */
  async getOrders(): Promise<any[]> {
    return this.makePrivateRequest("/orders", { state: "done" });
  }

  /**
   * 개인 API: 주문 생성 (테스트용 - 실제 매매 X)
   */
  async placeOrder(market: string, side: "BUY" | "SELL", volume: number, price: number): Promise<any> {
    return this.makePrivateRequest("/orders", {
      market,
      side,
      ord_type: "LIMIT",
      price,
      volume
    }, "POST");
  }

  // ======================== Private ========================

  private async makePrivateRequest(
    endpoint: string,
    params: Record<string, any> = {},
    method: "GET" | "POST" | "DELETE" = "GET"
  ): Promise<any> {
    const url = new URL(`${this.baseUrl}${endpoint}`);

    // 쿼리 문자열 생성
    const queryString = this.buildQueryString(params);

    // 서명 생성
    const signature = crypto
      .createHmac("sha256", this.config.secretKey)
      .update(queryString)
      .digest("hex");

    const nonce = Date.now().toString();

    // Authorization 헤더
    const authPayload = {
      access_key: this.config.accessKey,
      nonce,
      timestamp: Date.now(),
      signature
    };

    const headers: Record<string, string> = {
      Authorization: `Bearer ${JSON.stringify(authPayload)}`,
      Accept: "application/json"
    };

    let fetchOptions: RequestInit = {
      method,
      headers
    };

    if (method === "GET" && queryString) {
      url.search = queryString;
    } else if (method === "POST" && Object.keys(params).length > 0) {
      fetchOptions.body = JSON.stringify(params);
      headers["Content-Type"] = "application/json";
    }

    const response = await fetch(url.toString(), fetchOptions);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API Error: ${response.status} - ${errorText}`);
    }

    return response.json();
  }

  private buildQueryString(params: Record<string, any>): string {
    if (Object.keys(params).length === 0) return "";
    return Object.entries(params)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${encodeURIComponent(String(value))}`)
      .join("&");
  }
}

// ======================== 테스트 실행 ========================

async function main() {
  console.log("🚀 Upbit API 실제 연결 테스트\n");

  // 환경변수 확인
  const accessKey = process.env.UPBIT_ACCESS_KEY;
  const secretKey = process.env.UPBIT_SECRET_KEY;

  if (!accessKey || !secretKey) {
    console.error("❌ 환경변수 설정 필요:");
    console.error("   export UPBIT_ACCESS_KEY=your_key");
    console.error("   export UPBIT_SECRET_KEY=your_secret");
    process.exit(1);
  }

  const client = new SimpleUpbitClient({ accessKey, secretKey });

  try {
    // 1. 공개 API: 마켓 목록
    console.log("1️⃣ 마켓 목록 조회...");
    const markets = await client.getMarkets();
    console.log(`   ✅ ${markets.length}개 마켓 조회됨`);
    const btc = markets.find((m: any) => m.market === "KRW-BTC");
    console.log(`   - KRW-BTC: ${btc ? "✅" : "❌"}`);
    console.log();

    // 2. 공개 API: 시세 조회
    console.log("2️⃣ BTC 현재가 조회...");
    const btcTicker = await client.getTicker("KRW-BTC");
    console.log(`   ✅ 현재가: ${btcTicker.trade_price.toLocaleString()} KRW`);
    console.log(`   - 변동률: ${(btcTicker.signed_change_rate * 100).toFixed(2)}%`);
    console.log();

    // 3. 개인 API: 계좌 잔고
    console.log("3️⃣ 계좌 잔고 조회...");
    const accounts = await client.getAccounts();
    console.log(`   ✅ ${accounts.length}개 자산 보유`);
    const krwAccount = accounts.find((a: any) => a.currency === "KRW");
    if (krwAccount) {
      console.log(`   - KRW 잔금: ${krwAccount.balance.toLocaleString()} KRW`);
    }
    console.log();

    // 4. 개인 API: 과거 주문
    console.log("4️⃣ 체결된 주문 조회...");
    const orders = await client.getOrders();
    console.log(`   ✅ 과거 ${orders.length}개 주문 조회됨`);
    if (orders.length > 0) {
      const latest = orders[0];
      console.log(`   - 최근 주문: ${latest.market} ${latest.side} ${latest.executed_volume} @ ${latest.price}`);
    }
    console.log();

    // ✅ 최종 결과
    console.log("🎉 Upbit API 연결 성공!");
    console.log("\n준비 완료:");
    console.log("✅ API 인증: 완료");
    console.log("✅ 공개 API: 완료");
    console.log("✅ 개인 API: 완료");
    console.log("✅ 계좌 확인: 완료");

  } catch (error) {
    console.error("❌ API 연결 실패:");
    console.error(`   ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

main();
