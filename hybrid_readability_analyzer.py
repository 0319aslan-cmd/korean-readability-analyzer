import json
import re
import os
from konlpy.tag import Okt
from kiwipiepy import Kiwi
import google.generativeai as genai
import csv
import math
import numpy as np

# --- LLM API Key Configuration ---
try:
    genai.configure(api_key=os.environ["GEMINI_API_KEY"])
    print("Gemini API key configured successfully.")
except KeyError:
    print("Error: GEMINI_API_KEY environment variable not set.")

# --- Initialize morphe-me analyzers ---
okt = Okt()
kiwi = Kiwi(model_type='sbg')

# --- Vocabulary Loading ---
def load_vocab_with_levels_from_csv(filepath, word_col, level_col, max_level):
    vocab_map = {}
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            reader = csv.reader(f)
            for row in reader:
                if len(row) > max(word_col, level_col):
                    word = row[word_col].strip()
                    try:
                        # Scale level from original_max to 0-100
                        level = int(row[level_col].strip())
                        scaled_level = (level / max_level) * 100
                        if word: vocab_map[word] = scaled_level
                    except ValueError: continue
    except Exception as e: print(f"Error reading {filepath}: {e}")
    return vocab_map

NIKL_VOCAB_PATH = r"C:\Users\0319a\OneDrive - 한국교원대학교\바탕 화면\이독성 분석 프로그램\sample_nikl (1).csv"
EBS_VOCAB_PATH = r"C:\Users\0319a\OneDrive - 한국교원대학교\바탕 화면\이독성 분석 프로그램\ebs_vocab_with_level.csv"
ALL_VOCAB_LEVELS = {}
ALL_VOCAB_LEVELS.update(load_vocab_with_levels_from_csv(NIKL_VOCAB_PATH, 0, 1, 5))
ALL_VOCAB_LEVELS.update(load_vocab_with_levels_from_csv(EBS_VOCAB_PATH, 0, 2, 7))

# --- Final Benchmark ---
BENCH = {
    "narr": {"avgLen": 15, "clausePerSent": 1.8, "ttr": 0.45},
    "expo": {"avgLen": 16, "clausePerSent": 1.8, "ttr": 0.48}
}

# --- Core Helper Functions ---
def split_sentences(text):
    sentences = re.split(r'(?<=[.?!])\s+', text)
    refined = [p for s in sentences for p in re.split(r'(?<=[다요죠])\.\s*', s)]
    return [s.strip() for s in refined if s.strip()]

def get_oov_words(text, vocab_map):
    return list(set(w for w in okt.nouns(text) if w not in vocab_map))

# --- LLM Call Functions ---
def get_llm_oov_difficulty(oov_list):
    """Gets the average difficulty of Out-of-Vocabulary words from an LLM."""
    model = genai.GenerativeModel('models/gemini-flash-latest', generation_config={"response_mime_type": "application/json"})
    
    words_str = ", ".join(oov_list)
    prompt = f"""당신은 한국어 어휘 난이도 평가 전문가입니다. 당신의 임무는 주어진 단어 목록의 평균적인 난이도를 **한국 고등학생** 기준으로 평가하는 것입니다.

### 평가 기준 (0-100점)
- **0-20점:** 매우 쉬운 고유명사 또는 일상어 (예: '철수', '영희', '떡')
- **21-50점:** 일반적인 한자어 또는 보통 수준의 고유명사 (예: '대한민국', '정부')
- **51-80점:** 다소 어려운 학술 용어 또는 전문 분야의 고유명사 (예: '척사파', '갑신정변')
- **81-100점:** 매우 어려운 전문 용어 또는 거의 사용되지 않는 한자 성어 (예: '개물성무', '화민성속')

### 단어 목록
{words_str}

### 출력 형식 (JSON)
위 기준에 따라 단어들의 평균 난이도를 **정수**로 평가하여 아래 JSON 형식으로만 응답해주세요.
```json
{{
  "average_oov_difficulty": <평균 난이도 점수 (0-100)>
}}
```
    """
    try:
        response = model.generate_content(prompt, request_options={"timeout": 30})
        result = json.loads(response.text)
        return result.get("average_oov_difficulty", 50) # Default to medium on failure
    except Exception as e:
        print(f"OOV difficulty LLM call failed: {e}")
        return 50 # Return a neutral score on error

