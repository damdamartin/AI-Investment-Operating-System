/**
 * Live Order Executor - KIS & Toss API Integration
 *
 * 실제 주문을 KIS/Toss API로 실행합니다
 * 환경 변수에 따라 자동으로 증권사 선택
 */

interface LiveOrderResult {
  success: boolean;
  orderId?: string;
  symbol: string;
  action: "BUY" | "SELL";
  quantity: number;
  price: number;
  executedAt: Date;
  status: "PENDING" | "FILLED" | "REJECTED";
  broker: "KIS" | "Toss";
  message?: string;
}

interface BrokerConfig {
  broker: "KIS" | "Toss";
  appKey?: string | undefined;
  appSecret?: string | undefined;
  clientId?: string | undefined;
  clientSecret?: string | undefined;
  accountNumber?: string | undefined;
  accessToken?: string | undefined;
}

export class LiveOrderExecutor {
  private config: BrokerConfig;

  constructor(config: BrokerConfig) {
    this.config = config;
  }

  async executeBuyOrder(
    symbol: string,
    quantity: number,
    limitPrice: number
  ): Promise<LiveOrderResult> {
    console.log(
      `📝 [${this.config.broker}] BUY: ${symbol} x${quantity} @ ₩${limitPrice.toLocaleString()}`
    );

    if (this.config.broker === "KIS") {
      return this.executeKISBuyOrder(symbol, quantity, limitPrice);
    } else {
      return this.executeTossBuyOrder(symbol, quantity, limitPrice);
    }
  }

  async executeSellOrder(
    symbol: string,
    quantity: number,
    limitPrice: number
  ): Promise<LiveOrderResult> {
    console.log(
      `📝 [${this.config.broker}] SELL: ${symbol} x${quantity} @ ₩${limitPrice.toLocaleString()}`
    );

    if (this.config.broker === "KIS") {
      return this.executeKISSellOrder(symbol, quantity, limitPrice);
    } else {
      return this.executeTossSellOrder(symbol, quantity, limitPrice);
    }
  }

  // ============================================================
  // KIS (한투) API 구현
  // ============================================================

  private async executeKISBuyOrder(
    symbol: string,
    quantity: number,
    limitPrice: number
  ): Promise<LiveOrderResult> {
    try {
      if (!this.config.appKey || !this.config.appSecret || !this.config.accountNumber) {
        throw new Error("Missing KIS credentials (appKey, appSecret, accountNumber)");
      }

      // 1️⃣ 토큰 갱신
      const accessToken = await this.getKISAccessToken();

      // 2️⃣ 주문 제출
      const orderResponse = await fetch(
        "https://openapi.koreainvestment.com:9443/uapi/domestic-stock/v1/trading/order-cash",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
            "appKey": this.config.appKey,
            "appSecret": this.config.appSecret,
            "tr_id": "TTTC0802U",
            "custtype": "P",
          },
          body: JSON.stringify({
            CANO: this.config.accountNumber.split("-")[0],
            ACNT_PRDT_CD: this.config.accountNumber.split("-")[1] || "01",
            PDNO: symbol,
            ORD_QTY: quantity,
            ORD_UNPR: limitPrice,
            ORD_DVSN_CD: "00", // 지정가
            CMA_EVLU_AMT_ICLD_YN: "Y",
            ORGN_ODNO: "",
          }),
        }
      );

      const result = (await orderResponse.json()) as any;

      if (result.rt_cd !== "0") {
        throw new Error(`KIS Error: ${result.msg1}`);
      }

