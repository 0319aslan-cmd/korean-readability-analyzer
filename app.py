from __future__ import annotations
from flask import Flask, render_template, request, jsonify
from werkzeug.exceptions import HTTPException
import sys
import os
import traceback
import math
from typing import Any, Mapping, Sequence, Union

# 프로젝트 루트 경로 추가
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# 하이브리드 분석 함수 가져오기
from hybrid_readability_analyzer import analyze_text_hybrid

# --------------------------
# 유틸: JSON 직렬화 안전 변환
# --------------------------
def to_json_safe(obj: Any) -> Any:
    """numpy, set, 복합 객체를 JSON 직렬화 가능한 형태로 변환."""
    try:
        import numpy as np  # 선택적 의존
        np_types = (np.integer, np.floating, np.bool_)
        if isinstance(obj, np_types):
            return obj.item()
    except Exception:
        pass

    if isinstance(obj, (str, int, float, bool)) or obj is None:
        return obj
    if isinstance(obj, (list, tuple, set)):
        return [to_json_safe(x) for x in obj]
    if isinstance(obj, dict):
        return {str(k): to_json_safe(v) for k, v in obj.items()}
    if isinstance(obj, (bytes, bytearray)):
        return obj.decode("utf-8", errors="replace")
    if isinstance(obj, (complex,)):
        return {"real": obj.real, "imag": obj.imag}
    if isinstance(obj, (range,)):
        return list(obj)
    # fallback: 문자열화 (로깅 참고용)
    return str(obj)

# --------------------------
# 앱 초기화
# --------------------------
app = Flask(__name__, template_folder="templates", static_folder="static")

# 허용 장르 (예시)
ALLOWED_GENRES = {"expo", "narr", "argument", "news", "tech"}

# 텍스트 길이 제한 (예: 50,000자)
MAX_TEXT_LEN = 50_000

@app.route("/")
def index():
    # templates/index.html 존재 가정
    return render_template("index.html")

@app.route("/health", methods=["GET"])
def health():
    return jsonify({"ok": True}), 200

@app.route("/analyze", methods=["POST"])
def analyze():
    try:
        # JSON만 받도록 강제
        data = request.get_json(silent=False, force=False)
        if not isinstance(data, dict):
            return jsonify({"error": "요청 본문은 JSON 객체여야 합니다."}), 400

        text_to_analyze = (data.get("text") or "").strip()
        genre = (data.get("genre") or "expo").strip().lower()
        
        # --- 가중치 처리 ---
        weights = data.get("weights")
        if not isinstance(weights, dict) or not weights:
            weights = {"length": 1.0, "clause": 1.0, "ttr": 1.0, "lexical": 1.0}
        else:
            # Ensure all keys are present and are floats
            weights = {
                "length": float(weights.get("length", 1.0)),
                "clause": float(weights.get("clause", 1.0)),
                "ttr": float(weights.get("ttr", 1.0)),
                "lexical": float(weights.get("lexical", 1.0)),
                "macro": float(weights.get("macro", 1.0)),
                "inference": float(weights.get("inference", 1.0)),
            }

        config = data.get("config") or {}  # 옵션 확장 여지

        # 입력 검증
        if not text_to_analyze:
            return jsonify({"error": "분석할 텍스트를 입력해주세요."}), 400
        if len(text_to_analyze) > MAX_TEXT_LEN:
            return jsonify({"error": f"텍스트가 너무 깁니다. 최대 {MAX_TEXT_LEN}자까지 허용됩니다."}), 413
        if genre not in ALLOWED_GENRES:
            return jsonify({"error": f"허용되지 않은 장르입니다. 사용 가능: {sorted(ALLOWED_GENRES)}"}), 400
        if not isinstance(config, dict):
            return jsonify({"error": "config는 객체여야 합니다."}), 400

        # 실제 분석 호출
        report = analyze_text_hybrid(text_to_analyze, weights, genre)

        # 직렬화 안전 변환
        safe_report = to_json_safe(report)

        return jsonify({"result": safe_report}), 200

    except HTTPException as he:
        # Flask/Werkzeug가 던진 HTTP 예외는 그대로 전달
        return jsonify({"error": he.description}), he.code
    except Exception:
        tb_str = traceback.format_exc()
        # 서버 콘솔에 상세 로그
        print(f"[analyze] Internal Error:\n{tb_str}", flush=True)
        # 클라이언트엔 일반 메시지
        return jsonify({"error": "분석 중 서버에서 오류가 발생했습니다."}), 500

# --------------------------
# 진입점
# --------------------------
if __name__ == "__main__":
    # 환경변수로 제어: DEBUG, HOST, PORT
    debug = os.getenv("FLASK_DEBUG", "0") == "1"
    host = os.getenv("FLASK_HOST", "0.0.0.0")
    port = int(os.getenv("FLASK_PORT", "5000"))
    app.run(host=host, port=port, debug=debug)
