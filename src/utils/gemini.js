const normalizeImageToBase64 = async (imageInput, mimeType = 'image/jpeg') => {
  if (!imageInput || typeof imageInput !== 'string') return null;

  if (imageInput.startsWith('data:image/')) {
    return imageInput;
  }

  // If it's an HTTP/HTTPS URL (e.g. Google Drive image)
  if (imageInput.startsWith('http://') || imageInput.startsWith('https://')) {
    let targetUrl = imageInput;

    // Convert Google Drive links to direct lh3 CDN link
    if (imageInput.includes('drive.google.com') || imageInput.includes('googleusercontent.com')) {
      const match = imageInput.match(/[?&]id=([a-zA-Z0-9_-]+)/) ||
                    imageInput.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) ||
                    imageInput.match(/\/d\/([a-zA-Z0-9_-]+)/);
      if (match && match[1]) {
        targetUrl = `https://lh3.googleusercontent.com/d/${match[1]}`;
      }
    }

    // Try HTML Image element -> Canvas first (Google CDN allows CORS on lh3)
    try {
      const base64 = await new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'Anonymous';
        img.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            canvas.width = Math.min(img.naturalWidth || img.width || 800, 1600);
            canvas.height = Math.min(img.naturalHeight || img.height || 600, 1600);
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            resolve(canvas.toDataURL('image/jpeg', 0.85));
          } catch (err) {
            reject(err);
          }
        };
        img.onerror = (e) => reject(new Error('Image failed to load on canvas'));
        img.src = targetUrl;
      });
      if (base64 && base64.startsWith('data:image/')) {
        return base64;
      }
    } catch (imgErr) {
      console.warn("Canvas conversion failed, attempting direct fetch:", imgErr);
    }

    // Direct fetch fallback
    try {
      const resp = await fetch(targetUrl);
      const blob = await resp.blob();
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.readAsDataURL(blob);
      });
    } catch (e) {
      console.warn("Direct fetch failed, falling back to raw targetUrl:", e);
      return targetUrl;
    }
  }

  return `data:${mimeType};base64,${imageInput}`;
};

const DEFAULT_DEEPSEEK_KEY = import.meta.env.VITE_DEEPSEEK_API_KEY || '';

