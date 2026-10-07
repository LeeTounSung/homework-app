import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useHomework } from '../context/HomeworkContext';
import { autoGradeProblemSubmission, solveProblemWithAI, checkMathEquivalenceWithAI } from '../utils/gemini';

const formatGroupLabel = (label) => {
  if (!label || typeof label !== 'string') return label;
  
  const matches = [...label.matchAll(/\[([^\]]+)\]/g)].map(m => m[1]);
  if (matches.length >= 3) {
    const page = matches.find(m => m.startsWith('p.') || m.includes('p.'));
    const range = matches.find(m => m.startsWith('번호:') || /^\d+~\d+$/.test(m));
    const contentSegments = matches.filter(m => 
      m !== matches[0] && 
      m !== page && 
      m !== range
    );
    let title = contentSegments.length > 0 ? contentSegments[contentSegments.length - 1] : matches[0];
    const details = [];
    if (page) details.push(page);
    if (range) details.push(range.startsWith('번호:') ? `${range.replace('번호:', '')}번` : `${range}번`);
    
    if (details.length > 0) {
      title += ` (${details.join(', ')})`;
    }
    return title;
  }

  if (label.includes('번호:')) return label;
  return label.replace(/-?\[(\d+~\d+|\d+)\]$/, '-[번호:$1]');
};

