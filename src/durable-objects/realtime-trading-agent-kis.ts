/**
 * Realtime Trading Agent - KIS (한투) Variant
 * 
 * KIS 전용 자동매매 에이전트
 * Toss 에이전트와 독립적으로 작동
 */

import { RealtimeTradingAgent as BaseTradingAgent } from "./realtime-trading-agent.js";

export class RealtimeTradingAgentKIS extends BaseTradingAgent {
  // KIS 전용 설정
  // - 부모 클래스에서 KIS를 broker로 강제 선택
  // - 독립적인 가격 캐시 및 포지션 모니터링
  // - Toss 에이전트와 동시 실행 가능
}
