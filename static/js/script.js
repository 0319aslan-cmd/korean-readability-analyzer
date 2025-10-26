document.addEventListener('DOMContentLoaded', function() {
    // --- Initialize Bootstrap Popovers ---
    const popoverTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="popover"]'));
    const popoverList = popoverTriggerList.map(function (popoverTriggerEl) {
        return new bootstrap.Popover(popoverTriggerEl);
    });

    // --- Global variables ---
    let chartInstances = {};
    let manipulationAnalysisData = null; // To store data for real-time recalculation
    let baselineScores = null; // To store baseline scores (weights all 1.0)

    // --- DOM Elements ---
    // Tab 1: Compare
    const compareResultsContainer = document.getElementById('compare-results-container');
    const resultLeftEl = document.getElementById('result-left');
    const resultRightEl = document.getElementById('result-right');

    // Tab 2: Manipulate
    const textInputManipulate = document.getElementById('text-input-manipulate');
    const analyzeManipulateBtn = document.getElementById('analyze-manipulate-button');
    const manipulateControls = document.getElementById('manipulate-controls');
    const manipulateResultEl = document.getElementById('manipulate-result');
    const sliders = {
        length: document.getElementById('weight-length'),
        clause: document.getElementById('weight-clause'),
        ttr: document.getElementById('weight-ttr'),
        lexical: document.getElementById('weight-lexical'),
        macro: document.getElementById('weight-macro'),
        inference: document.getElementById('weight-inference'),
    };
    const sliderVals = {
        length: document.getElementById('weight-length-val'),
        clause: document.getElementById('weight-clause-val'),
        ttr: document.getElementById('weight-ttr-val'),
        lexical: document.getElementById('weight-lexical-val'),
        macro: document.getElementById('weight-macro-val'),
        inference: document.getElementById('weight-inference-val'),
    };

    // Tab 3: Predict
    const loadPredictTextBtn = document.getElementById('load-predict-text-button');
    const predictTextDisplay = document.getElementById('predict-text-display');
    const predictionInput = document.getElementById('prediction-input');
    const analyzePredictBtn = document.getElementById('analyze-predict-button');
    const predictResultContainer = document.getElementById('predict-result-container');
    const sampleTexts = [
        // 고3 모의고사 독서 지문 (10개)
        "채권자가 채무자에게 채무의 이행을 청구하는 것을 내용으로 하는 권리인 채권은 법률 행위에 의해 발생하는 것이 일반적이다. 법률 행위는 의사 표시를 필수적 요소로 하여 법률 효과를 발생시키는 행위인데, 계약이 대표적인 예이다. 그러나 당사자의 의사와 무관하게 법률 규정에 의해 채권이 발생하기도 하는데, 사무 관리, 부당 이득, 불법 행위가 이에 해당한다. 사무 관리는 법률상 의무 없이 타인을 위하여 그의 사무를 처리해 주는 행위이다. 예를 들어 이웃집의 수도가 고장 나 수리해 준 경우, 수리해 준 사람은 그 집주인에게 비용을 상환하라고 청구할 수 있는 채권을 가진다. 이때 의무 없이 나선 행위가 타인의 이익을 위한 것이어야 한다는 점에서 불법 행위와 구별된다.",
        "18세기 북학파 학자들은 청의 문물을 적극적으로 수용하여 국가를 발전시키고자 했다. 이들은 상업과 기술의 중요성을 강조하며, 당시 조선 사회의 폐쇄적인 경제 구조를 비판했다. 박제가의 '북학의'는 이러한 사상을 집대성한 저서로, 그는 소비를 우물물에 비유하며 생산을 촉진하기 위해서는 적절한 소비가 필수적이라고 주장했다. 이는 생산력 발전에만 주목했던 당시의 전통적인 경제관에서 벗어나, 유통과 소비의 중요성을 인식한 선구적인 견해였다. 그는 또한 수레와 선박의 활용을 통해 전국적인 유통망을 구축하고, 대외 무역을 확대하여 국가의 부를 증진시켜야 한다고 역설했다.",
        "인간의 뇌는 복잡한 신경망으로 이루어져 있으며, 뉴런이라는 신경 세포들이 시냅스를 통해 서로 신호를 주고받으며 정보를 처리한다. 학습과 기억은 이러한 시냅스의 연결 강도가 변화하고 재구성되는 과정, 즉 '시냅스 가소성'을 통해 이루어진다. 특정 시냅스가 반복적으로 활성화되면 그 연결이 강화되어 신호 전달 효율이 높아지는데, 이를 장기 강화 현상(LTP)이라고 한다. 반대로, 시냅스의 활동이 줄어들면 연결이 약화되는 장기 약화 현상(LTD)도 일어난다. 이러한 시냅스 가소성은 뇌가 새로운 정보를 학습하고, 불필요한 정보를 잊으며, 환경 변화에 적응할 수 있게 하는 핵심적인 기제이다.",
        "위성 항법 시스템(GPS)은 최소 4개의 위성으로부터 신호를 수신하여 현재 위치를 계산한다. 각 위성은 정확한 시간 정보와 자신의 위치 좌표를 담은 신호를 지구로 송신한다. GPS 수신기는 이 신호를 받은 시각과 신호에 담긴 송신 시각의 차이를 이용하여 위성과의 거리를 계산한다. 빛의 속도는 일정하므로, 시간 차이에 빛의 속도를 곱하면 거리를 알 수 있다. 이렇게 3개의 위성과의 거리를 알면, 3개의 구가 만나는 두 점으로 위치를 좁힐 수 있다. 이 두 점 중 하나는 보통 지구 표면에서 매우 멀거나 움직이는 속도가 비현실적이므로, 나머지 한 점을 현재 위치로 특정할 수 있다. 네 번째 위성은 이러한 계산 과정에서 발생할 수 있는 시간 오차를 보정하여 정확도를 높이는 역할을 한다.",
        "현대 사회에서 데이터는 중요한 자원으로 인식되며, 이를 분석하고 활용하는 능력이 경쟁력의 핵심이 되고 있다. 데이터 마이닝은 대규모 데이터 집합에서 통계적 규칙이나 패턴을 찾아내는 기술이다. 이 기술은 연관 규칙 분석, 분류, 군집화 등 다양한 기법을 활용한다. 예를 들어, 마트의 판매 데이터에서 특정 상품들이 함께 구매되는 경향을 발견하는 것은 연관 규칙 분석에 해당한다. 데이터 마이닝을 통해 기업은 고객의 소비 패턴을 예측하여 마케팅 전략을 수립하고, 금융 기관은 신용 평가 모델을 정교화하며, 의료 분야에서는 질병의 발병 가능성을 예측하는 등 다양한 분야에서 활용되고 있다.",
        "칸트는 의무론적 윤리설을 대표하는 철학자로, 행위의 결과보다는 그 행위를 유발한 동기의 도덕성을 판단의 기준으로 삼았다. 그에 따르면, 도덕적 행위는 오직 '선한 의지'에서 비롯된 것이어야 한다. 선한 의지란 어떤 결과를 얻기 위한 수단으로서가 아니라, 단지 그것이 옳다는 이유만으로 도덕 법칙을 따르려는 의지를 말한다. 칸트는 이러한 도덕 법칙을 '정언 명령'이라고 불렀다. 정언 명령은 '네 의지의 준칙이 언제나 동시에 보편적 입법의 원리가 될 수 있도록 행위하라'는 형식으로 표현되며, 이는 시대와 상황을 초월하여 누구나 따라야 할 절대적인 도덕 원칙임을 의미한다.",
        "중력 렌즈 효과는 거대한 질량을 가진 천체(은하단 등)가 주변의 시공간을 휘게 하여, 그 뒤쪽에 있는 더 먼 천체에서 나온 빛이 휘어져 보이는 현상을 말한다. 이는 아인슈타인의 일반 상대성 이론에 의해 예측되었으며, 실제로 관측을 통해 증명되었다. 이 효과로 인해 멀리 있는 천체의 모습이 여러 개로 보이거나, 링 모양으로 왜곡되어 보이기도 한다. 천문학자들은 중력 렌즈 효과를 이용하여 직접 관측하기 어려운 암흑 물질의 분포를 연구하거나, 우주 초기에 형성된 매우 멀리 있는 은하를 발견하는 등 우주를 탐사하는 강력한 도구로 활용하고 있다.",
        "플라스틱은 가볍고, 내구성이 강하며, 가공하기 쉬워 현대 사회에서 널리 사용되는 물질이다. 그러나 자연적으로 분해되지 않아 심각한 환경 문제를 야기한다. 특히, 미세 플라스틱은 5mm 미만의 작은 플라스틱 조각으로, 해양 생태계를 파괴하고 먹이 사슬을 통해 결국 인간의 건강까지 위협할 수 있다. 이에 대한 해결책으로 생분해성 플라스틱이 주목받고 있다. 옥수수 전분과 같은 식물성 원료로 만들어지는 이 플라스틱은 특정 조건에서 미생물에 의해 물과 이산화탄소로 분해될 수 있다. 하지만 생산 비용이 비싸고, 모든 환경에서 쉽게 분해되지 않는다는 한계도 있어 상용화를 위해서는 기술 개발이 더 필요하다.",
        "점유란 물건에 대한 사실상의 지배 상태를 의미하며, 소유권과 같은 본권의 유무와는 무관하게 인정된다. 우리 민법은 점유에 대해 일정한 법적 효과를 부여하여 법질서의 안정을 꾀하는데, 이를 점유 보호 제도라고 한다. 예를 들어, 어떤 물건을 훔친 도둑이라도 그 물건을 사실상 지배하고 있는 동안에는 점유권을 가진다. 만약 제3자가 그 물건을 빼앗으려 한다면, 도둑은 점유권에 기한 방해 배제 청구권을 행사할 수 있다. 이처럼 점유 제도는 현재의 사실 상태를 일단 보호함으로써 분쟁을 예방하고, 본권의 유무는 추후 소송을 통해 가리도록 하는 역할을 한다.",
        "알고리즘은 특정 문제를 해결하기 위한 절차나 방법의 집합이다. 좋은 알고리즘은 정확하고, 효율적이며, 이해하기 쉬워야 한다. 알고리즘의 효율성은 주로 '시간 복잡도'와 '공간 복잡도'로 평가된다. 시간 복잡도는 입력 데이터의 크기가 증가함에 따라 알고리즘의 실행 시간이 얼마나 길어지는지를 나타내는 척도이며, 공간 복잡도는 알고리즘이 실행되는 동안 사용하는 메모리 공간의 크기를 나타낸다. 예를 들어, 정렬되지 않은 데이터에서 특정 값을 찾을 때, 처음부터 순서대로 하나씩 확인하는 '선형 탐색' 알고리즘은 데이터가 N개일 때 평균 N/2번의 비교가 필요하지만, 정렬된 데이터에서 사용하는 '이진 탐색' 알고리즘은 log2(N)번의 비교만으로 값을 찾을 수 있어 훨씬 효율적이다.",
        
        // 인터넷 뉴스 기사 (5개)
        "정부가 내년도 연구개발(R&D) 예산을 역대 최대 규모로 편성하기로 했다. 과학기술정보통신부는 오늘 국가과학기술자문회의 심의를 거쳐 '2025년도 국가연구개발사업 예산 배분·조정안'을 확정했다고 밝혔다. 조정안에 따르면 내년도 R&D 예산은 올해보다 9.5% 증가한 26조 5천억 원 규모다. 특히 인공지능(AI), 첨단 바이오, 양자 등 3대 게임체인저 기술 분야에 대한 투자를 대폭 확대하고, 젊은 연구자 지원과 기초 연구 강화를 위한 예산도 증액하기로 했다. 정부는 이번 예산 편성이 과학기술 강국으로 도약하기 위한 초석이 될 것으로 기대한다고 밝혔다.",
        "최근 고물가 현상이 지속되면서 소비자들의 시름이 깊어지고 있다. 통계청이 발표한 '9월 소비자물가동향'에 따르면 지난달 소비자물가지수는 지난해 같은 달보다 3.7% 상승했다. 특히 신선식품지수는 15.4%나 급등하며 장바구니 물가 부담을 키웠다. 정부는 물가 안정을 위해 농축수산물 할인 지원을 확대하고, 석유류 유류세 인하 조치를 연말까지 연장하기로 했다. 하지만 국제 유가 변동성과 이상 기후 등 불확실성이 여전해 당분간 물가 불안은 계속될 것이라는 전망이 우세하다.",
        "한국은행 금융통화위원회가 기준금리를 현재의 연 3.5% 수준에서 동결하기로 결정했다. 올해 들어 다섯 차례 연속 동결이다. 금통위는 물가 상승률이 둔화 흐름을 이어가고 있지만, 여전히 목표 수준을 상회하고 있고, 가계부채 증가세와 미국 등 주요국의 통화정책 변화 등 대내외 불확실성이 높은 점을 고려해 이같이 결정했다고 설명했다. 시장에서는 이번 동결 결정이 예상된 결과라는 반응이면서도, 연내 추가 금리 인상 가능성은 여전히 남아있다고 분석하고 있다.",
        "국내 연구진이 차세대 디스플레이로 주목받는 마이크로 LED의 효율을 획기적으로 높이는 기술을 개발했다. 한국과학기술원(KAIST) 연구팀은 나노미터 크기의 반도체 입자인 '퀀텀닷'의 표면 구조를 제어해 발광 효율을 기존보다 40% 이상 향상시키는 데 성공했다고 밝혔다. 마이크로 LED는 기존 OLED보다 수명이 길고, 밝기가 뛰어나며, 전력 소모가 적어 스마트워치, 증강현실(AR) 기기 등 다양한 분야에 활용될 것으로 기대된다. 이번 연구 결과는 국제 학술지 '네이처 나노테크놀로지'에 게재되었다.",
        "저출산 문제가 국가적 위기로 대두되면서 정부와 지자체가 앞다퉈 대책을 내놓고 있다. 서울시는 내년부터 아이를 낳는 모든 가정에 2년간 총 1,200만 원의 '탄생응원금'을 지급하고, 부모 모두 육아휴직을 사용하는 경우 최대 3,900만 원을 지원하는 파격적인 정책을 발표했다. 또한, 국공립 어린이집을 대폭 확충하고, 아이돌봄 서비스를 강화하는 등 양육 환경 개선에도 집중 투자할 계획이다. 이러한 정책들이 실제 출산율 반등으로 이어질 수 있을지 귀추가 주목된다.",

        // 매우 쉬운 동화 (5개)
        "넓은 들판에 작은 토끼 한 마리가 살았어요. 토끼는 매일 아침 일찍 일어나 싱싱한 풀을 찾아다녔답니다. 어느 날, 토끼는 커다란 당근을 발견했어요. '와, 정말 크다!' 토끼는 너무 기뻐서 당근을 번쩍 들어 올렸지만, 너무 무거워서 낑낑거렸어요. 그때, 다람쥐 친구가 다가와 말했어요. '내가 도와줄게!' 토끼와 다람쥐는 힘을 합쳐 당근을 옮겼고, 함께 맛있게 나누어 먹었답니다.",
        "햇볕이 쨍쨍한 여름날, 아기 오리는 엄마를 따라 연못으로 갔어요. 아기 오리는 물이 무서워서 꼼짝도 못 했어요. 엄마 오리는 '괜찮아, 물은 재미있는 곳이란다.' 하고 말하며 먼저 물속으로 퐁당 들어갔어요. 엄마의 즐거운 모습을 본 아기 오리는 용기를 내어 조심스럽게 발을 담갔어요. 시원한 물 느낌이 좋아서, 아기 오리도 곧 신나게 헤엄치며 놀았답니다.",
        "숲속 작은 집에 꿀벌 한 마리가 살았어요. 꿀벌의 이름은 '부지런이'였어요. 부지런이는 매일 아침 꽃들을 찾아다니며 달콤한 꿀을 모았어요. 어느 날, 비가 와서 꽃들이 모두 문을 닫았어요. 부지런이는 꿀을 모을 수 없어 슬펐지만, 실망하지 않고 집을 깨끗하게 청소하며 날씨가 좋아지기를 기다렸어요. 다음 날, 해가 반짝 뜨자 부지런이는 누구보다 먼저 꿀을 모으러 나갔답니다.",
        "장난꾸러기 아기 원숭이가 나무 타기 놀이를 하고 있었어요. 이 나무에서 저 나무로 휙휙 날아다니는 게 정말 재미있었어요. 그러다가 그만 발을 헛디뎌 땅으로 쿵 떨어지고 말았어요. 아기 원숭이는 무릎이 아파서 엉엉 울었어요. 그 소리를 듣고 엄마 원숭이가 달려와서 아픈 무릎을 호호 불어주며 꼭 안아주었어요. 엄마의 따뜻한 품에 안기니 아픔이 금방 사라지는 것 같았어요.",
        "밤하늘에 반짝이는 작은 별이 있었어요. 작은 별은 항상 땅을 내려다보며 궁금해했어요. '땅에는 무엇이 있을까?' 어느 날 밤, 작은 별은 큰 결심을 하고 땅으로 살짝 내려와 보았어요. 땅에는 예쁜 꽃들이 잠들어 있었고, 귀여운 동물 친구들도 코코 잠을 자고 있었어요. 작은 별은 모두가 깨지 않게 조용히 세상을 구경하고는, 다시 하늘로 올라가 친구들에게 땅 위의 아름다운 이야기를 들려주었답니다."
    ];

    // --- Helper Functions ---

    /**
     * Performs an API call to the /analyze endpoint.
     * @param {string} text - The text to analyze.
     * @param {object} weights - The weights for the analysis.
     * @returns {Promise<object>} - The analysis result.
     */
    async function analyzeText(text, weights = { length: 1, clause: 1, ttr: 1, lexical: 1 }) {
        const response = await fetch('/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: text, genre: 'expo', weights: weights }),
        });
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        const data = await response.json();
        return data.result;
    }

    /**
     * Creates the HTML content for a single analysis result, including a collapsible source text view.
     * @param {object} resultData - The data from the API.
     * @param {string} uniqueId - A unique ID prefix for the chart canvas elements.
     * @param {string} sourceText - The original text that was analyzed.
     * @returns {string} - The HTML string.
     */
    function createResultHtml(resultData, uniqueId, sourceText) {
        if (!resultData) return '<p class="text-danger">분석 결과를 표시할 수 없습니다.</p>';
        
        // Sanitize source text for HTML display
        const sanitizedText = sourceText.replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>");

        return `
            <div class="lilypad-card p-3">
                <div class="d-flex justify-content-between align-items-center mb-2">
                    <h5 class="mb-0">종합 점수: <span class="fw-bold final-score-display">${resultData.overall_final_score}</span>점</h5>
                    <button class="btn btn-sm btn-outline-secondary" type="button" data-bs-toggle="collapse" data-bs-target="#text-collapse-${uniqueId}" aria-expanded="false" aria-controls="text-collapse-${uniqueId}">
                        원문 보기
                    </button>
                </div>

                <div class="collapse" id="text-collapse-${uniqueId}">
                    <div class="card card-body bg-light mb-3">
                        <p class="small" style="max-height: 150px; overflow-y: auto;">${sanitizedText}</p>
                    </div>
                </div>

                <div class="summary-metrics text-center p-3 mb-3 bg-light rounded">
                    <div class="row">
                        <div class="col-4"><h6>문장 수</h6><p class="fs-5 fw-bold mb-0">${resultData.sentence_count}</p></div>
                        <div class="col-4"><h6>평균 길이</h6><p class="fs-5 fw-bold mb-0">${resultData.avg_sentence_len}</p></div>
                        <div class="col-4"><h6>기초 어휘율</h6><p class="fs-5 fw-bold mb-0">${resultData.known_vocab_rate}%</p></div>
                    </div>
                </div>
                <div class="mb-3">${resultData.final_score_reason}</div>
                <hr>
                <h6 class="text-center">세부 점수</h6>
                <canvas id="chart-${uniqueId}"></canvas>
            </div>
        `;
    }
    
    /**
     * Renders a radar chart for a result.
     * @param {string} canvasId - The ID of the canvas element.
     * @param {object} resultData - The analysis data.
     */
    function renderChart(canvasId, resultData) {
        const ctx = document.getElementById(canvasId).getContext('2d');
        if (chartInstances[canvasId]) {
            chartInstances[canvasId].destroy();
        }
        chartInstances[canvasId] = new Chart(ctx, {
            type: 'radar',
            data: {
                labels: ['어휘/문법', '구조/논리', '추론 잠재력'],
                datasets: [{
                    label: '점수',
                    data: [
                        resultData.micro_score,
                        resultData.macro_score,
                        resultData.inference_adjustment_score + 15 // Normalize for display
                    ],
                    backgroundColor: 'rgba(22, 160, 133, 0.2)',
                    borderColor: 'rgba(22, 160, 133, 1)',
                }]
            },
            options: {
                scales: { r: { suggestedMin: 0, suggestedMax: 50 } },
                plugins: { legend: { display: false } }
            }
        });
    }

    // --- Tab 1: Compare Logic (Static) ---
    function displayStaticComparison() {
        // This is a local helper function specifically for the static comparison tab
        function createStaticCompareResultHtml(resultData, uniqueId, sourceText, title) {
            if (!resultData) return '<p class="text-danger">분석 결과를 표시할 수 없습니다.</p>';
            const sanitizedText = sourceText.replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>");

            return `
                <div class="lilypad-card p-3">
                    <h5 class="text-center fw-bold mb-2">${title}</h5>
                    <div class="card card-body bg-light mb-3">
                        <p class="small" style="max-height: 150px; overflow-y: auto;">${sanitizedText}</p>
                    </div>
                    <h5 class="text-center mb-3">종합 점수: <span class="fw-bold final-score-display">${resultData.overall_final_score}</span>점</h5>
                    <div class="summary-metrics text-center p-3 mb-3 bg-light rounded">
                        <div class="row">
                            <div class="col-4"><h6>문장 수</h6><p class="fs-5 fw-bold mb-0">${resultData.sentence_count}</p></div>
                            <div class="col-4"><h6>평균 길이</h6><p class="fs-5 fw-bold mb-0">${resultData.avg_sentence_len}</p></div>
                            <div class="col-4"><h6>기초 어휘율</h6><p class="fs-5 fw-bold mb-0">${resultData.known_vocab_rate}%</p></div>
                        </div>
                    </div>
                    <div class="mb-3">${resultData.final_score_reason}</div>
                    <hr>
                    <h6 class="text-center">세부 점수</h6>
                    <canvas id="chart-${uniqueId}"></canvas>
                </div>
            `;
        }

        // 1. Hardcoded texts
        const donghwaText = `옛날 시골마을에 별난 재주 세 형제가 살았습니다. 눈이 밝은 맏이는 별별 것을 다 봅니다. 둘째는 천하장사 바윗돌도 번쩍번쩍. 개구쟁이 막내는 희한한 재주인데 매 맞는 재주입니다. 회초리로 때리면 간지럽다고 깔깔대고 절굿공이 내리치면 시원하다 깔깔댑니다. 그러던 어느 날 마을에 흉년이 들어 세 형제는 쫄쫄 굶고 나무뿌리 캐 먹으러 산 위로 올라갔습니다. “사람들 어찌 사나 어디 한 번 둘러볼까?” 눈 밝은 맏이가 어허 쯧쯧 혀를 찹니다. 논바닥이 쩌억 갈라지고 나무껍질이 홀라당 벗겨져 있었어요. 어른들은 굶어서 눈이 움푹 들어가고 아이들은 배고파 울고불고 소리칩니다. “으앙 배고파~”\n\n그중에서 어디서 밥을 짓나 하얀 연기가 모락모락 피어 오르고 있었어요. “마을 사또 사는 곳에 잔치가 열렸구나” 곡간에는 쌀가마니가 산처럼 쌓여 있고 대청마루 상 위에는 온갖 음식이 가득히 차려져 있었어요. 땀 흘려 거둔 곡식을 사또 혼자 차지한 것입니다. 세 형제는 그 모습을 보고 화가 나서 이리해 볼까, 저리해 볼까 고민을 했습니다. 밤은 깊어 가는데 둘째가 쌀가마를 이고 갑니다. 이 집 저 집 다니며 배불리 먹으라고 세 형제는 밤새도록 홍길동 노릇을 합니다. “야단났네! 야단났어! 곡간이 텅 비었네!” 자신의 곡간이 도둑이 든 것을 안 사또는 소리칩니다. 대신 집집마다 밥을 짓는 연기로 하얀 연기가 나오고 있었습니다. 욕심 많은 사또는 화가 났습니다.\n\n온 마을 사람들이 끌려와서 성난 사또 눈길을 피해 벌벌 떨고 있는데 막내가 쏜살같이 달려와 “내가 바로 도둑이오!”라고 말을 합니다. 결국 막내는 형틀에 묶여 맨 궁둥이 까발리고 철썩 곤장을 맞습니다. 사람들은 무서워 벌벌 떠는데 “아 시원하다!”라고 막내는 좋아합니다. 한 사람씩 돌아가며 곤장 백 대 내리쳐도 졸린 듯 따분한 듯 막내는 하품을 합니다. 오히려 때리는 놈들이 힘들어합니다. 보다 못한 사또가 곤장을 칩니다. 약이 오른 사또는 날뛰다 뒤로 넘어져 버립니다. 결국 지친 사또는 세 형제를 집으로 돌려보내고, 사이 좋은 세 형제는 집으로 돌아갑니다.\n\n신기한 재주를 가진 삼 형제는 자신들의 재주로 굶어가는 마을 사람들을 돕습니다. 자신의 장점과 재주가 무엇인지 알고 이를 좋은 곳에 쓴 삼 형제는 우리가 본받아야 할 부분입니다. 사또는 자신의 이익만 취하려고 하다가 결국 가지고 있던 것도 모두 잃은 케이스로 과도한 욕심은 오히려 독이 되는 경우가 있습니다. 그러므로 우리는 과도한 욕심을 부리지 않는 것은 물론 내가 갖고 있는 장점으로 남을 도울 수 있는 지혜를 기를 수 있는 노력이 필요합니다.`;
        const supermoonText = `우리는 가끔 평소보다 큰 보름달인 ‘슈퍼문(supermoon)’을 보게 된다. 실제 달의 크기는 일정한데 이러한 현상이 발생하는 까닭은 무엇일까? 이 현상은 달의 공전 궤도가 타원 궤도라는 점과 관련이 있다.\n타원은 두 개의 초점이 있고 두 초점으로부터의 거리를 합한 값이 일정한 점들의 집합이다. 두 초점이 가까울수록 원 모양에 가까워진다. 타원에서 두 초점을 지나는 긴지름을 가리켜 장축이라 하는데, 두 초점 사이의 거리를 장축의 길이로 나눈 값을 이심률이라 한다. 두 초점이 가까울수록 이심률은 작아진다.\n달은 지구를 한 초점으로 하면서 이심률이 약 0.055인 타원 궤도를 돌고 있다. 이 궤도의 장축 상에서 지구로부터 가장 먼 지점을 ‘원지점’, 가장 가까운 지점을 ‘근지점’이라 한다. 지구에서 보름달은 약 29.5일 주기로 세 천체가 ‘태양 - 지구 - 달’의 순서로 배열될 때 볼 수 있는데, 이때 보름달이 근지점이나 그 근처에 위치하면 슈퍼문이 관측된다. 슈퍼문은 보름달 중 크기가 가장 작게 보이는 것보다 14 % 정도 크게 보인다. \n이는 지구에서 본 달의 겉보기 지름이 달라졌기 때문이다. 지구에서 본 천체의 겉보기 지름을 각도로 나타낸 것을 각지름이 라 하는데, 관측되는 천체까지의 거리가 가까워지면 각지름이 커진다. 예를 들어, 달과 태양의 경우 평균적인 각지름은 각각 0.5° 정도이다.\n지구의 공전 궤도에서도 이와 같은 현상이 나타난다. 지구 역시 태양을 한 초점으로 하는 타원 궤도로 공전하고 있으므로, 궤도 상의 지구의 위치에 따라 태양과의 거리가 다르다.\n달과 마찬가지로 지구도 공전 궤도의 장축 상에서 태양으로부터 가장 먼 지점과 가장 가까운 지점을 갖는데, 이를 각각 원일점과 근일점이라 한다. 지구와 태양 사이의 이러한 거리 차이에 따라 일식 현상이 다르게 나타난다. 세 천체가 ‘태양 - 달- 지구’의 순서로 늘어서고, 달이 태양을 가릴 수 있는 특정한 위치에 있을 때, 일식 현상이 일어난다. 이때 달이 근지점이나 그 근처에 위치하면 대부분의 경우 태양 면의 전체 면적이 달에 의해 완전히 가려지는 개기 일식이 관측된다. 하지만 일식이 일어나는 같은 조건에서 달이 원지점이나 그 근처에 위치하면 대부분의 경우 태양 면이 달에 의해 완전히 가려지지 않아 태양 면의 가장자리가 빛나는 고리처럼 보이는 금환 일식이 관측될 수 있다.\n이러한 원일점, 근일점, 원지점, 근지점의 위치는 태양, 행성 등 다른 천체들의 인력에 의해 영향을 받아 미세하게 변한다.\n현재 지구 공전 궤도의 이심률은 약 0.017인데, 일정한 주기로 이심률이 변한다. 천체의 다른 조건들을 고려하지 않을 때 지구공전 궤도의 이심률만이 현재보다 더 작아지면 근일점은 현재 보다 더 멀어지며 원일점은 현재보다 더 가까워지게 된다. 이는 달의 공전 궤도 상에 있는 근지점과 원지점도 마찬가지이다. 천체의 다른 조건들을 고려하지 않을 때 천체의 공전 궤도의 이심률만이 현재보다 커지면 반대의 현상이 일어난다.`;

        // 2. Hardcoded detailed analysis results
        const resultLeftData = {
            overall_final_score: 45.8, micro_score: 38.2, macro_score: 25.0, inference_adjustment_score: -5,
            sentence_count: 28, avg_sentence_len: 18.5, known_vocab_rate: 92.1,
            micro_details: { length: 25, clause: 30, ttr: 45, lexical: 50 },
            macro_details: { structure: 20, abstraction: 15, connectivity: 40 },
            inference_details: { density: 2, completeness: -8, ambiguity: 1 },
            macro_summary: "이야기 구조가 명확하고 순차적으로 진행되어 이해하기 쉽습니다. 사용된 어휘와 문장 구조가 단순하여 독자의 부담이 적습니다.",
            inference_reason: "AI가 텍스트의 내용이 명확하고 완결적이어서 추론의 여지가 적다고 평가했습니다."
        };
        const resultRightData = {
            overall_final_score: 78.2, micro_score: 55.7, macro_score: 40.0, inference_adjustment_score: 8,
            sentence_count: 19, avg_sentence_len: 29.8, known_vocab_rate: 75.4,
            micro_details: { length: 60, clause: 65, ttr: 50, lexical: 48 },
            macro_details: { structure: 45, abstraction: 50, connectivity: 25 },
            inference_details: { density: 8, completeness: -2, ambiguity: 2 },
            macro_summary: "과학적 개념을 설명하기 위해 다소 복잡한 문장 구조와 높은 수준의 어휘를 사용합니다. 정보가 밀도 높게 제시되어 독자의 집중력을 요구합니다.",
            inference_reason: "AI가 텍스트의 정보 밀도와 확장 가능성을 긍정적으로 평가했습니다."
        };

        // 3. Helper function to build the detailed reason HTML
        function buildReasonHtml(data) {
            const micro_reason = `
                <p><strong>[1단계: 로컬 점수 분석 (${data.micro_score.toFixed(1)}점)]</strong></p>
                <p>기계적으로 측정된 텍스트의 기본적인 특성입니다.</p>
                <ul>
                    <li><strong>문장 길이:</strong> ${data.micro_details.length}점</li>
                    <li><strong>문장 구조:</strong> ${data.micro_details.clause}점</li>
                    <li><strong>어휘 다양성:</strong> ${data.micro_details.ttr}점</li>
                    <li><strong>어휘 수준:</strong> ${data.micro_details.lexical}점 (기초 어휘 비율: ${data.known_vocab_rate}%)</li>
                </ul>`;
            
            const ai_reason = `
                <p><strong>[2단계: AI 보정 점수 분석 (${(data.macro_score + data.inference_adjustment_score).toFixed(1)}점)]</strong></p>
                <p>AI가 글의 전체적인 맥락과 구조, 독자가 추론해야 할 요소 등을 분석하여 점수를 보정합니다.</p>
                <blockquote><strong>AI의 종합 평가 요약:</strong> ${data.macro_summary}</blockquote>
                <p><strong>세부 분석 내용:</strong></p>
                <ul>
                    <li><strong>구조/논리 점수 (${data.macro_score.toFixed(1)}점):</strong>
                        <ul>
                            <li>정보 구조: ${data.macro_details.structure}점</li>
                            <li>추상성 수준: ${data.macro_details.abstraction}점</li>
                            <li>논리적 연결성: ${data.macro_details.connectivity}점</li>
                        </ul>
                    </li>
                    <li><strong>추론 잠재력 점수 (${data.inference_adjustment_score}점):</strong>
                        <ul>
                            <li><strong>이유:</strong> ${data.inference_reason}</li>
                        </ul>
                    </li>
                </ul>`;
            return micro_reason + ai_reason;
        }

        // 4. Add the generated HTML to the data objects
        resultLeftData.final_score_reason = buildReasonHtml(resultLeftData);
        resultRightData.final_score_reason = buildReasonHtml(resultRightData);

        // 5. Render the results
        resultLeftEl.innerHTML = createStaticCompareResultHtml(resultLeftData, 'compare-left', donghwaText, '동화');
        resultRightEl.innerHTML = createStaticCompareResultHtml(resultRightData, 'compare-right', supermoonText, '설명문 (비문학)');
        
        renderChart('chart-compare-left', resultLeftData);
        renderChart('chart-compare-right', resultRightData);
    }

    // --- Tab 2: Manipulate Logic ---
    let isAnalyzingManipulate = false;

    // Reset analysis if text is changed by user
    textInputManipulate.addEventListener('input', () => {
        manipulationAnalysisData = null;
        baselineScores = null;
        manipulateResultEl.style.display = 'none';
        analyzeManipulateBtn.textContent = '분석하기 🚀';
        analyzeManipulateBtn.disabled = false;
    });

    analyzeManipulateBtn.addEventListener('click', async () => {
        if (isAnalyzingManipulate) return; // Prevent multiple clicks

        const text = textInputManipulate.value.trim();
        if (!text) {
            alert('분석할 텍스트를 입력해주세요.');
            return;
        }

        isAnalyzingManipulate = true;
        analyzeManipulateBtn.disabled = true;
        analyzeManipulateBtn.textContent = '분석 중...';

        try {
            // If data doesn't exist (first analysis or text has changed), fetch from server
            if (!manipulationAnalysisData) {
                manipulateResultEl.style.display = 'none';
                const micro_weights = {
                    length: 1.0, // Always use baseline for the first server call
                    clause: 1.0,
                    ttr: 1.0,
                    lexical: 1.0,
                };
                manipulationAnalysisData = await analyzeText(text, micro_weights);
                
                // Calculate and store baseline scores using the CORRECT 5-factor average logic
                const { micro_details, macro_score, inference_adjustment_score } = manipulationAnalysisData;
                const base_main_score = (
                    micro_details.length + 
                    micro_details.clause + 
                    micro_details.ttr + 
                    micro_details.lexical + 
                    macro_score
                ) / 5.0;
                
                let base_final = base_main_score + inference_adjustment_score;
                base_final = Math.max(0, Math.min(100, base_final));
                
                // The baseline micro score is still the simple average of the 4 micro components
                const base_micro = (micro_details.length + micro_details.clause + micro_details.ttr + micro_details.lexical) / 4.0;
                
                baselineScores = { micro: base_micro, final: base_final };
            }

            // Update view with all current slider weights
            const all_weights = {
                length: parseFloat(sliders.length.value),
                clause: parseFloat(sliders.clause.value),
                ttr: parseFloat(sliders.ttr.value),
                lexical: parseFloat(sliders.lexical.value),
                macro: parseFloat(sliders.macro.value),
                inference: parseFloat(sliders.inference.value)
            };
            updateManipulationView(all_weights);
            manipulateResultEl.style.display = 'block';

        } catch (error) {
            console.error('Error during manipulation analysis:', error);
            alert('분석 중 오류가 발생했습니다.');
            // Fully reset on error
            textInputManipulate.dispatchEvent(new Event('input'));
        } finally {
            isAnalyzingManipulate = false;
            analyzeManipulateBtn.disabled = false;
            analyzeManipulateBtn.textContent = '가중치 적용하여 다시 분석하기 🔄';
        }
    });

    function updateManipulationView(weights) {
        if (!manipulationAnalysisData || !baselineScores) return;

        const { micro_details, macro_score, inference_adjustment_score } = manipulationAnalysisData;
        
        // 1. Recalculate main score based on all 5 sliders
        const scores_to_average = {
            length: micro_details.length,
            clause: micro_details.clause,
            ttr: micro_details.ttr,
            lexical: micro_details.lexical,
            macro: macro_score
        };
        
        const weighted_score_sum = (
            scores_to_average.length * weights.length +
            scores_to_average.clause * weights.clause +
            scores_to_average.ttr * weights.ttr +
            scores_to_average.lexical * weights.lexical +
            scores_to_average.macro * weights.macro
        );

        const total_main_weight = weights.length + weights.clause + weights.ttr + weights.lexical + weights.macro;
        const current_main_score = total_main_weight > 0 ? weighted_score_sum / total_main_weight : 0;

        // 2. Calculate final score with weighted inference adjustment
        const weighted_inference = inference_adjustment_score * weights.inference;
        let final_score = current_main_score + weighted_inference;
        final_score = Math.max(0, Math.min(100, final_score));

        // For display purposes, calculate the unweighted micro score average
        const current_micro_score = (micro_details.length + micro_details.clause + micro_details.ttr + micro_details.lexical) / 4.0;

        // Create a temporary result object to render
        const updatedResult = {
            ...manipulationAnalysisData,
            micro_score: current_micro_score, // Display the simple average for consistency
            macro_score: macro_score, // Original macro score for the chart
            inference_adjustment_score: inference_adjustment_score, // Original inference score for the chart
            overall_final_score: final_score.toFixed(2),
            // PRESERVE the original detailed reason and APPEND the change summary
            final_score_reason: manipulationAnalysisData.final_score_reason + 
                                `<hr><p class="mt-3"><strong>[가중치 조작 결과]</strong> 가중치가 조절되어 최종 점수는 <strong>${final_score.toFixed(2)}점</strong>(기준 ${baselineScores.final.toFixed(2)}점)으로 변경되었습니다.</p>`
        };
        
        manipulateResultEl.innerHTML = createResultHtml(updatedResult, 'manipulate', textInputManipulate.value);
        
        const finalScoreDisplay = manipulateResultEl.querySelector('.final-score-display');
        if (finalScoreDisplay) {
            finalScoreDisplay.innerHTML = `${updatedResult.overall_final_score}점 <small class="text-muted fw-normal">(기준 ${baselineScores.final.toFixed(2)}점)</small>`;
        }

        renderChart('chart-manipulate', updatedResult);
    }

    // Remove real-time update, only update the value display
    for (const key in sliders) {
        sliders[key].addEventListener('input', function() {
            sliderVals[key].textContent = this.value;
        });
    }

    // --- NEW: Reset Weights Button Logic ---
    const resetWeightsBtn = document.getElementById('reset-weights-button');
    if(resetWeightsBtn) {
        resetWeightsBtn.addEventListener('click', () => {
            for (const key in sliders) {
                sliders[key].value = 1.0;
                sliderVals[key].textContent = '1.0';
            }
            // If analysis data exists, re-trigger the analysis to update the view
            if (manipulationAnalysisData) {
                analyzeManipulateBtn.click();
            }
        });
    }

    // --- Tab 3: Predict Logic ---
    const predictionInputsBase = document.querySelectorAll('.prediction-input-base');
    const predictionInputInference = document.getElementById('prediction-input-inference');
    const predictionInferenceVal = document.getElementById('prediction-inference-val');
    const predictedScoreDisplay = document.getElementById('predicted-score-display');

    function updatePredictedScore() {
        // 1. Calculate base score from 5 metrics (1-10 scale)
        let baseTotal = 0;
        predictionInputsBase.forEach(input => {
            baseTotal += parseFloat(input.value) || 5;
        });
        const baseAvg10 = baseTotal / predictionInputsBase.length;
        
        // 2. Scale base score to a 0-100 range
        // Mapping 1 -> 0, 10 -> 100
        const predictedBaseScore = (baseAvg10 - 1) * (100 / 9);

        // 3. Get inference score and scale to -15 to +15 range
        const inferenceValue = parseFloat(predictionInputInference.value) || 0;
        // Mapping -5 -> -15, 0 -> 0, 5 -> 15 (simple multiplication)
        const predictedInferenceAdj = inferenceValue * 3;
        
        // 4. Calculate final score
        let finalPredictedScore = predictedBaseScore + predictedInferenceAdj;
        finalPredictedScore = Math.max(0, Math.min(100, finalPredictedScore)); // Clamp between 0 and 100

        predictedScoreDisplay.textContent = `${Math.round(finalPredictedScore)}점`;
        predictionInferenceVal.textContent = inferenceValue;
    }

    predictionInputsBase.forEach(input => {
        input.addEventListener('input', updatePredictedScore);
    });
    predictionInputInference.addEventListener('input', updatePredictedScore);


    loadPredictTextBtn.addEventListener('click', () => {
        const randomIndex = Math.floor(Math.random() * sampleTexts.length);
        predictTextDisplay.textContent = sampleTexts[randomIndex];
        predictResultContainer.style.display = 'none';
        
        // Reset prediction inputs to default
        predictionInputsBase.forEach(input => input.value = 5);
        predictionInputInference.value = 0;
        
        updatePredictedScore(); // Recalculate score after reset
    });

        let isAnalyzingPredict = false;
        analyzePredictBtn.addEventListener('click', async () => {
            if (isAnalyzingPredict) return; // Prevent multiple clicks
    
            const text = predictTextDisplay.textContent;
            const userPrediction = predictedScoreDisplay.textContent.replace('점', '');
    
            if (text.includes('여기에 예측할 지문이')) {
                alert('먼저 새로운 지문을 받아주세요.');
                return;
            }
    
            // Store user's detailed predictions before making the API call
            const userDetailedPredictions = {
                length: document.querySelector('.prediction-input-base[data-id="length"]').value,
                clause: document.querySelector('.prediction-input-base[data-id="clause"]').value,
                ttr: document.querySelector('.prediction-input-base[data-id="ttr"]').value,
                lexical: document.querySelector('.prediction-input-base[data-id="lexical"]').value,
                macro: document.querySelector('.prediction-input-base[data-id="macro"]').value,
                inference: predictionInputInference.value
            };
    
            isAnalyzingPredict = true;
            analyzePredictBtn.disabled = true;
            analyzePredictBtn.textContent = '분석 중...';
            predictResultContainer.style.display = 'none';
    
            try {
                const result = await analyzeText(text);
                
                // Generate detailed comparison table
                const aiScores = result.prediction_scaled_scores;
                const labels = {
                    length: '문장 길이', clause: '구문 복잡도', ttr: '어휘 다양성',
                    lexical: '어휘 난이도', macro: '구조/논리', inference: '추론 잠재력'
                };
                let comparisonHtml = '<h5 class="text-center mt-4">세부 항목 비교</h5><table class="table table-sm table-bordered text-center small">';
                comparisonHtml += '<thead class="table-light"><tr><th>항목</th><th>나의 예측</th><th>AI 분석</th></tr></thead><tbody>';
                
                for (const key in aiScores) {
                    const isBase = key !== 'inference';
                    const userScore = userDetailedPredictions[key];
                    const aiScore = aiScores[key];
                    const unit = isBase ? '점 (1-10)' : '점 (-5~5)';
                    comparisonHtml += `
                        <tr>
                            <td>${labels[key]}</td>
                            <td>${userScore}</td>
                            <td>${aiScore}</td>
                        </tr>
                    `;
                }
                comparisonHtml += '</tbody></table>';
    
                const resultHtml = `
                    <div class="row">
                        <div class="col-md-6">
                            <div class="alert alert-info text-center">
                                <h5>나의 예측</h5>
                                <p class="display-4 fw-bold">${userPrediction}점</p>
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="alert alert-success text-center">
                                <h5>AI 분석 결과</h5>
                                <p class="display-4 fw-bold">${result.overall_final_score}점</p>
                            </div>
                        </div>
                    </div>
                    ${comparisonHtml}
                    <hr>
                    <h5 class="text-center mt-4">AI 상세 분석 리포트</h5>
                    ${createResultHtml(result, 'predict', text)}
                `;
                predictResultContainer.innerHTML = resultHtml;
                renderChart('chart-predict', result);
                predictResultContainer.style.display = 'block';
    
            } catch (error) {
                console.error('Error during prediction analysis:', error);
                alert('분석 중 오류가 발생했습니다.');
            } finally {
                isAnalyzingPredict = false;
                analyzePredictBtn.disabled = false;
                analyzePredictBtn.textContent = '결과 확인하기 🚀';
            }
        });
    // --- Initial Load ---
    displayStaticComparison(); // Run static analysis for Tab 1
    loadPredictTextBtn.click(); // Load a text for prediction tab on page load
});