export default function HomeworkDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { 
    getHomeworkById, 
    addProblemRange, 
    removeProblemGroup, 
    updateHomeworkInfo, 
    updateHomeworkAnswers,
    isAdmin, 
    deleteHomework,
    evaluateSingleProblem,
    geminiApiKey,
    aiConfig,
    isAiConfigured
  } = useHomework();
  
  // Custom Modal States
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [startNum, setStartNum] = useState('');
  const [endNum, setEndNum] = useState('');
  
  const [deleteTarget, setDeleteTarget] = useState(null); // { groupId, label }

  // Answer Key Modal State
  const [isAnswerKeyModalOpen, setIsAnswerKeyModalOpen] = useState(false);
  const [editedAnswers, setEditedAnswers] = useState({});

  // Edit Info Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editStudent, setEditStudent] = useState('');
  const [editPdfUrl, setEditPdfUrl] = useState('');
  
  // Bulk AI Grading State
  const [isBulkAiGrading, setIsBulkAiGrading] = useState(false);
  const [bulkGradingProgress, setBulkGradingProgress] = useState({ current: 0, total: 0 });

  // Timer logic for Autonomous Online Tests
  const [timerStatus, setTimerStatus] = useState('idle'); // 'idle', 'running', 'paused'
  const [timeLeft, setTimeLeft] = useState(0);
  const [targetMinutes, setTargetMinutes] = useState('60');

  const hw = getHomeworkById(id);

  useEffect(() => {
    if (hw && hw.isOnlineTest) {
      const savedState = localStorage.getItem(`timer_state_${hw.id}`);
      if (savedState) {
        try {
          const data = JSON.parse(savedState);
          if (data.status === 'paused') {
            setTimeLeft(data.timeLeft);
            setTimerStatus('paused');
          } else if (data.status === 'running') {
            const remaining = Math.max(0, Math.floor((data.endTime - Date.now()) / 1000));
            setTimeLeft(remaining);
            setTimerStatus('running');
          }
        } catch (e) {
          // ignore
        }
      } else {
        // Fallback for old storage key
        const oldEndTime = localStorage.getItem(`timer_end_${hw.id}`);
        if (oldEndTime) {
          const remaining = Math.max(0, Math.floor((parseInt(oldEndTime) - Date.now()) / 1000));
          setTimeLeft(remaining);
          setTimerStatus('running');
          localStorage.setItem(`timer_state_${hw.id}`, JSON.stringify({ status: 'running', endTime: parseInt(oldEndTime) }));
        }
      }
    }
  }, [hw]);

  useEffect(() => {
    let timer;
    if (timerStatus === 'running' && timeLeft > 0) {
      timer = setInterval(() => {
        setTimeLeft(prev => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [timerStatus, timeLeft]);

  if (!hw) return <div style={{color: 'white', padding: '20px'}}>숙제를 찾을 수 없습니다.</div>;

  const handleEditOpen = () => {
    setEditTitle(hw.title);
    setEditDesc(hw.description);
    setEditStudent(hw.studentName || '');
    setEditPdfUrl(hw.pdfUrl || '');
    setIsEditModalOpen(true);
  };

  const handleStartTimer = () => {
    const mins = parseInt(targetMinutes);
    if (!mins || mins <= 0) return alert('올바른 시간을 입력해주세요.');
    const endTime = Date.now() + mins * 60 * 1000;
    localStorage.setItem(`timer_state_${hw.id}`, JSON.stringify({ status: 'running', endTime }));
    setTimeLeft(mins * 60);
    setTimerStatus('running');
  };

  const handlePauseTimer = () => {
    localStorage.setItem(`timer_state_${hw.id}`, JSON.stringify({ status: 'paused', timeLeft }));
    setTimerStatus('paused');
  };

  const handleResumeTimer = () => {
    const endTime = Date.now() + timeLeft * 1000;
    localStorage.setItem(`timer_state_${hw.id}`, JSON.stringify({ status: 'running', endTime }));
    setTimerStatus('running');
  };

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleEditSubmit = () => {
    updateHomeworkInfo(id, editTitle, editDesc, editStudent, editPdfUrl);
    setIsEditModalOpen(false);
  };

  const handleDeleteHomework = () => {
    if (window.confirm(`'${hw.title}' 숙제를 완전히 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`)) {
      deleteHomework(id);
      navigate('/');
    }
  };

  const problemGroups = hw.problemGroups || [];
  const submittedProblems = hw.submittedProblems || [];
  
  const rawTotal = problemGroups.reduce((sum, group) => sum + group.problems.length, 0);
  const exemptCount = submittedProblems.filter(p => p.status === 'exempt').length;
  const totalQuestions = rawTotal - exemptCount;
  
  const actualSubmittedCount = submittedProblems.filter(p => p.status !== 'exempt').length;
  
  const progressPercent = totalQuestions > 0 ? (actualSubmittedCount / totalQuestions) * 100 : 0;

  const normalizeAnswer = (str) => {
    if (str === null || str === undefined) return '';
    return String(str)
      .trim()
      .replace(/[①⑴(1)]/g, '1')
      .replace(/[②⑵(2)]/g, '2')
      .replace(/[③⑶(3)]/g, '3')
      .replace(/[④⑷(4)]/g, '4')
      .replace(/[⑤⑸(5)]/g, '5')
      .replace(/\s+/g, '')
      .toLowerCase();
  };

  const [isAiSolving, setIsAiSolving] = useState(false);

  const handleOpenAnswerKeyModal = () => {
    setEditedAnswers({ ...(hw.answers || {}) });
    setIsAnswerKeyModalOpen(true);
  };

  const handleSaveAnswerKey = () => {
    updateHomeworkAnswers(hw.id, editedAnswers);
    setIsAnswerKeyModalOpen(false);
    alert('정답표가 성공적으로 저장되었습니다.');
  };

  const handleAutoSolveAnswers = async () => {
    if (!isAiConfigured && !geminiApiKey) {
      alert("우측 상단 관리자 설정에서 AI(Meta Muse Spark, DeepSeek, Gemini) API 키를 먼저 등록해주세요.");
      return;
    }

    const allProbs = [];
    (hw.problemGroups || []).forEach(grp => {
      (grp.problems || []).forEach(num => {
        allProbs.push(num);
      });
    });

    if (allProbs.length === 0) {
      alert("등록된 문항이 없습니다.");
      return;
    }

    if (!window.confirm(`총 ${allProbs.length}개 문항에 대해 AI가 문제를 직접 풀고 정답표를 자동으로 생성하시겠습니까?`)) {
      return;
    }

    setIsAiSolving(true);
    const newAnswers = { ...editedAnswers };
    let solvedCount = 0;

    try {
      for (const num of allProbs) {
        const details = (hw.problemDetails && (hw.problemDetails[num] || hw.problemDetails[String(num)])) || {};
        const statement = details.statement || '';
        let probImage = details.image || null;

        if (!probImage) {
          const sp = (hw.submittedProblems || []).find(p => p.problemNumber === num);
          if (sp && sp.imageUrl) probImage = sp.imageUrl;
        }

        const answer = await solveProblemWithAI(aiConfig || geminiApiKey, statement, probImage);
        if (answer) {
          newAnswers[num] = answer;
          solvedCount++;
        }
      }

      setEditedAnswers(newAnswers);
      alert(`총 ${solvedCount}개 문항의 정답을 AI로 자동 생성했습니다!\n입력된 정답을 검토하신 후 [💾 정답 저장]을 눌러주세요.`);
    } catch (err) {
      console.error("AI Auto-solve error:", err);
      alert(`AI 정답 자동 생성 중 오류가 발생했습니다: ${err.message}`);
    } finally {
      setIsAiSolving(false);
    }
  };

  const handleBulkAiGrade = async () => {
    // 💡 이미 맞은 문제(status === 'correct')는 그대로 두고, 미채점(submitted) 또는 오답(incorrect, indeterminate) 문제만 선별하여 채점
    const toGrade = (hw.submittedProblems || []).filter(
      p => p.status !== 'correct' && p.status !== 'exempt' && (p.imageUrl || p.studentAnswer)
    );

    if (toGrade.length === 0) {
      const alreadyCorrectCount = (hw.submittedProblems || []).filter(p => p.status === 'correct').length;
      if (alreadyCorrectCount > 0) {
        alert(`채점할 대상이 없습니다. 제출된 ${alreadyCorrectCount}개 문제가 이미 모두 '⭕ 맞음'으로 완료되었습니다! 🎉`);
      } else {
        alert("채점할 제출물이 없습니다. 먼저 문제를 제출해주세요.");
      }
      return;
    }

    const registeredAnswers = hw.answers || hw.answerKey || {};

    if (!window.confirm(`총 ${toGrade.length}개의 미채점/오답 문제를 채점하시겠습니까?\n(이미 맞은 문제는 그대로 유지됩니다)`)) {
      return;
    }

    setIsBulkAiGrading(true);
    setBulkGradingProgress({ current: 0, total: toGrade.length });

    let correctCount = 0;
    let incorrectCount = 0;
    let indeterminateCount = 0;
    let autoMatchedCount = 0;
    let errors = [];

    try {
      for (let i = 0; i < toGrade.length; i++) {
        const p = toGrade[i];
        setBulkGradingProgress({ current: i + 1, total: toGrade.length });
        
        let label = '';
        if (hw.problemGroups) {
          const g = hw.problemGroups.find(grp => grp.groupId === p.groupId);
          if (g) label = g.label;
        }

        const correctAns = registeredAnswers[p.problemNumber] || registeredAnswers[String(p.problemNumber)];

        // FAST-PATH 1: Student typed answer & answer key exists
        if (correctAns && p.studentAnswer && p.studentAnswer.trim()) {
          const normStudent = normalizeAnswer(p.studentAnswer);
          const normCorrect = normalizeAnswer(correctAns);
          const isExactMatch = normStudent === normCorrect;

          if (isExactMatch) {
            // 100% exact match (0 tokens!)
            const feedback = `⭕ [정답표 자동 채점]\n입력 답안: ${p.studentAnswer}\n정답: ${correctAns}\n결과: 정답입니다!`;
            evaluateSingleProblem(hw.id, p.groupId, p.problemNumber, 'correct', feedback);
            correctCount++;
            autoMatchedCount++;
            continue;
          }

          // If simple single digit choices (1~5) and not matching, definitely incorrect (0 tokens)
          if (/^[1-5]$/.test(normStudent) && /^[1-5]$/.test(normCorrect)) {
            const feedback = `❌ [정답표 자동 채점]\n입력 답안: ${p.studentAnswer}\n정답: ${correctAns}\n결과: 오답입니다.`;
            evaluateSingleProblem(hw.id, p.groupId, p.problemNumber, 'incorrect', feedback);
            incorrectCount++;
            autoMatchedCount++;
            continue;
          }

          // PATH 1.5: LaTeX / Math expression / Short-answer -> AI Mathematical Equivalence Check!
          if (isAiConfigured || geminiApiKey) {
            try {
              const equivRes = await checkMathEquivalenceWithAI(aiConfig || geminiApiKey, correctAns, p.studentAnswer);
              const isWrong = equivRes.includes('❌') || equivRes.includes('오답') || equivRes.includes('DIFFERENT') || /\[채점 결과\]\s*❌/.test(equivRes);
              const isEquiv = (equivRes.includes('⭕') || equivRes.includes('EQUIVALENT') || /\[채점 결과\]\s*⭕/.test(equivRes)) && !isWrong;
              const gradeStatus = isEquiv ? 'correct' : 'incorrect';
              const feedback = `${isEquiv ? '⭕' : '❌'} [수학적 동치 판정]\n입력 답안: ${p.studentAnswer}\n공식 정답: ${correctAns}\n\n${equivRes}`;
              evaluateSingleProblem(hw.id, p.groupId, p.problemNumber, gradeStatus, feedback);
              if (isEquiv) correctCount++;
              else incorrectCount++;
              autoMatchedCount++;
              continue;
            } catch (err) {
              console.warn('AI Equivalence check error, fallback to strict mismatch:', err);
            }
          }

          // Fallback if AI not configured and strings don't match
          const feedback = `❌ [정답표 자동 채점]\n입력 답안: ${p.studentAnswer}\n정답: ${correctAns}\n결과: 오답입니다.`;
          evaluateSingleProblem(hw.id, p.groupId, p.problemNumber, 'incorrect', feedback);
          incorrectCount++;
          autoMatchedCount++;
          continue;
        }

        // SLOW-PATH 2: Needs AI Vision
        if (!isAiConfigured && !geminiApiKey) {
          errors.push(`${p.problemNumber}번: AI API 키 미설정 (정답표에 정답을 등록하고 단답형으로 제출하면 AI 키 없이 즉시 채점됩니다)`);
          continue;
        }

        let desc = `${hw.studentName} 학생의 ${hw.title} ${label ? `[${label}] ` : ''}${p.problemNumber}번 문제 풀이입니다.`;
        if (correctAns) {
          desc += `\n[참고] 이 문제의 공식 정답은 [${correctAns}]입니다. 문제를 직접 풀지 말고, 학생의 손글씨 답안과 공식 정답의 일치 여부만 판정해주세요.`;
        }

        try {
          const feedback = await autoGradeProblemSubmission(aiConfig || geminiApiKey, desc, p.imageUrl, '', correctAns);
          
          let gradeStatus = 'incorrect';
          const isIndeterminate = feedback.includes('채점 불가') || feedback.includes('채점불가') || feedback.includes('🔺') || feedback.includes('확인 필요');
          const isWrong = feedback.includes('❌') || feedback.includes('오답') || feedback.includes('틀렸습니다');
          const isRight = (feedback.includes('⭕') || feedback.includes('맞았습니다') || /\[채점 결과\]\s*⭕/.test(feedback)) && !isWrong;

          if (isIndeterminate) {
            gradeStatus = 'indeterminate';
            indeterminateCount++;
          } else if (isRight) {
            gradeStatus = 'correct';
            correctCount++;
          } else {
            gradeStatus = 'incorrect';
            incorrectCount++;
          }
          evaluateSingleProblem(hw.id, p.groupId, p.problemNumber, gradeStatus, feedback);
        } catch (err) {
          console.error(`Error grading problem ${p.problemNumber}:`, err);
          errors.push(`${p.problemNumber}번: ${err.message}`);
        }
      }

      if (errors.length > 0 && correctCount === 0 && incorrectCount === 0 && indeterminateCount === 0) {
        alert(`❌ 채점 중 오류가 발생했습니다:\n\n${errors.slice(0, 3).join('\n')}\n\n관리자 설정에서 AI API 키 및 인터넷 연결을 확인해주세요.`);
      } else {
        let msg = `🎉 채점이 완료되었습니다!\n\n⭕ 맞음(연파랑): ${correctCount}개\n❌ 틀림(연빨강): ${incorrectCount}개`;
        if (indeterminateCount > 0) {
          msg += `\n🔺 확인필요/채점불가(연녹색): ${indeterminateCount}개`;
        }
        if (autoMatchedCount > 0) {
          msg += `\n⚡ (정답표 초고속 자동채점: ${autoMatchedCount}문항, 토큰 0개 소모)`;
        }
        if (errors.length > 0) {
          msg += `\n(참고: ${errors.length}건 오류)`;
        }
        alert(msg);
      }
    } catch (err) {
      console.error("Bulk grading error:", err);
      alert(`채점 중 오류가 발생했습니다: ${err.message}`);
    } finally {
      setIsBulkAiGrading(false);
    }
  };

  const handleAddSubmit = () => {
    const s = parseInt(startNum, 10);
    const e = parseInt(endNum, 10);
    
    if (!newLabel) {
      alert("구분 라벨을 입력해주세요.");
      return;
    }
    if (isNaN(s) || isNaN(e)) {
      alert("번호를 올바르게 입력해주세요.");
      return;
    }
    if (s > e) {
      alert("시작 번호가 끝 번호보다 작거나 같아야 합니다.");
      return;
    }
    
    addProblemRange(id, newLabel, s, e);
    setIsAddModalOpen(false);
    setNewLabel('');
    setStartNum('');
    setEndNum('');
  };

  const confirmDelete = () => {
    if (deleteTarget) {
      removeProblemGroup(id, deleteTarget.groupId);
      setDeleteTarget(null);
    }
  };

  const getProblemStyle = (status, subProb = null) => {
    switch (status) {
      case 'correct': {
        const wasIncorrect = (subProb?.wrongCount > 0) || Boolean(subProb?.hasBeenIncorrect);
        if (wasIncorrect) {
          return { 
            bg: '#1E293B', 
            border: '#F59E0B', 
            borderWidth: '2.5px',
            text: '#FFFFFF', 
            label: '⭕ 틀림후 맞춤',
            labelColor: '#FBBF24'
          }; // 주황/골드 테두리 + 슬레이트 배경 (오답 후 재풀이 정답)
        }
        return { 
          bg: '#1E293B', 
          border: '#3B82F6', 
          borderWidth: '2.5px',
          text: '#FFFFFF', 
          label: '⭕ 맞음',
          labelColor: '#60A5FA'
        }; // 블루 테두리 + 슬레이트 배경
      }
      case 'incorrect':
        return { 
          bg: '#1E293B', 
          border: '#EF4444', 
          borderWidth: '2.5px',
          text: '#FFFFFF', 
          label: '❌ 틀림',
          labelColor: '#F87171'
        }; // 레드 테두리 + 슬레이트 배경
      case 'indeterminate':
      case 'unclear':
        return { 
          bg: '#1E293B', 
          border: '#10B981', 
          borderWidth: '2.5px',
          text: '#FFFFFF', 
          label: '🔺 확인',
          labelColor: '#34D399'
        }; // 그린 테두리 + 슬레이트 배경
      case 'exempt':
        return { 
          bg: '#16171C', 
          border: '#2A2C34', 
          borderWidth: '2px',
          text: '#555555', 
          opacity: 0.5, 
          label: '' 
        }; // 제외
      case 'submitted':
        return { 
          bg: '#1E293B', 
          border: '#3B82F6', 
          borderWidth: '2px',
          text: '#FFFFFF', 
          label: '제출',
          labelColor: '#93C5FD'
        }; // 블루 제출
      default:
        return { 
          bg: '#1A1B23', 
          border: '#334155', 
          borderWidth: '1.5px',
          text: '#94A3B8', 
          label: '' 
        }; // 미제출
    }
  };

  return (
    <div className="app-container">
      {/* Header */}
      <header className="header">
        <button className="back-btn" onClick={() => navigate('/')}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <h1 className="header-title">숙제 상세</h1>
        <div style={{width: '24px'}}></div> {/* Spacer for centering */}
      </header>

      {/* Main Content */}
      <main className="content-list detail-content">
        <div className="detail-header" style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '8px' }}>
            <h2 style={{ color: '#fff', fontSize: '20px', margin: 0 }}>{hw.title}</h2>
            <div style={{ display: 'flex', gap: '8px' }}>
              {isAdmin && (
                <button 
                  onClick={handleEditOpen}
                  style={{ 
                    background: 'none', border: '1px solid #444', color: '#FFD700', 
                    padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' 
                  }}
                >
                  ✏️ 편집
                </button>
              )}
              {isAdmin && (
                <button 
                  onClick={handleDeleteHomework}
                  style={{ 
                    background: 'none', border: '1px solid #F44336', color: '#F44336', 
                    padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' 
                  }}
                >
                  🗑️ 삭제
                </button>
              )}
            </div>
          </div>
          <p style={{ color: '#888', fontSize: '14px', marginBottom: '16px' }}>{hw.description}</p>
          
          {hw.pdfUrl && (
            <div style={{ marginBottom: '16px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {hw.pdfUrl.split(/[\s,]+/).filter(url => url.trim().startsWith('http')).map((url, idx) => (
                <a key={idx} href={url.trim()} target="_blank" rel="noopener noreferrer" style={{
                  display: 'inline-block', padding: '8px 16px', backgroundColor: '#F44336', color: '#fff', 
                  textDecoration: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 'bold'
                }}>
                  📄 PDF {idx + 1} 보기
                </a>
              ))}
            </div>
          )}

          {hw.isOnlineTest ? (
            <div className="progress-info" style={{ backgroundColor: '#202129', padding: '16px', borderRadius: '12px', textAlign: 'center' }}>
              {timerStatus === 'idle' ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                  <div style={{ color: '#E0E0E0', fontSize: '14px' }}>목표 시험 시간(분)을 설정해주세요.</div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input 
                      type="number" 
                      value={targetMinutes} 
                      onChange={(e) => setTargetMinutes(e.target.value)}
                      style={{ width: '80px', padding: '8px', borderRadius: '4px', border: '1px solid #555', backgroundColor: '#333', color: '#fff', textAlign: 'center', fontSize: '16px' }}
                    />
                    <span style={{ color: '#888' }}>분</span>
                  </div>
                  <button 
                    onClick={handleStartTimer}
                    style={{ padding: '8px 24px', backgroundColor: '#4CAF50', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '16px', cursor: 'pointer', fontWeight: 'bold' }}
                  >
                    ▶️ 타이머 시작
                  </button>
                </div>
              ) : (
                <>
                  <div style={{ color: '#E0E0E0', fontSize: '14px', marginBottom: '8px' }}>남은 시간 {timerStatus === 'paused' && <span style={{color: '#FF9800'}}>(일시정지됨)</span>}</div>
                  <div style={{ fontSize: '32px', fontWeight: 'bold', color: timeLeft > 60 ? '#4CAF50' : '#F44336', fontFamily: 'monospace' }}>
                    {formatTime(timeLeft)}
                  </div>
                  <div style={{ marginTop: '12px' }}>
                    {timerStatus === 'running' ? (
                      <button 
                        onClick={handlePauseTimer}
                        style={{ padding: '6px 16px', backgroundColor: '#FF9800', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '14px', cursor: 'pointer', fontWeight: 'bold' }}
                      >
                        ⏸️ 일시정지
                      </button>
                    ) : (
                      <button 
                        onClick={handleResumeTimer}
                        style={{ padding: '6px 16px', backgroundColor: '#2196F3', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '14px', cursor: 'pointer', fontWeight: 'bold' }}
                      >
                        ▶️ 계속하기
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="progress-info" style={{ backgroundColor: '#202129', padding: '16px', borderRadius: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', color: '#E0E0E0' }}>
                <span>진행률 {exemptCount > 0 && <span style={{fontSize: '12px', color: '#888'}}>(제외 {exemptCount}문제)</span>}</span>
                <span>{actualSubmittedCount} / {totalQuestions} ({Math.round(progressPercent)}%)</span>
              </div>
              <div className="progress-bar" style={{ width: '100%', height: '8px', backgroundColor: '#333', borderRadius: '4px', overflow: 'hidden' }}>
                <div className="progress-fill" style={{ width: `${progressPercent}%`, backgroundColor: '#FFD700', height: '100%' }}></div>
              </div>

              {/* AI Bulk Grading Action & Result Summary */}
              <div style={{ 
                marginTop: '16px', 
                paddingTop: '12px', 
                borderTop: '1px solid #333', 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center', 
                flexWrap: 'wrap', 
                gap: '10px' 
              }}>
                <div style={{ fontSize: '13px', color: '#aaa' }}>
                  {submittedProblems.some(p => p.status === 'correct' || p.status === 'incorrect' || p.status === 'indeterminate') ? (
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                      <span style={{ color: '#90CAF9', fontWeight: 'bold' }}>
                        ⭕ 맞음: {submittedProblems.filter(p => p.status === 'correct' && !((p.wrongCount > 0) || p.hasBeenIncorrect)).length}개
                      </span>
                      {submittedProblems.filter(p => p.status === 'correct' && ((p.wrongCount > 0) || p.hasBeenIncorrect)).length > 0 && (
                        <>
                          <span style={{ color: '#666' }}>|</span>
                          <span style={{ color: '#FBBF24', fontWeight: 'bold' }}>
                            ⭕ 틀림후 맞춤: {submittedProblems.filter(p => p.status === 'correct' && ((p.wrongCount > 0) || p.hasBeenIncorrect)).length}개
                          </span>
                        </>
                      )}
                      <span style={{ color: '#666' }}>|</span>
                      <span style={{ color: '#EF9A9A', fontWeight: 'bold' }}>
                        ❌ 틀림: {submittedProblems.filter(p => p.status === 'incorrect').length}개
                      </span>
                      {submittedProblems.filter(p => p.status === 'indeterminate').length > 0 && (
                        <>
                          <span style={{ color: '#666' }}>|</span>
                          <span style={{ color: '#A5D6A7', fontWeight: 'bold' }}>
                            🔺 확인: {submittedProblems.filter(p => p.status === 'indeterminate').length}개
                          </span>
                        </>
                      )}
                    </div>
                  ) : (
                    <span>💡 숙제를 제출한 후 [채점하기]를 누르면 채점됩니다.</span>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={handleOpenAnswerKeyModal}
                      style={{
                        padding: '9px 14px',
                        borderRadius: '8px',
                        border: '1px solid #4CAF50',
                        backgroundColor: '#1E2D24',
                        color: '#A5D6A7',
                        fontWeight: 'bold',
                        fontSize: '13px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px',
                        transition: 'all 0.2s'
                      }}
                      title="mathkorea 운영자 전용: 각 문항의 정답을 미리 등록하거나 AI로 자동 생성합니다"
                    >
                      <span>📝 정답표 관리</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={handleBulkAiGrade}
                    disabled={isBulkAiGrading || actualSubmittedCount === 0}
                    style={{
                      padding: '9px 16px',
                      borderRadius: '8px',
                      border: 'none',
                      backgroundColor: actualSubmittedCount > 0 ? '#673AB7' : '#333',
                      color: '#ffffff',
                      fontWeight: 'bold',
                      fontSize: '13px',
                      cursor: actualSubmittedCount > 0 && !isBulkAiGrading ? 'pointer' : 'not-allowed',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      boxShadow: actualSubmittedCount > 0 ? '0 3px 8px rgba(103, 58, 183, 0.4)' : 'none',
                      transition: 'all 0.2s'
                    }}
                  >
                    {isBulkAiGrading ? (
                      <>
                        <div className="spinner" style={{ width: '14px', height: '14px', border: '2px solid #fff', borderTop: '2px solid transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
                        <span>채점 중 ({bulkGradingProgress.current}/{bulkGradingProgress.total})...</span>
                      </>
                    ) : (
                      <>
                        <span>✍️ 채점하기</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', marginTop: '24px' }}>
          <h3 style={{ color: '#fff', fontSize: '16px' }}>문항별 제출</h3>
        </div>
        
        {problemGroups.map(group => (
          <div key={group.groupId} style={{ marginBottom: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px', gap: '8px' }}>
              <div style={{ 
                backgroundColor: '#2A2C38', 
                border: '1px solid #3E4254',
                color: '#FFFFFF', 
                padding: '6px 14px', 
                borderRadius: '8px', 
                fontSize: '14px',
                fontWeight: 'bold',
                letterSpacing: '0.2px'
              }}>
                {formatGroupLabel(group.label)}
              </div>
              {isAdmin && (
                <button 
                  onClick={() => setDeleteTarget({ groupId: group.groupId, label: group.label })}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#888',
                    cursor: 'pointer',
                    fontSize: '12px',
                    padding: '4px 8px',
                    borderRadius: '12px',
                    backgroundColor: '#2A2A2A'
                  }}
                >
                  삭제
                </button>
              )}
            </div>
            
            <div className="problem-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
              {group.problems.map(problemNum => {
                const subProb = submittedProblems.find(p => p.groupId === group.groupId && p.problemNumber === problemNum);
                const status = subProb ? subProb.status : 'unsubmitted';
                const style = getProblemStyle(status, subProb);
                
                return (
                  <button 
                    key={problemNum}
                    className={`problem-btn`}
                    onClick={() => navigate(`/upload/${hw.id}/${group.groupId}/${problemNum}`)}
                    style={{
                      aspectRatio: '1',
                      backgroundColor: style.bg,
                      border: `${style.borderWidth || '2px'} solid ${style.border}`,
                      borderRadius: '12px',
                      color: style.text,
                      fontSize: '18px',
                      fontWeight: 'bold',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center',
                      alignItems: 'center',
                      cursor: 'pointer',
                      position: 'relative',
                      opacity: style.opacity || 1,
                      boxShadow: style.border !== '#333333' ? `0 0 8px ${style.border}55` : 'none',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {status === 'exempt' ? (
                      <span style={{ textDecoration: 'line-through' }}>{problemNum}</span>
                    ) : (
                      <span>{problemNum}</span>
                    )}
                    {style.label && (
                      <span style={{ fontSize: '11px', marginTop: '2px', fontWeight: 'bold', color: style.labelColor || '#000' }}>
                        {style.label}
                      </span>
                    )}
                    {status === 'submitted' && (
                      <div style={{ position: 'absolute', top: '4px', right: '4px', width: '8px', height: '8px', backgroundColor: '#3B82F6', borderRadius: '50%' }}></div>
                    )}
                    {/* 오답 횟수 또는 재도전 횟수 표시 */}
                    {(subProb?.wrongCount > 0 || subProb?.attempts > 1) && (status === 'correct' || status === 'incorrect' || status === 'indeterminate') && (
                      <div style={{ 
                        position: 'absolute', bottom: '3px', right: '5px', 
                        fontSize: '10px',
                        fontWeight: '600',
                        color: status === 'incorrect' ? '#F87171' : (subProb?.wrongCount > 0 ? '#FBBF24' : '#94A3B8'),
                        backgroundColor: 'rgba(0, 0, 0, 0.45)',
                        padding: '1px 5px',
                        borderRadius: '4px',
                        lineHeight: '1.2'
                      }}>
                        {subProb?.wrongCount > 0 ? `오답 ${subProb.wrongCount}회` : `${subProb.attempts}회차`}
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
        
        {/* 범위 추가 버튼 */}
        {isAdmin && (
          <button 
            onClick={() => setIsAddModalOpen(true)}
            style={{
              width: '100%',
              padding: '16px',
              backgroundColor: 'transparent',
              border: '1px dashed #555',
              borderRadius: '12px',
              color: '#888',
              fontSize: '14px',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              cursor: 'pointer',
              marginTop: '8px'
            }}
          >
            + 새로운 문제 범위 추가
          </button>
        )}
      </main>

      {/* Add Range Modal */}
      {isAddModalOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000
        }}>
          <div style={{
            backgroundColor: '#202129', padding: '24px', borderRadius: '16px', width: '90%', maxWidth: '400px'
          }}>
            <h3 style={{ color: '#fff', marginBottom: '16px' }}>새로운 문제 범위 추가</h3>
            
            <div style={{ marginBottom: '12px' }}>
              <label style={{ color: '#888', fontSize: '12px', display: 'block', marginBottom: '4px' }}>구분 라벨 (예: 1ch, 심화문제)</label>
              <input 
                type="text" 
                value={newLabel} 
                onChange={e => setNewLabel(e.target.value)}
                style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #333', backgroundColor: '#1A1B23', color: '#fff' }}
              />
            </div>
            
            <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ color: '#888', fontSize: '12px', display: 'block', marginBottom: '4px' }}>시작 번호</label>
                <input 
                  type="number" 
                  value={startNum} 
                  onChange={e => setStartNum(e.target.value)}
                  style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #333', backgroundColor: '#1A1B23', color: '#fff' }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ color: '#888', fontSize: '12px', display: 'block', marginBottom: '4px' }}>끝 번호</label>
                <input 
                  type="number" 
                  value={endNum} 
                  onChange={e => setEndNum(e.target.value)}
                  style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #333', backgroundColor: '#1A1B23', color: '#fff' }}
                />
              </div>
            </div>
            
            <div style={{ display: 'flex', gap: '12px' }}>
              <button 
                onClick={() => setIsAddModalOpen(false)}
                style={{ flex: 1, padding: '12px', borderRadius: '8px', border: 'none', backgroundColor: '#333', color: '#fff', cursor: 'pointer' }}
              >
                취소
              </button>
              <button 
                onClick={handleAddSubmit}
                style={{ flex: 1, padding: '12px', borderRadius: '8px', border: 'none', backgroundColor: '#FFD700', color: '#000', fontWeight: 'bold', cursor: 'pointer' }}
              >
                추가하기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {deleteTarget && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000
        }}>
          <div style={{
            backgroundColor: '#202129', padding: '24px', borderRadius: '16px', width: '90%', maxWidth: '320px', textAlign: 'center'
          }}>
            <h3 style={{ color: '#fff', marginBottom: '12px' }}>그룹 삭제</h3>
            <p style={{ color: '#888', fontSize: '14px', marginBottom: '24px' }}>
              '{deleteTarget.label}' 그룹을 삭제하시겠습니까?<br/>제출된 사진도 모두 삭제됩니다.
            </p>
            
            <div style={{ display: 'flex', gap: '12px' }}>
              <button 
                onClick={() => setDeleteTarget(null)}
                style={{ flex: 1, padding: '12px', borderRadius: '8px', border: 'none', backgroundColor: '#333', color: '#fff', cursor: 'pointer' }}
              >
                취소
              </button>
              <button 
                onClick={confirmDelete}
                style={{ flex: 1, padding: '12px', borderRadius: '8px', border: 'none', backgroundColor: '#F44336', color: '#fff', fontWeight: 'bold', cursor: 'pointer' }}
              >
                삭제하기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Info Modal */}
      {isEditModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3 style={{ marginTop: 0, marginBottom: '20px', color: '#FFD700' }}>정보 수정</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', color: '#aaa' }}>학생 이름 (또는 그룹명)</label>
                <input 
                  type="text" 
                  value={editStudent} 
                  onChange={(e) => setEditStudent(e.target.value)}
                  className="modal-input"
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', color: '#aaa' }}>숙제 제목</label>
                <input 
                  type="text" 
                  value={editTitle} 
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="modal-input"
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', color: '#aaa' }}>설명</label>
                <textarea 
                  value={editDesc} 
                  onChange={(e) => setEditDesc(e.target.value)}
                  className="modal-input"
                  style={{ minHeight: '80px', resize: 'vertical' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', color: '#aaa' }}>PDF 링크 (URL)</label>
                <input 
                  type="text" 
                  value={editPdfUrl} 
                  onChange={(e) => setEditPdfUrl(e.target.value)}
                  className="modal-input"
                  placeholder="예: https://link1... https://link2... (여러 개일 경우 띄어쓰기로 구분)"
                />
              </div>
            </div>
            
            <div className="modal-buttons" style={{ marginTop: '20px' }}>
              <button className="modal-btn cancel" onClick={() => setIsEditModalOpen(false)}>취소</button>
              <button className="modal-btn confirm" onClick={handleEditSubmit}>저장하기</button>
            </div>
          </div>
        </div>
      )}

      {/* Answer Key Modal */}
      {isAnswerKeyModalOpen && (
        <div className="modal-overlay" style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 1000,
          display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '16px'
        }}>
          <div className="modal-content" style={{
            backgroundColor: '#1E1E24', borderRadius: '14px', padding: '24px',
            maxWidth: '480px', width: '100%', maxHeight: '80vh', overflowY: 'auto',
            border: '1px solid #444', color: '#fff'
          }}>
            <h3 style={{ margin: '0 0 8px 0', color: '#81C784', fontSize: '17px' }}>
              📝 과제 정답표 관리 (mathkorea 운영자)
            </h3>
            <p style={{ fontSize: '12px', color: '#aaa', margin: '0 0 16px 0', lineHeight: '1.4' }}>
              각 문항의 정답(객관식 선지 번호, 단답형 숫자, 서술형 LaTeX 수식)을 등록합니다. 아래 <b>[🤖 AI 정답 자동 생성]</b>을 누르면 AI가 자동으로 풀어서 입력합니다.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '20px' }}>
              {problemGroups.map(grp => (
                <div key={grp.groupId}>
                  <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#90CAF9', marginBottom: '8px' }}>
                    {formatGroupLabel(grp.label)}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {grp.problems.map(num => {
                      const val = editedAnswers[num] || '';
                      const isLatex = val.includes('\\') || val.includes('^') || val.includes('_') || val.includes('{') || (val.includes('/') && val.length > 2);
                      return (
                        <div key={num} style={{ backgroundColor: '#262834', padding: '8px 12px', borderRadius: '8px', border: '1px solid #3E4254' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '14px', fontWeight: 'bold', width: '42px', color: '#81C784' }}>
                              {num}번:
                            </span>
                            <input
                              type="text"
                              placeholder="정답 (객관식 1~5, 단답형, 또는 LaTeX 수식)"
                              value={val}
                              onChange={(e) => setEditedAnswers({ ...editedAnswers, [num]: e.target.value })}
                              style={{
                                flex: 1,
                                padding: '7px 10px',
                                borderRadius: '6px',
                                border: '1px solid #555',
                                backgroundColor: '#16161A',
                                color: '#fff',
                                fontSize: '13px'
                              }}
                            />
                          </div>
                          {isLatex && (
                            <div style={{ marginTop: '4px', paddingLeft: '50px', fontSize: '11px', color: '#90CAF9' }}>
                              📐 수식(LaTeX): <code>${val}$</code>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={handleAutoSolveAnswers}
                disabled={isAiSolving}
                style={{
                  padding: '8px 14px',
                  borderRadius: '8px',
                  border: '1px solid #7E57C2',
                  backgroundColor: '#261C38',
                  color: '#D1C4E9',
                  fontWeight: 'bold',
                  cursor: isAiSolving ? 'not-allowed' : 'pointer',
                  fontSize: '13px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.2s'
                }}
                title="AI가 문제 본문/이미지를 분석하여 정답을 자동으로 도출합니다"
              >
                {isAiSolving ? '🤖 AI 정답 푸는 중...' : '🤖 AI 정답 자동 생성'}
              </button>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setIsAnswerKeyModalOpen(false)}
                  style={{
                    padding: '8px 16px', borderRadius: '8px', border: '1px solid #555',
                    backgroundColor: '#333', color: '#ccc', cursor: 'pointer', fontSize: '13px'
                  }}
                >
                  닫기
                </button>
                <button
                  type="button"
                  onClick={handleSaveAnswerKey}
                  style={{
                    padding: '8px 18px', borderRadius: '8px', border: 'none',
                    backgroundColor: '#FFD700', color: '#000', fontWeight: 'bold',
                    cursor: 'pointer', fontSize: '13px'
                  }}
                >
                  💾 정답 저장
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