def get_llm_holistic_evaluation(text):
    """Analyzes macro-structure and inference potential."""
    model = genai.GenerativeModel('models/gemini-flash-latest', generation_config={"response_mime_type": "application/json"})
    prompt = f"""당신은 텍스트의 '진정한 인지적 부담'을 평가하는 세계 최고의 분석가입니다. 당신의 임무는 독자가 수행해야 할 '사고의 종류'와 '정보의 구조'에 따라 텍스트의 난이도를 종합적으로 판별하는 것입니다.

### 분석할 텍스트 ###
{text}

### Part 1: 거시 점수 (구조 및 논리 분석) ###
#### [평가 기준]
- **정보 구조 (0-100점):** 정보가 선형적인가, 복합적인가? (낮을수록 선형적)
- **추상성 수준 (0-100점):** 구체적인가, 추상적인가? (낮을수록 구체적)
- **논리적 연결성 (0-100점):** 문장/문단 간 연결이 명시적인가, 암시적인가? (낮을수록 명시적)

### Part 2: 추론 잠재력 보정 점수 (독자의 추론적 사고 분석) ###
#### [평가 기준]
- **정보 밀도 (+0 ~ +20점):** 정보가 밀도 높고 확장 가능하여 독자가 더 깊이 생각할 여지가 있는가?
- **내용 완결성 (-20 ~ +0점):** 내용이 명확하고 완결적이어서 독자가 곧바로 이해할 수 있고 추론의 여지가 적은가? (완결적일수록 마이너스 점수)
- **모호성/비판성 (+0 ~ +10점):** 비판적 사고를 자극하거나 다양한 해석을 유도하는 모호한 부분이 있는가?

### 분석 및 평가 ###
위의 평가 기준에 따라 텍스트를 분석하고, 각 세부 항목에 대한 점수를 부여하세요. 그리고 그 점수들을 바탕으로 **종합 거시 점수 (0-100점)**와 **종합 추론 잠재력 보정 점수 (-30 ~ +30점)**를 결정하세요. 마지막으로, 전체적인 분석 요약과 추론 잠재력의 이유를 긍정적 측면과 부정적 측면으로 나누어 **반드시 경어체('~합니다', '~습니다')를 사용하여** 서술해주세요.

### 출력 형식 (JSON) ###
```json
{{
  "macro_score": <종합 거시 점수 (정수)>,
  "macro_details": {{
    "structure": <정보 구조 점수 (정수)>,
    "abstraction": <추상성 수준 점수 (정수)>,
    "connectivity": <논리적 연결성 점수 (정수)>
  }},
  "analysis_summary": "<거시 점수 분석 요약 (문자열)>",
  "inference_adjustment": <종합 추론 잠재력 보정 점수 (정수)>,
  "inference_details": {{
      "density": <정보 밀도 점수 (정수)>,
      "completeness": <내용 완결성 점수 (정수)>,
      "ambiguity": <모호성/비판성 점수 (정수)>
  }},
  "inference_reason_positive": "<추론 잠재력이 높은 이유 분석 (문자열)>",
  "inference_reason_negative": "<추론 잠재력이 낮은 이유 분석 (문자열)>"
}}
```
    """
    try:
        response = model.generate_content(prompt, request_options={"timeout": 30})
        match = re.search(r'\{.*\}', response.text, re.DOTALL)
        if match:
            json_str = match.group(0)
            return json.loads(json_str)
        else:
            raise ValueError("No valid JSON object found in the LLM response.")
    except Exception as e: 
        print(f"Holistic LLM call failed: {e}")
        return {
            "macro_score": 50, "macro_details": {"structure": 50, "abstraction": 50, "connectivity": 50},
            "analysis_summary": f"AI 분석 중 오류 발생: {e}", "inference_adjustment": 0,
            "inference_details": {"density": 0, "completeness": 0, "ambiguity": 0},
            "inference_strength": "AI 분석 중 오류가 발생했습니다.", "inference_limit": "AI 분석 중 오류가 발생했습니다."
        }

