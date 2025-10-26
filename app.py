import streamlit as st
import sys
import os
import traceback
import numpy as np

# 프로젝트 루트 경로 추가
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# 하이브리드 분석 함수 가져오기
from hybrid_readability_analyzer import analyze_text_hybrid

# --- Streamlit 앱 UI 구성 ---

# 페이지 설정 (제목, 아이콘 등)
st.set_page_config(page_title="한국어 이독성 분석기", page_icon="🐸")

# 제목
st.title("📝 한국어 이독성 분석기")
st.write("텍스트를 입력하면 종합적인 이독성 점수와 세부 지표를 분석합니다.")

# 사이드바: 설정 및 옵션
with st.sidebar:
    st.header("⚙️ 분석 설정")
    
    # 1. 장르 선택
    genre = st.selectbox(
        "글의 종류(장르)를 선택하세요:",
        ("expo", "narr", "argument", "news", "tech"),
        index=0, # 기본값 'expo'
        help="글의 장르에 따라 분석 가중치가 일부 조정됩니다."
    )

    # 2. 가중치 설정 (간단한 슬라이더로 변경)
    st.subheader("지표별 가중치 조절")
    weights = {
        "length": st.slider("어휘/구문 길이", 0.0, 2.0, 1.0, 0.1),
        "clause": st.slider("구문 구조", 0.0, 2.0, 1.0, 0.1),
        "ttr": st.slider("어휘 다양성", 0.0, 2.0, 1.0, 0.1),
        "lexical": st.slider("어휘 수준", 0.0, 2.0, 1.0, 0.1),
        "macro": st.slider("거시 구조", 0.0, 2.0, 1.0, 0.1),
        "inference": st.slider("추론 요구", 0.0, 2.0, 1.0, 0.1),
    }

# 메인 화면: 텍스트 입력 및 결과 출력
st.header("👇 분석할 텍스트를 여기에 붙여넣으세요")
text_to_analyze = st.text_area(" ", height=250, placeholder="여기에 텍스트를 입력하세요...")

# "분석하기" 버튼
if st.button("분석하기", type="primary"):
    if text_to_analyze.strip():
        try:
            # 분석 실행
            with st.spinner("텍스트를 분석 중입니다... 잠시만 기다려주세요."):
                report = analyze_text_hybrid(text_to_analyze, weights, genre)

            # --- 결과 출력 ---
            st.header("📊 분석 결과")

            # 최종 점수 강조
            final_score = report.get("final_score")
            if final_score is not None:
                st.metric(label="⭐ 종합 이독성 점수", value=f"{final_score:.2f} 점")
                st.progress(final_score / 100.0, text=f"난이도: {report.get('final_grade', '알 수 없음')}")

            st.divider()

            # 세부 지표들을 2열로 나눠서 표시
            col1, col2 = st.columns(2)
            
            with col1:
                st.subheader("어휘 및 구문")
                st.text(f"평균 문장 길이: {report.get('avg_sentence_length', 0):.2f} 어절")
                st.text(f"평균 어절 길이: {report.get('avg_word_length', 0):.2f} 음절")
                st.text(f"어휘 다양도 (TTR): {report.get('ttr', 0):.2f}")
                
            with col2:
                st.subheader("고급 지표")
                st.text(f"평균 부사 사용 빈도: {report.get('adverb_ratio', 0):.2f}")
                st.text(f"평균 접속사 사용 빈도: {report.get('conj_ratio', 0):.2f}")
                st.text(f"문장 구조 복잡도: {report.get('sentence_complexity', 0):.2f}")

            # 원본 보고서(dict)를 펼쳐서 보여주기 (디버깅용)
            with st.expander("자세한 분석 결과 보기 (JSON)"):
                st.json(report)

        except Exception as e:
            st.error("분석 중 오류가 발생했습니다.")
            st.code(traceback.format_exc())
    else:
        st.warning("분석할 텍스트를 입력해주세요.")