      return {
        success: true,
        orderId: result.output?.ORD_NO,
        symbol,
        action: "BUY",
        quantity,
        price: limitPrice,
        executedAt: new Date(),
        status: "PENDING",
        broker: "KIS",
        message: `주문 접수: ${result.output?.ORD_NO}`,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`❌ KIS BUY 주문 실패: ${message}`);
      return {
        success: false,
        symbol,
        action: "BUY",
        quantity,
        price: limitPrice,
        executedAt: new Date(),
        status: "REJECTED",
        broker: "KIS",
        message,
      };
    }
  }

  private async executeKISSellOrder(
    symbol: string,
    quantity: number,
    limitPrice: number
  ): Promise<LiveOrderResult> {
    try {
      if (!this.config.appKey || !this.config.appSecret || !this.config.accountNumber) {
        throw new Error("Missing KIS credentials");
      }

      const accessToken = await this.getKISAccessToken();

      const orderResponse = await fetch(
        "https://openapi.koreainvestment.com:9443/uapi/domestic-stock/v1/trading/order-cash",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
            "appKey": this.config.appKey,
            "appSecret": this.config.appSecret,
            "tr_id": "TTTC0801U",
            "custtype": "P",
          },
          body: JSON.stringify({
            CANO: this.config.accountNumber.split("-")[0],
            ACNT_PRDT_CD: this.config.accountNumber.split("-")[1] || "01",
            PDNO: symbol,
            ORD_QTY: quantity,
            ORD_UNPR: limitPrice,
            ORD_DVSN_CD: "00", // 지정가
            CMA_EVLU_AMT_ICLD_YN: "Y",
            ORGN_ODNO: "",
          }),
        }
      );

      const result = (await orderResponse.json()) as any;

      if (result.rt_cd !== "0") {
        throw new Error(`KIS Error: ${result.msg1}`);
      }

      return {
        success: true,
        orderId: result.output?.ORD_NO,
        symbol,
        action: "SELL",
        quantity,
        price: limitPrice,
        executedAt: new Date(),
        status: "PENDING",
        broker: "KIS",
        message: `주문 접수: ${result.output?.ORD_NO}`,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`❌ KIS SELL 주문 실패: ${message}`);
      return {
        success: false,
        symbol,
        action: "SELL",
        quantity,
        price: limitPrice,
        executedAt: new Date(),
        status: "REJECTED",
        broker: "KIS",
        message,
      };
    }
  }

  private async getKISAccessToken(): Promise<string> {
    const response = await fetch(
      "https://openapi.koreainvestment.com:9443/oauth2/tokenP",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          grant_type: "client_credentials",
          appkey: this.config.appKey,
          appsecret: this.config.appSecret,
        }),
      }
    );

    const data = (await response.json()) as any;
    if (!data.access_token) {
      throw new Error("Failed to get KIS access token");
    }

    return data.access_token;
  }

  // ============================================================
  // Toss (토스증권) API 구현
  // ============================================================

  private async executeTossBuyOrder(
    symbol: string,
    quantity: number,
    limitPrice: number
  ): Promise<LiveOrderResult> {
    try {
      if (!this.config.clientId || !this.config.clientSecret) {
        throw new Error("Missing Toss credentials (clientId, clientSecret)");
      }

      // 1️⃣ 토큰 갱신
      const accessToken = await this.getTossAccessToken();

      // 2️⃣ 주문 제출
      const orderResponse = await fetch("https://openapi.tossinvest.com/v1/stock/order", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          symbol,
          orderType: "BUY",
          quantity,
          price: limitPrice,
          orderCondition: "LIMIT",
        }),
      });

      const result = (await orderResponse.json()) as any;

      if (!result.orderId) {
        throw new Error(result.message || "Order submission failed");
      }

      return {
        success: true,
        orderId: result.orderId,
        symbol,
        action: "BUY",
        quantity,
        price: limitPrice,
        executedAt: new Date(),
        status: "PENDING",
        broker: "Toss",
        message: `주문 접수: ${result.orderId}`,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`❌ Toss BUY 주문 실패: ${message}`);
      return {
        success: false,
        symbol,
        action: "BUY",
        quantity,
        price: limitPrice,
        executedAt: new Date(),
        status: "REJECTED",
        broker: "Toss",
        message,
      };
    }
  }

  private async executeTossSellOrder(
    symbol: string,
    quantity: number,
    limitPrice: number
  ): Promise<LiveOrderResult> {
    try {
      if (!this.config.clientId || !this.config.clientSecret) {
        throw new Error("Missing Toss credentials");
      }

      const accessToken = await this.getTossAccessToken();

      const orderResponse = await fetch("https://openapi.tossinvest.com/v1/stock/order", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          symbol,
          orderType: "SELL",
          quantity,
          price: limitPrice,
          orderCondition: "LIMIT",
        }),
      });

      const result = (await orderResponse.json()) as any;

      if (!result.orderId) {
        throw new Error(result.message || "Order submission failed");
      }

      return {
        success: true,
        orderId: result.orderId,
        symbol,
        action: "SELL",
        quantity,
        price: limitPrice,
        executedAt: new Date(),
        status: "PENDING",
        broker: "Toss",
        message: `주문 접수: ${result.orderId}`,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`❌ Toss SELL 주문 실패: ${message}`);
      return {
        success: false,
        symbol,
        action: "SELL",
        quantity,
        price: limitPrice,
        executedAt: new Date(),
        status: "REJECTED",
        broker: "Toss",
        message,
      };
    }
  }

  private async getTossAccessToken(): Promise<string> {
    const response = await fetch("https://openapi.tossinvest.com/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: "client_credentials",
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
      }),
    });

    const data = (await response.json()) as any;
    if (!data.access_token) {
      throw new Error("Failed to get Toss access token");
    }

    return data.access_token;
  }
}

export type { LiveOrderResult, BrokerConfig };