export const callDeepseekAPI = async (apiKey, prompt, base64Image = null, mimeType = 'image/jpeg', model = 'deepseek-v4-flash-vision-exp') => {
  const activeKey = apiKey || DEFAULT_DEEPSEEK_KEY;
  if (!activeKey) {
    throw new Error('DeepSeek API 키가 설정되지 않았습니다.');
  }

  const selectedModel = (model ? String(model).trim() : '') || 'deepseek-v4-flash-vision-exp';
  const url = 'https://api.deepseek.com/chat/completions';

  let messages = [];

  if (base64Image) {
    const fullDataUrl = await normalizeImageToBase64(base64Image, mimeType);

    messages.push({
      role: 'user',
      content: [
        { type: 'text', text: prompt },
        {
          type: 'image_url',
          image_url: {
            url: fullDataUrl
          }
        }
      ]
    });
  } else {
    messages.push({
      role: 'user',
      content: prompt
    });
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${activeKey}`
    },
    body: JSON.stringify({
      model: selectedModel,
      messages: messages,
      temperature: 0.2,
      max_tokens: 1000
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `DeepSeek API 호출 실패 (HTTP ${response.status})`);
  }

  const data = await response.json();
  if (data.choices && data.choices.length > 0 && data.choices[0].message) {
    return data.choices[0].message.content;
  }

  return '응답을 생성하지 못했습니다.';
};

export const callGeminiAPI = async (apiKey, prompt, base64Image = null, mimeType = 'image/jpeg') => {
  if (!apiKey) {
    throw new Error('Gemini API 키가 설정되지 않았습니다.');
  }

  const models = [
    'gemini-2.5-flash-lite',
    'gemini-2.0-flash-lite',
    'gemini-2.0-flash-lite-preview-02-05',
    'gemini-2.5-flash',
    'gemini-2.0-flash',
    'gemini-1.5-flash-latest',
    'gemini-1.5-flash',
    'gemini-1.5-pro'
  ];

  let contents = [];
  
  if (base64Image) {
    const fullDataUrl = await normalizeImageToBase64(base64Image, mimeType);
    let base64Data = fullDataUrl;
    if (base64Data && base64Data.startsWith('data:')) {
      const parts = base64Data.split(',');
      base64Data = parts[1];
    }

    if (base64Data && !base64Data.startsWith('http')) {
      contents.push({
        role: 'user',
        parts: [
          { text: prompt },
          {
            inlineData: {
              mimeType: mimeType,
              data: base64Data
            }
          }
        ]
      });
    } else {
      contents.push({
        role: 'user',
        parts: [{ text: `${prompt}\n\n[문제 및 풀이 이미지 링크: ${fullDataUrl}]` }]
      });
    }
  } else {
    contents.push({
      role: 'user',
      parts: [{ text: prompt }]
    });
  }

  let lastError = null;

  for (const model of models) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: contents,
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 800,
          }
        })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.candidates && data.candidates.length > 0 && data.candidates[0].content?.parts?.length > 0) {
          return data.candidates[0].content.parts[0].text;
        }
      } else {
        const errData = await response.json();
        lastError = new Error(errData.error?.message || `HTTP ${response.status}`);
        if (response.status === 400 && !errData.error?.message?.includes('not found') && !errData.error?.message?.includes('not supported')) {
          throw lastError;
        }
        if (response.status === 403) {
          throw lastError;
        }
      }
    } catch (e) {
      if (e.message?.includes('API key') || e.message?.includes('quota') || e.message?.includes('Quota') || e.message?.includes('PERMISSION_DENIED')) {
        throw e;
      }
      lastError = e;
    }
  }

  throw lastError || new Error('사용 가능한 Gemini 모델을 찾을 수 없습니다.');
};

export const callAIAPI = async (aiConfig, prompt, base64Image = null, mimeType = 'image/jpeg') => {
  // If aiConfig is passed as an object: { provider, geminiApiKey, deepseekApiKey, deepseekModel }
  if (typeof aiConfig === 'object' && aiConfig !== null) {
    const { provider, geminiApiKey, deepseekApiKey, deepseekModel } = aiConfig;
    if (provider === 'deepseek') {
      return await callDeepseekAPI(deepseekApiKey, prompt, base64Image, mimeType, deepseekModel);
    } else {
      return await callGeminiAPI(geminiApiKey, prompt, base64Image, mimeType);
    }
  }

  // If a raw string key is passed
  if (typeof aiConfig === 'string') {
    // If it looks like a deepseek key or caller wants deepseek
    if (aiConfig.startsWith('sk-')) {
      try {
        return await callDeepseekAPI(aiConfig, prompt, base64Image, mimeType);
      } catch (err) {
        return await callGeminiAPI(aiConfig, prompt, base64Image, mimeType);
      }
    }
    return await callGeminiAPI(aiConfig, prompt, base64Image, mimeType);
  }

  throw new Error('AI API 설정(키)이 올바르지 않습니다.');
};

export const analyzeProblemSubmission = async (aiConfig, problemDesc, base64Image, customDetails = '') => {
  let prompt = `당신은 친절하고 꼼꼼한 수학 선생님입니다. 
학생이 수학 문제에 대해 작성한 풀이 과정(또는 사진)을 보고 피드백을 작성해주세요.
사진이 첨부되었다면 수식과 글씨를 주의 깊게 읽어주세요.

요청사항:
1. 풀이 과정에서 논리적 오류나 계산 실수가 있는지 찾아주세요.
2. 잘한 점이 있다면 칭찬해주세요.
3. 정답을 직접적으로 알려주기보다는 스스로 고칠 수 있도록 힌트와 조언 위주로 설명해주세요.
4. 존댓말로 다정하게 작성해주세요.`;

  if (customDetails.trim()) {
    prompt += `\n\n[원장님(선생님)의 추가 요청사항/세부사항]\n${customDetails}`;
  }

  return await callAIAPI(aiConfig, prompt, base64Image);
};

export const solveProblemWithAI = async (aiConfig, problemStatement, problemImage = null) => {
  const prompt = `당신은 대한민국 최고 수준의 고등 수학 전문 강사입니다.
제시된 고등학교 수학 문제를 정확하고 신속하게 풀고, 학생 채점용 기준 정답을 도출해주세요.

[문제]
${problemStatement || '첨부된 문제 이미지를 풀이해주세요.'}

출력 규칙:
1. 복잡한 풀이 과정이나 설명은 일절 작성하지 마십시오.
2. 오직 학생 답안과 직접 비교할 수 있는 최종 정답 값만 간결하게 한 줄로 출력하십시오.
- 객관식의 경우: 1, 2, 3, 4, 5 중 선지 번호 하나만 출력 (예: 5)
- 단답형 숫자의 경우: 계산된 최종 숫자만 출력 (예: 51, -12)
- 분수/수식/서술형의 경우: 표준 LaTeX 수식 형태로 출력 (예: \\frac{9}{4}, 2(x+1)(y+2), x^2 - 4x + 3)`;

  const response = await callAIAPI(aiConfig, prompt, problemImage);
  if (!response) return '';

  let clean = response.trim().replace(/^`+|`+$/g, '').trim();
  clean = clean.replace(/^\$+|\$+$/g, '').trim();
  const firstLine = clean.split('\n')[0].replace(/^정답:\s*/, '').trim();
  return firstLine;
};

export const checkMathEquivalenceWithAI = async (aiConfig, correctAnswer, studentAnswer) => {
  const prompt = `당신은 엄밀한 고등수학 정답 판정관입니다.
선생님이 사전에 지정한 [공식 정답]과 학생이 제출한 [학생 답안]이 수학적으로 동치(동일한 의미와 값)인지 판정해주세요.

[공식 정답]: ${correctAnswer}
[학생 답안]: ${studentAnswer}

판정 기준:
1. 분수와 소수 (예: 9/4와 2.25), 약분 전후, 인수분해형과 전개형 (예: 2(x+1)과 2x+2), 항의 순서 교환 (예: 3+x와 x+3), LaTeX 표기법 차이(예: \\frac{9}{4}와 9/4, \\pm 등) 등 표현 형태가 달라도 수학적으로 완전히 같은 식이나 값이면 반드시 "⭕ 정답"으로 판정하십시오.
2. 수치나 부호가 다르거나 수학적으로 동치가 아니면 "❌ 오답"으로 판정하십시오.

응답 형식 (반드시 첫 줄에 판정만 출력):
[채점 결과]
⭕ 정답 (또는 ❌ 오답)

[판정 근거]
- 공식 정답: ${correctAnswer}
- 학생 답안: ${studentAnswer}
- 해설: (동치 여부에 대한 간결한 1줄 설명)`;

  return await callAIAPI(aiConfig, prompt, null);
};

export const autoGradeProblemSubmission = async (aiConfig, problemDesc, studentSolutionImage, customDetails = '', correctAns = null) => {
  let prompt = '';

  if (correctAns) {
    prompt = `당신은 정확하고 빠른 고등수학 채점관입니다.
선생님이 사전에 지정한 이 문제의 공식 정답은 다음과 같습니다:
[공식 정답]: ${correctAns} (객관식 번호, 단답형 숫자, 또는 LaTeX 수식)

첨부된 학생의 손글씨 풀이 사진을 보고 다음만 판정하세요:
1. 학생이 도출하여 적은 최종 답안을 찾으세요.
2. 학생의 최종 답안이 공식 정답 [${correctAns}]와 수학적으로 일치하면 [채점 결과]를 "⭕ 정답", 다르면 "❌ 오답", 글씨를 전혀 알아볼 수 없거나 다른 문제 풀이면 "🔺 채점 불가 (이미지 확인 필요)"로 판정하세요.
- 공식 정답이 서술형 수식(LaTeX)인 경우, 학생의 풀이 마지막에 적힌 수식이 수식적으로 동치인지 판정하세요.
3. 문제를 처음부터 직접 새로 풀 필요가 전혀 없으며, 학생의 손글씨 답안과 공식 정답 [${correctAns}]의 일치 여부만 신속하고 간결하게 판정하세요.

응답 형식 (반드시 준수):
[채점 결과]
⭕ 정답 (또는 ❌ 오답, 또는 🔺 채점 불가)

[풀이 첨삭 및 피드백]
- 학생 도출 답안: (학생이 풀이 끝에 적은 답)
- 공식 정답 비교: (정답과 일치 여부 확인)
- 코멘트: (간결한 1~2줄 코멘트)`;
  } else {
    prompt = `당신은 실력 있고 친절한 전문 수학 선생님이자 채점관입니다.
학생이 제출한 수학 문제 풀이(이미지 속 손글씨 및 수식)를 비전으로 정밀 분석하여 채점하고 명확한 피드백을 제공해주세요.

[문제 정보]
${problemDesc}

채점 및 평가 기준:
1. 이미지가 흐리거나, 문제와 무관하거나, 글씨가 없어 정답/오답을 판별할 수 없는 경우 반드시 "[채점 결과]"를 "🔺 채점 불가 (이미지 확인 필요)"로 판정하세요.
2. 최종 답안이 맞았는지 확인하세요.
3. 풀이 과정의 수식 전개와 계산 논리가 맞는지 단계별로 검증하세요.
4. 실수가 있다면 어느 부분에서 부호/계산 실수가 발생했는지 정확히 짚어주세요.

응답 형식 (반드시 아래 형식에 맞추어 작성해주세요):
[채점 결과]
⭕ 정답 (또는 ❌ 오답, 또는 🔺 채점 불가 중 하나)

[풀이 첨삭 및 피드백]
- 잘한 점: (1~2줄)
- 오류/보완 포인트: (실수가 있는 경우 친절하게 설명, 맞은 경우 생략 가능)
- 핵심 개념 및 조언: (학생이 기억해야 할 핵심 팁)`;
  }

  if (customDetails.trim()) {
    prompt += `\n\n[선생님의 추가 요청사항]\n${customDetails}`;
  }

  return await callAIAPI(aiConfig, prompt, studentSolutionImage);
};

export const analyzeStudentProgress = async (aiConfig, studentName, testsData, incorrectProblems, customDetails = '') => {
  let prompt = `당신은 학생의 성적을 종합 분석하는 교육 컨설턴트(학원 원장님 보조)입니다.
다음은 '${studentName}' 학생의 그동안의 시험 성적 데이터와 최근 오답 노트 기록입니다.

[시험 성적 데이터]
${JSON.stringify(testsData, null, 2)}

[최근 오답 기록]
${JSON.stringify(incorrectProblems, null, 2)}

요청사항:
1. 학생의 전반적인 학업 성취도(점수 변화 추이 등)를 평가해주세요.
2. 오답 기록과 시험 점수를 바탕으로 이 학생이 특히 취약한 부분이나 자주 하는 실수 패턴을 유추해주세요.
3. 앞으로 어떤 단원이나 유형을 집중적으로 복습해야 하는지 학부모님/원장님이 참고할 수 있도록 '향후 학습 방향'을 요약해주세요.
4. 원장님이 학생 상담 시 바로 쓸 수 있을 만큼 전문적이고 객관적인 어조로 작성해주세요 (분량: 3~4문단 내외).`;

  if (customDetails.trim()) {
    prompt += `\n\n[원장님(선생님)의 추가 요청사항/세부사항]\n${customDetails}`;
  }

  return await callAIAPI(aiConfig, prompt, null);
};
