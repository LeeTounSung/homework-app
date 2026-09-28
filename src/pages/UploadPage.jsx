import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useHomework } from '../context/HomeworkContext';
import MathInkComponent from '../components/MathInkComponent';
import ProblemStatementView from '../components/ProblemStatementView';
import { autoGradeProblemSubmission } from '../utils/gemini';

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

  // Prepend BASE_URL for relative paths (e.g., /problem_images/... or problem_images/...)
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    const base = (import.meta.env.BASE_URL || '/').replace(/\/$/, '');
    const cleanPath = url.startsWith('/') ? url : `/${url}`;
    if (base && !cleanPath.startsWith(base + '/')) {
      return `${base}${cleanPath}`;
    }
    return cleanPath;
  }

  return url;
};

const formatGroupLabel = (label) => {
  if (!label || typeof label !== 'string') return label;
  if (label.includes('번호:')) return label;
  return label.replace(/-?\[(\d+~\d+|\d+)\]$/, '-[번호:$1]');
};

export default function UploadPage() {
  const navigate = useNavigate();
  const { id, groupId, problemId } = useParams();
  const { getHomeworkById, submitHomeworkProblem, exemptProblem, toggleBookmarkProblem, isSaving, getProblemImageFromDrive, geminiApiKey, aiConfig, isAiConfigured } = useHomework();
  const [imagePreview, setImagePreview] = useState(null);
  const [aiFeedback, setAiFeedback] = useState('');
  const [aiGrade, setAiGrade] = useState('');
  const [isAiGrading, setIsAiGrading] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [driveImageUrl, setDriveImageUrl] = useState(null);
  const [problemHistory, setProblemHistory] = useState([]);
  const [isBookmarked, setIsBookmarked] = useState(false);
  
  // Image Zoom Lightbox State
  const [zoomModalImage, setZoomModalImage] = useState(null);
  const [zoomScale, setZoomScale] = useState(1);
  
  // MathInk State
  const [useMathType, setUseMathType] = useState(false);
  const problemTextRef = useRef(null);
  
  const hw = getHomeworkById(id);

  // MathJax typesetting for problem statement
  useEffect(() => {
    if (window.MathJax && window.MathJax.typesetPromise && problemTextRef.current) {
      window.MathJax.typesetPromise([problemTextRef.current]).catch(err => console.warn(err));
    }
  }, [problemId, hw]);

  // Find the group label
  let groupLabel = '';
  if (hw && hw.problemGroups) {
    const group = hw.problemGroups.find(g => g.groupId === groupId);
    if (group) groupLabel = formatGroupLabel(group.label);
  }
  const cleanLabel = groupLabel && groupLabel !== '문제' 
    ? (groupLabel.startsWith('[') ? `${groupLabel} ` : `[${groupLabel}] `) 
    : '';

  useEffect(() => {
    if (hw) {
      const existingProblem = (hw.submittedProblems || []).find(
        p => p.groupId === groupId && p.problemNumber === parseInt(problemId)
      );
      if (existingProblem) {
        if (existingProblem.imageUrl && existingProblem.status !== 'exempt') {
          setImagePreview(existingProblem.imageUrl);
        }
        if (existingProblem.aiFeedback) {
          setAiFeedback(existingProblem.aiFeedback);
        }
        if (existingProblem.history) {
          setProblemHistory(existingProblem.history);
        }
        if (existingProblem.isBookmarked) {
          setIsBookmarked(true);
        }
        if (existingProblem.aiGrade) {
          setAiGrade(existingProblem.aiGrade);
        } else if (existingProblem.status === 'correct') {
          setAiGrade('⭕ 정답');
        } else if (existingProblem.status === 'incorrect') {
          setAiGrade('❌ 오답');
        }
      }
      
      if (hw.problemImagesBaseUrl) {
        const isGoogleDrive = hw.problemImagesBaseUrl.includes('drive.google.com');
        if (isGoogleDrive && getProblemImageFromDrive) {
          getProblemImageFromDrive(hw.problemImagesBaseUrl, `${problemId}.png`)
            .then(res => {
              if (res && res.success) {
                setDriveImageUrl(res.url);
                setImageError(false);
              } else {
                setErrorMessage(res ? res.error : '서버 통신 실패');
                setImageError(true);
              }
            })
            .catch(err => {
              console.error("Problem image fetch error:", err);
              setErrorMessage('이미지 로딩 중 오류');
              setImageError(true);
            });
        } else {
          const rawUrl = `${hw.problemImagesBaseUrl.replace(/\/$/, '')}/${problemId}.png`;
          setDriveImageUrl(formatDriveImageUrl(rawUrl));
          setImageError(false);
        }
      }
    }
  }, [hw, groupId, problemId, getProblemImageFromDrive]);



  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const convertToBase64Image = (url) => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "Anonymous"; 
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(img.width + 40, 300); // Add padding, ensure minimum width
        canvas.height = Math.max(img.height + 40, 150);
        const ctx = canvas.getContext('2d');
        
        // Fill white background (because JPEG doesn't support transparency)
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Center the image
        const x = (canvas.width - img.width) / 2;
        const y = (canvas.height - img.height) / 2;
        ctx.drawImage(img, x, y);
        
        resolve(canvas.toDataURL('image/jpeg', 0.9));
      };
      img.onerror = (e) => reject(new Error('Image load failed'));
      img.src = url;
    });
  };

  const handleAiAutoGrade = async () => {
    if (!imagePreview) {
      alert("먼저 사진을 첨부하거나 수식을 직접 입력해주세요.");
      return;
    }

    if (!isAiConfigured && !geminiApiKey) {
      alert("AI API 키가 설정되지 않았습니다. 관리자 페이지 환경 설정에서 AI(Meta Muse Spark, DeepSeek, Gemini) API 키를 먼저 입력해주세요.");
      return;
    }

    setIsAiGrading(true);
    try {
      const desc = `${hw.studentName} 학생의 ${hw.title} ${groupLabel ? `[${groupLabel}] ` : ''}${problemId}번 문제 풀이입니다.`;
      const result = await autoGradeProblemSubmission(aiConfig || geminiApiKey, desc, imagePreview);
      
      setAiFeedback(result);

      // Auto detect grade status
      if (result.includes('⭕') || result.includes('정답')) {
        setAiGrade('⭕ 정답');
      } else if (result.includes('❌') || result.includes('오답')) {
        setAiGrade('❌ 오답');
      } else if (result.includes('🔺') || result.includes('부분')) {
        setAiGrade('🔺 부분 정답');
      } else {
        setAiGrade('⭕ 정답');
      }
    } catch (err) {
      console.error(err);
      alert(`AI 채점 중 오류가 발생했습니다: ${err.message}`);
    } finally {
      setIsAiGrading(false);
    }
  };

  const handleSubmit = async () => {
    let finalData = imagePreview;
    
    if (!finalData) {
      alert("제출할 풀이 사진 또는 직접 입력한 수식이 없습니다.");
      return;
    }

    await submitHomeworkProblem(id, groupId, problemId, finalData, aiFeedback, aiGrade, null);
    navigate(-1);
  };

  const handleExempt = () => {
    if (window.confirm('이 문제는 풀지 않아도 되는 문제로 표시할까요? (진행률 계산에서 제외됩니다)')) {
      exemptProblem(id, groupId, problemId);
      navigate(-1);
    }
  };

  if (!hw) return <div style={{color: 'white', padding: '20px'}}>숙제를 찾을 수 없습니다.</div>;

  return (
    <div className="app-container" style={{ position: 'relative' }}>
      {isSaving && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 9999,
          display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center'
        }}>
          <div className="spinner" style={{ width: '40px', height: '40px', border: '4px solid #333', borderTop: '4px solid #FFD700', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
          <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
          <p style={{ color: '#FFD700', marginTop: '16px', fontWeight: 'bold' }}>저장 중...</p>
        </div>
      )}
      
      {/* Header */}
      <header className="header">
        <button className="back-btn" onClick={() => navigate(-1)}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <h1 className="header-title">{cleanLabel}{problemId}번 제출</h1>
        <div style={{width: '24px'}}></div> {/* Spacer for centering */}
      </header>

      {/* Main Content */}
      <main className="content-list upload-content">
        <div className="upload-instruction" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h2 style={{ margin: 0 }}>{cleanLabel}{problemId}번 문제 풀이</h2>
            <p style={{ margin: '4px 0 0 0' }}>{hw.title} · {hw.studentName}</p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              onClick={() => {
                const nextState = !isBookmarked;
                toggleBookmarkProblem(id, groupId, problemId);
                setIsBookmarked(nextState);
                if (nextState) {
                  alert("📌 이 문제가 [문제] 보관함에 등록되었습니다!\n홈 화면의 [문제] 탭에서 언제든 다시 풀고 복습할 수 있습니다.");
                }
              }}
              style={{
                padding: '6px 14px',
                borderRadius: '20px',
                border: isBookmarked ? '1px solid #FFD700' : '1px solid #555',
                backgroundColor: isBookmarked ? '#3A3215' : '#222',
                color: isBookmarked ? '#FFD700' : '#aaa',
                fontSize: '12px',
                fontWeight: 'bold',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                whiteSpace: 'nowrap',
                transition: 'all 0.2s'
              }}
            >
              <span>{isBookmarked ? '⭐️ 보관됨 (문제 보관함)' : '☆ 문제 보관'}</span>
            </button>

            {/* Red box location: Touch to zoom hint */}
            {driveImageUrl && !imageError && (
              <div 
                onClick={() => {
                  setZoomModalImage(formatDriveImageUrl(driveImageUrl));
                  setZoomScale(1);
                }}
                style={{
                  padding: '6px 14px',
                  borderRadius: '20px',
                  border: '1px solid #735914',
                  backgroundColor: '#262215',
                  color: '#FFD700',
                  fontSize: '12px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.2s'
                }}
                title="클릭하여 고화질 확대"
              >
                <span>🔍 터치하면 고화질 확대</span>
              </div>
            )}
          </div>
        </div>

        {imageError && errorMessage && (
          <div style={{ marginBottom: '16px', textAlign: 'center', backgroundColor: '#332222', color: '#ffaaaa', borderRadius: '12px', padding: '16px' }}>
            <p>이미지 불러오기 실패: {errorMessage}</p>
          </div>
        )}

        {/* Problem Image & Submitted Answer Cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '20px' }}>
          {/* Problem Image Card */}
          {driveImageUrl && !imageError && (
            <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', padding: '16px', textAlign: 'center', boxShadow: '0 4px 10px rgba(0,0,0,0.3)' }}>
              <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#1565C0', marginBottom: '10px', textAlign: 'left' }}>
                <span>📌 [문제] {cleanLabel}{problemId}번</span>
              </div>
              
              <div 
                style={{ 
                  width: '100%', 
                  overflow: 'hidden', 
                  borderRadius: '8px',
                  cursor: 'zoom-in',
                  backgroundColor: '#ffffff'
                }}
                onClick={() => {
                  setZoomModalImage(formatDriveImageUrl(driveImageUrl));
                  setZoomScale(1);
                }}
              >
                <img 
                  src={formatDriveImageUrl(driveImageUrl)} 
                  alt={`문제 ${problemId}번`} 
                  referrerPolicy="no-referrer"
                  crossOrigin="anonymous"
                  style={{ width: '100%', height: 'auto', display: 'block', margin: '0 auto', borderRadius: '8px' }} 
                  onError={(e) => {
                    if (driveImageUrl.includes('drive.google.com') || driveImageUrl.includes('googleusercontent.com')) {
                      const match = driveImageUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/) ||
                                    driveImageUrl.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) ||
                                    driveImageUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
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
                    setImageError(true);
                    setErrorMessage('이미지 링크에 접근할 수 없습니다.');
                  }}
                />
              </div>
            </div>
          )}

          {/* Problem Statement Card (Text / LaTeX from problemDetails) - Only shown if no image or image error */}
          {(!driveImageUrl || imageError) && hw.problemDetails && (hw.problemDetails[problemId] || hw.problemDetails[String(problemId)]) && (
            <div style={{ backgroundColor: '#ffffff', color: '#111', borderRadius: '12px', padding: '18px', boxShadow: '0 4px 12px rgba(0,0,0,0.3)', border: '1px solid #E0E0E0' }}>
              <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#1565C0', marginBottom: '10px', textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>📌 [문제 {problemId}번] {cleanLabel}{(hw.problemDetails[problemId] || hw.problemDetails[String(problemId)]).concept || ''}</span>
                {(hw.problemDetails[problemId] || hw.problemDetails[String(problemId)]).level && (
                  <span style={{ fontSize: '11px', backgroundColor: '#FFF3E0', color: '#E65100', padding: '2px 8px', borderRadius: '10px', fontWeight: 'bold' }}>
                    Level {(hw.problemDetails[problemId] || hw.problemDetails[String(problemId)]).level}
                  </span>
                )}
              </div>
              <ProblemStatementView 
                statement={(hw.problemDetails[problemId] || hw.problemDetails[String(problemId)]).statement} 
              />
              {(hw.problemDetails[problemId] || hw.problemDetails[String(problemId)]).image && (
                <div style={{ marginTop: '16px', textAlign: 'center', backgroundColor: '#fcfcfc', padding: '16px', borderRadius: '8px', border: '1px solid #ECEFF1' }}>
                  <img 
                    src={(hw.problemDetails[problemId] || hw.problemDetails[String(problemId)]).image} 
                    alt="문제 도형 그래프"
                    style={{ maxWidth: '100%', maxHeight: '380px', objectFit: 'contain', display: 'block', margin: '0 auto' }} 
                  />
                  <div style={{ fontSize: '11px', color: '#888', marginTop: '6px' }}>📐 [TikZ 벡터 도형 그래프]</div>
                </div>
              )}
            </div>
          )}

          {/* Submitted Answer Card (Rendered clearly with the problem) */}
          {imagePreview && (
            <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', padding: '16px', textAlign: 'center', boxShadow: '0 4px 10px rgba(0,0,0,0.3)', border: '2px solid #FFD700' }}>
              <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#111', marginBottom: '10px', textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>✍️ [내 풀이 / 정답 미리보기]</span>
                <button
                  type="button"
                  onClick={() => {
                    setZoomModalImage(formatDriveImageUrl(imagePreview));
                    setZoomScale(1);
                  }}
                  style={{
                    background: '#333',
                    color: '#fff',
                    border: '1px solid #666',
                    borderRadius: '16px',
                    padding: '4px 10px',
                    fontSize: '11px',
                    cursor: 'pointer'
                  }}
                >
                  🔍 크게 보기
                </button>
              </div>

              <div 
                style={{ width: '100%', overflow: 'hidden', borderRadius: '8px', cursor: 'zoom-in', backgroundColor: '#ffffff' }}
                onClick={() => {
                  setZoomModalImage(formatDriveImageUrl(imagePreview));
                  setZoomScale(1);
                }}
              >
                <img 
                  src={formatDriveImageUrl(imagePreview)} 
                  alt="제출한 풀이 미리보기" 
                  referrerPolicy="no-referrer"
                  crossOrigin="anonymous"
                  style={{ width: '100%', height: 'auto', display: 'block', margin: '0 auto', borderRadius: '8px' }} 
                  onError={(e) => {
                    if (imagePreview.includes('drive.google.com') || imagePreview.includes('googleusercontent.com')) {
                      const match = imagePreview.match(/[?&]id=([a-zA-Z0-9_-]+)/) ||
                                    imagePreview.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) ||
                                    imagePreview.match(/\/d\/([a-zA-Z0-9_-]+)/);
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
                    if (e.target.src !== imagePreview) {
                      e.target.src = imagePreview;
                    }
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Existing AI Feedback if any */}
        {aiFeedback && (
          <div style={{ 
            backgroundColor: aiFeedback.includes('채점 불가') || aiFeedback.includes('🔺') ? '#152E20' : (aiGrade?.includes('오답') ? '#35181C' : '#14253B'),
            borderLeft: `4px solid ${aiFeedback.includes('채점 불가') || aiFeedback.includes('🔺') ? '#81C784' : (aiGrade?.includes('오답') ? '#EF5350' : '#42A5F5')}`, 
            padding: '16px', 
            borderRadius: '0 8px 8px 0', 
            marginBottom: '20px' 
          }}>
            <h3 style={{ 
              color: aiFeedback.includes('채점 불가') || aiFeedback.includes('🔺') ? '#A5D6A7' : (aiGrade?.includes('오답') ? '#EF9A9A' : '#90CAF9'), 
              marginTop: 0, 
              marginBottom: '8px', 
              fontSize: '14px', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '6px' 
            }}>
              🤖 AI 채점 및 피드백 {aiFeedback.includes('채점 불가') || aiFeedback.includes('🔺') ? '(🔺 채점 불가 / 확인 필요)' : (aiGrade ? `(${aiGrade})` : '')}
            </h3>
            <p style={{ color: '#ECEFF1', margin: 0, fontSize: '14px', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>
              {aiFeedback}
            </p>
          </div>
        )}

        {/* Problem Attempt History Timeline */}
        {problemHistory && problemHistory.length > 1 && (
          <div style={{ backgroundColor: '#181A22', border: '1px solid #333', borderRadius: '8px', padding: '14px', marginBottom: '20px' }}>
            <h4 style={{ margin: '0 0 10px 0', color: '#FFD700', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              📜 누적 풀이 및 오답 히스토리 ({problemHistory.length}회 기록)
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {problemHistory.map((h, hIdx) => (
                <div 
                  key={hIdx} 
                  style={{ 
                    backgroundColor: '#222530', 
                    borderRadius: '6px', 
                    padding: '10px 12px', 
                    borderLeft: `3px solid ${h.status === 'correct' ? '#1E88E5' : '#E53935'}` 
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <span style={{ fontWeight: 'bold', fontSize: '12px', color: h.status === 'correct' ? '#90CAF9' : '#EF9A9A' }}>
                      {h.attempt || hIdx + 1}회차 제출 ({h.status === 'correct' ? '⭕ 정답' : '❌ 오답'})
                    </span>
                    <span style={{ fontSize: '11px', color: '#888' }}>{h.date}</span>
                  </div>
                  {h.aiFeedback && (
                    <p style={{ margin: 0, fontSize: '12px', color: '#bbb', whiteSpace: 'pre-wrap', lineHeight: '1.4' }}>
                      {h.aiFeedback.length > 120 ? `${h.aiFeedback.slice(0, 120)}...` : h.aiFeedback}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}


        {/* Toggle MathType / Image Upload */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
          <label 
            htmlFor="hw-upload"
            style={{ 
              flex: 1, padding: '14px', borderRadius: '8px', border: '1px solid #444', 
              backgroundColor: '#FFD700',
              color: '#000000',
              fontWeight: 'bold', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
              fontSize: '15px'
            }}
          >
            📸 사진 첨부 / 촬영
          </label>
          <input 
            id="hw-upload" 
            type="file" 
            accept="image/*" 
            capture="environment"
            onChange={handleImageChange}
            style={{ display: 'none' }}
          />

          <button 
            onClick={() => setUseMathType(true)}
            style={{ 
              flex: 1, padding: '14px', borderRadius: '8px', border: '1px solid #444', 
              backgroundColor: '#202129',
              color: '#ffffff',
              fontWeight: 'bold', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
              fontSize: '15px'
            }}
          >
            ✍️ 수식 직접 입력
          </button>
        </div>

        {useMathType && (
          <MathInkComponent 
            geminiApiKey={geminiApiKey}
            aiConfig={aiConfig}
            onInsert={(img) => { setImagePreview(img); setUseMathType(false); }} 
            onCancel={() => setUseMathType(false)} 
          />
        )}

        <div className="submit-container" style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px' }}>
          <button 
            className={`submit-btn ${(imagePreview) ? 'active' : ''}`}
            onClick={handleSubmit}
            disabled={!imagePreview}
          >
            저장하기
          </button>
          
          <button 
            onClick={handleExempt}
            style={{
              padding: '16px',
              backgroundColor: 'transparent',
              border: '1px solid #555',
              borderRadius: '12px',
              color: '#888',
              fontSize: '16px',
              fontWeight: 'bold',
              cursor: 'pointer'
            }}
          >
            풀지 않아도 되는 문제 (제외하기)
          </button>
        </div>
      </main>

      {/* Full-Screen Zoom Lightbox Modal */}
      {zoomModalImage && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.94)',
            zIndex: 99999,
            display: 'flex',
            flexDirection: 'column',
            backdropFilter: 'blur(6px)'
          }}
        >
          {/* Zoom Modal Header */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '12px 18px',
            backgroundColor: 'rgba(25, 25, 25, 0.98)',
            borderBottom: '1px solid #333',
            flexWrap: 'wrap',
            gap: '8px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ color: '#FFD700', fontWeight: 'bold', fontSize: '15px' }}>🔍 문제 고화질 확대보기</span>
              <span style={{ color: '#aaa', fontSize: '13px' }}>({Math.round(zoomScale * 100)}%)</span>
            </div>

            {/* Controls */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <button
                type="button"
                onClick={() => setZoomScale(prev => Math.max(0.5, prev - 0.25))}
                style={{
                  background: '#333',
                  color: '#fff',
                  border: '1px solid #555',
                  borderRadius: '6px',
                  padding: '6px 12px',
                  fontSize: '13px',
                  fontWeight: 'bold',
                  cursor: 'pointer'
                }}
              >
                ➖ 축소
              </button>

              <button
                type="button"
                onClick={() => setZoomScale(1)}
                style={{
                  background: '#333',
                  color: '#FFD700',
                  border: '1px solid #555',
                  borderRadius: '6px',
                  padding: '6px 10px',
                  fontSize: '12px',
                  cursor: 'pointer'
                }}
              >
                100%
              </button>

              <button
                type="button"
                onClick={() => setZoomScale(prev => Math.min(3.5, prev + 0.25))}
                style={{
                  background: '#FFD700',
                  color: '#000',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '6px 12px',
                  fontSize: '13px',
                  fontWeight: 'bold',
                  cursor: 'pointer'
                }}
              >
                ➕ 확대
              </button>

              <button
                type="button"
                onClick={() => setZoomModalImage(null)}
                style={{
                  background: '#E53935',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '6px 14px',
                  fontSize: '13px',
                  fontWeight: 'bold',
                  marginLeft: '6px',
                  cursor: 'pointer'
                }}
              >
                ✖️ 닫기
              </button>
            </div>
          </div>

          {/* Zoom Modal Content */}
          <div 
            style={{
              flex: 1,
              overflow: 'auto',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              padding: '16px',
              cursor: zoomScale > 1 ? 'grab' : 'default'
            }}
            onClick={(e) => {
              if (e.target.tagName !== 'IMG' && e.target.tagName !== 'BUTTON') {
                setZoomModalImage(null);
              }
            }}
          >
            <img 
              src={zoomModalImage} 
              alt="확대 이미지"
              referrerPolicy="no-referrer"
              crossOrigin="anonymous"
              style={{
                transform: `scale(${zoomScale})`,
                transformOrigin: 'center center',
                transition: 'transform 0.15s ease-out',
                maxWidth: zoomScale <= 1 ? '96vw' : 'none',
                maxHeight: zoomScale <= 1 ? '85vh' : 'none',
                borderRadius: '8px',
                boxShadow: '0 8px 30px rgba(0,0,0,0.9)'
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
