/**
 * Crypto Engine - Basic Usage Example
 * 이 파일은 암호화폐 자동매매 엔진을 사용하는 기본 예제입니다.
 *
 * 실행 방법:
 * 1. 환경변수 설정
 *    export UPBIT_ACCESS_KEY=your_key
 *    export UPBIT_SECRET_KEY=your_secret
 *
 * 2. 마이그레이션 실행
 *    npm run db:migrate
 *
 * 3. 이 파일 실행
 *    npx ts-node src/crypto-engine/examples/basic-usage.ts
 */

import { CryptoEngine } from "../bootstrap.js";

// 예제 1: 가상매매 모드로 테스트
async function exampleVirtualTrading() {
  console.log("=== 예제 1: 가상매매 모드 ===\n");

  // D1 데이터베이스 (실제로는 Cloudflare Worker 환경에서 제공됨)
  const mockDb = {
    prepare: () => ({
      bind: () => ({
        first: async () => null,
        run: async () => null
      }),
      first: async () => null
    })
  } as any;

  const engine = new CryptoEngine(
    {
      accessKey: process.env.UPBIT_ACCESS_KEY || "test_key",
      secretKey: process.env.UPBIT_SECRET_KEY || "test_secret",
      markets: ["KRW-BTC", "KRW-ETH", "KRW-XRP"],
      tradingMode: "VIRTUAL", // 실제 매매 안함
      dailyLossLimit: -0.02, // -2%
      maxPositionPercent: 0.1 // 10%
    },
    mockDb
  );

  try {
    // 엔진 시작
    await engine.start();

    // 10초 동안 실행
    console.log("\n10초 동안 신호 생성을 모니터링합니다...\n");
    for (let i = 0; i < 10; i++) {
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const status = engine.getStatus();
      console.log(
        `[${i + 1}s] 마켓: ${status.marketCache.recentUpdates}/${status.marketCache.totalMarkets}, 큐: ${status.queueSize}, 추적: ${status.trackedOrders}`
      );
    }

    // 상태 확인
    const finalStatus = engine.getStatus();
    console.log("\n최종 상태:");
    console.log(JSON.stringify(finalStatus, null, 2));

    // 엔진 종료
    await engine.stop();
    console.log("\n✅ 가상매매 테스트 완료");
  } catch (error) {
    console.error("❌ 오류:", error);
  }
}

// 예제 2: 신호 생성 모니터링
async function exampleSignalMonitoring() {
  console.log("=== 예제 2: 신호 생성 모니터링 ===\n");

  const mockDb = {
    prepare: () => ({
      bind: () => ({
        first: async () => null,
        run: async () => null
      }),
      first: async () => null
    })
  } as any;

  const engine = new CryptoEngine(
    {
      accessKey: process.env.UPBIT_ACCESS_KEY || "test_key",
      secretKey: process.env.UPBIT_SECRET_KEY || "test_secret",
      markets: ["KRW-BTC"],
      tradingMode: "VIRTUAL",
      dailyLossLimit: -0.02,
      maxPositionPercent: 0.1
    },
    mockDb
  );

  try {
    await engine.start();

    console.log("신호 생성을 모니터링합니다. (Ctrl+C로 중단)\n");

    // 30초 동안 모니터링
    for (let i = 0; i < 30; i++) {
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // 실제 구현에서는 engine.getSignals() 같은 메서드로 신호를 가져올 수 있음
      const status = engine.getStatus();
      if (status.marketCache.recentUpdates > 0) {
        console.log(
          `[${new Date().toLocaleTimeString()}] 신호 생성 중... (마켓: ${status.marketCache.recentUpdates})`
        );
      }
    }

    await engine.stop();
  } catch (error) {
    console.error("❌ 오류:", error);
  }
}

// 예제 3: 리스크 관리 테스트
async function exampleRiskManagement() {
  console.log("=== 예제 3: 리스크 관리 테스트 ===\n");

  const mockDb = {
    prepare: () => ({
      bind: () => ({
        first: async () => null,
        run: async () => null
      }),
      first: async () => null
    })
  } as any;

  const engine = new CryptoEngine(
    {
      accessKey: process.env.UPBIT_ACCESS_KEY || "test_key",
      secretKey: process.env.UPBIT_SECRET_KEY || "test_secret",
      markets: ["KRW-BTC"],
      tradingMode: "VIRTUAL",
      dailyLossLimit: -0.02, // -2% 손실 한도
      maxPositionPercent: 0.05 // 5% 최대 포지션
    },
    mockDb
  );

  console.log("리스크 설정:");
  console.log("- 일일 손실 한도: -2%");
  console.log("- 최대 포지션: 5%");
  console.log("- 거래 모드: 가상매매\n");

  try {
    await engine.start();

    console.log("5초 동안 실행...\n");
    for (let i = 0; i < 5; i++) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const status = engine.getStatus();
      console.log(`[${i + 1}s] 킬 스위치: ${status.killSwitchActive ? "🔴 활성" : "🟢 비활성"}`);
    }

    await engine.stop();
    console.log("\n✅ 리스크 관리 테스트 완료");
  } catch (error) {
    console.error("❌ 오류:", error);
  }
}

// 예제 4: 다중 마켓 거래
async function exampleMultiMarketTrading() {
  console.log("=== 예제 4: 다중 마켓 거래 ===\n");

  const mockDb = {
    prepare: () => ({
      bind: () => ({
        first: async () => null,
        run: async () => null
      }),
      first: async () => null
    })
  } as any;

  const markets = ["KRW-BTC", "KRW-ETH", "KRW-XRP", "KRW-DOGE"];

  const engine = new CryptoEngine(
    {
      accessKey: process.env.UPBIT_ACCESS_KEY || "test_key",
      secretKey: process.env.UPBIT_SECRET_KEY || "test_secret",
      markets,
      tradingMode: "VIRTUAL",
      dailyLossLimit: -0.02,
      maxPositionPercent: 0.08 // 8% 최대 포지션
    },
    mockDb
  );

  console.log(`거래할 마켓 (${markets.length}개):`);
  markets.forEach((m) => console.log(`  - ${m}`));
  console.log();

  try {
    await engine.start();

    console.log("10초 동안 모니터링...\n");
    for (let i = 0; i < 10; i++) {
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const status = engine.getStatus();
      console.log(
        `[${i + 1}s] 마켓: ${status.marketCache.totalMarkets}, 활성: ${status.marketCache.recentUpdates}, 큐: ${status.queueSize}`
      );
    }

    await engine.stop();
    console.log("\n✅ 다중 마켓 거래 테스트 완료");
  } catch (error) {
    console.error("❌ 오류:", error);
  }
}

// 메인 함수
async function main() {
  const exampleNum = process.argv[2] || "1";

  console.log("\n🚀 암호화폐 자동매매 엔진 예제\n");
  console.log("사용 가능한 예제:");
  console.log("  1. 가상매매 모드 (npx ts-node ... 1)");
  console.log("  2. 신호 생성 모니터링 (npx ts-node ... 2)");
  console.log("  3. 리스크 관리 테스트 (npx ts-node ... 3)");
  console.log("  4. 다중 마켓 거래 (npx ts-node ... 4)\n");

  switch (exampleNum) {
    case "1":
      await exampleVirtualTrading();
      break;
    case "2":
      await exampleSignalMonitoring();
      break;
    case "3":
      await exampleRiskManagement();
      break;
    case "4":
      await exampleMultiMarketTrading();
      break;
    default:
      console.log(`❌ 예제 ${exampleNum}은 존재하지 않습니다.`);
  }
}

// 실행
main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
