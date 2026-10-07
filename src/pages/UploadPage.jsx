import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useHomework } from '../context/HomeworkContext';
import MathInkComponent from '../components/MathInkComponent';
import ProblemStatementView from '../components/ProblemStatementView';
import { autoGradeProblemSubmission, extractStudentMathToLatex, checkMathEquivalenceWithAI, normalizeChoiceNumber } from '../utils/gemini';

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
    const fullPath = (base && !cleanPath.startsWith(base + '/')) ? `${base}${cleanPath}` : cleanPath;
    try {
      return encodeURI(decodeURI(fullPath)).replace(/\[/g, '%5B').replace(/\]/g, '%5D');
    } catch {
      return encodeURI(fullPath).replace(/\[/g, '%5B').replace(/\]/g, '%5D');
    }
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
  const { getHomeworkById, submitHomeworkProblem, exemptProblem, toggleBookmarkProblem, isSaving, getProblemImageFromDrive, geminiApiKey, aiConfig, isAiConfigured, isAdmin } = useHomework();
  const [imagePreview, setImagePreview] = useState(null);
  const [studentAnswer, setStudentAnswer] = useState('');
  const [isExtractingLatex, setIsExtractingLatex] = useState(false);
  const [aiFeedback, setAiFeedback] = useState('');
  const [aiGrade, setAiGrade] = useState('');
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
  const latexPreviewRef = useRef(null);
  
  const hw = getHomeworkById(id);

  // MathJax typesetting for problem statement & student latex answer
  useEffect(() => {
    if (window.MathJax && window.MathJax.typesetPromise && problemTextRef.current) {
      window.MathJax.typesetPromise([problemTextRef.current]).catch(err => console.warn(err));
    }
  }, [problemId, hw]);

  useEffect(() => {
    if (window.MathJax && window.MathJax.typesetPromise && latexPreviewRef.current) {
      window.MathJax.typesetPromise([latexPreviewRef.current]).catch(err => console.warn(err));
    }
  }, [studentAnswer]);

  // Extract clean sub-unit or chapter from group label (without textbook/출처 tags)
  const extractSubUnit = (label) => {
    if (!label || typeof label !== 'string') return '';
    const matches = [...label.matchAll(/\[([^\]]+)\]/g)].map(m => m[1]);
    if (matches.length >= 3) {
      const page = matches.find(m => m.startsWith('p.') || m.includes('p.'));
      const range = matches.find(m => m.startsWith('번호:') || /^\d+~\d+$/.test(m));
      const contentSegments = matches.filter(m => 
        m !== matches[0] && 
        m !== page && 
        m !== range
      );
      return contentSegments.length > 0 ? contentSegments[contentSegments.length - 1] : matches[0];
    }
    if (matches.length === 2 && !matches[1].startsWith('번호:')) {
      return matches[1];
    }
    return '';
  };

  const currentGroup = hw?.problemGroups?.find(g => g.groupId === groupId);
  const subUnit = currentGroup ? extractSubUnit(currentGroup.label) : '';
  const cleanTitle = hw?.title ? hw.title.replace(/^\[[^\]]+\]\s*/, '') : '';
  const subtitleText = [subUnit, cleanTitle, hw?.studentName].filter(Boolean).join(' · ');

  useEffect(() => {
    if (hw) {
      const existingProblem = (hw.submittedProblems || []).find(
        p => p.groupId === groupId && p.problemNumber === parseInt(problemId)
      );
      if (existingProblem) {
        if (existingProblem.studentAnswer) {
          setStudentAnswer(existingProblem.studentAnswer);
        }
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
      
      const currentGroup = hw.problemGroups?.find(g => g.groupId === groupId);
      const imagesBaseUrl = currentGroup?.problemImagesBaseUrl || hw.problemImagesBaseUrl;
      if (imagesBaseUrl) {
        const isGoogleDrive = imagesBaseUrl.includes('drive.google.com');
        if (isGoogleDrive && getProblemImageFromDrive) {
          getProblemImageFromDrive(imagesBaseUrl, `${problemId}.png`)
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
          const rawUrl = `${imagesBaseUrl.replace(/\/$/, '')}/${problemId}.png`;
          setDriveImageUrl(formatDriveImageUrl(rawUrl));
          setImageError(false);
        }
      }
    }
  }, [hw, groupId, problemId, getProblemImageFromDrive]);

  // Extract student handwriting/math from image to LaTeX using Gemini 2.5 Flash-Lite
  const handleExtractLatex = async (imageInput) => {
    const targetImg = imageInput || imagePreview;
    if (!targetImg) return;

    setIsExtractingLatex(true);
    try {
      const activeGeminiKey = geminiApiKey || (aiConfig && aiConfig.geminiApiKey) || '';
      const activeOrKey = (aiConfig && aiConfig.openrouterApiKey) || '';
      const extracted = await extractStudentMathToLatex(activeGeminiKey, targetImg, activeOrKey);
      if (extracted && extracted.trim()) {
        setStudentAnswer(extracted.trim());
      }
    } catch (err) {
      console.warn("손글씨 수식(LaTeX) 자동 변환 실패:", err);
    } finally {
      setIsExtractingLatex(false);
    }
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result;
        setImagePreview(base64);
        handleExtractLatex(base64);
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

  const handleSubmit = async () => {
    let finalData = imagePreview;
    
    if (!finalData && !studentAnswer) {
      alert("제출할 풀이 사진 또는 직접 입력한 수식이 없습니다.");
      return;
    }

    // 채점은 개별 문제 제출 시 실시간으로 하지 않고, 모든 문제 제출 후 [채점하기]로 일괄 진행합니다.
    await submitHomeworkProblem(id, groupId, problemId, finalData, null, null, studentAnswer);
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
        <h1 className="header-title">{problemId}번 제출</h1>
        <div style={{width: '24px'}}></div> {/* Spacer for centering */}
      </header>

      {/* Main Content */}
      <main className="content-list upload-content">
        <div className="upload-instruction" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h2 style={{ margin: 0 }}>{problemId}번 문제 풀이</h2>
            <p style={{ margin: '4px 0 0 0', color: '#aaa', fontSize: '13px' }}>{subtitleText}</p>
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
                border: isBookmarked ? '1px solid #3B82F6' : '1px solid #555',
                backgroundColor: isBookmarked ? '#1E293B' : '#222',
                color: isBookmarked ? '#60A5FA' : '#aaa',
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
                  border: '1px solid #3B82F6',
                  backgroundColor: '#1E293B',
                  color: '#60A5FA',
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
                <span>📌 [문제] {problemId}번</span>
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
                <span>📌 [문제 {problemId}번]{(hw.problemDetails[problemId] || hw.problemDetails[String(problemId)]).concept ? ` · ${(hw.problemDetails[problemId] || hw.problemDetails[String(problemId)]).concept}` : ''}</span>
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
            <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', padding: '16px', textAlign: 'center', boxShadow: '0 4px 10px rgba(0,0,0,0.3)', border: '2px solid #3B82F6' }}>
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



        {/* Problem Attempt History Timeline (Admin only) */}
        {problemHistory && problemHistory.length > 1 && isAdmin && (
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
            onInsert={(img, latex) => { 
              if (img) setImagePreview(img); 
              if (latex) setStudentAnswer(latex);
              setUseMathType(false); 
            }} 
            onCancel={() => setUseMathType(false)} 
          />
        )}

        {/* Student Math Answer (LaTeX) & Real-time Jev 1.13 Grading Card */}
        <div style={{
          backgroundColor: '#1E2028',
          border: '1.5px solid #3B82F6',
          borderRadius: '12px',
          padding: '16px',
          marginBottom: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
            <span style={{ color: '#60A5FA', fontWeight: 'bold', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              ✍️ 학생 최종 답안 (객관식 번호 / 수식)
            </span>
            {isExtractingLatex && (
              <span style={{ fontSize: '12px', color: '#FFD700', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span className="spinner" style={{ width: '12px', height: '12px', border: '2px solid #555', borderTop: '2px solid #FFD700', borderRadius: '50%', display: 'inline-block', animation: 'spin 1s linear infinite' }}></span>
                Gemini 2.5 Flash-Lite 수식 추출 중...
              </span>
            )}
          </div>

          {/* 객관식 1~5번 원클릭 선택 버튼 바 */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            backgroundColor: '#161822',
            padding: '10px 12px',
            borderRadius: '10px',
            border: '1px solid #2B2F40'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', color: '#9CA3AF', fontWeight: '600' }}>
                🔘 객관식 빠른 선택 (1~5번)
              </span>
              {studentAnswer && ['1', '2', '3', '4', '5'].includes(normalizeChoiceNumber(studentAnswer)) && (
                <button
                  type="button"
                  onClick={() => setStudentAnswer('')}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#EF4444',
                    fontSize: '11px',
                    cursor: 'pointer',
                    padding: '2px 6px'
                  }}
                >
                  선택 취소 ✕
                </button>
              )}
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
              {[1, 2, 3, 4, 5].map((num) => {
                const circled = ['①', '②', '③', '④', '⑤'][num - 1];
                const isSelected = normalizeChoiceNumber(studentAnswer) === String(num);
                return (
                  <button
                    key={num}
                    type="button"
                    onClick={() => {
                      if (isSelected) {
                        setStudentAnswer('');
                      } else {
                        setStudentAnswer(String(num));
                      }
                    }}
                    style={{
                      flex: 1,
                      height: '42px',
                      borderRadius: '8px',
                      border: isSelected ? '2px solid #3B82F6' : '1px solid #374151',
                      backgroundColor: isSelected ? '#1D4ED8' : '#1F2937',
                      color: isSelected ? '#FFFFFF' : '#D1D5DB',
                      fontSize: '18px',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.15s ease',
                      boxShadow: isSelected ? '0 0 10px rgba(59, 130, 246, 0.6)' : 'none',
                      transform: isSelected ? 'scale(1.05)' : 'scale(1)'
                    }}
                  >
                    {circled}
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <input 
              type="text" 
              value={studentAnswer} 
              onChange={(e) => setStudentAnswer(e.target.value)} 
              placeholder="선택지 번호(1~5) 또는 직접 수식 입력 (예: 3, \frac{9}{4}, x^2-4x+3)"
              className="modal-input"
              style={{
                flex: 1,
                fontSize: '15px',
                fontFamily: 'monospace',
                padding: '10px 12px',
                backgroundColor: '#121318',
                border: '1px solid #4B5563',
                color: '#FFFFFF',
                borderRadius: '8px'
              }}
            />
          </div>

          {/* Real-time MathJax LaTeX Preview / Choice Preview */}
          {studentAnswer && (
            <div style={{
              backgroundColor: '#121318',
              borderRadius: '8px',
              padding: '12px',
              border: '1px solid #2B2D3A',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '11px', color: '#888', marginBottom: '6px', textAlign: 'left' }}>
                {['1', '2', '3', '4', '5'].includes(normalizeChoiceNumber(studentAnswer)) ? '선택된 객관식 답안:' : '렌더링 미리보기:'}
              </div>
              <div ref={latexPreviewRef} style={{ fontSize: '18px', color: '#60A5FA', minHeight: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {['1', '2', '3', '4', '5'].includes(normalizeChoiceNumber(studentAnswer)) ? (
                  <span style={{ fontWeight: 'bold', fontSize: '20px', color: '#38BDF8' }}>
                    {['①', '②', '③', '④', '⑤'][parseInt(normalizeChoiceNumber(studentAnswer)) - 1]} ({normalizeChoiceNumber(studentAnswer)}번)
                  </span>
                ) : (
                  `$$ ${studentAnswer} $$`
                )}
              </div>
            </div>
          )}
        </div>

        <div className="submit-container" style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px' }}>
          <button 
            className={`submit-btn ${(imagePreview || studentAnswer) ? 'active' : ''}`}
            onClick={handleSubmit}
            disabled={!imagePreview && !studentAnswer}
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