def get_micro_details(text, genre, weights):
    corpus_bench = BENCH.get(genre, BENCH["expo"])
    sentences = split_sentences(text)
    num_sentences = len(sentences)

    if not sentences:
        return {
            "length": 0, "clause": 0, "ttr": 0, "lexical": 0,
            "sentence_count": 0, "avg_sentence_len": 0, "known_vocab_rate": 100
        }

    # --- Calculate raw metrics ---
    all_morphs = okt.morphs(text)
    avg_sentence_len = len(all_morphs) / num_sentences if num_sentences > 0 else 0

    # --- Calculate Length & TTR complexity (relative to benchmark) ---
    len_complexities = [max(0, (len(okt.morphs(s)) - corpus_bench["avgLen"]) / corpus_bench["avgLen"]) for s in sentences]
    ttr_complexities = [max(0, ((len(set(okt.morphs(s))) / len(okt.morphs(s)) if okt.morphs(s) else 0) - corpus_bench["ttr"]) / max(0.15, corpus_bench["ttr"])) for s in sentences]

    # --- NEW: Comprehensive Clause Counting for Syntactic Complexity (using Kiwi) ---
    total_clauses = 0
    # Tags to count as proxies for clauses:
    # VV: Verb, VA: Adjective (Main predicates)
    # ETM: Adnominal Ending (Relative clauses, e.g., "예쁜 꽃")
    # ETN: Nominal Ending (Noun clauses, e.g., "밥을 먹기")
    # EC: Connective Ending (Adverbial/Subordinate clauses, e.g., "배가 고파서 밥을 먹었다")
    # JKQ: Quoting Particle (Quoted clauses, e.g., "'안녕'이라고 말했다")
    clause_tags = ['VV', 'VA', 'ETM', 'ETN', 'EC', 'JKQ']

    for s in sentences:
        if not s.strip(): continue
        
        analysis_result = kiwi.analyze(s)
        if not analysis_result: continue
        
        tokens, _ = analysis_result[0]
        clauses_in_sentence = sum(1 for token in tokens if token.tag in clause_tags)
        total_clauses += max(1, clauses_in_sentence) # Ensure at least 1 clause per sentence

    avg_clauses_per_sentence = total_clauses / num_sentences if num_sentences > 0 else 1
    
    # Normalize the clause count to a 0-100 scale
    # An average of ~7 clauses/sentence will now approach the max score.
    clause_complexity = (avg_clauses_per_sentence - 1) * 16 
    final_clause_score = min(100, max(0, clause_complexity))

    # --- NEW: Hybrid Lexical Difficulty Calculation (Weighted Average) ---
    all_nouns = okt.nouns(text)
    known_nouns = [n for n in all_nouns if n in ALL_VOCAB_LEVELS]
    oov_nouns = list(set(n for n in all_nouns if n not in ALL_VOCAB_LEVELS)) # Use set for unique words
    
    known_vocab_rate = (len(known_nouns) / len(all_nouns) * 100) if all_nouns else 100


    # 1. Score for known words (0-100 scale)
    known_score = 0
    if known_nouns:
        known_score = np.mean([ALL_VOCAB_LEVELS.get(n, 50) for n in known_nouns])

    # 2. Score for OOV words from LLM (0-100 scale)
    oov_score = get_llm_oov_difficulty(oov_nouns)

    # 3. Weighted average to get final lexical score (0-100 scale)
    total_nouns_count = len(all_nouns)
    if total_nouns_count == 0:
        final_lexical_score = 0
    else:
        final_lexical_score = (known_score * len(known_nouns) + oov_score * len(oov_nouns)) / total_nouns_count

    # --- NEW: More aggressive scaling for all scores to 100 ---
    # A complexity of 1.0 (e.g., twice the benchmark) now maps to a score of 100.
    scaling_factor = 100
    
    details_scaled = {
        "length": min(100, round(np.mean(len_complexities) * scaling_factor)),
        "clause": min(100, round(final_clause_score)),
        "ttr": min(100, round(np.mean(ttr_complexities) * scaling_factor)),
        "lexical": min(100, round(final_lexical_score))
    }
    
    # Add raw stats for reporting
    details_scaled["sentence_count"] = num_sentences
    details_scaled["avg_sentence_len"] = round(avg_sentence_len, 2)
    details_scaled["known_vocab_rate"] = round(known_vocab_rate, 2)

    return details_scaled

