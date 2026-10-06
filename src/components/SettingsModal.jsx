import React, { useState, useEffect } from 'react';
import { useHomework } from '../context/HomeworkContext';
import { testJevConnection } from '../utils/gemini';

export default function SettingsModal({ isOpen, onClose }) {
  const {
    aiProvider,
    geminiApiKey,
    openrouterApiKey,
    openrouterModel,
    deepseekApiKey,
    deepseekModel,
    musesparkApiKey,
    musesparkModel,
    myscriptAppKey,
    myscriptHmacKey,
    saveAiSettings
  } = useHomework();

  const DEFAULT_META_KEY = import.meta.env.VITE_META_API_KEY || 'LLM_2161394044719218_Lv8NcmLsyd5kH8je0bbvj4tyQlg';
  const DEFAULT_OPENROUTER_KEY = import.meta.env.VITE_OPENROUTER_API_KEY || '';

  const [tempProvider, setTempProvider] = useState('jev');
  const [tempMusesparkKey, setTempMusesparkKey] = useState('');
  const [tempMusesparkModel, setTempMusesparkModel] = useState('muse-spark-1.3-contributor');
  const [tempDeepseekKey, setTempDeepseekKey] = useState('');
  const [tempDeepseekModel, setTempDeepseekModel] = useState('deepseek-v4-flash-vision-exp');
  const [tempGeminiKey, setTempGeminiKey] = useState('');
  const [tempOpenrouterKey, setTempOpenrouterKey] = useState('');
  const [tempOpenrouterModel, setTempOpenrouterModel] = useState('typesafe/jev-1.13');
  const [tempMyscriptAppKey, setTempMyscriptAppKey] = useState('');
  const [tempMyscriptHmacKey, setTempMyscriptHmacKey] = useState('');
  const [showMetaKey, setShowMetaKey] = useState(false);
  const [showOpenrouterKey, setShowOpenrouterKey] = useState(false);
  const [isTestingJev, setIsTestingJev] = useState(false);
  const [jevTestResult, setJevTestResult] = useState(null);

  useEffect(() => {
    if (isOpen) {
      setTempProvider(aiProvider || 'jev');
      setTempMusesparkKey(musesparkApiKey || DEFAULT_META_KEY);
      setTempMusesparkModel(musesparkModel || 'muse-spark-1.3-contributor');
      setTempDeepseekKey(deepseekApiKey || '');
      setTempDeepseekModel(deepseekModel || 'deepseek-v4-flash-vision-exp');
      setTempGeminiKey(geminiApiKey || '');
      setTempOpenrouterKey(openrouterApiKey || DEFAULT_OPENROUTER_KEY);
      setTempOpenrouterModel(openrouterModel || 'typesafe/jev-1.13');
      setTempMyscriptAppKey(myscriptAppKey || '');
      setTempMyscriptHmacKey(myscriptHmacKey || '');
      setShowMetaKey(false);
      setShowOpenrouterKey(false);
      setJevTestResult(null);
    }
  }, [isOpen, aiProvider, musesparkApiKey, musesparkModel, deepseekApiKey, deepseekModel, geminiApiKey, openrouterApiKey, openrouterModel, myscriptAppKey, myscriptHmacKey]);

  if (!isOpen) return null;

  const handleTestJev = async () => {
    setIsTestingJev(true);
    setJevTestResult(null);
    try {
      const res = await testJevConnection(tempOpenrouterKey.trim(), tempOpenrouterModel.trim());
      setJevTestResult({
        success: true,
        message: `✅ TypeSafe Jev 1.13 연결 성공! (응답시간: ${res.durationMs}ms, 모델: ${res.model})`
      });
    } catch (err) {
      setJevTestResult({
        success: false,
        message: `❌ Jev 1.13 연결 실패: ${err.message}`
      });
    } finally {
      setIsTestingJev(false);
    }
  };

  const handleSave = () => {
    const cleanedDeepseekModel = tempDeepseekModel.trim() || 'deepseek-v4-flash-vision-exp';
    const cleanedMusesparkModel = tempMusesparkModel.trim() || 'muse-spark-1.3-contributor';
    const cleanedOpenrouterModel = tempOpenrouterModel.trim() || 'typesafe/jev-1.13';

    saveAiSettings({
      provider: tempProvider,
      geminiKey: tempGeminiKey.trim(),
      openrouterKey: tempOpenrouterKey.trim(),
      openrouterModel: cleanedOpenrouterModel,
      deepseekKey: tempDeepseekKey.trim(),
      model: cleanedDeepseekModel,
      musesparkKey: tempMusesparkKey.trim(),
      musesparkModel: cleanedMusesparkModel,
      myscriptAppKey: tempMyscriptAppKey.trim(),
      myscriptHmacKey: tempMyscriptHmacKey.trim()
    });

    onClose();

    let providerName = 'TypeSafe Jev 1.13 (OpenRouter)';
    if (tempProvider === 'musespark') providerName = 'Meta Muse Spark 1.3 (Contributor)';
    else if (tempProvider === 'deepseek') providerName = 'DeepSeek Vision';
    else if (tempProvider === 'gemini') providerName = 'Google Gemini';
    alert(`AI 설정이 저장되었습니다. (활성 엔진: ${providerName})`);
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 1100 }}>
      <div className="modal-content" style={{ maxWidth: '520px', width: '92%', maxHeight: '90vh', overflowY: 'auto' }}>
        <h3 style={{ marginTop: 0, marginBottom: '18px', color: '#FFFFFF', display: 'flex', alignItems: 'center', gap: '8px' }}>
          ⚙️ AI 엔진 및 API 키 환경 설정
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* AI Engine Selection */}
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', color: '#eee', fontWeight: 'bold' }}>
              🤖 기본 사용할 AI 엔진 선택
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
              <button 
                type="button"
                onClick={() => setTempProvider('jev')}
                style={{
                  padding: '10px 8px',
                  borderRadius: '8px',
                  border: tempProvider === 'jev' ? '2px solid #FFD700' : '1px solid #555',
                  backgroundColor: tempProvider === 'jev' ? 'rgba(255, 215, 0, 0.25)' : '#2A2B36',
                  color: tempProvider === 'jev' ? '#FFD700' : '#aaa',
                  fontWeight: tempProvider === 'jev' ? 'bold' : 'normal',
                  cursor: 'pointer',
                  fontSize: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px'
                }}
              >
                ⚡ TypeSafe Jev 1.13
              </button>
              <button 
                type="button"
                onClick={() => setTempProvider('musespark')}
                style={{
                  padding: '10px 8px',
                  borderRadius: '8px',
                  border: tempProvider === 'musespark' ? '2px solid #0084FF' : '1px solid #555',
                  backgroundColor: tempProvider === 'musespark' ? 'rgba(0, 132, 255, 0.25)' : '#2A2B36',
                  color: tempProvider === 'musespark' ? '#60a5fa' : '#aaa',
                  fontWeight: tempProvider === 'musespark' ? 'bold' : 'normal',
                  cursor: 'pointer',
                  fontSize: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px'
                }}
              >
                ⚡ Meta Muse Spark 1.3
              </button>
              <button 
                type="button"
                onClick={() => setTempProvider('deepseek')}
                style={{
                  padding: '10px 8px',
                  borderRadius: '8px',
                  border: tempProvider === 'deepseek' ? '2px solid #4CAF50' : '1px solid #555',
                  backgroundColor: tempProvider === 'deepseek' ? 'rgba(76, 175, 80, 0.2)' : '#2A2B36',
                  color: tempProvider === 'deepseek' ? '#81C784' : '#aaa',
                  fontWeight: tempProvider === 'deepseek' ? 'bold' : 'normal',
                  cursor: 'pointer',
                  fontSize: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px'
                }}
              >
                DeepSeek Vision
              </button>
              <button 
                type="button"
                onClick={() => setTempProvider('gemini')}
                style={{
                  padding: '10px 8px',
                  borderRadius: '8px',
                  border: tempProvider === 'gemini' ? '2px solid #2196F3' : '1px solid #555',
                  backgroundColor: tempProvider === 'gemini' ? 'rgba(33, 150, 243, 0.2)' : '#2A2B36',
                  color: tempProvider === 'gemini' ? '#64B5F6' : '#aaa',
                  fontWeight: tempProvider === 'gemini' ? 'bold' : 'normal',
                  cursor: 'pointer',
                  fontSize: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px'
                }}
              >
                Google Gemini
              </button>
            </div>
          </div>

          {/* Meta Muse Spark 1.3 Settings Card */}
          <div style={{ 
            padding: '14px', 
            borderRadius: '10px', 
            backgroundColor: tempProvider === 'musespark' ? 'rgba(0, 132, 255, 0.12)' : '#252630',
            border: tempProvider === 'musespark' ? '1.5px solid #0084FF' : '1px solid #444',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label style={{ fontSize: '13px', color: '#60a5fa', fontWeight: 'bold' }}>
                ⚡ Meta Muse Spark 1.3 (Contributor)
              </label>
              <span style={{ fontSize: '11px', color: '#93c5fd', backgroundColor: 'rgba(0, 132, 255, 0.2)', padding: '2px 8px', borderRadius: '10px', fontWeight: 'bold', border: '1px solid #0084FF' }}>
                Meta AI Cloud (MSL)
              </span>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontSize: '12px', color: '#60a5fa', fontWeight: 'bold' }}>
                Meta Model API Key (META_API_KEY)
              </label>
              <div style={{ display: 'flex', gap: '6px' }}>
                <input 
                  type={showMetaKey ? 'text' : 'password'} 
                  value={tempMusesparkKey} 
                  onChange={(e) => setTempMusesparkKey(e.target.value)}
                  className="modal-input"
                  style={{ flex: 1, fontFamily: 'monospace', fontSize: '12px' }}
                  placeholder="LLM_... 형식의 Meta API Key"
                />
                <button
                  type="button"
                  onClick={() => setShowMetaKey(!showMetaKey)}
                  style={{
                    padding: '0 10px',
                    borderRadius: '8px',
                    backgroundColor: '#333',
                    color: '#fff',
                    border: '1px solid #555',
                    cursor: 'pointer',
                    fontSize: '12px'
                  }}
                  title={showMetaKey ? '키 숨기기' : '키 보기'}
                >
                  {showMetaKey ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontSize: '11px', color: '#aaa' }}>
                모델명 (기본: muse-spark-1.3-contributor)
              </label>
              <input 
                type="text" 
                value={tempMusesparkModel} 
                onChange={(e) => setTempMusesparkModel(e.target.value)}
                className="modal-input"
                placeholder="muse-spark-1.3-contributor"
              />
            </div>

            <div style={{ fontSize: '11px', color: '#9ca3af', lineHeight: '1.4' }}>
              * Meta Superintelligence Labs(MSL)의 Muse Spark 1.3 Contributor 추론 API(<code>https://api.meta.ai/v1/chat/completions</code>)를 활용하여 정답표 대비 주관식/서술형 LaTeX 동치 판정 및 손글씨 비전 채점을 수행합니다.
            </div>
          </div>

          {/* DeepSeek Settings Card */}
          <div style={{ 
            padding: '12px', 
            borderRadius: '8px', 
            backgroundColor: tempProvider === 'deepseek' ? 'rgba(76, 175, 80, 0.1)' : '#252630',
            border: tempProvider === 'deepseek' ? '1.5px solid #4CAF50' : '1px solid #444',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px'
          }}>
            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontSize: '13px', color: '#81C784', fontWeight: 'bold' }}>
                DeepSeek API Key
              </label>
              <input 
                type="password" 
                value={tempDeepseekKey} 
                onChange={(e) => setTempDeepseekKey(e.target.value)}
                className="modal-input"
                placeholder="sk-... 형식의 DeepSeek API 키"
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontSize: '12px', color: '#aaa' }}>
                DeepSeek 모델명
              </label>
              <input 
                type="text" 
                value={tempDeepseekModel} 
                onChange={(e) => setTempDeepseekModel(e.target.value)}
                className="modal-input"
                placeholder="deepseek-v4-flash-vision-exp"
              />
            </div>
          </div>

          {/* Gemini Settings Card */}
          <div style={{ 
            padding: '12px', 
            borderRadius: '8px', 
            backgroundColor: tempProvider === 'gemini' ? 'rgba(33, 150, 243, 0.1)' : '#252630',
            border: tempProvider === 'gemini' ? '1.5px solid #2196F3' : '1px solid #444' 
          }}>
            <label style={{ display: 'block', marginBottom: '5px', fontSize: '13px', color: '#64B5F6', fontWeight: 'bold' }}>
              Google Gemini API Key (손글씨 수식 인식: 2.5 Flash-Lite)
            </label>
            <input 
              type="password" 
              value={tempGeminiKey} 
              onChange={(e) => setTempGeminiKey(e.target.value)}
              className="modal-input"
              placeholder="AIzaSy... 형식의 Gemini API 키"
            />
          </div>

          {/* TypeSafe Jev 1.13 Decisions API Card (OpenRouter) */}
          <div style={{ 
            padding: '14px', 
            borderRadius: '10px', 
            backgroundColor: tempProvider === 'jev' ? 'rgba(255, 215, 0, 0.14)' : 'rgba(255, 215, 0, 0.05)',
            border: tempProvider === 'jev' ? '2px solid #FFD700' : '1px solid #FFD700',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label style={{ fontSize: '13px', color: '#FFD700', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
                ⚡ TypeSafe Jev 1.13 Decisions API (OpenRouter)
                {tempProvider === 'jev' && <span style={{ fontSize: '11px', color: '#000', backgroundColor: '#FFD700', padding: '1px 6px', borderRadius: '4px', fontWeight: 'bold' }}>활성 엔진</span>}
              </label>
              <span style={{ fontSize: '11px', color: '#FFD700', backgroundColor: 'rgba(255, 215, 0, 0.2)', padding: '2px 8px', borderRadius: '10px', fontWeight: 'bold', border: '1px solid #FFD700' }}>
                0.05s 초고속 동치 판정
              </span>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontSize: '12px', color: '#FFD700', fontWeight: 'bold' }}>
                OpenRouter API Key (Jev 1.13 추론용)
              </label>
              <div style={{ display: 'flex', gap: '6px' }}>
                <input 
                  type={showOpenrouterKey ? 'text' : 'password'} 
                  value={tempOpenrouterKey} 
                  onChange={(e) => setTempOpenrouterKey(e.target.value)}
                  className="modal-input"
                  placeholder="OpenRouter API 키를 입력하세요 (기본 .env 설정값 자동적용)"
                  style={{ flex: 1, fontFamily: 'monospace', fontSize: '12px' }}
                />
                <button
                  type="button"
                  onClick={() => setShowOpenrouterKey(!showOpenrouterKey)}
                  style={{
                    padding: '0 10px',
                    borderRadius: '8px',
                    backgroundColor: '#333',
                    color: '#fff',
                    border: '1px solid #555',
                    cursor: 'pointer',
                    fontSize: '12px'
                  }}
                  title={showOpenrouterKey ? '키 숨기기' : '키 보기'}
                >
                  {showOpenrouterKey ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '11px', color: '#aaa' }}>
                  모델 식별자
                </label>
                <input 
                  type="text" 
                  value={tempOpenrouterModel} 
                  onChange={(e) => setTempOpenrouterModel(e.target.value)}
                  className="modal-input"
                  placeholder="typesafe/jev-1.13"
                  style={{ width: '100%', boxSizing: 'border-box', fontSize: '12px' }}
                />
              </div>

              <div style={{ alignSelf: 'flex-end' }}>
                <button
                  type="button"
                  onClick={handleTestJev}
                  disabled={isTestingJev || !tempOpenrouterKey}
                  style={{
                    padding: '9px 14px',
                    borderRadius: '8px',
                    border: '1px solid #FFD700',
                    backgroundColor: isTestingJev ? '#555' : 'rgba(255, 215, 0, 0.2)',
                    color: '#FFD700',
                    fontWeight: 'bold',
                    fontSize: '12px',
                    cursor: (isTestingJev || !tempOpenrouterKey) ? 'not-allowed' : 'pointer',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {isTestingJev ? '⏳ 검정 중...' : '🧪 Jev 1.13 연결 테스트'}
                </button>
              </div>
            </div>

            {jevTestResult && (
              <div style={{
                padding: '8px 12px',
                borderRadius: '6px',
                backgroundColor: jevTestResult.success ? 'rgba(76, 175, 80, 0.2)' : 'rgba(244, 67, 54, 0.2)',
                border: jevTestResult.success ? '1px solid #4CAF50' : '1px solid #F44336',
                color: jevTestResult.success ? '#A5D6A7' : '#EF9A9A',
                fontSize: '12px',
                fontWeight: 'bold'
              }}>
                {jevTestResult.message}
              </div>
            )}

            <div style={{ fontSize: '11px', color: '#d4af37', lineHeight: '1.4' }}>
              * TypeSafe Jev 1.13(<code>https://openrouter.ai/api/alpha/decisions</code>)을 호출하여 학생의 LaTeX 수식과 정답표 간의 수학적 동치(Algebraic Equivalence) 판정 및 10점 만점 루브릭 채점을 0.05초 만에 $0.000015 극초저비용으로 즉각 완료합니다.
            </div>
          </div>

          {/* ✍️ MyScript Interactive Ink (iink Math) Configuration */}
          <div style={{
            padding: '14px',
            backgroundColor: '#1E293B',
            borderRadius: '10px',
            border: '1.5px solid #0EA5E9',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 'bold', fontSize: '13px', color: '#38BDF8', display: 'flex', alignItems: 'center', gap: '6px' }}>
                ✍️ MyScript 전자 수식 필기 (iink Math)
              </span>
              <a 
                href="https://developer.myscript.com" 
                target="_blank" 
                rel="noreferrer"
                style={{ fontSize: '11px', color: '#7DD3FC', textDecoration: 'underline' }}
              >
                무료 키 발급 ↗
              </a>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '11px', color: '#aaa' }}>
                Application Key
              </label>
              <input 
                type="text" 
                value={tempMyscriptAppKey} 
                onChange={(e) => setTempMyscriptAppKey(e.target.value)}
                className="modal-input"
                placeholder="MyScript Cloud Application Key"
                style={{ width: '100%', boxSizing: 'border-box', fontFamily: 'monospace', fontSize: '12px' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '11px', color: '#aaa' }}>
                HMAC Key (Secret)
              </label>
              <input 
                type="password" 
                value={tempMyscriptHmacKey} 
                onChange={(e) => setTempMyscriptHmacKey(e.target.value)}
                className="modal-input"
                placeholder="MyScript Cloud HMAC Key"
                style={{ width: '100%', boxSizing: 'border-box', fontFamily: 'monospace', fontSize: '12px' }}
              />
            </div>

            <div style={{ fontSize: '11px', color: '#94A3B8', lineHeight: '1.4' }}>
              * 학생이 전자 필기패드(수식 직접 입력)에서 디지털 펜/터치로 수식을 필기할 때, MyScript Interactive Ink 엔진이 실시간으로 LaTeX 수식으로 즉각 변환합니다. (키가 없으면 일반 필기 캔버스로 자동 동작합니다.)
            </div>
          </div>

          <p style={{ fontSize: '12px', color: '#888', margin: 0, lineHeight: 1.4 }}>
            * API 키는 브라우저 내부(LocalStorage)에만 안전하게 보관됩니다.
          </p>
        </div>

        <div className="modal-buttons" style={{ marginTop: '20px' }}>
          <button className="modal-btn cancel" onClick={onClose}>취소</button>
          <button className="modal-btn confirm" onClick={handleSave}>저장</button>
        </div>
      </div>
    </div>
  );
}
