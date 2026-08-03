/**
 * 🔴 실제 매매 시스템
 * 이 스크립트는 실제 업비트 계좌에서 자동 매매를 실행합니다
 *
 * 경고: 실제 자산이 움직입니다. 신중하게 사용하세요.
 *
 * 실행 방법:
 * export UPBIT_ACCESS_KEY=your_key
 * export UPBIT_SECRET_KEY=your_secret
 * npx ts-node live-trading.ts
 */

import crypto from "crypto";
import * as readline from "readline";

interface Account {
  currency: string;
  balance: number;
  locked: number;
  avg_buy_price: number;
  avg_buy_price_modified: boolean;
  unit_currency: string;
}

interface Ticker {
  market: string;
  trade_price: number;
  signed_change_rate: number;
  change: string;
  acc_trade_price_24h: number;
  trade_volume: number;
}

interface Order {
  uuid: string;
  side: string;
  ord_type: string;
  price: number | null;
  state: string;
  market: string;
  volume: number | null;
  remaining_volume: number | null;
  executed_volume: number;
}

class LiveTradingSystem {
  private accessKey: string;
  private secretKey: string;
  private baseUrl = "https://api.upbit.com/v1";

  constructor(accessKey: string, secretKey: string) {
    this.accessKey = accessKey;
    this.secretKey = secretKey;
  }

  // ======================== 공개 API ========================

  async getTicker(market: string): Promise<Ticker> {
    const url = `${this.baseUrl}/ticker?markets=${market}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`API Error: ${response.statusText}`);
    const data = await response.json();
    return data[0];
  }

  // ======================== 개인 API ========================

  async getAccounts(): Promise<Account[]> {
    return this.makePrivateRequest("/accounts");
  }

  async placeOrder(market: string, side: "BUY" | "SELL", volume: number, price: number): Promise<Order> {
    return this.makePrivateRequest(
      "/orders",
      {
        market,
        side,
        ord_type: "LIMIT",
        price,
        volume,
        time_in_force: "GTC"
      },
      "POST"
    );
  }

  async getOrder(uuid: string): Promise<Order> {
    return this.makePrivateRequest(`/orders/${uuid}`);
  }

  async cancelOrder(uuid: string): Promise<Order> {
    return this.makePrivateRequest(`/orders/${uuid}`, {}, "DELETE");
  }

  // ======================== 신호 생성 ========================

  generateSignal(ticker: Ticker): { direction: "BUY" | "SELL" | null; confidence: number; reason: string } {
    const changeRate = ticker.signed_change_rate;

    // BUY 신호: 2% 이상 상승
    if (changeRate > 0.02) {
      return {
        direction: "BUY",
        confidence: Math.min(0.95, 0.5 + changeRate * 5),
        reason: `상승 트렌드: ${(changeRate * 100).toFixed(2)}%`
      };
    }

    // SELL 신호: 2% 이상 하락
    if (changeRate < -0.02) {
      return {
        direction: "SELL",
        confidence: Math.min(0.95, 0.5 + Math.abs(changeRate) * 5),
        reason: `하락 트렌드: ${(changeRate * 100).toFixed(2)}%`
      };
    }

    return {
      direction: null,
      confidence: 0,
      reason: "신호 없음"
    };
  }

  // ======================== 매매 실행 ========================

  async executeTrade(
    market: string,
    accounts: Account[],
    maxInvestAmount: number
  ): Promise<{ success: boolean; message: string; orderId?: string }> {
    try {
      // 1. 시세 조회
      console.log(`\n📊 ${market} 시세 조회 중...`);
      const ticker = await this.getTicker(market);
      console.log(`   현재가: ${ticker.trade_price.toLocaleString()} KRW`);
      console.log(`   변동률: ${(ticker.signed_change_rate * 100).toFixed(2)}%`);

      // 2. 신호 생성
      const signal = this.generateSignal(ticker);
      console.log(`\n🎯 신호: ${signal.direction || "HOLD"} (신뢰도: ${(signal.confidence * 100).toFixed(0)}%)`);
      console.log(`   이유: ${signal.reason}`);

      if (!signal.direction) {
        return { success: false, message: "신호 없음" };
      }

      // 3. 자금 확인
      const krwAccount = accounts.find((a) => a.currency === "KRW");
      if (!krwAccount) {
        return { success: false, message: "KRW 계좌 없음" };
      }

      if (signal.direction === "BUY") {
        // BUY 신호: KRW로 매수
        if (krwAccount.balance < maxInvestAmount) {
          return {
            success: false,
            message: `잔금 부족: ${krwAccount.balance.toLocaleString()} < ${maxInvestAmount.toLocaleString()}`
          };
        }

        const volume = maxInvestAmount / ticker.trade_price;
        console.log(`\n💰 BUY 주문: ${volume.toFixed(8)} ${market.split("-")[1]}`);
        console.log(`   금액: ${maxInvestAmount.toLocaleString()} KRW`);
        console.log(`   가격: ${ticker.trade_price.toLocaleString()} KRW`);

        // ⚠️ 실제 주문 실행
        const order = await this.placeOrder(market, "BUY", volume, ticker.trade_price);
        console.log(`\n✅ 주문 생성됨: ${order.uuid}`);
        console.log(`   상태: ${order.state}`);

        return {
          success: true,
          message: `BUY 주문 생성: ${order.uuid}`,
          orderId: order.uuid
        };
      } else {
        // SELL 신호: 보유중인 자산 매도
        const crypto = market.split("-")[1];
        const cryptoAccount = accounts.find((a) => a.currency === crypto);

        if (!cryptoAccount || cryptoAccount.balance === 0) {
          return { success: false, message: `${crypto} 잔고 없음` };
        }

        console.log(`\n💰 SELL 주문: ${cryptoAccount.balance.toFixed(8)} ${crypto}`);
        console.log(`   금액: ${(cryptoAccount.balance * ticker.trade_price).toLocaleString()} KRW`);
        console.log(`   가격: ${ticker.trade_price.toLocaleString()} KRW`);

        // ⚠️ 실제 주문 실행
        const order = await this.placeOrder(market, "SELL", cryptoAccount.balance, ticker.trade_price);
        console.log(`\n✅ 주문 생성됨: ${order.uuid}`);
        console.log(`   상태: ${order.state}`);

        return {
          success: true,
          message: `SELL 주문 생성: ${order.uuid}`,
          orderId: order.uuid
        };
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`\n❌ 매매 실패: ${message}`);
      return { success: false, message };
    }
  }

  // ======================== Private Methods ========================

  private async makePrivateRequest(
    endpoint: string,
    params: Record<string, any> = {},
    method: "GET" | "POST" | "DELETE" = "GET"
  ): Promise<any> {
    const url = new URL(`${this.baseUrl}${endpoint}`);

    // Upbit API 인증 방식
    const nonce = this.generateNonce();
    const timestamp = Date.now().toString();

    let queryString = "";

    if (method === "GET" || method === "DELETE") {
      queryString = this.buildQueryString(params);
      if (queryString) {
        url.search = queryString;
      }
    }

    // 서명 생성: HMAC-SHA256(secret_key, query_string)
    const signature = crypto
      .createHmac("sha256", this.secretKey)
      .update(queryString || "")
      .digest("hex");

    // Authorization 헤더: Bearer {access_key}:{nonce}:{timestamp}:{signature}
    const authHeader = `Bearer ${this.accessKey}:${nonce}:${timestamp}:${signature}`;

    const headers: Record<string, string> = {
      Authorization: authHeader,
      Accept: "application/json"
    };

    let fetchOptions: RequestInit = { method, headers };

    if (method === "POST" && Object.keys(params).length > 0) {
      fetchOptions.body = JSON.stringify(params);
      headers["Content-Type"] = "application/json";
    }

    const response = await fetch(url.toString(), fetchOptions);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`${response.status}: ${errorText}`);
    }

    return response.json();
  }

  private generateNonce(): string {
    // UUID v4 형식의 nonce 생성
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
      const r = (Math.random() * 16) | 0;
      const v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  private buildQueryString(params: Record<string, any>): string {
    if (Object.keys(params).length === 0) return "";
    return Object.entries(params)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${encodeURIComponent(String(value))}`)
      .join("&");
  }
}