# --- Main Analysis Function ---
def analyze_text_hybrid(text, weights, genre):
    
    if not text.strip():
        return {
            "overall_final_score": 0, "final_score_reason": "<p>분석할 텍스트가 없습니다.</p>",
            "micro_score": 0, "micro_details": {"length": 0, "clause": 0, "ttr": 0, "lexical": 0},
            "macro_score": 0, "macro_details": {"structure": 0, "abstraction": 0, "connectivity": 0},
            "inference_adjustment_score": 0, "inference_details": {"density": 0, "completeness": 0, "ambiguity": 0},
            "oov_list": [],
            "sentence_count": 0, "avg_sentence_len": 0, "known_vocab_rate": 100
        }

    # --- Get Micro and Macro Scores ---
    micro_details_scaled = get_micro_details(text, genre, weights)
    holistic_eval = get_llm_holistic_evaluation(text)

    # Extract all values from the holistic evaluation at once
    macro_score_from_llm = holistic_eval.get("macro_score", 50)
    macro_details = holistic_eval.get("macro_details", {"structure": 50, "abstraction": 50, "connectivity": 50})
    analysis_summary = holistic_eval.get("analysis_summary", "AI 분석에 실패하여 기본값을 사용합니다.")
    inference_adjustment = holistic_eval.get("inference_adjustment", 0)

    # --- Final Score Calculation ---
    # 5대 요인(미시 4 + 거시 1)의 가중 평균으로 기본 점수 계산
    scores_to_average = {
        "length": micro_details_scaled["length"],
        "clause": micro_details_scaled["clause"],
        "ttr": micro_details_scaled["ttr"],
        "lexical": micro_details_scaled["lexical"],
        "macro": macro_score_from_llm
    }

    amplification_factor = 2.0
    
    current_weights = {
        "length": 1 + (weights.get("length", 1.0) - 1) * amplification_factor,
        "clause": 1 + (weights.get("clause", 1.0) - 1) * amplification_factor,
        "ttr": 1 + (weights.get("ttr", 1.0) - 1) * amplification_factor,
        "lexical": 1 + (weights.get("lexical", 1.0) - 1) * amplification_factor,
        "macro": 1 + (weights.get("macro", 1.0) - 1) * amplification_factor
    }

    weighted_score_sum = sum(scores_to_average[key] * current_weights[key] for key in scores_to_average)
    total_weight = sum(current_weights.values())
    main_score = weighted_score_sum / total_weight if total_weight > 0 else 0

    # 추론 잠재력 점수는 가중치를 적용하여 보정값으로 사용
    inference_weight_ui = weights.get("inference", 1.0)
    amplified_inference_weight = 1 + (inference_weight_ui - 1) * amplification_factor
    weighted_inference_adjustment = inference_adjustment * amplified_inference_weight

    final_score = main_score + weighted_inference_adjustment
    final_score = max(0, min(100, final_score))

    # --- Reporting ---
    macro_score = scores_to_average["macro"] # Get the score used in the average
    
    # Conditional inference reason based on score
    if inference_adjustment >= 0:
        inference_reason = holistic_eval.get("inference_reason_positive", "AI가 텍스트의 정보 밀도와 확장 가능성을 긍정적으로 평가했습니다.")
    else:
        inference_reason = holistic_eval.get("inference_reason_negative", "AI가 텍스트의 내용이 명확하고 완결적이어서 추론의 여지가 적다고 평가했습니다.")

    main_score_reason = (
        f"<p><strong>[주요 5대 요인 가중 평균 ({round(main_score, 1)}점)]</strong></p>"
        f"<p>아래 5개 항목의 점수에 각각의 가중치를 곱한 뒤, 가중치의 총합으로 나누어 계산된 '기본 점수'입니다.</p>"
        f"<ul>"
        f"<li><strong>문장 길이 ({weights.get('length', 1.0)}배):</strong> {micro_details_scaled['length']}점</li>"
        f"<li><strong>문장 구조 ({weights.get('clause', 1.0)}배):</strong> {micro_details_scaled['clause']}점</li>"
        f"<li><strong>어휘 다양성 ({weights.get('ttr', 1.0)}배):</strong> {micro_details_scaled['ttr']}점</li>"
        f"<li><strong>어휘 수준 ({weights.get('lexical', 1.0)}배):</strong> {micro_details_scaled['lexical']}점</li>"
        f"<li><strong>구조/논리 ({weights.get('macro', 1.0)}배):</strong> {round(macro_score, 1)}점"
        f"    <blockquote><strong>AI의 종합 평가 요약:</strong> {analysis_summary}</blockquote>"
        f"    <ul>"
        f"        <li>정보 구조: {macro_details['structure']}점 <span class='reveal-on-select'>(선형적/단순 ↔ 복합적/다층적)</span></li>"
        f"        <li>추상성 수준: {macro_details['abstraction']}점 <span class='reveal-on-select'>(구체적/경험적 ↔ 추상적/개념적)</span></li>"
        f"        <li>논리적 연결성: {macro_details['connectivity']}점 <span class='reveal-on-select'>(명시적/친절 ↔ 암시적/불친절)</span></li>"
        f"    </ul>"
        f"</li>"
        f"</ul>"
    )

    inference_reason_block = (
        f"<p><strong>[추론 잠재력 보정 ({weighted_inference_adjustment:+.1f}점)]</strong></p>"
        f"<p>위에서 계산된 기본 점수에, AI가 분석한 '추론 잠재력' 점수가 가중치와 함께 더해져 최종 점수가 산출됩니다.</p>"
        f"<ul>"
        f"<li><strong>추론 잠재력 점수 ({weights.get('inference', 1.0)}배):</strong> {inference_adjustment}점</li>"
        f"<li><strong>AI 분석:</strong> {inference_reason}</li>"
        f"</ul>"
    )

    final_reason = f"{main_score_reason}{inference_reason_block}"
    oov_list = get_oov_words(text, ALL_VOCAB_LEVELS)

    # --- Convert final scores to prediction scale for comparison ---
    pred_scaled = {
        "length": round((micro_details_scaled.get("length", 50) / 100) * 9 + 1, 1),
        "clause": round((micro_details_scaled.get("clause", 50) / 100) * 9 + 1, 1),
        "ttr": round((micro_details_scaled.get("ttr", 50) / 100) * 9 + 1, 1),
        "lexical": round((micro_details_scaled.get("lexical", 50) / 100) * 9 + 1, 1),
        "macro": round((macro_score / 100) * 9 + 1, 1),
        "inference": round(inference_adjustment / 6, 1)
    }

    report = {
        "overall_final_score": round(final_score, 2),
        "final_score_reason": final_reason,
        "micro_score": round(main_score, 2), # 이제 main_score가 micro_score의 역할을 대신함
        "micro_details": micro_details_scaled,
        "macro_score": round(macro_score, 2),
        "macro_details": macro_details,
        "inference_adjustment_score": weighted_inference_adjustment, # 가중치 적용된 값
        "inference_details": holistic_eval.get("inference_details", {"density": 0, "completeness": 0, "ambiguity": 0}),
        "oov_list": oov_list,
        "sentence_count": micro_details_scaled.get("sentence_count", 0),
        "avg_sentence_len": micro_details_scaled.get("avg_sentence_len", 0),
        "known_vocab_rate": micro_details_scaled.get("known_vocab_rate", 100),
        "prediction_scaled_scores": pred_scaled
    }
    return report

