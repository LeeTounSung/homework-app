export const evaluateMathProblem = async (imageBase64, problemText, apiKey) => {
  if (!apiKey) {
    throw new Error('Gemini API Key가 설정되지 않았습니다.');
  }

  // Extract base64 part if it contains data URL prefix
  let base64Data = imageBase64;
  let mimeType = "image/jpeg";
  if (imageBase64.includes(',')) {
    const parts = imageBase64.split(',');
    const match = parts[0].match(/:(.*?);/);
    if (match) {
      mimeType = match[1];
    }
    base64Data = parts[1];
  }

  const prompt = `
당신은 엄격하고 친절한 수학 선생님입니다. 
아래 제공된 '문제 원본 및 해설지'를 참고하여, 학생이 제출한 '수학 풀이 이미지(또는 수식)'를 채점해주세요.

[문제 원본 및 해설지 (정답 기준)]
${problemText}

[지시사항]
1. 학생의 이미지 속 풀이와 최종 정답을 확인하세요.
2. 학생의 최종 정답이 해설지와 일치하는지 (맞음/틀림) 판별하세요.
3. 만약 틀렸거나 풀이 과정에 오류가 있다면, 어느 부분에서 실수했는지(부호 실수, 계산 실수, 공식 오적용 등) 구체적으로 짚어주는 2~3문장의 짧은 피드백 코멘트를 작성하세요. 정답이라면 칭찬하는 코멘트를 작성하세요.
4. 반드시 아래 JSON 형식으로만 응답하세요. 다른 설명은 포함하지 마세요.

\`\`\`json
{
  "isCorrect": true/false,
  "feedback": "피드백 내용"
}
\`\`\`
`;

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: prompt },
              {
                inlineData: {
                  mimeType: mimeType,
                  data: base64Data
                }
              }
            ]
          }
        ],
        generationConfig: {
          responseMimeType: "application/json"
        }
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Gemini API 오류: ${errorData.error?.message || response.statusText}`);
    }

    const data = await response.json();
    const textResponse = data.candidates[0].content.parts[0].text;
    
    // Parse JSON
    try {
      const result = JSON.parse(textResponse);
      return result; // { isCorrect: boolean, feedback: string }
    } catch (parseError) {
      // In case the model wrapped it in markdown code blocks despite responseMimeType
      const cleaned = textResponse.replace(/```json/g, '').replace(/```/g, '').trim();
      return JSON.parse(cleaned);
    }
  } catch (error) {
    console.error("Gemini API call failed:", error);
    throw error;
  }
};