// ======================== 메인 ========================

async function main() {
  console.log("🔴 실제 매매 시스템 시작\n");

  const accessKey = process.env.UPBIT_ACCESS_KEY;
  const secretKey = process.env.UPBIT_SECRET_KEY;

  if (!accessKey || !secretKey) {
    console.error("❌ API 키 설정 필요:");
    console.error("export UPBIT_ACCESS_KEY=your_key");
    console.error("export UPBIT_SECRET_KEY=your_secret");
    process.exit(1);
  }

  const system = new LiveTradingSystem(accessKey, secretKey);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const question = (prompt: string): Promise<string> => {
    return new Promise((resolve) => {
      rl.question(prompt, resolve);
    });
  };

  try {
    // 1. 계좌 확인
    console.log("📋 계좌 정보 로드 중...\n");
    const accounts = await system.getAccounts();

    console.log("보유 자산:");
    for (const account of accounts) {
      if (account.balance > 0 || account.locked > 0) {
        console.log(
          `  ${account.currency}: ${account.balance.toFixed(8)} (잠금: ${account.locked.toFixed(8)})`
        );
      }
    }

    const krwAccount = accounts.find((a) => a.currency === "KRW");
    if (krwAccount) {
      console.log(`\n💰 사용 가능한 KRW: ${krwAccount.balance.toLocaleString()}`);
    }

    // 2. 매매 시장 선택
    console.log("\n매매할 시장을 선택하세요:");
    console.log("1. KRW-BTC (비트코인)");
    console.log("2. KRW-ETH (이더리움)");
    console.log("3. KRW-XRP (리플)");
    console.log("4. KRW-DOGE (도지코인)");

    const choice = await question("\n선택 (1-4): ");
    const marketMap: Record<string, string> = {
      "1": "KRW-BTC",
      "2": "KRW-ETH",
      "3": "KRW-XRP",
      "4": "KRW-DOGE"
    };

    const market = marketMap[choice];
    if (!market) {
      console.error("❌ 잘못된 선택");
      rl.close();
      return;
    }

    // 3. 투자 금액 입력
    const amountStr = await question(`\n투자 금액 (KRW, 기본값: 10000): `);
    const investAmount = parseInt(amountStr) || 10000;

    // 4. 확인
    console.log(`\n⚠️  경고: 실제 매매가 실행됩니다!`);
    console.log(`시장: ${market}`);
    console.log(`금액: ${investAmount.toLocaleString()} KRW`);

    const confirm = await question("\n계속하시겠습니까? (yes/no): ");

    if (confirm.toLowerCase() !== "yes") {
      console.log("❌ 취소되었습니다.");
      rl.close();
      return;
    }

    // 5. 매매 실행
    console.log("\n🚀 매매 실행 중...");
    const result = await system.executeTrade(market, accounts, investAmount);

    if (result.success) {
      console.log(`\n✅ 매매 성공!`);
      console.log(`주문 ID: ${result.orderId}`);
    } else {
      console.log(`\n❌ 매매 실패: ${result.message}`);
    }

    rl.close();
  } catch (error) {
    console.error("❌ 오류:", error instanceof Error ? error.message : String(error));
    rl.close();
    process.exit(1);
  }
}

main();
