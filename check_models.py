import google.generativeai as genai
import os

try:
    # Configure the API key from the environment variable
    genai.configure(api_key=os.environ["GEMINI_API_KEY"])
    print("Gemini API key configured successfully.")

    print("\n사용 가능한 모델 목록:")
    for m in genai.list_models():
      # 'generateContent'를 지원하는 모델만 출력합니다.
      if 'generateContent' in m.supported_generation_methods:
        print(f"- {m.name}")

except KeyError:
    print("오류: GEMINI_API_KEY 환경 변수가 설정되지 않았습니다.")
except Exception as e:
    print(f"오류가 발생했습니다: {e}")
