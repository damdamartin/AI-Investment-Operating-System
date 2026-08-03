/**
 * 업비트 실거래 테스트
 * ₩10,000 최소 주문으로 API 연동 확인
 */

import { UpbitClient } from "./src/crypto-engine/config/upbit-client.js";

async function testUpbitTrade() {
  console.log("🚀 업비트 실거래 테스트 시작...\n");

  // API 키 (환경변수에서 읽음)
  const accessKey = process.env.UPBIT_ACCESS_KEY;
  const secretKey = process.env.UPBIT_SECRET_KEY;

  if (!accessKey || !secretKey) {
    console.error("❌ 오류: Upbit API 키가 설정되지 않았습니다!");
    process.exit(1);
  }

  // Upbit 클라이언트 초기화
  const client = new UpbitClient({
    accessKey,
    secretKey
  });

  try {
    // 1. API 인증 테스트
    console.log("1️⃣ API 인증 테스트...");
    const authValid = await client.testAuth();
    if (!authValid) {
      console.error("❌ API 인증 실패!");
      process.exit(1);
    }
    console.log("✅ API 인증 성공!\n");

    // 2. 계좌 잔고 확인
    console.log("2️⃣ 계좌 잔고 확인...");
    const accounts = await client.getAccounts();
    const krwAccount = accounts.find((a) => a.currency === "KRW");
    if (!krwAccount || krwAccount.balance < 10000) {
      console.error("❌ 잔액 부족! (최소: ₩10,000)");
      console.log(`현재 잔액: ₩${krwAccount?.balance || 0}`);
      process.exit(1);
    }
    console.log(`✅ 현재 잔액: ₩${krwAccount.balance}\n`);

    // 3. 실시간 시세 확인
    console.log("3️⃣ BTC 실시간 시세 확인...");
    const ticker = await client.getTicker("KRW-BTC");
    console.log(`✅ BTC 현재가: ₩${ticker.trade_price}\n`);

    // 4. 테스트 주문 실행
    console.log("4️⃣ 테스트 주문 실행 (₩10,000 매수)...");
    const order = await client.placeOrder({
      market: "KRW-BTC",
      side: "BUY",
      ord_type: "LIMIT",
      price: ticker.trade_price, // 현재가로 지정가
      volume: 10000 / ticker.trade_price // 수량 계산
    });

    console.log(`✅ 주문 완료!\n`);
    console.log(`📊 주문 정보:`);
    console.log(`   UUID: ${order.uuid}`);
    console.log(`   종목: ${order.market}`);
    console.log(`   방향: ${order.side}`);
    console.log(`   가격: ₩${order.price}`);
    console.log(`   수량: ${order.volume}`);
    console.log(`   상태: ${order.state}\n`);

    // 5. 주문 상태 확인
    console.log("5️⃣ 주문 상태 확인...");
    const checkOrder = await client.getOrder(order.uuid);
    console.log(`✅ 주문 상태: ${checkOrder.state}\n`);

    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("✨ 테스트 완료!");
    console.log("📱 업비트 앱에서 매매 기록을 확인하세요!");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  } catch (error) {
    console.error("❌ 오류 발생:", error);
    process.exit(1);
  }
}

// 실행
testUpbitTrade();
