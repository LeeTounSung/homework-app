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

const BUILTIN_DEEPSEEK_KEY = typeof atob === 'function' ? atob('c2stYzU3MjhmZGFlZmFkNGZhNWI4ZWE4ZjAzZjA2MTNmNmM=') : '';
const DEFAULT_DEEPSEEK_KEY = import.meta.env.VITE_DEEPSEEK_API_KEY || BUILTIN_DEEPSEEK_KEY;
const BUILTIN_OPENROUTER_KEY = typeof atob === 'function' ? atob('c2stb3ItdjEtYzgwOWZhMzkxZWRlMTU3YzgzODZhNjAxNjM2OWE4NWQ3NTg4MGEyZDE3YjI5NDdiMDQ5ZTVlYWY2OTEwNTM1Mg==') : '';
const DEFAULT_OPENROUTER_KEY = import.meta.env.VITE_OPENROUTER_API_KEY || BUILTIN_OPENROUTER_KEY;

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

export const callOpenRouterGeminiVision = async (openrouterKey, prompt, base64Image = null, mimeType = 'image/jpeg') => {
  const activeKey = (openrouterKey && openrouterKey.trim()) || DEFAULT_OPENROUTER_KEY;
  if (!activeKey) {
    throw new Error('OpenRouter API 키가 설정되지 않았습니다.');
  }

  let content = [{ type: 'text', text: prompt }];

  if (base64Image) {
    const fullDataUrl = await normalizeImageToBase64(base64Image, mimeType);
    content.push({
      type: 'image_url',
      image_url: { url: fullDataUrl }
    });
  }

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${activeKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://leetounsung.github.io/homework-app/',
      'X-Title': 'Gemini 2.5 Flash-Lite Vision'
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash-lite',
      messages: [{ role: 'user', content: content }],
      temperature: 0.1,
      max_tokens: 300
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`OpenRouter Gemini Vision API 오류 (HTTP ${response.status}): ${errText}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
};

export const callGeminiAPI = async (apiKey, prompt, base64Image = null, mimeType = 'image/jpeg') => {
  if (!apiKey) {
    if (DEFAULT_OPENROUTER_KEY) {
      return await callOpenRouterGeminiVision(DEFAULT_OPENROUTER_KEY, prompt, base64Image, mimeType);
    }
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
      }
    } catch (e) {
      lastError = e;
    }
  }

  // Fallback to OpenRouter Gemini 2.5 Flash-Lite if direct Google API failed
  if (DEFAULT_OPENROUTER_KEY) {
    try {
      return await callOpenRouterGeminiVision(DEFAULT_OPENROUTER_KEY, prompt, base64Image, mimeType);
    } catch (orErr) {
      console.warn("OpenRouter Gemini fallback error:", orErr);
    }
  }

  throw lastError || new Error('사용 가능한 Gemini 모델을 찾을 수 없습니다.');
};

const DEFAULT_META_KEY = import.meta.env.VITE_META_API_KEY || 'LLM_2161394044719218_Lv8NcmLsyd5kH8je0bbvj4tyQlg';

export const callMetaMuseSparkAPI = async (apiKey, prompt, base64Image = null, mimeType = 'image/jpeg', model = 'muse-spark-1.3-contributor') => {
  const activeKey = apiKey || DEFAULT_META_KEY;
  if (!activeKey) {
    throw new Error('Meta Muse Spark API 키가 설정되지 않았습니다. 관리자 환경 설정에서 API 키를 입력해주세요.');
  }

  const url = 'https://api.meta.ai/v1/chat/completions';
  const selectedModel = model || 'muse-spark-1.3-contributor';

  let messages = [];

  if (base64Image) {
    const fullDataUrl = await normalizeImageToBase64(base64Image, mimeType);
    messages.push({
      role: 'user',
      content: [
        {
          type: 'text',
          text: prompt
        },
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
      'Authorization': `Bearer ${activeKey.trim()}`
    },
    body: JSON.stringify({
      model: selectedModel,
      messages: messages,
      temperature: 0.1,
      max_tokens: 1000
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `Meta Muse Spark API 호출 실패 (HTTP ${response.status})`);
  }

  const data = await response.json();
  if (data.choices && data.choices.length > 0 && data.choices[0].message) {
    return data.choices[0].message.content;
  }

  return '응답을 생성하지 못했습니다.';
};

export const callAIAPI = async (aiConfig, prompt, base64Image = null, mimeType = 'image/jpeg', extraMeta = {}) => {
  // If aiConfig is passed as an object: { provider, geminiApiKey, deepseekApiKey, deepseekModel, musesparkApiKey, musesparkModel, openrouterApiKey }
  if (typeof aiConfig === 'object' && aiConfig !== null) {
    const { provider, geminiApiKey, deepseekApiKey, deepseekModel, musesparkApiKey, musesparkModel, openrouterApiKey, openrouterModel } = aiConfig;
    if (provider === 'jev' || provider === 'typesafe-jev') {
      const { correctAns, studentAns } = extraMeta || {};
      if (correctAns && studentAns) {
        return await checkMathEquivalenceWithAI(aiConfig, correctAns, studentAns);
      }
      // If image is present and correctAns is present, try vision OCR to extract LaTeX then run Jev 1.13
      if (base64Image && correctAns) {
        let extracted = '';
        if (geminiApiKey) {
          try {
            extracted = await extractStudentMathToLatex(geminiApiKey, base64Image);
          } catch (e) {
            console.warn('Gemini OCR extraction failed:', e);
          }
        }
        if (extracted) {
          return await checkMathEquivalenceWithAI(aiConfig, correctAns, extracted);
        }
      }
      // Fallback to text LLM or available vision provider if pure equivalence cannot run
      if (musesparkApiKey) {
        return await callMetaMuseSparkAPI(musesparkApiKey, prompt, base64Image, mimeType, musesparkModel);
      } else if (deepseekApiKey) {
        return await callDeepseekAPI(deepseekApiKey, prompt, base64Image, mimeType, deepseekModel);
      } else if (geminiApiKey) {
        return await callGeminiAPI(geminiApiKey, prompt, base64Image, mimeType);
      }
    } else if (provider === 'musespark' || provider === 'meta') {
      return await callMetaMuseSparkAPI(musesparkApiKey, prompt, base64Image, mimeType, musesparkModel);
    } else if (provider === 'deepseek') {
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

export const callGeminiVisionToLatex = async (imageInput, geminiKey = '', openrouterKey = '') => {
  const activeGeminiKey = (geminiKey && geminiKey.trim()) || import.meta.env.VITE_GEMINI_API_KEY || '';
  const activeOrKey = (openrouterKey && openrouterKey.trim()) || DEFAULT_OPENROUTER_KEY;

  const prompt = `당신은 초정밀 수학 수식 인식 비전 AI(Gemini)입니다.
첨부된 학생의 손글씨 풀이/메모/수식 사진에서 학생이 적은 수학 수식, 숫자, 또는 최종 정답을 찾아 정확한 LaTeX 수식으로만 한 줄 출력하세요.
규칙:
1. 다른 설명, 인사말, 마크다운 코드블록(\`\`\`) 등은 일절 붙이지 마세요.
2. 예시: 4, -12, \\frac{9}{4}, x^2 - 4x + 3, \\sqrt{3}, 5 등
3. 오직 순수 LaTeX 수식 문자열만 한 줄로 출력하세요.`;

  // 1. Try Direct Google Gemini API first if a key is provided
  if (activeGeminiKey) {
    try {
      const fullDataUrl = await normalizeImageToBase64(imageInput);
      let base64Data = fullDataUrl;
      if (base64Data && base64Data.startsWith('data:')) {
        const parts = base64Data.split(',');
        base64Data = parts[1];
      }

      const models = [
        'gemini-2.5-flash-lite',
        'gemini-2.0-flash-lite',
        'gemini-2.5-flash',
        'gemini-1.5-flash'
      ];

      for (const model of models) {
        try {
          const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${activeGeminiKey.trim()}`;
          const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{
                role: 'user',
                parts: [
                  { text: prompt },
                  { inlineData: { mimeType: 'image/jpeg', data: base64Data } }
                ]
              }],
              generationConfig: {
                temperature: 0.1,
                maxOutputTokens: 120
              }
            })
          });

          if (response.ok) {
            const data = await response.json();
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
            const clean = text.replace(/^`+|`+$/g, '').replace(/^\$+|\$+$/g, '').trim();
            if (clean) return clean;
          }
        } catch (e) {
          // continue fallback
        }
      }
    } catch (directErr) {
      console.warn("Direct Google Gemini API failed, falling back to OpenRouter Gemini:", directErr);
    }
  }

  // 2. OpenRouter Gemini 2.5 Flash-Lite (Google official model via OpenRouter)
  if (activeOrKey) {
    const rawContent = await callOpenRouterGeminiVision(activeOrKey, prompt, imageInput, 'image/jpeg');
    const clean = rawContent.replace(/```latex/gi, '').replace(/```/g, '').replace(/^\$+|\$+$/g, '').trim();
    if (clean) return clean;
  }

  throw new Error('사용 가능한 Gemini API(직접 연결 또는 OpenRouter)를 찾을 수 없습니다.');
};

export const extractStudentMathToLatex = async (geminiKey, imageInput, openrouterKey = '') => {
  return await callGeminiVisionToLatex(imageInput, geminiKey, openrouterKey);
};

export const callTypeSafeJevDecisions = async (openrouterKey, correctAnswer, studentAnswer, model = 'typesafe/jev-1.13') => {
  const activeKey = (openrouterKey && openrouterKey.trim()) || import.meta.env.VITE_OPENROUTER_API_KEY || BUILTIN_OPENROUTER_KEY;
  if (!activeKey) {
    throw new Error('TypeSafe Jev API 키(OpenRouter)가 설정되지 않았습니다.');
  }

  const selectedModel = model || 'typesafe/jev-1.13';
  const url = 'https://openrouter.ai/api/alpha/decisions';
  const payload = {
    model: selectedModel,
    state: `[Math Equivalence Verification Task]\nStudent Answer: ${studentAnswer}\nOfficial Answer Key: ${correctAnswer}\nEvaluate if student answer is mathematically equivalent to the official key, or matches the correct multiple-choice option number (1~5 or ①~⑤).`,
    questions: {
      is_equivalent: {
        type: 'choice',
        instructions: 'Determine whether the student answer is mathematically equivalent to the official key or is the correct choice number.',
        criteria: {
          EQUIVALENT: 'The student answer is mathematically identical, numerically equal, algebraically equivalent, or is the matching multiple choice option number (1~5 or ①~⑤).',
          DIFFERENT: 'The student answer is mathematically different in value, sign, or wrong option number.'
        }
      },
      score: {
        type: 'score',
        instructions: 'Rate the correctness score out of 10 points based on mathematical equivalence.',
        criteria: ['0', '2', '4', '6', '8', '10']
      },
      confidence_noul: {
        type: 'noul',
        instructions: 'Probability that the student answer is correct and equivalent to the key.',
        criteria: {
          true: 'Student answer is mathematically correct and matches key.',
          false: 'Student answer is incorrect or different from key.'
        }
      }
    }
  };

  const startTime = Date.now();
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${activeKey.trim()}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://leetounsung.github.io/homework-app/',
      'X-Title': 'TypeSafe Jev Homework Grader'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Jev 1.13 Decisions API 실패 (HTTP ${response.status}): ${errText}`);
  }

  const data = await response.json();
  const durationMs = Date.now() - startTime;
  
  const answers = data.answers || {};
  const choice = answers.is_equivalent?.choice;
  const confidence = answers.is_equivalent?.confidence ?? 1;
  const noul = answers.confidence_noul?.noul ?? (choice === 'EQUIVALENT' ? 1.0 : 0.0);
  
  // Score interpretation
  let finalScore = choice === 'EQUIVALENT' ? 10 : 0;
  if (answers.score?.score !== undefined) {
    const rawScore = answers.score.score; // 0..5 index scale
    finalScore = Math.min(10, Math.max(0, Math.round((rawScore / 5) * 10)));
  }

  const isEquivalent = choice === 'EQUIVALENT' || noul >= 0.8;
  const cost = data.usage?.cost || 0.000015;

  return {
    success: true,
    isEquivalent,
    choice,
    score: finalScore,
    noul,
    confidence,
    durationMs,
    cost,
    model: data.model || selectedModel,
    provider: data.provider || 'TypeSafe'
  };
};

export const testJevConnection = async (apiKey, model = 'typesafe/jev-1.13') => {
  const activeKey = (apiKey && apiKey.trim()) || import.meta.env.VITE_OPENROUTER_API_KEY || BUILTIN_OPENROUTER_KEY;
  const res = await callTypeSafeJevDecisions(activeKey, '2', '2', model);
  return {
    success: res.isEquivalent,
    durationMs: res.durationMs,
    cost: res.cost,
    model: res.model,
    provider: res.provider,
    noul: res.noul
  };
};

export const normalizeChoiceNumber = (str) => {
  if (str === null || str === undefined) return '';
  let s = String(str).trim();
  const circledMap = {
    '①': '1', '②': '2', '③': '3', '④': '4', '⑤': '5',
    '❶': '1', '❷': '2', '❸': '3', '❹': '4', '❺': '5',
    '⑴': '1', '⑵': '2', '⑶': '3', '⑷': '4', '⑸': '5'
  };
  s = s.replace(/[①②③④⑤❶❷❸❹❺⑴⑵⑶⑷⑸]/g, ch => circledMap[ch] || ch);
  const m = s.match(/^([1-5])\s*(?:번|\.)?$/);
  if (m) return m[1];
  return s.trim();
};

export const checkMathEquivalenceWithAI = async (aiConfig, correctAnswer, studentAnswer) => {
  const rawKey = String(correctAnswer || '').trim();
  const rawStudent = String(studentAnswer || '').trim();

  // Normalize backslashes (JSON-escaped \\frac -> \frac) and spaces
  const cleanKey = rawKey.replace(/\\\\+/g, '\\').replace(/\s+/g, ' ').trim();
  const cleanStudent = rawStudent.replace(/\\\\+/g, '\\').replace(/\s+/g, ' ').trim();

  // FAST-PATH 0A: Exact string match (ignoring spaces & backslash differences)
  if (cleanKey && cleanStudent && cleanKey.toLowerCase().replace(/\s+/g, '') === cleanStudent.toLowerCase().replace(/\s+/g, '')) {
    return `[채점 결과]
⭕ 정답

[⚡ 즉시 일치 판정]
- 공식 정답: ${correctAnswer}
- 학생 답안: ${studentAnswer}
- 동치 판정: 완전 일치 (EXACT_MATCH)
- 획득 점수: 10점 / 10점 (일치 확률: 100%)
- 검정 속도: 0ms (0비용)`;
  }

  // FAST-PATH 0B: Multiple Choice Number Match (1~5 or ①~⑤ or 3번)
  const normKey = normalizeChoiceNumber(cleanKey);
  const normStudent = normalizeChoiceNumber(cleanStudent);
  const validChoices = ['1', '2', '3', '4', '5'];

  if (validChoices.includes(normKey) && validChoices.includes(normStudent)) {
    if (normKey === normStudent) {
      return `[채점 결과]
⭕ 정답

[⚡ 객관식 정답 판정]
- 공식 정답: ${correctAnswer} (${normKey}번)
- 학생 답안: ${studentAnswer} (${normStudent}번)
- 동치 판정: 선택지 일치 (EQUIVALENT)
- 획득 점수: 10점 / 10점 (일치 확률: 100%)
- 검정 속도: 0ms (0비용)`;
    } else {
      return `[채점 결과]
❌ 오답

[⚡ 객관식 오답 판정]
- 공식 정답: ${correctAnswer} (${normKey}번)
- 학생 답안: ${studentAnswer} (${normStudent}번)
- 동치 판정: 선택지 불일치 (DIFFERENT)
- 획득 점수: 0점 / 10점
- 검정 속도: 0ms (0비용)`;
    }
  }

  // FAST-PATH 1: Try TypeSafe Jev 1.13 Decisions API first (0.05s, 0.003 KRW)
  try {
    const orKey = ((typeof aiConfig === 'object' && aiConfig?.openrouterApiKey) || '').trim() || BUILTIN_OPENROUTER_KEY;
    const orModel = (typeof aiConfig === 'object' && aiConfig?.openrouterModel) || 'typesafe/jev-1.13';
    const jevRes = await callTypeSafeJevDecisions(orKey, correctAnswer, studentAnswer, orModel);
    
    const probPercent = Math.round((jevRes.noul ?? (jevRes.isEquivalent ? 1 : 0)) * 100);
    const costUsd = (jevRes.cost || 0.000015).toFixed(6);

    if (jevRes.isEquivalent) {
      return `[채점 결과]
⭕ 정답

[⚡ TypeSafe Jev 1.13 검정 판정]
- 공식 정답: ${correctAnswer}
- 학생 답안: ${studentAnswer}
- 동치 판정: 완벽한 수학적 동치 (EQUIVALENT)
- 획득 점수: ${jevRes.score}점 / 10점 (일치 확률: ${probPercent}%)
- 검정 속도: ${jevRes.durationMs}ms (추론 비용: $${costUsd})`;
    } else {
      return `[채점 결과]
❌ 오답

[⚡ TypeSafe Jev 1.13 검정 판정]
- 공식 정답: ${correctAnswer}
- 학생 답안: ${studentAnswer}
- 동치 판정: 불일치 (DIFFERENT)
- 획득 점수: ${jevRes.score}점 / 10점 (일치 확률: ${probPercent}%)
- 검정 속도: ${jevRes.durationMs}ms (추론 비용: $${costUsd})`;
    }
  } catch (jevErr) {
    console.warn("Jev 1.13 Decisions API 호출 실패, 표준 AI로 폴백:", jevErr);
  }

  // FALLBACK 2: Standard LLM call
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

  return await callAIAPI(aiConfig, prompt, null, 'image/jpeg', { correctAns: correctAnswer, studentAns: studentAnswer });
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

  return await callAIAPI(aiConfig, prompt, studentSolutionImage, 'image/jpeg', { correctAns });
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
