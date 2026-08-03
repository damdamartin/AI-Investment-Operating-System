"""
운영 대시보드 서버 - Claude AI 거래 에이전트 통합
"""

from flask import Flask, render_template_string, jsonify, request
from datetime import datetime
import json
import os
from pathlib import Path
from .trading_agent import TradingAgent

app = Flask(__name__)

# Claude 거래 에이전트 초기화
trading_agent = None

def get_agent():
    """거래 에이전트 싱글톤"""
    global trading_agent
    if trading_agent is None:
        trading_agent = TradingAgent()
    return trading_agent

# 설정 파일 경로
CONFIG_FILE = '/Users/mac/Documents/Codex/AI-Investment-Operating-System/config/booster_config.json'

def load_config():
    """운영 설정 로드"""
    if os.path.exists(CONFIG_FILE):
        with open(CONFIG_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    return {}

def save_config(config):
    """운영 설정 저장"""
    os.makedirs(os.path.dirname(CONFIG_FILE), exist_ok=True)
    config['last_updated'] = datetime.now().isoformat()
    with open(CONFIG_FILE, 'w', encoding='utf-8') as f:
        json.dump(config, f, indent=2, ensure_ascii=False)

# 샘플 데이터
dashboard_data = {
    'kis': {'portfolio_krw': 70002, 'portfolio_usd': 23.08, 'positions': 0, 'pnl': 0, 'pnl_pct': 0, 'positions_list': []},
    'toss': {'portfolio': 228954, 'positions': 0, 'pnl': 0, 'pnl_pct': 0, 'cash': 10000000, 'positions_list': []}
}

@app.route('/')
def dashboard():
    """메인 대시보드"""
    html = """
    <!DOCTYPE html>
    <html>
    <head><title>Upbit 부스터 모드</title></head>
    <body>
        <h1>🚀 Upbit 자동매매 부스터</h1>
        <p>📊 <a href="/api/config">현재 설정 조회</a></p>
        <p>⚙️ 대시보드에서 운영 방식을 설정하세요</p>
        <p>🔗 공식 대시보드: <a href="https://ai-investment-trading-cycle-production.junkim-life360.workers.dev/dashboard">클릭</a></p>
    </body>
    </html>
    """
    return html

@app.route('/api/config', methods=['GET'])
def get_config():
    """현재 운영 설정 조회"""
    config = load_config()
    return jsonify({
        'status': 'success',
        'config': config,
        'timestamp': datetime.now().isoformat()
    })

@app.route('/api/config', methods=['POST'])
def update_config():
    """운영 설정 업데이트"""
    try:
        new_config = request.json
        config = load_config()
        config.update(new_config)
        save_config(config)
        return jsonify({
            'status': 'success',
            'message': '설정이 업데이트되었습니다',
            'config': config
        })
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 400

@app.route('/api/config/modes', methods=['GET'])
def get_available_modes():
    """사용 가능한 운영 모드"""
    modes = {
        'BOOSTER': {
            'name': '급등락주 초단타',
            'cycle_seconds': 30,
            'hold_policy': 'NO_HOLD',
            'description': '변동성 높은 종목 집중 거래'
        },
        'CONSERVATIVE': {
            'name': '안정형 매매',
            'cycle_seconds': 300,
            'hold_policy': 'SHORT_TERM',
            'description': '손실 최소화 중심'
        },
        'GROWTH': {
            'name': '성장형 매매',
            'cycle_seconds': 60,
            'hold_policy': 'MEDIUM_TERM',
            'description': '중기 수익 추구'
        },
        'MANUAL': {
            'name': '수동 모드',
            'cycle_seconds': 0,
            'hold_policy': 'MANUAL',
            'description': '대시보드에서 직접 주문'
        }
    }
    return jsonify({'status': 'success', 'modes': modes})

@app.route('/api/data')
def get_data():
    """실시간 데이터 API"""
    return jsonify(dashboard_data)

@app.route('/api/update', methods=['POST'])
def update_data():
    """데이터 업데이트 API"""
    global dashboard_data
    data = request.json
    dashboard_data.update(data)
    return jsonify({'status': 'success'})

@app.route('/api/chat', methods=['POST'])
def chat():
    """Claude AI 거래 에이전트 챗 엔드포인트"""
    try:
        data = request.json
        user_message = data.get('message', '')

        if not user_message:
            return jsonify({'status': 'error', 'message': '메시지가 없습니다'}), 400

        # 거래 에이전트에 메시지 전송
        agent = get_agent()
        response = agent.chat(user_message)

        return jsonify({
            'status': 'success',
            'message': user_message,
            'response': response,
            'timestamp': datetime.now().isoformat()
        })
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500

@app.route('/chat')
def chat_page():
    """채팅 UI 페이지"""
    html = """
    <!DOCTYPE html>
    <html lang="ko">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>🤖 거래 에이전트</title>
        <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                background: #f5f5f5;
                padding: 20px;
            }
            .container {
                max-width: 900px;
                margin: 0 auto;
                background: white;
                border-radius: 12px;
                box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                display: flex;
                flex-direction: column;
                height: 80vh;
            }
            header {
                padding: 20px;
                border-bottom: 1px solid #eee;
                text-align: center;
            }
            h1 {
                color: #333;
                margin-bottom: 5px;
            }
            .subtitle {
                color: #999;
                font-size: 14px;
            }
            .chat-container {
                flex: 1;
                overflow-y: auto;
                padding: 20px;
                display: flex;
                flex-direction: column;
            }
            .message {
                margin-bottom: 15px;
                animation: slideIn 0.3s ease;
            }
            @keyframes slideIn {
                from { opacity: 0; transform: translateY(10px); }
                to { opacity: 1; transform: translateY(0); }
            }
            .user-msg {
                display: flex;
                justify-content: flex-end;
            }
            .user-msg .content {
                background: #3b82f6;
                color: white;
                padding: 12px 16px;
                border-radius: 12px;
                max-width: 70%;
                word-wrap: break-word;
            }
            .agent-msg {
                display: flex;
                justify-content: flex-start;
            }
            .agent-msg .content {
                background: #e5e7eb;
                color: #333;
                padding: 12px 16px;
                border-radius: 12px;
                max-width: 70%;
                word-wrap: break-word;
                white-space: pre-wrap;
            }
            .input-container {
                padding: 20px;
                border-top: 1px solid #eee;
                display: flex;
                gap: 10px;
            }
            input {
                flex: 1;
                padding: 12px;
                border: 1px solid #ddd;
                border-radius: 8px;
                font-size: 14px;
            }
            input:focus {
                outline: none;
                border-color: #3b82f6;
                box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
            }
            button {
                padding: 12px 24px;
                background: #3b82f6;
                color: white;
                border: none;
                border-radius: 8px;
                cursor: pointer;
                font-weight: 500;
                transition: background 0.2s;
            }
            button:hover {
                background: #2563eb;
            }
            button:disabled {
                background: #9ca3af;
                cursor: not-allowed;
            }
            .timestamp {
                font-size: 12px;
                color: #999;
                margin-top: 5px;
            }
            .examples {
                text-align: center;
                color: #999;
                font-size: 13px;
                padding: 10px;
                background: #f9f9f9;
                border-radius: 8px;
                margin-bottom: 10px;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <header>
                <h1>🤖 AI 거래 에이전트</h1>
                <p class="subtitle">자연언어로 거래 명령을 내립니다</p>
            </header>

            <div class="examples">
                💡 예시: "BTC 현재가는?", "모드를 CONSERVATIVE로 변경해", "포트폴리오 현황", "설정을 보여줘"
            </div>

            <div class="chat-container" id="chat">
                <div class="agent-msg">
                    <div class="content">안녕하세요! 🤖 거래 에이전트입니다.
자연언어로 거래 명령을 내려보세요.
- 가격 조회: "BTC 현재가는?"
- 모드 변경: "모드를 CONSERVATIVE로"
- 포트폴리오: "현재 자산은?"
- 설정: "현재 설정을 보여줘"</div>
                </div>
            </div>

            <div class="input-container">
                <input type="text" id="input" placeholder="메시지를 입력하세요..." />
                <button onclick="sendMessage()">전송</button>
            </div>
        </div>

        <script>
            const chatDiv = document.getElementById('chat');
            const inputEl = document.getElementById('input');

            async function sendMessage() {
                const message = inputEl.value.trim();
                if (!message) return;

                // 사용자 메시지 표시
                addMessage(message, 'user');
                inputEl.value = '';
                inputEl.disabled = true;

                try {
                    // API 호출
                    const response = await fetch('/api/chat', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ message })
                    });

                    const data = await response.json();
                    if (data.status === 'success') {
                        addMessage(data.response, 'agent', data.timestamp);
                    } else {
                        addMessage('❌ 오류: ' + data.message, 'agent');
                    }
                } catch (error) {
                    addMessage('❌ 통신 오류: ' + error.message, 'agent');
                }

                inputEl.disabled = false;
                inputEl.focus();
            }

            function addMessage(text, role, timestamp = null) {
                const div = document.createElement('div');
                div.className = 'message ' + (role === 'user' ? 'user-msg' : 'agent-msg');

                const content = document.createElement('div');
                content.className = 'content';
                content.textContent = text;

                div.appendChild(content);

                if (timestamp && role === 'agent') {
                    const ts = document.createElement('div');
                    ts.className = 'timestamp';
                    ts.textContent = new Date(timestamp).toLocaleTimeString('ko-KR');
                    div.appendChild(ts);
                }

                chatDiv.appendChild(div);
                chatDiv.scrollTop = chatDiv.scrollHeight;
            }

            inputEl.onkeypress = (e) => {
                if (e.key === 'Enter') sendMessage();
            };

            inputEl.focus();
        </script>
    </body>
    </html>
    """
    return html

if __name__ == '__main__':
    print("🚀 운영 대시보드 서버 시작")
    print("📊 로컬: http://localhost:5000")
    print("🌐 클라우드: https://ai-investment-trading-cycle-production.junkim-life360.workers.dev/dashboard")
    app.run(debug=False, port=5000, host='127.0.0.1')
