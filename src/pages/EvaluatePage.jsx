import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useHomework } from '../context/HomeworkContext';
import { analyzeProblemSubmission } from '../utils/gemini';

const formatDriveImageUrl = (url) => {
  if (!url || typeof url !== 'string') return url;
  if (url.startsWith('data:image')) return url;

  if (url.includes('drive.google.com') || url.includes('googleusercontent.com')) {
    const match = url.match(/[?&]id=([a-zA-Z0-9_-]+)/) ||
                  url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) ||
                  url.match(/\/d\/([a-zA-Z0-9_-]+)/) ||
                  url.match(/\/open\?id=([a-zA-Z0-9_-]+)/);
    if (match && match[1]) {
      const fileId = match[1];
      return `https://lh3.googleusercontent.com/d/${fileId}`;
    }
  }
  return url;
};

export default function EvaluatePage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { getHomeworkById, evaluateHomework, evaluateSingleProblem, evaluateBulkProblems, geminiApiKey, aiConfig, isAiConfigured } = useHomework();
  const [evaluationType, setEvaluationType] = useState('check'); // check, stars
  const [stars, setStars] = useState(0);

  // AI Feedback Modal State
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [currentAiProblem, setCurrentAiProblem] = useState(null);
  const [aiCustomDetails, setAiCustomDetails] = useState('');
  const [aiFeedbackText, setAiFeedbackText] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);

  // Bulk AI Modal State
  const [isBulkAiModalOpen, setIsBulkAiModalOpen] = useState(false);
  const [wrongNumbersInput, setWrongNumbersInput] = useState('');
  const [bulkFeedback, setBulkFeedback] = useState('');
  
  const hw = getHomeworkById(id);

  if (!hw) return <div style={{color: 'white', padding: '20px'}}>숙제를 찾을 수 없습니다.</div>;

  // Filter out exempt problems from gallery
  const submittedProblems = (hw.submittedProblems || []).filter(p => p.status !== 'exempt');
  
  // To show proper labels, we map groupId back to the label name
  const groupLabelMap = {};
  if (hw.problemGroups) {
    hw.problemGroups.forEach(g => {
      groupLabelMap[g.groupId] = g.label;
    });
  }

  // Sort by group name then problem number
  const sortedProblems = [...submittedProblems].sort((a, b) => {
    const labelA = groupLabelMap[a.groupId] || '';
    const labelB = groupLabelMap[b.groupId] || '';
    if (labelA !== labelB) {
      return labelA.localeCompare(labelB);
    }
    return a.problemNumber - b.problemNumber;
  });

  const rawTotal = hw.problemGroups ? hw.problemGroups.reduce((sum, group) => sum + group.problems.length, 0) : 0;
  const exemptCount = (hw.submittedProblems || []).filter(p => p.status === 'exempt').length;
  const totalQuestions = rawTotal - exemptCount;

  const handleEvaluate = () => {
    let evaluationData = {};
    if (evaluationType === 'check') {
      evaluationData = { type: 'check' };
    } else if (evaluationType === 'stars') {
      evaluationData = { type: 'stars', value: stars };
    }

    evaluateHomework(id, evaluationData);
    alert('평가가 완료되었습니다!');
    navigate('/teacher');
  };

  const handleBulkAiGrade = () => {
    // Parse comma separated numbers
    const wrongNumbers = wrongNumbersInput
      .split(',')
      .map(s => parseInt(s.trim()))
      .filter(n => !isNaN(n));
      
    if (window.confirm(`입력하신 ${wrongNumbers.length}개의 문제를 오답 처리하고, 나머지 문제들은 모두 정답 처리하시겠습니까?`)) {
      evaluateBulkProblems(id, wrongNumbers, bulkFeedback);
      alert('일괄 채점이 적용되었습니다.');
      setIsBulkAiModalOpen(false);
      setWrongNumbersInput('');
      setBulkFeedback('');
    }
  };

  const handleAiAnalyzeOpen = (problem) => {
    if (!isAiConfigured && !geminiApiKey) {
      alert('AI API 키가 설정되지 않았습니다. 관리자 페이지 환경 설정에서 키를 먼저 입력해주세요.');
      return;
    }
    setCurrentAiProblem(problem);
    setIsAiModalOpen(true);
    setAiFeedbackText('');
    setAiCustomDetails('');
    setIsAiLoading(false);
  };

  const handleAiAnalyzeExecute = async () => {
    if (!currentAiProblem) return;
    setIsAiLoading(true);
    setAiFeedbackText('');

    try {
      const desc = `${hw.studentName} 학생의 ${hw.title} ${currentAiProblem.problemNumber}번 문제 풀이입니다.`;
      const feedback = await analyzeProblemSubmission(aiConfig || geminiApiKey, desc, currentAiProblem.imageUrl, aiCustomDetails);
      setAiFeedbackText(feedback);
    } catch (error) {
      console.error(error);
      setAiFeedbackText(`AI 분석 중 오류가 발생했습니다: ${error.message}`);
    } finally {
      setIsAiLoading(false);
    }
  };

  return (
    <div className="app-container" style={{ backgroundColor: '#1A1B23' }}>
      {/* Header */}
      <header className="header" style={{ backgroundColor: '#1A1B23' }}>
        <button className="back-btn" onClick={() => navigate(-1)}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <h1 className="header-title" style={{ color: '#FFFFFF' }}>숙제 평가하기</h1>
        <div style={{width: '24px'}}></div>
      </header>

      {/* Main Content */}
      <main className="content-list evaluate-content" style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
        <div className="student-info" style={{ marginBottom: '16px', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2>{hw.studentName} 학생의 제출물</h2>
            <p style={{ color: '#888', fontSize: '14px' }}>{hw.title} - 총 {totalQuestions}문제 중 {submittedProblems.length}문제 제출</p>
          </div>
          <button 
            onClick={() => setIsBulkAiModalOpen(true)}
            style={{
              padding: '10px 16px', backgroundColor: '#2563EB', color: '#FFFFFF', 
              border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '6px'
            }}
          >
            🤖 일괄 자동 채점
          </button>
        </div>

        <div className="problems-viewer" style={{ flex: 1, overflowY: 'auto', marginBottom: '24px' }}>
          {sortedProblems.length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
              {sortedProblems.map(p => {
                const label = groupLabelMap[p.groupId] || '';
                return (
                  <div key={`${p.groupId}-${p.problemNumber}`} style={{ backgroundColor: '#111', borderRadius: '12px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ padding: '8px', backgroundColor: '#333', color: '#fff', fontSize: '14px', textAlign: 'center' }}>
                      {label ? `[${label}] ` : ''}{p.problemNumber}번
                    </div>
                    <img 
                      src={formatDriveImageUrl(p.imageUrl)} 
                      alt={`${label} ${p.problemNumber}번 제출`} 
                      referrerPolicy="no-referrer"
                      crossOrigin="anonymous"
                      style={{ width: '100%', height: '150px', objectFit: 'contain', backgroundColor: '#fff', cursor: 'pointer' }} 
                      onClick={() => window.open(formatDriveImageUrl(p.imageUrl), '_blank')} 
                      onError={(e) => {
                        if (p.imageUrl && (p.imageUrl.includes('drive.google.com') || p.imageUrl.includes('googleusercontent.com'))) {
                          const match = p.imageUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/) ||
                                        p.imageUrl.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) ||
                                        p.imageUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
                          if (match && match[1]) {
                            const fileId = match[1];
                            if (!e.target.src.includes('thumbnail?id=')) {
                              e.target.src = `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`;
                              return;
                            } else if (!e.target.src.includes('uc?export=view')) {
                              e.target.src = `https://drive.google.com/uc?export=view&id=${fileId}`;
                              return;
                            }
                          }
                        }
                        if (e.target.src !== p.imageUrl) {
                          e.target.src = p.imageUrl;
                        }
                      }}
                    />
                    <button
                      onClick={() => handleAiAnalyzeOpen(p)}
                      style={{
                        padding: '8px',
                        backgroundColor: '#673AB7',
                        color: 'white',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '4px'
                      }}
                    >
                      🤖 AI 풀이 분석
                    </button>
                    <div style={{ display: 'flex', borderTop: '1px solid #333' }}>
                      <button 
                        onClick={() => evaluateSingleProblem(id, p.groupId, p.problemNumber, true)}
                        style={{ 
                          flex: 1, 
                          padding: '12px', 
                          backgroundColor: p.status === 'correct' ? '#1A3320' : 'transparent', 
                          border: 'none', 
                          borderRight: '1px solid #333',
                          color: p.status === 'correct' ? '#4CAF50' : '#888',
                          cursor: 'pointer',
                          fontWeight: 'bold',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '4px'
                        }}
                      >
                        O 정답
                        {p.status === 'correct' && p.attempts > 1 && (
                          <span style={{ fontSize: '10px', color: '#888' }}>({p.attempts}회 시도)</span>
                        )}
                      </button>
                      <button 
                        onClick={() => evaluateSingleProblem(id, p.groupId, p.problemNumber, false)}
                        style={{ 
                          flex: 1, 
                          padding: '12px', 
                          backgroundColor: p.status === 'incorrect' ? '#331A1A' : 'transparent', 
                          border: 'none', 
                          color: p.status === 'incorrect' ? '#F44336' : '#888',
                          cursor: 'pointer',
                          fontWeight: 'bold'
                        }}
                      >
                        X 오답
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ color: '#555', textAlign: 'center', marginTop: '40px' }}>제출된 이미지가 없습니다.</div>
          )}
        </div>

        <div className="evaluation-panel" style={{ backgroundColor: '#202129', padding: '20px', borderRadius: '16px' }}>
          <h3 style={{ color: '#fff', marginBottom: '16px', fontSize: '16px' }}>전체 종합 평가 (완료 시 제출)</h3>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
            <button 
              className={`tag ${evaluationType === 'check' ? 'active-eval' : ''}`}
              onClick={() => setEvaluationType('check')}
              style={{ cursor: 'pointer', border: evaluationType === 'check' ? '1px solid #3B82F6' : 'none' }}
            >
              통과(체크)
            </button>
            <button 
              className={`tag ${evaluationType === 'stars' ? 'active-eval' : ''}`}
              onClick={() => setEvaluationType('stars')}
              style={{ cursor: 'pointer', border: evaluationType === 'stars' ? '1px solid #3B82F6' : 'none' }}
            >
              별점 부여
            </button>
          </div>

          {evaluationType === 'stars' && (
            <div style={{ marginBottom: '16px', display: 'flex', gap: '8px' }}>
              {[1, 2, 3].map(s => (
                <button 
                  key={s}
                  onClick={() => setStars(s)}
                  style={{ background: 'none', border: 'none', color: stars >= s ? '#3B82F6' : '#444', fontSize: '24px', cursor: 'pointer' }}
                >
                  ★
                </button>
              ))}
            </div>
          )}

          <button 
            className="submit-btn active"
            onClick={handleEvaluate}
            style={{ width: '100%', maxWidth: 'none' }}
          >
            평가 완료 및 전송
          </button>
        </div>
      </main>

      {/* Bulk AI 채점 모달 */}
      {isBulkAiModalOpen && (
        <div className="modal-overlay" style={{ zIndex: 1000 }}>
          <div className="modal-content" style={{ maxWidth: '400px' }}>
            <h3 style={{ marginTop: 0, marginBottom: '16px', color: '#A8A8FF' }}>
              🤖 일괄 자동 채점
            </h3>
            <p style={{ fontSize: '13px', color: '#ccc', marginBottom: '16px', lineHeight: '1.4' }}>
              노트북LM이나 제미나이에서 받아온 <strong>틀린 문제 번호</strong>를 쉼표로 구분해 입력해주세요.<br/>
              <span style={{color: '#888'}}>(예: 7, 9, 12) *입력하지 않은 나머지 문제는 모두 자동 정답(O) 처리됩니다.</span>
            </p>
            
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', color: '#aaa' }}>틀린 번호</label>
              <input 
                type="text" 
                value={wrongNumbersInput}
                onChange={(e) => setWrongNumbersInput(e.target.value)}
                className="modal-input"
                placeholder="예: 7, 9, 12"
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', color: '#aaa' }}>전체 피드백 (선택)</label>
              <textarea 
                value={bulkFeedback}
                onChange={(e) => setBulkFeedback(e.target.value)}
                className="modal-input"
                placeholder="AI가 작성한 전체 평가 코멘트를 붙여넣으세요..."
                style={{ minHeight: '100px', resize: 'vertical', fontSize: '14px', lineHeight: '1.5' }}
              />
            </div>
            
            <div className="modal-buttons" style={{ marginTop: '20px' }}>
              <button 
                className="modal-btn cancel" 
                onClick={() => setIsBulkAiModalOpen(false)}
              >
                닫기
              </button>
              <button 
                className="modal-btn confirm" 
                onClick={handleBulkAiGrade}
                style={{ backgroundColor: '#A8A8FF', color: '#000', display: 'flex', justifyContent: 'center', alignItems: 'center' }}
              >
                자동 적용
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 개별 AI 분석 모달 */}
      {isAiModalOpen && currentAiProblem && (
        <div className="modal-overlay" style={{ zIndex: 1000 }}>
          <div className="modal-content" style={{ maxWidth: '500px' }}>
            <h3 style={{ marginTop: 0, marginBottom: '16px', color: '#673AB7', display: 'flex', alignItems: 'center', gap: '8px' }}>
              🤖 AI 풀이 분석 ({currentAiProblem.problemNumber}번)
            </h3>

            {!isAiLoading && !aiFeedbackText && (
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', color: '#aaa' }}>추가 요청사항/세부사항 (선택)</label>
                <textarea 
                  value={aiCustomDetails}
                  onChange={(e) => setAiCustomDetails(e.target.value)}
                  className="modal-input"
                  placeholder="예: '계산 실수를 집중적으로 찾아줘', '개념 위주로 설명해줘'"
                  style={{ minHeight: '80px', resize: 'vertical', fontSize: '14px', lineHeight: '1.5' }}
                />
              </div>
            )}
            
            {(isAiLoading || aiFeedbackText) && (
              <div style={{
                backgroundColor: '#1A1B23', 
                padding: '16px', 
                borderRadius: '8px', 
                minHeight: '150px',
                maxHeight: '300px',
                overflowY: 'auto',
                color: '#ddd',
                fontSize: '14px',
                lineHeight: '1.6',
                whiteSpace: 'pre-wrap'
              }}>
                {isAiLoading ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '12px' }}>
                    <div className="spinner" style={{ width: '30px', height: '30px', border: '3px solid #333', borderTop: '3px solid #673AB7', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
                    <span style={{ color: '#888' }}>수식과 풀이를 분석하고 있습니다...</span>
                  </div>
                ) : (
                  aiFeedbackText
                )}
              </div>
            )}
            
            <div className="modal-buttons" style={{ marginTop: '20px' }}>
              <button 
                className="modal-btn cancel" 
                onClick={() => setIsAiModalOpen(false)}
              >
                닫기
              </button>
              {!isAiLoading && !aiFeedbackText && (
                <button 
                  className="modal-btn confirm" 
                  onClick={handleAiAnalyzeExecute}
                  style={{ backgroundColor: '#673AB7', color: 'white' }}
                >
                  분석 시작
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