if __name__ == '__main__':
    if "GEMINI_API_KEY" in os.environ:
        test_text = """서양의 과학과 기술, 천주교의 수용을 반대했던 이항로를 비롯한 척사파의 주장은 개항 이후에도 지속되었지만, 개화 는 거스를 수 없는 대세로 자리 잡았다. 개물성무(開物成務)와 화민성속 (化民成俗)의 앞 글자를 딴 개화는 개항 이전에는 통치자의 통치 행위로서 변화하는 세상에 대한 지식 확장과 피통치자에 대한 교화를 의미했다.개항 이후 서양 문명에 대한 긍정적 인식이 확산되면서 서양 문명의 수용을 뜻하는 개화 개념이 자리 잡았다. 임오군란 이후, 고종은 자강 정책을 추진하면서 반(反)서양 정서의 교정을 위해 한성순보를 발간했다. 이 신문의 개화 개념은 서양 기술과 제도의 도입을 통한 인지의 발달과 풍속의 진보를 뜻했다. 이 개념에는 인민이 국가의 독립 주권의 소중함을 깨닫는 의식의 변화가 내포되었고, 통치자의 입장에서 수용 가능한 문명의 장점을 받아들여 국가의 진보를 달성한다는 의미도 담겼다.개화당의 한 인사가 제시한 개화 개념은 성문화된 규정에 따른 대민 정치에서의 법적 처리 절차 실현 등 서양 근대 국가의 통치 방식으로의 변화를 내포하는 것이었다. 그는 개화 실행 주체를 여전히 왕으로 생각했고, 개화 실행 주체로서 왕의 역할이 사라진 것은 갑신정변에서였다. 풍속의 진보와 통치 방식 변화 라는 의미를 내포한 갑신정변의 개화 개념은 통치권에 대한 도전으로뿐 아니라 개인의 사욕을 위한 것으로 표상되었다. 이후 개화 개념은 국가 구성원을 조직하고 동원하기 위해 부정적 이미지에서 벗어나야 했고, 유길준은 󰡔서유견문󰡕을 저술하며 개화 개념에 덧씌워진 부정적 이미지를 떼어 내고자 했다. 이후 간행된 󰡔대한매일신보󰡕 등의 개화 개념은 국가 구성원 전체를 실행 주체로 하여 근대 국가 주권을 향해 그들을 조직하고 동원하는 것을 의미했다.을사늑약 이후, 개화 논의는 문명에 대한 본격적인 논의로 이어졌다. 대한 자강회의 주요 인사들은 서양 근대 문명을 수용하여 근대 국가를 건설하고자, 앞서 문명화를 이룬 일본의 지도를 받아야 한다고 보았다. 이들은 서양 근대 문명의 주체를 주체 인식의 준거로 삼았기 때문에 민족 주체성을 간과했다. 이러한 상황에서 박은식은 근대 국가 건설과 새로운 주체의 형성에 주목하여 문명에 대한 견해를 제시했다. 그의 기본 전략은 문명의 물질적 측면인 과학은 서양으로부터 수용하되, 문명의 정신적 측면인 철학은 유학을 혁신하여 재구성하는 것이었다. 그는 생존과 편리 증진을 위해 과학 연구가 시급 하지만, 가치관 정립과 인격 수양을 위해 철학 또한 필수적 이라고 보았다. 자국 철학 전통의 정립이라는 당시 동아시아의 사상적 흐름 속에서 그가 제시한 근대 주체는 과학적․철학적 인식의 주체이자 실천적 도덕 수양의 주체로서의 성격을 띠는 것이었다."""
        test_weights = {"len": 1.0, "clause": 1.0, "ttr": 1.0, "lex": 1.0}
        analysis_report = analyze_text_hybrid(test_text, test_weights, "expo")
        print(json.dumps(analysis_report, indent=2, ensure_ascii=False))
    else:
        print("Cannot run test: GEMINI_API_KEY not set.")
