#!/usr/bin/env python3
"""
AIOS Healthcheck - 모든 서비스의 상태를 확인합니다.
매 5분마다 실행되어 systemd, heartbeat, 로그를 검사합니다.
"""

import json
import subprocess
import sys
from datetime import datetime, timedelta
from pathlib import Path


def run_cmd(cmd: list) -> str:
    """명령어 실행 후 출력을 반환합니다."""
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=10)
        return result.stdout + result.stderr
    except Exception as e:
        return f"[ERROR] {e}"


def check_service_status(service_name: str) -> dict:
    """systemd 서비스 상태 확인"""
    output = run_cmd(["systemctl", "is-active", service_name])
    is_active = output.strip() == "active"

    uptime = run_cmd(["systemctl", "show", "-p", "ExecMainStartTimestamp", service_name])

    return {
        "service": service_name,
        "active": is_active,
        "uptime_info": uptime.strip(),
    }


def check_heartbeat(service_name: str) -> dict:
    """Heartbeat 파일 확인"""
    hb_file = Path("/var/lib/aios") / f"{service_name}_heartbeat.json"

    if not hb_file.exists():
        return {
            "service": service_name,
            "exists": False,
            "status": "NO_HEARTBEAT",
            "age_seconds": None,
        }

    try:
        with open(hb_file) as f:
            data = json.load(f)

        timestamp = datetime.fromisoformat(data["timestamp"].replace("Z", "+00:00"))
        age = (datetime.utcnow() - timestamp.replace(tzinfo=None)).total_seconds()

        status = "OK" if age < 120 else "STALE"

        return {
            "service": service_name,
            "exists": True,
            "status": status,
            "age_seconds": int(age),
            "loop_count": data.get("loop_count"),
            "pid": data.get("pid"),
            "last_error": data.get("last_error"),
        }
    except Exception as e:
        return {
            "service": service_name,
            "exists": True,
            "status": "ERROR",
            "error": str(e),
        }


def check_recent_logs(service_name: str, lines: int = 5) -> dict:
    """최근 로그 확인"""
    log_file = Path(f"/var/log/aios/{service_name}.log")

    if not log_file.exists():
        return {"service": service_name, "log_exists": False}

    try:
        with open(log_file) as f:
            all_lines = f.readlines()

        recent = all_lines[-lines:] if len(all_lines) > lines else all_lines

        return {
            "service": service_name,
            "log_exists": True,
            "total_lines": len(all_lines),
            "recent_logs": [line.rstrip() for line in recent],
        }
    except Exception as e:
        return {
            "service": service_name,
            "log_exists": True,
            "error": str(e),
        }


def main():
    """전체 헬스 체크 실행"""
    services = ["aios-crypto", "aios-kis", "aios-toss"]
    report = {
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "services": {},
        "overall_status": "OK",
    }

    unhealthy = 0

    for service in services:
        service_report = {
            "systemd": check_service_status(service),
            "heartbeat": check_heartbeat(service.replace("aios-", "")),
            "logs": check_recent_logs(service.replace("aios-", "")),
        }

        hb = service_report["heartbeat"]
        if hb.get("status") not in ("OK",):
            unhealthy += 1

        report["services"][service] = service_report

    # 전체 상태 결정
    if unhealthy > 0:
        report["overall_status"] = "WARN" if unhealthy < 3 else "ERROR"

    # 출력
    print(json.dumps(report, indent=2))

    # 로그
    log_file = Path("/var/log/aios/healthcheck.log")
    try:
        with open(log_file, "a") as f:
            f.write(json.dumps(report) + "\n")
    except Exception:
        pass

    # Exit code
    sys.exit(0 if report["overall_status"] == "OK" else 1)


if __name__ == "__main__":
    main()
