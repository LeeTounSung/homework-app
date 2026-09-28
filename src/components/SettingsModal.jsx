import React, { useState, useEffect } from 'react';
import { useHomework } from '../context/HomeworkContext';

export default function SettingsModal({ isOpen, onClose }) {
  const {
    aiProvider,
    geminiApiKey,
    deepseekApiKey,
    deepseekModel,
    musesparkApiKey,
    musesparkModel,
    saveAiSettings
  } = useHomework();

  const DEFAULT_META_KEY = 'LLM_2161394044719218_Lv8NcmLsyd5kH8je0bbvj4tyQlg';

  const [tempProvider, setTempProvider] = useState('musespark');
  const [tempMusesparkKey, setTempMusesparkKey] = useState('');
  const [tempMusesparkModel, setTempMusesparkModel] = useState('muse-spark-1.3-contributor');
  const [tempDeepseekKey, setTempDeepseekKey] = useState('');
  const [tempDeepseekModel, setTempDeepseekModel] = useState('deepseek-v4-flash-vision-exp');
  const [tempGeminiKey, setTempGeminiKey] = useState('');
  const [showMetaKey, setShowMetaKey] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setTempProvider(aiProvider || 'musespark');
      setTempMusesparkKey(musesparkApiKey || DEFAULT_META_KEY);
      setTempMusesparkModel(musesparkModel || 'muse-spark-1.3-contributor');
      setTempDeepseekKey(deepseekApiKey || '');
      setTempDeepseekModel(deepseekModel || 'deepseek-v4-flash-vision-exp');
      setTempGeminiKey(geminiApiKey || '');
      setShowMetaKey(false);
    }
  }, [isOpen, aiProvider, musesparkApiKey, musesparkModel, deepseekApiKey, deepseekModel, geminiApiKey]);

  if (!isOpen) return null;

  const handleSave = () => {
    const cleanedDeepseekModel = tempDeepseekModel.trim() || 'deepseek-v4-flash-vision-exp';
    const cleanedMusesparkModel = tempMusesparkModel.trim() || 'muse-spark-1.3-contributor';

    saveAiSettings({
      provider: tempProvider,
      geminiKey: tempGeminiKey.trim(),
      deepseekKey: tempDeepseekKey.trim(),
      model: cleanedDeepseekModel,
      musesparkKey: tempMusesparkKey.trim(),
      musesparkModel: cleanedMusesparkModel
    });

    onClose();

    const providerName = tempProvider === 'musespark' 
      ? 'Meta Muse Spark 1.3 (Contributor)' 
      : (tempProvider === 'deepseek' ? 'DeepSeek Vision' : 'Google Gemini');
    alert(`AI 설정이 저장되었습니다. (활성 엔진: ${providerName})`);
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 1100 }}>
      <div className="modal-content" style={{ maxWidth: '520px', width: '92%', maxHeight: '90vh', overflowY: 'auto' }}>
        <h3 style={{ marginTop: 0, marginBottom: '18px', color: '#FFD700', display: 'flex', alignItems: 'center', gap: '8px' }}>
          ⚙️ AI 엔진 및 API 키 환경 설정
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* AI Engine Selection */}
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', color: '#eee', fontWeight: 'bold' }}>
              🤖 기본 사용할 AI 엔진 선택
            </label>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button 
                type="button"
                onClick={() => setTempProvider('musespark')}
                style={{
                  flex: '1 1 calc(33.3% - 6px)',
                  padding: '10px 6px',
                  borderRadius: '8px',
                  border: tempProvider === 'musespark' ? '2px solid #0084FF' : '1px solid #555',
                  backgroundColor: tempProvider === 'musespark' ? 'rgba(0, 132, 255, 0.25)' : '#2A2B36',
                  color: tempProvider === 'musespark' ? '#60a5fa' : '#aaa',
                  fontWeight: tempProvider === 'musespark' ? 'bold' : 'normal',
                  cursor: 'pointer',
                  fontSize: '12px'
                }}
              >
                ⚡ Meta Muse Spark 1.3
              </button>
              <button 
                type="button"
                onClick={() => setTempProvider('deepseek')}
                style={{
                  flex: '1 1 calc(33.3% - 6px)',
                  padding: '10px 6px',
                  borderRadius: '8px',
                  border: tempProvider === 'deepseek' ? '2px solid #4CAF50' : '1px solid #555',
                  backgroundColor: tempProvider === 'deepseek' ? 'rgba(76, 175, 80, 0.2)' : '#2A2B36',
                  color: tempProvider === 'deepseek' ? '#81C784' : '#aaa',
                  fontWeight: tempProvider === 'deepseek' ? 'bold' : 'normal',
                  cursor: 'pointer',
                  fontSize: '12px'
                }}
              >
                DeepSeek Vision
              </button>
              <button 
                type="button"
                onClick={() => setTempProvider('gemini')}
                style={{
                  flex: '1 1 calc(33.3% - 6px)',
                  padding: '10px 6px',
                  borderRadius: '8px',
                  border: tempProvider === 'gemini' ? '2px solid #2196F3' : '1px solid #555',
                  backgroundColor: tempProvider === 'gemini' ? 'rgba(33, 150, 243, 0.2)' : '#2A2B36',
                  color: tempProvider === 'gemini' ? '#64B5F6' : '#aaa',
                  fontWeight: tempProvider === 'gemini' ? 'bold' : 'normal',
                  cursor: 'pointer',
                  fontSize: '12px'
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
              Google Gemini API Key (고정 모델: 2.5 Flash-Lite)
            </label>
            <input 
              type="password" 
              value={tempGeminiKey} 
              onChange={(e) => setTempGeminiKey(e.target.value)}
              className="modal-input"
              placeholder="AIzaSy... 형식의 Gemini API 키"
            />
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
