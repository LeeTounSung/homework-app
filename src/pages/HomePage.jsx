import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useHomework } from '../context/HomeworkContext';
import { analyzeStudentProgress } from '../utils/gemini';

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

const formatHomeworkCardDesc = (hw) => {
  if (!hw) return '';
  const desc = hw.description || '';
  
  // 1. Cut off everything from 🎯 or 선별 난이도 onwards
  let clean = desc.split(/🎯|선별\s*난이도/)[0].trim();
  
  if (clean && clean.includes('진도 단원')) {
    // If it has something like "(p.12) 1~4", format as "(p.12) 번호: 1~4"
    clean = clean.replace(/(\(p\.?[0-9]+\))\s*([0-9]+~[0-9]+)/, '$1 번호: $2');
    return clean;
  }

  // 2. If problemGroups exists, construct the original layout
  if (hw.problemGroups && hw.problemGroups.length > 0) {
    const firstGroup = hw.problemGroups[0];
    const label = firstGroup.label || '';
    const parts = label.match(/\[([^\]]+)\]/g);
    if (parts && parts.length >= 2) {
      const cleanParts = parts.map(p => p.replace(/[\[\]]/g, ''));
      let subject = '공통수학1';
      if (desc.includes('수학(상)')) subject = '수학(상)';
      else if (desc.includes('수학(하)')) subject = '수학(하)';
      else if (desc.includes('수학1')) subject = '수학1';
      else if (desc.includes('수학2')) subject = '수학2';
      else if (desc.includes('미적분')) subject = '미적분';
      else if (desc.includes('기하')) subject = '기하';
      else if (desc.includes('확률과통계')) subject = '확률과통계';

      let textbook = cleanParts[0] || '교재';
      let chapter = cleanParts[1] || '단원';
      let page = cleanParts[2] || '';
      let numRange = cleanParts[3] || '';
      if (numRange && !numRange.startsWith('번호:')) numRange = `번호: ${numRange}`;
      return `📖 진도 단원: ${subject} > ${chapter} 📚 교재: ${textbook} (${page}) ${numRange}`.trim();
    }
  }

  return clean || desc;
};

const StatusIndicator = ({ hw }) => {
  if (hw.evaluation && hw.evaluation.type === 'check') {
    return (
      <div className="status-indicator">
        <div className="check-icon">✓</div>
      </div>
    );
  }

  if (hw.evaluation && hw.evaluation.type === 'stars') {
    return (
      <div className="status-indicator stars">
        {Array.from({ length: hw.evaluation.value }).map((_, i) => (
          <span key={i}>★</span>
        ))}
      </div>
    );
  }

  const rawTotal = hw.problemGroups ? hw.problemGroups.reduce((sum, group) => sum + group.problems.length, 0) : 0;
  
  // Calculate how many are exempt
  const exemptCount = hw.submittedProblems ? hw.submittedProblems.filter(p => p.status === 'exempt').length : 0;
  const total = rawTotal - exemptCount;
  
  // Submitted count excludes exempt
  const submittedCount = hw.submittedProblems ? hw.submittedProblems.filter(p => p.status !== 'exempt').length : 0;
  
  if (total > 0) {
    const percent = Math.round((submittedCount / total) * 100);
    return (
      <div className="status-indicator progress-container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
        <span className="progress-text" style={{ fontSize: '13px', color: '#888' }}>{submittedCount}/{total} ({percent}%)</span>
        <div className="progress-bar" style={{ width: '80px', height: '4px', backgroundColor: '#333', borderRadius: '2px', overflow: 'hidden' }}>
          <div className="progress-fill" style={{ width: `${percent}%`, backgroundColor: '#FFD700', height: '100%' }}></div>
        </div>
      </div>
    );
  } else if (rawTotal > 0 && total === 0) {
    // All problems are exempt
    return <div className="status-indicator"><span style={{ color: '#888', fontSize: '13px' }}>전체 제외됨</span></div>;
  }

  return null;
};

export default function HomePage() {
  const navigate = useNavigate();
  const { data, isLoading, createHomework, createTest, updateTestInfo, deleteHomework, currentUser, isAdmin, login, logout, geminiApiKey, aiConfig, isAiConfigured, schedules, addSchedule, updateSchedule, deleteSchedule, promoBanners, mainBannerImage } = useHomework();

  const [activeTab, setActiveTab] = useState('homework'); // 'homework' | 'incorrect' | 'test' | 'schedule' | 'statistics'
  const [incorrectViewMode, setIncorrectViewMode] = useState('current'); // 'current' | 'history'
  const [zoomPromoImage, setZoomPromoImage] = useState(null);

  // Schedule State & Modals (과외용 학생별 주차별 진도표)
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [editScheduleId, setEditScheduleId] = useState(null);
  const [selectedScheduleStudent, setSelectedScheduleStudent] = useState(null);
  const [scheduleFilter, setScheduleFilter] = useState('all'); // 'all' | 'current' | 'completed' | 'upcoming'
  const [scheduleViewMode, setScheduleViewMode] = useState('compact'); // 'compact' | 'detailed'
  
  const allStudentNames = React.useMemo(() => {
    const names = new Set();
    data.forEach(section => {
      section.homeworks.forEach(hw => {
        if (hw.studentName) names.add(hw.studentName);
      });
    });
    if (schedules) {
      schedules.forEach(s => {
        if (s.studentName && s.studentName !== '전체') names.add(s.studentName);
      });
    }
    return Array.from(names);
  }, [data, schedules]);

  const activeScheduleStudent = isAdmin 
    ? (selectedScheduleStudent || allStudentNames[0] || '강백')
    : currentUser;

  const [scheduleForm, setScheduleForm] = useState({
    week: '1주차',
    period: '',
    subject: '공통수학1',
    studentName: '강백',
    chapter: '',
    topic: '',
    status: 'current'
  });

  const openAddScheduleModal = (defaultSubj = '공통수학1') => {
    setEditScheduleId(null);
    const studentSchedules = schedules ? schedules.filter(s => s.studentName === activeScheduleStudent) : [];
    const nextWeekNum = studentSchedules.length + 1;
    setScheduleForm({
      week: `${nextWeekNum}주차`,
      period: '',
      subject: defaultSubj || '공통수학1',
      studentName: activeScheduleStudent,
      chapter: '',
      topic: '',
      status: 'upcoming'
    });
    setIsScheduleModalOpen(true);
  };

  const openEditScheduleModal = (s) => {
    setEditScheduleId(s.id);
    setScheduleForm({
      week: s.week || '1주차',
      period: s.period || '',
      subject: s.subject || '공통수학1',
      studentName: s.studentName || activeScheduleStudent,
      chapter: s.chapter || '',
      topic: s.topic || '',
      status: s.status || 'current'
    });
    setIsScheduleModalOpen(true);
  };

  const handleSaveSchedule = () => {
    if (!scheduleForm.chapter && !scheduleForm.topic) {
      alert('예상 단원명을 입력해주세요.');
      return;
    }
    if (editScheduleId) {
      updateSchedule(editScheduleId, scheduleForm);
    } else {
      addSchedule({ ...scheduleForm, studentName: activeScheduleStudent });
    }
    setIsScheduleModalOpen(false);
  };

  // Filtered schedules computation (Student specific!)
  const filteredSchedules = React.useMemo(() => {
    if (!schedules) return [];
    return schedules.filter(s => {
      if (s.studentName !== activeScheduleStudent) return false;
      if (scheduleFilter === 'current') return s.status === 'current';
      if (scheduleFilter === 'completed') return s.status === 'completed';
      if (scheduleFilter === 'upcoming') return s.status === 'upcoming';
      return true;
    });
  }, [schedules, scheduleFilter, activeScheduleStudent]);

  // Group filtered schedules by Subject (과목 하나에 그안에 주차별 예상 단원 구성)
  const schedulesBySubject = React.useMemo(() => {
    const groups = {};
    filteredSchedules.forEach(s => {
      const subj = s.subject || '공통수학1';
      if (!groups[subj]) groups[subj] = [];
      groups[subj].push(s);
    });
    return groups;
  }, [filteredSchedules]);

  // Edit Test Modal State
  const [isEditTestModalOpen, setIsEditTestModalOpen] = useState(false);
  const [editTestId, setEditTestId] = useState(null);
  const [editTestStudent, setEditTestStudent] = useState('');
  const [editTestTitle, setEditTestTitle] = useState('');
  const [editTestScore, setEditTestScore] = useState('');
  const [editTestComment, setEditTestComment] = useState('');

  // AI Analytics Modal State
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [aiStudentName, setAiStudentName] = useState('');
  const [aiCustomDetails, setAiCustomDetails] = useState('');
  const [aiFeedbackText, setAiFeedbackText] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);

  // Login Modal State
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [loginName, setLoginName] = useState('');

  const openEditTestModal = (test) => {
    setEditTestId(test.id);
    setEditTestStudent(test.studentName);
    setEditTestTitle(test.title);
    setEditTestScore(test.score);
    setEditTestComment(test.comment || '');
    setIsEditTestModalOpen(true);
  };

  const handleEditTestSubmit = () => {
    if (!editTestStudent || !editTestTitle) {
      alert("학생 이름과 시험명은 필수입니다.");
      return;
    }
    updateTestInfo(editTestId, editTestTitle, editTestStudent, editTestScore, editTestComment);
    setIsEditTestModalOpen(false);
  };

  const handleLoginSubmit = () => {
    if (!loginName.trim()) return;
    login(loginName.trim());
    setIsLoginModalOpen(false);
    setLoginName('');
  };

  const handleAiAnalyzeStudentOpen = (studentName) => {
    if (!isAiConfigured && !geminiApiKey) {
      alert('AI API 키가 설정되지 않았습니다. 관리자 페이지 환경 설정에서 키를 먼저 입력해주세요.');
      return;
    }
    setAiStudentName(studentName);
    setIsAiModalOpen(true);
    setAiFeedbackText('');
    setAiCustomDetails('');
    setIsAiLoading(false);
  };

  const handleAiAnalyzeStudentExecute = async () => {
    if (!aiStudentName) return;
    setIsAiLoading(true);
    setAiFeedbackText('');

    try {
      // Gather student tests
      const studentTests = [];
      filteredData.forEach(section => {
        section.homeworks.forEach(hw => {
          if (hw.studentName === aiStudentName && (hw.type === 'test' || hw.isOnlineTest)) {
            studentTests.push({
              title: hw.title,
              date: section.date,
              score: hw.score || (hw.submittedProblems ? '온라인 제출 완료' : '미응시'),
              comment: hw.comment || ''
            });
          }
        });
      });

      // Gather student incorrect problems
      const studentIncorrect = incorrectByStudent.find(s => s.studentName === aiStudentName);
      
      const feedback = await analyzeStudentProgress(aiConfig || geminiApiKey, aiStudentName, studentTests, studentIncorrect ? studentIncorrect.problems : [], aiCustomDetails);
      setAiFeedbackText(feedback);
    } catch (error) {
      console.error(error);
      setAiFeedbackText(`AI 분석 중 오류가 발생했습니다: ${error.message}`);
    } finally {
      setIsAiLoading(false);
    }
  };

  // Filter homeworks by active tab and search/role
  const filteredData = React.useMemo(() => {
    return data.map(section => ({
      ...section,
      homeworks: section.homeworks.filter(hw => {
        // Tab filtering
        if (activeTab === 'test') {
          if (hw.type !== 'test' && !hw.isOnlineTest) return false;
        } else if (activeTab === 'homework') {
          if (hw.type === 'test') return false;
        }
        
        // Student Role filtering
        if (!isAdmin && currentUser) {
          return hw.studentName === currentUser;
        }
        return true;
      })
    })).filter(section => section.homeworks.length > 0);
  }, [data, currentUser, isAdmin, activeTab]);

  // Compute incorrect & difficult problems grouped by student and chapter subheaders
  const incorrectByStudent = React.useMemo(() => {
    const map = {};
    const targetData = isAdmin ? data : filteredData;
    
    targetData.forEach(section => {
      section.homeworks.forEach(hw => {
        if (!isAdmin && hw.studentName !== currentUser) return;
        
        const targetProblems = (hw.submittedProblems || []).filter(p => {
          if (incorrectViewMode === 'current') {
            return p.status === 'incorrect';
          } else if (incorrectViewMode === 'bookmark') {
            return p.isBookmarked;
          } else {
            // 'all' / history: all problems that are incorrect, was incorrect, attempts > 1, or bookmarked
            return p.status === 'incorrect' || p.hasBeenIncorrect || (p.attempts > 1) || p.isBookmarked || (p.history && p.history.some(h => h.status === 'incorrect'));
          }
        });

        if (targetProblems.length > 0) {
          if (!map[hw.studentName]) map[hw.studentName] = [];
          
          targetProblems.forEach(p => {
            const group = hw.problemGroups?.find(g => g.groupId === p.groupId);
            map[hw.studentName].push({
              hwId: hw.id,
              groupId: p.groupId,
              hwTitle: hw.title,
              label: group ? group.label : (hw.title || '기본'),
              problemNumber: p.problemNumber,
              status: p.status,
              attempts: p.attempts || 1,
              imageUrl: p.imageUrl,
              aiFeedback: p.aiFeedback,
              isBookmarked: p.isBookmarked || false,
              history: p.history || []
            });
          });
        }
      });
    });
    
    return Object.entries(map).map(([name, problems]) => {
      const subHeaderMap = {};
      problems.forEach(p => {
        // Group by group label (e.g. 공통수학1, 공통수학2) or homework title
        const subKey = p.label || p.hwTitle;
        if (!subHeaderMap[subKey]) {
          subHeaderMap[subKey] = {
            subHeader: subKey,
            hwId: p.hwId,
            groupId: p.groupId,
            hwTitle: p.hwTitle,
            label: p.label,
            items: []
          };
        }
        subHeaderMap[subKey].items.push(p);
      });

      return {
        studentName: name,
        totalCount: problems.length,
        unresolvedCount: problems.filter(p => p.status === 'incorrect').length,
        resolvedCount: problems.filter(p => p.status === 'correct').length,
        bookmarkedCount: problems.filter(p => p.isBookmarked).length,
        problems,
        groupedSections: Object.values(subHeaderMap)
      };
    });
  }, [data, currentUser, isAdmin, filteredData, incorrectViewMode]);

  const handleReassign = (studentData) => {
    const now = new Date();
    const createdAt = `${now.getMonth() + 1}/${now.getDate()} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    const dateStr = `${now.getMonth() + 1}월 ${now.getDate()}일 생성`;
    
    // Group incorrect problems by their original hwTitle and label
    const groupsMap = {};
    studentData.problems.forEach(p => {
      const groupKey = p.label ? `${p.hwTitle} [${p.label}]` : p.hwTitle;
      if (!groupsMap[groupKey]) {
        groupsMap[groupKey] = [];
      }
      groupsMap[groupKey].push(p.problemNumber);
    });

    const newGroups = Object.entries(groupsMap).map(([label, problems], idx) => ({
      groupId: 'g' + Date.now() + idx,
      label: label,
      problems: problems,
      startNum: Math.min(...problems),
      endNum: Math.max(...problems)
    }));

    createHomework(dateStr, studentData.studentName, '오답 노트 (재도전)', '틀린 문제들만 모아놓은 숙제입니다.', createdAt, newGroups);
    alert(`${studentData.studentName} 학생의 오답 노트가 새 숙제로 출제되었습니다!`);
  };

  const handleReassignSection = (studentName, sectionData) => {
    const now = new Date();
    const createdAt = `${now.getMonth() + 1}/${now.getDate()} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    const dateStr = `${now.getMonth() + 1}월 ${now.getDate()}일 생성`;

    const problems = sectionData.items.map(p => p.problemNumber).sort((a,b) => a-b);
    const newGroups = [{
      groupId: 'g' + Date.now(),
      label: sectionData.label || sectionData.subHeader,
      problems: problems,
      startNum: Math.min(...problems),
      endNum: Math.max(...problems)
    }];

    createHomework(dateStr, studentName, `오답 재도전 (${sectionData.subHeader})`, `${sectionData.subHeader} 단원에서 틀렸던 문제 모음입니다.`, createdAt, newGroups);
    alert(`${studentName} 학생의 [${sectionData.subHeader}] 오답 문제가 새 숙제로 출제되었습니다!`);
  };

  const exportToCSV = () => {
    const BOM = "\uFEFF";
    let csvContent = BOM + "날짜 (제출마감일),학생 이름,과목 및 제목 (출처),문제 범위 (단원명),문제 번호,상태,시도 횟수,AI 피드백\n";

    data.forEach(section => {
      section.homeworks.forEach(hw => {
        const title = (hw.title || "").replace(/,/g, " ");
        const student = (hw.studentName || "").replace(/,/g, " ");
        const date = (section.date || "").replace(/,/g, " ");
        
        const subMap = {};
        if (hw.submittedProblems) {
          hw.submittedProblems.forEach(sp => {
            subMap[sp.problemNumber] = sp;
          });
        }

        if (hw.type === 'test') {
          // Export test as a single row
          const score = hw.score || '';
          const comment = (hw.comment || "").replace(/,/g, " ");
          csvContent += `${date},${student},${title},[테스트 평가],-,테스트 점수: ${score},-,${comment}\n`;
        } else if (hw.problemGroups) {
          hw.problemGroups.forEach(group => {
            const label = (group.label || "").replace(/,/g, " ");
            group.problems.forEach(pNum => {
              const sp = subMap[pNum];
              let status = '미제출';
              let attempts = 0;
              let hasFeedback = '없음';

              if (sp) {
                if (sp.status === 'exempt') status = '제외됨';
                else if (sp.status === 'correct') status = '정답(O)';
                else if (sp.status === 'incorrect') status = '오답(X)';
                else if (sp.status === 'pending') status = '채점대기';
                else status = sp.status;

                attempts = sp.attempts || (sp.status === 'exempt' ? 0 : 1);
                hasFeedback = sp.aiFeedback ? '있음' : '없음';
              }

              csvContent += `${date},${student},${title},${label},${pNum},${status},${attempts},${hasFeedback}\n`;
            });
          });
        }
      });
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `숙제_통합데이터_${new Date().toISOString().slice(0,10)}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (isLoading) {
    return (
      <div className="app-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', backgroundColor: '#111' }}>
        <div style={{ color: '#FFD700', fontSize: '18px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
          <div className="spinner" style={{ width: '40px', height: '40px', border: '4px solid #333', borderTop: '4px solid #FFD700', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
          <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
          데이터를 불러오는 중...
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      {/* Header */}
      <header className="header" style={{ padding: '16px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
        <button 
          className="back-btn" 
          onClick={() => {
            if (currentUser) {
              if (window.confirm('로그아웃 하시겠습니까?')) {
                logout();
              }
            } else {
              setIsLoginModalOpen(true);
            }
          }}
          style={{ 
            width: 'auto', 
            display: 'flex', 
            alignItems: 'center', 
            gap: '6px', 
            padding: '6px 10px', 
            backgroundColor: '#1E2028',
            border: '1px solid #333',
            borderRadius: '16px',
            fontSize: '13px',
            fontWeight: 'bold',
            color: '#fff',
            whiteSpace: 'nowrap',
            cursor: 'pointer'
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
             <path d="M12 12C14.21 12 16 10.21 16 8C16 5.79 14.21 4 12 4C9.79 4 8 5.79 8 8C8 10.21 9.79 12 12 12ZM12 14C9.33 14 4 15.34 4 18V20H20V18C20 15.34 14.67 14 12 14Z" fill="#FFD700"/>
          </svg>
          {currentUser ? `${currentUser} 님` : '로그인'}
        </button>

        <div className="header-tabs" style={{ display: 'flex', flex: 1, justifyContent: 'space-around', alignItems: 'center', maxWidth: '360px', margin: '0 auto' }}>
          {[
            { id: 'homework', label: '숙제' },
            { id: 'incorrect', label: '오답' },
            { id: 'test', label: '시험' },
            { id: 'schedule', label: '일정' },
            { id: 'statistics', label: '성적' }
          ].map(tab => {
            const isActive = activeTab === tab.id;
            return (
              <h1 
                key={tab.id}
                className="header-title" 
                style={{ 
                  color: isActive ? '#FFD700' : '#888', 
                  fontWeight: isActive ? 'bold' : 'normal',
                  cursor: 'pointer',
                  margin: 0,
                  padding: '4px 6px',
                  borderBottom: isActive ? '2.5px solid #FFD700' : '2.5px solid transparent',
                  whiteSpace: 'nowrap',
                  fontSize: '16px',
                  transition: 'all 0.2s'
                }}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </h1>
            );
          })}
        </div>

        {isAdmin && (
          <div style={{ display: 'flex', gap: '8px' }}>
            <button 
              className="new-hw-btn" 
              style={{ 
                backgroundColor: '#FFD700', 
                color: '#000', 
                fontWeight: 'bold',
                padding: '6px 12px',
                borderRadius: '8px',
                fontSize: '12px',
                whiteSpace: 'nowrap'
              }} 
              onClick={() => navigate('/admin')}
            >
              👑 관리자
            </button>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="content-list">
        {!currentUser ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '10px 0 40px 0' }}>
            {/* Blank Yellow Box / Image Banner Frame */}
            <div style={{
              backgroundColor: '#181A22',
              border: '1px solid #FFD700',
              borderRadius: '16px',
              minHeight: '140px',
              boxShadow: '0 6px 20px rgba(0,0,0,0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: (mainBannerImage || (promoBanners && promoBanners.find(b => b.imageUrl))) ? '6px' : '16px',
              overflow: 'hidden'
            }}>
              {(mainBannerImage || (promoBanners && promoBanners.find(b => b.imageUrl)?.imageUrl)) ? (
                <div 
                  style={{ width: '100%', borderRadius: '12px', overflow: 'hidden', cursor: 'pointer' }}
                  onClick={() => setZoomPromoImage(formatDriveImageUrl(mainBannerImage || promoBanners.find(b => b.imageUrl)?.imageUrl))}
                >
                  <img 
                    src={formatDriveImageUrl(mainBannerImage || promoBanners.find(b => b.imageUrl)?.imageUrl)} 
                    alt="홍보/성과 이미지"
                    referrerPolicy="no-referrer"
                    style={{ width: '100%', height: 'auto', display: 'block', borderRadius: '10px' }}
                  />
                </div>
              ) : null}
            </div>

            {/* Feature Cards Section */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                <span style={{ fontSize: '18px' }}>📢</span>
                <h3 style={{ color: '#ffffff', fontSize: '17px', margin: 0, fontWeight: 'bold' }}>
                  수업 및 학습 시스템
                </h3>
              </div>

              {/* 3 Core Feature Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
                <div style={{ backgroundColor: '#1E2028', border: '1px solid #2d303e', borderRadius: '12px', padding: '16px' }}>
                  <div style={{ fontSize: '24px', marginBottom: '8px' }}>🤖</div>
                  <h4 style={{ color: '#81C784', margin: '0 0 6px 0', fontSize: '14px' }}>AI 손글씨 자동인식 및 첨삭</h4>
                  <p style={{ color: '#999', margin: 0, fontSize: '12px', lineHeight: 1.4 }}>
                    학생의 손글씨 풀이를 AI가 정밀 분석하여 계산 실수와 논리 오류를 실시간 교정
                  </p>
                </div>

                <div style={{ backgroundColor: '#1E2028', border: '1px solid #2d303e', borderRadius: '12px', padding: '16px' }}>
                  <div style={{ fontSize: '24px', marginBottom: '8px' }}>📊</div>
                  <h4 style={{ color: '#FFB74D', margin: '0 0 6px 0', fontSize: '14px' }}>주차별 진도 & 오답 누적 관리</h4>
                  <p style={{ color: '#999', margin: 0, fontSize: '12px', lineHeight: 1.4 }}>
                    틀린 문제들을 단원별로 자동 누적 보관하여 시험 직전 완벽 복습 제공
                  </p>
                </div>

                <div style={{ backgroundColor: '#1E2028', border: '1px solid #2d303e', borderRadius: '12px', padding: '16px' }}>
                  <div style={{ fontSize: '24px', marginBottom: '8px' }}>👨‍👩‍👧</div>
                  <h4 style={{ color: '#64B5F6', margin: '0 0 6px 0', fontSize: '14px' }}>부모의 학생 상태 확인</h4>
                  <p style={{ color: '#999', margin: 0, fontSize: '12px', lineHeight: 1.4 }}>
                    자녀의 주차별 진도 현황, 숙제 제출 및 오답노트, 단원별 시험 성적을 실시간으로 투명하게 확인
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : activeTab === 'incorrect' ? (
          // --- 오답 & 복습 보관함 탭 (단원별 직관적 그리드) ---
          <div>
            <div style={{ marginBottom: '16px' }}>
              <h2 style={{ color: '#FFD700', fontSize: '18px', margin: '0 0 6px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                📚 단원별 오답 & 복습 보관함
              </h2>
              <p style={{ color: '#888', fontSize: '13px', margin: 0 }}>
                학생들이 풀면서 틀렸거나 어려웠던 문제들이 단원별로 누적 보관되어 스스로 언제든 다시 풀고 복습할 수 있습니다.
              </p>
            </div>

            {/* Filter Toggle: 전체 복습함 vs 미해결 오답 vs 어려웠던 문제 */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => setIncorrectViewMode('history')}
                style={{
                  flex: 1,
                  minWidth: '110px',
                  padding: '9px 12px',
                  borderRadius: '10px',
                  border: incorrectViewMode === 'history' ? '2px solid #1E88E5' : '1px solid #333',
                  backgroundColor: incorrectViewMode === 'history' ? '#142742' : '#1E2028',
                  color: incorrectViewMode === 'history' ? '#90CAF9' : '#888',
                  fontWeight: 'bold',
                  fontSize: '13px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  transition: 'all 0.2s'
                }}
              >
                <span>📚 단원별 전체</span>
              </button>

              <button
                type="button"
                onClick={() => setIncorrectViewMode('current')}
                style={{
                  flex: 1,
                  minWidth: '110px',
                  padding: '9px 12px',
                  borderRadius: '10px',
                  border: incorrectViewMode === 'current' ? '2px solid #E53935' : '1px solid #333',
                  backgroundColor: incorrectViewMode === 'current' ? '#3B1A1E' : '#1E2028',
                  color: incorrectViewMode === 'current' ? '#FF8A80' : '#888',
                  fontWeight: 'bold',
                  fontSize: '13px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  transition: 'all 0.2s'
                }}
              >
                <span>🚨 미해결 오답만</span>
              </button>

              <button
                type="button"
                onClick={() => setIncorrectViewMode('bookmark')}
                style={{
                  flex: 1,
                  minWidth: '110px',
                  padding: '9px 12px',
                  borderRadius: '10px',
                  border: incorrectViewMode === 'bookmark' ? '2px solid #FFD700' : '1px solid #333',
                  backgroundColor: incorrectViewMode === 'bookmark' ? '#3A3215' : '#1E2028',
                  color: incorrectViewMode === 'bookmark' ? '#FFD700' : '#888',
                  fontWeight: 'bold',
                  fontSize: '13px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  transition: 'all 0.2s'
                }}
              >
                <span>⭐️ 어려움 보관</span>
              </button>
            </div>

            {incorrectByStudent.length > 0 ? (
              <div style={{ marginBottom: '32px' }}>
                {incorrectByStudent.map((studentData, idx) => (
                  <div key={idx} style={{ marginBottom: '30px' }}>
                    {/* Student Title if Admin or multiple students */}
                    {isAdmin && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', paddingBottom: '8px', borderBottom: '1px solid #2A2D3A' }}>
                        <span style={{ fontSize: '15px', fontWeight: 'bold', color: '#FFD700' }}>
                          👤 {studentData.studentName} 학생
                        </span>
                        <span style={{ fontSize: '12px', color: '#888' }}>
                          (누적 {studentData.totalCount}문제 · 미해결 {studentData.unresolvedCount})
                        </span>
                      </div>
                    )}

                    {/* Chapter Sections (공통수학1, 공통수학2, ...) */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                      {studentData.groupedSections.map((sec, secIdx) => (
                        <div key={secIdx}>
                          {/* Chapter Badge */}
                          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px', gap: '8px' }}>
                            <div style={{ 
                              backgroundColor: '#333', 
                              color: '#FFD700', 
                              padding: '4px 12px', 
                              borderRadius: '12px', 
                              fontSize: '12px',
                              fontWeight: 'bold'
                            }}>
                              {sec.subHeader}
                            </div>
                            <span style={{ fontSize: '12px', color: '#666' }}>
                              {sec.items.length}문제
                            </span>
                          </div>

                          {/* 4-Column Problem Squares Grid (Exact homework grid style) */}
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
                            {sec.items.map((prob, pIdx) => {
                              const isCorrect = prob.status === 'correct';
                              const isIndeterminate = prob.status === 'indeterminate' || prob.status === 'unclear';
                              const isIncorrect = prob.status === 'incorrect';
                              
                              let borderColor = '#E53935';
                              let labelText = '❌ 틀림';
                              let labelColor = '#B71C1C';

                              if (isCorrect) {
                                borderColor = '#1E88E5';
                                labelText = '⭕ 맞음';
                                labelColor = '#0D47A1';
                              } else if (isIndeterminate) {
                                borderColor = '#43A047';
                                labelText = '🔺 확인';
                                labelColor = '#1B5E20';
                              } else if (prob.isBookmarked && !isIncorrect) {
                                borderColor = '#FFD700';
                                labelText = '⭐️ 보관';
                                labelColor = '#333';
                              }

                              return (
                                <button
                                  key={pIdx}
                                  onClick={() => navigate(`/upload/${prob.hwId}/${prob.groupId}/${prob.problemNumber}`)}
                                  style={{
                                    aspectRatio: '1',
                                    backgroundColor: '#FFD700',
                                    border: `3.5px solid ${borderColor}`,
                                    borderRadius: '12px',
                                    color: '#000000',
                                    fontSize: '18px',
                                    fontWeight: 'bold',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                    cursor: 'pointer',
                                    position: 'relative',
                                    boxShadow: `0 2px 8px ${borderColor}44`,
                                    transition: 'transform 0.15s ease'
                                  }}
                                  onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                                  onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
                                >
                                  {prob.isBookmarked && (
                                    <span style={{ position: 'absolute', top: '3px', left: '5px', fontSize: '11px' }}>⭐️</span>
                                  )}
                                  <span>{prob.problemNumber}</span>
                                  <span style={{ fontSize: '10px', marginTop: '2px', fontWeight: 'bold', color: labelColor }}>
                                    {labelText}
                                  </span>
                                  {prob.attempts > 1 && (
                                    <div style={{ 
                                      position: 'absolute', bottom: '3px', right: '5px', 
                                      fontSize: '10px', color: labelColor, fontWeight: 'bold' 
                                    }}>
                                      {prob.attempts}회
                                    </div>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ color: '#888', textAlign: 'center', marginTop: '50px' }}>
                {incorrectViewMode === 'current' 
                  ? '🎉 현재 미해결된 오답이 없습니다!' 
                  : (incorrectViewMode === 'bookmark' ? '⭐️ 보관된 어려운 문제가 없습니다.' : '기록된 오답 & 복습 문제가 없습니다.')}
              </div>
            )}
          </div>
        ) : activeTab === 'test' ? (
          // --- 테스트 관리 탭 ---
          filteredData.length === 0 ? (
            <div style={{ color: '#888', textAlign: 'center', marginTop: '50px' }}>
              등록된 테스트 기록이 없습니다.
            </div>
          ) : (
            filteredData.map((section, index) => (
              <div key={index}>
                <div className="date-section">
                  <h2 className="date-title">{section.date}</h2>
                </div>
                
                {section.homeworks.map(test => {
                  if (test.type === 'test') {
                    return (
                      <div 
                        key={test.id} 
                        className="homework-card" 
                        onClick={() => {
                          if (isAdmin) openEditTestModal(test);
                        }}
                        style={{ 
                          borderLeft: '4px solid #4CAF50', 
                          padding: '12px 16px', 
                          cursor: isAdmin ? 'pointer' : 'default',
                          minHeight: 'unset' 
                        }}
                      >
                        <div className="card-header" style={{ marginBottom: 0 }}>
                          <div className="sender-receiver">
                            <div className="profile-container" style={{ width: '32px', height: '32px' }}>
                              <div className="profile-pic" style={{ backgroundColor: '#444', color: '#FFD700', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 'bold' }}>
                                {test.studentName.charAt(0)}
                              </div>
                            </div>
                            <div className="names">
                              <span style={{ fontSize: '15px', color: '#fff' }}>{test.studentName}</span>
                              <span style={{ fontSize: '13px', color: '#888', display: 'block', marginTop: '2px' }}>{test.title}</span>
                            </div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#4CAF50' }}>
                              {test.score}점
                            </div>
                            {isAdmin && (
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (window.confirm(`'${test.title}' 테스트 기록을 삭제하시겠습니까?`)) {
                                    deleteHomework(test.id);
                                  }
                                }}
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
                        <div className="card-content" style={{ marginTop: '12px' }}>
                          <div style={{ 
                            padding: '12px', 
                            backgroundColor: '#1A1B23', 
                            borderRadius: '8px', 
                            color: test.comment ? '#ccc' : '#555', 
                            fontSize: '13px',
                            whiteSpace: 'pre-wrap' 
                          }}>
                            {test.comment ? test.comment : "클릭하여 시험문제 틀린 것 분석 및 코멘트를 남겨주세요."}
                          </div>
                        </div>
                      </div>
                    );
                  } else {
                    return (
                      <div 
                        key={test.id} 
                        className="homework-card" 
                        onClick={() => navigate(`/detail/${test.id}`)}
                      >
                        <div className="card-header">
                          <div className="sender-receiver">
                            <div className="profile-container">
                              <div className="profile-pic" style={{ backgroundColor: '#444', color: '#FFD700', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', fontWeight: 'bold' }}>
                                {test.studentName.charAt(0)}
                              </div>
                              <div className="red-dot"></div>
                            </div>
                            <div className="names">
                              <span style={{ fontSize: '16px', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                {test.studentName}
                                <span style={{ backgroundColor: '#E91E63', color: '#fff', padding: '2px 6px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold' }}>
                                  ⏱️ 온라인 시험 {test.timeLimit && `(${test.timeLimit}분)`}
                                </span>
                              </span>
                              <span style={{ fontSize: '14px', color: '#888', display: 'block', marginTop: '2px' }}>{test.title}</span>
                            </div>
                          </div>
                          <StatusIndicator hw={test} />
                        </div>
                        
                        <div className="card-content">
                          <p className="hw-desc">{test.description}</p>
                        </div>
                      </div>
                    );
                  }
                })}
              </div>
            ))
          )
        ) : activeTab === 'statistics' ? (
          // --- 성적 통계 탭 ---
          filteredData.length === 0 ? (
            <div style={{ color: '#888', textAlign: 'center', marginTop: '50px' }}>
              등록된 성적 기록이 없습니다.
            </div>
          ) : (
            <div style={{ padding: '0 16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h2 style={{ fontSize: '18px', color: '#FFD700', margin: 0 }}>📊 전체 성적 통계표</h2>
              </div>
              <div style={{ overflowX: 'auto', backgroundColor: '#1A1B23', borderRadius: '12px', border: '1px solid #333' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px', color: '#ddd', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#252631', borderBottom: '1px solid #444' }}>
                      <th style={{ padding: '12px 16px', fontWeight: 'bold' }}>학생 이름</th>
                      <th style={{ padding: '12px 16px', fontWeight: 'bold' }}>시험명</th>
                      <th style={{ padding: '12px 16px', fontWeight: 'bold' }}>일자</th>
                      <th style={{ padding: '12px 16px', fontWeight: 'bold' }}>성적 / 평가</th>
                      {isAdmin && <th style={{ padding: '12px 16px', fontWeight: 'bold' }}>관리</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredData.map(section => 
                      section.homeworks.map(test => {
                        let scoreDisplay = '-';
                        if (test.type === 'test') {
                          scoreDisplay = test.score ? `${test.score}점` : '미입력';
                        } else if (test.isOnlineTest) {
                          const rawTotal = test.problemGroups ? test.problemGroups.reduce((sum, group) => sum + group.problems.length, 0) : 0;
                          const exemptCount = test.submittedProblems ? test.submittedProblems.filter(p => p.status === 'exempt').length : 0;
                          const total = rawTotal - exemptCount;
                          const correctCount = test.submittedProblems ? test.submittedProblems.filter(p => p.status === 'correct').length : 0;
                          
                          if (total > 0) {
                            const percent = Math.round((correctCount / total) * 100);
                            scoreDisplay = `정답 ${correctCount}/${total} (${percent}점)`;
                          } else {
                            scoreDisplay = '응시 전';
                          }
                        }
                        
                        return (
                          <tr key={test.id} style={{ borderBottom: '1px solid #333' }}>
                            <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                {test.studentName}
                                <button 
                                  onClick={() => handleAiAnalyzeStudentOpen(test.studentName)}
                                  title="AI 성적 분석"
                                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px' }}
                                >
                                  🤖
                                </button>
                              </div>
                            </td>
                            <td style={{ padding: '12px 16px' }}>{test.title}</td>
                            <td style={{ padding: '12px 16px', whiteSpace: 'nowrap', color: '#888' }}>{section.date}</td>
                            <td style={{ padding: '12px 16px', fontWeight: 'bold', color: test.type === 'test' ? '#4CAF50' : '#2196F3' }}>
                              {scoreDisplay}
                            </td>
                            {isAdmin && (
                              <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                  <button
                                    onClick={() => {
                                      if (test.type === 'test') {
                                        setEditTestStudent(test.studentName);
                                        setEditTestTitle(test.title);
                                        setEditTestScore(test.score || '');
                                        setEditTestComment(test.comment || '');
                                        setEditTestId(test.id);
                                        setIsEditTestModalOpen(true);
                                      } else {
                                        alert("온라인 시험 성적은 학생들이 제출한 문제를 기준으로 자동 계산되므로 직접 수정할 수 없습니다.");
                                      }
                                    }}
                                    style={{ background: '#4CAF50', color: 'white', border: 'none', borderRadius: '4px', padding: '4px 8px', cursor: 'pointer', fontSize: '12px' }}
                                  >
                                    수정
                                  </button>
                                  <button
                                    onClick={() => {
                                      if (window.confirm(`${test.studentName} 학생의 [${test.title}] 기록을 정말 삭제하시겠습니까?`)) {
                                        deleteHomework(test.id);
                                      }
                                    }}
                                    style={{ background: '#f44336', color: 'white', border: 'none', borderRadius: '4px', padding: '4px 8px', cursor: 'pointer', fontSize: '12px' }}
                                  >
                                    삭제
                                  </button>
                                </div>
                              </td>
                            )}
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )
        ) : activeTab === 'schedule' ? (
          // --- 과외용 학생별 주차별 진도표 탭 ---
          <div>
            {/* Student Selector if Admin */}
            {isAdmin && allStudentNames.length > 0 && (
              <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '8px', marginBottom: '16px' }}>
                {allStudentNames.map(name => {
                  const isSelected = activeScheduleStudent === name;
                  return (
                    <button
                      key={name}
                      onClick={() => setSelectedScheduleStudent(name)}
                      style={{
                        padding: '6px 14px',
                        borderRadius: '20px',
                        border: isSelected ? '1.5px solid #FFD700' : '1px solid #444',
                        backgroundColor: isSelected ? '#333' : '#1A1B23',
                        color: isSelected ? '#FFD700' : '#888',
                        fontWeight: 'bold',
                        fontSize: '13px',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      👤 {name} 학생
                    </button>
                  );
                })}
              </div>
            )}

            {/* Header Title */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <h2 style={{ color: '#FFD700', fontSize: '18px', margin: '0 0 6px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  📋 {activeScheduleStudent} 학생의 주차별 진도표
                </h2>
                <p style={{ color: '#888', fontSize: '13px', margin: 0 }}>
                  현재 나가고 있는 주차별 진도 현황입니다.
                </p>
              </div>

              {isAdmin && (
                <button
                  type="button"
                  onClick={openAddScheduleModal}
                  style={{
                    backgroundColor: '#FFD700',
                    color: '#000',
                    fontWeight: 'bold',
                    padding: '8px 14px',
                    borderRadius: '8px',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '13px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  ➕ 진도 등록
                </button>
              )}
            </div>

            {/* Filter chips */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', overflowX: 'auto', paddingBottom: '4px' }}>
              <button
                type="button"
                onClick={() => setScheduleFilter('all')}
                style={{
                  padding: '7px 12px',
                  borderRadius: '20px',
                  border: scheduleFilter === 'all' ? '1.5px solid #FFD700' : '1px solid #333',
                  backgroundColor: scheduleFilter === 'all' ? '#333' : '#1A1B23',
                  color: scheduleFilter === 'all' ? '#FFD700' : '#888',
                  fontSize: '12px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap'
                }}
              >
                전체 주차 ({filteredSchedules.length})
              </button>

              <button
                type="button"
                onClick={() => setScheduleFilter('current')}
                style={{
                  padding: '7px 12px',
                  borderRadius: '20px',
                  border: scheduleFilter === 'current' ? '1.5px solid #FFD700' : '1px solid #333',
                  backgroundColor: scheduleFilter === 'current' ? '#3A3215' : '#1A1B23',
                  color: scheduleFilter === 'current' ? '#FFD700' : '#888',
                  fontSize: '12px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap'
                }}
              >
                🔥 이번 주 진도
              </button>

              <button
                type="button"
                onClick={() => setScheduleFilter('completed')}
                style={{
                  padding: '7px 12px',
                  borderRadius: '20px',
                  border: scheduleFilter === 'completed' ? '1.5px solid #4CAF50' : '1px solid #333',
                  backgroundColor: scheduleFilter === 'completed' ? '#1A3320' : '#1A1B23',
                  color: scheduleFilter === 'completed' ? '#A5D6A7' : '#888',
                  fontSize: '12px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap'
                }}
              >
                ✅ 완료
              </button>

              <button
                type="button"
                onClick={() => setScheduleFilter('upcoming')}
                style={{
                  padding: '7px 12px',
                  borderRadius: '20px',
                  border: scheduleFilter === 'upcoming' ? '1.5px solid #64B5F6' : '1px solid #333',
                  backgroundColor: scheduleFilter === 'upcoming' ? '#142742' : '#1A1B23',
                  color: scheduleFilter === 'upcoming' ? '#90CAF9' : '#888',
                  fontSize: '12px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap'
                }}
              >
                ⏳ 예정
              </button>
            </div>

            {/* Subject-based Schedule Containers (과목 하나에 그안에 주차별 예상 단원) */}
            {Object.keys(schedulesBySubject).length === 0 ? (
              <div style={{ color: '#888', textAlign: 'center', marginTop: '50px' }}>
                등록된 진도 계획이 없습니다.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '40px' }}>
                {Object.entries(schedulesBySubject).map(([subjName, subjItems]) => {
                  const currentItem = subjItems.find(s => s.status === 'current');

                  return (
                    <div
                      key={subjName}
                      className="homework-card"
                      style={{
                        backgroundColor: '#181A22',
                        border: '1.5px solid #2D303E',
                        borderRadius: '16px',
                        padding: '16px 18px',
                        marginBottom: 0,
                        boxShadow: '0 4px 16px rgba(0,0,0,0.35)'
                      }}
                    >
                      {/* 과목 헤더 */}
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        paddingBottom: '12px',
                        borderBottom: '1px solid #282A36',
                        marginBottom: '12px',
                        flexWrap: 'wrap',
                        gap: '8px'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '18px' }}>📘</span>
                          <h3 style={{ color: '#FFD700', fontSize: '16px', margin: 0, fontWeight: 'bold' }}>
                            {subjName}
                          </h3>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {currentItem && (
                            <span style={{
                              backgroundColor: '#3A3215',
                              color: '#FFD700',
                              border: '1px solid #FFD700',
                              fontSize: '11px',
                              fontWeight: 'bold',
                              padding: '2px 8px',
                              borderRadius: '10px'
                            }}>
                              🔥 이번 주: {currentItem.week}
                            </span>
                          )}
                          <span style={{
                            backgroundColor: '#222533',
                            color: '#90CAF9',
                            fontSize: '11px',
                            fontWeight: 'bold',
                            padding: '2px 8px',
                            borderRadius: '10px'
                          }}>
                            총 {subjItems.length}주차 진도
                          </span>
                          {isAdmin && (
                            <button
                              type="button"
                              onClick={() => openAddScheduleModal(subjName)}
                              style={{
                                backgroundColor: '#252838',
                                color: '#FFD700',
                                border: '1px solid #FFD700',
                                borderRadius: '8px',
                                padding: '2px 8px',
                                fontSize: '11px',
                                fontWeight: 'bold',
                                cursor: 'pointer'
                              }}
                            >
                              ➕ 주차 추가
                            </button>
                          )}
                        </div>
                      </div>

                      {/* 과목 내부: 주차별 예상 진도 단원 목록 */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {subjItems.map(s => {
                          const isCurrent = s.status === 'current';
                          const isCompleted = s.status === 'completed';
                          const statusBg = isCurrent ? '#3A3215' : (isCompleted ? '#1A3320' : '#222533');
                          const statusCol = isCurrent ? '#FFD700' : (isCompleted ? '#A5D6A7' : '#888');
                          const statusBorder = isCurrent ? '#FFD700' : (isCompleted ? '#4CAF50' : '#333');
                          const statusText = isCurrent ? '🔥 이번 주' : (isCompleted ? '✅ 완료' : '⏳ 예정');

                          return (
                            <div
                              key={s.id}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '10px 14px',
                                backgroundColor: isCurrent ? '#232532' : '#1C1D26',
                                borderRadius: '10px',
                                borderLeft: isCurrent ? '4px solid #FFD700' : (isCompleted ? '4px solid #4CAF50' : '4px solid #444'),
                                border: `1px solid ${isCurrent ? 'rgba(255, 215, 0, 0.35)' : '#282A36'}`,
                                gap: '10px',
                                flexWrap: 'wrap'
                              }}
                            >
                              {/* 좌측: 주차 + 기간 */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: '110px' }}>
                                <span style={{
                                  backgroundColor: isCurrent ? '#FFD700' : '#2A2C3A',
                                  color: isCurrent ? '#000' : '#FFD700',
                                  fontWeight: 'bold',
                                  fontSize: '11.5px',
                                  padding: '2px 7px',
                                  borderRadius: '6px',
                                  whiteSpace: 'nowrap'
                                }}>
                                  {s.week}
                                </span>
                                {s.period && (
                                  <span style={{ color: '#888', fontSize: '11px', whiteSpace: 'nowrap' }}>
                                    {s.period}
                                  </span>
                                )}
                              </div>

                              {/* 중앙: 예상 단원 */}
                              <div style={{ flex: 1, minWidth: '160px' }}>
                                <div style={{
                                  color: isCurrent ? '#ffffff' : '#e0e0e0',
                                  fontWeight: 'bold',
                                  fontSize: '13px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '6px'
                                }}>
                                  <span style={{ color: isCurrent ? '#FFD700' : '#888', fontSize: '11px' }}>📖</span>
                                  <span>{s.chapter || s.topic}</span>
                                </div>
                                {s.topic && s.topic !== s.chapter && !s.topic.startsWith('1회차') && (
                                  <div style={{ color: '#888', fontSize: '11px', marginTop: '2px', paddingLeft: '18px' }}>
                                    {s.topic}
                                  </div>
                                )}
                              </div>

                              {/* 우측: 상태 + 관리자 버튼 */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{
                                  backgroundColor: statusBg,
                                  color: statusCol,
                                  border: `1px solid ${statusBorder}`,
                                  padding: '2px 7px',
                                  borderRadius: '8px',
                                  fontSize: '10.5px',
                                  fontWeight: 'bold',
                                  whiteSpace: 'nowrap'
                                }}>
                                  {statusText}
                                </span>

                                {isAdmin && (
                                  <div style={{ display: 'flex', gap: '4px' }}>
                                    <button
                                      type="button"
                                      onClick={() => openEditScheduleModal(s)}
                                      style={{ background: 'none', border: '1px solid #4CAF50', color: '#81C784', borderRadius: '4px', padding: '1px 5px', fontSize: '10px', cursor: 'pointer' }}
                                    >
                                      ✏️
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (window.confirm(`'${s.week}' 진도를 삭제하시겠습니까?`)) {
                                          deleteSchedule(s.id);
                                        }
                                      }}
                                      style={{ background: 'none', border: '1px solid #E53935', color: '#EF9A9A', borderRadius: '4px', padding: '1px 5px', fontSize: '10px', cursor: 'pointer' }}
                                    >
                                      🗑️
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          // --- 숙제 관리 탭 ---
          filteredData.length === 0 ? (
            <div style={{ color: '#888', textAlign: 'center', marginTop: '50px' }}>
              등록된 숙제가 없습니다.
            </div>
          ) : (
            filteredData.map((section, index) => (
              <div key={index}>
                <div className="date-section">
                  <h2 className="date-title">{section.date}</h2>
                </div>
                
                {section.homeworks.map(hw => (
                  <div 
                    key={hw.id} 
                    className="homework-card" 
                    onClick={() => navigate(`/detail/${hw.id}`)}
                  >
                    <div className="card-header">
                      <div className="sender-receiver">
                        <div className="profile-container">
                          <div className="profile-pic" style={{ backgroundColor: '#444', color: '#FFD700', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', fontWeight: 'bold' }}>
                            {hw.studentName.charAt(0)}
                          </div>
                          <div className="red-dot"></div>
                        </div>
                        <div className="names">
                          <span style={{ fontSize: '16px', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {hw.studentName}
                          </span>
                          <span style={{ fontSize: '14px', color: '#888', display: 'block', marginTop: '2px' }}>{hw.title}</span>
                        </div>
                      </div>
                      <StatusIndicator hw={hw} />
                    </div>
                    
                    <div className="card-content" style={{ marginTop: '8px', marginBottom: '4px' }}>
                      <p className="hw-desc" style={{
                        fontSize: '14.5px',
                        color: '#b0b4be',
                        fontWeight: '500',
                        lineHeight: '1.6',
                        margin: 0,
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'keep-all'
                      }}>
                        {formatHomeworkCardDesc(hw)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ))
          )
        )}
      </main>

      {/* Login Modal */}
      {isLoginModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3 style={{ marginTop: 0, marginBottom: '20px', color: '#FFD700' }}>이름 확인</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', color: '#aaa' }}>빠른 선택</label>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {['강백', '이소은', '원장샘'].map((name) => (
                    <button
                      key={name}
                      type="button"
                      onClick={() => {
                        login(name);
                        setIsLoginModalOpen(false);
                      }}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '16px',
                        border: name === '원장샘' ? '1px solid #FFD700' : '1px solid #4CAF50',
                        backgroundColor: name === '원장샘' ? '#3A3215' : '#1A3320',
                        color: name === '원장샘' ? '#FFD700' : '#A5D6A7',
                        fontSize: '13px',
                        fontWeight: 'bold',
                        cursor: 'pointer'
                      }}
                    >
                      {name === '원장샘' ? '👑 원장샘 (관리자)' : `👤 ${name}`}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', color: '#aaa' }}>직접 입력</label>
                <input 
                  type="text" 
                  value={loginName} 
                  onChange={(e) => setLoginName(e.target.value)}
                  className="modal-input"
                  placeholder="본인의 이름을 입력하세요 (예: 강백)"
                />
              </div>
            </div>
            
            <div className="modal-buttons" style={{ marginTop: '20px' }}>
              <button className="modal-btn cancel" onClick={() => setIsLoginModalOpen(false)}>닫기</button>
              <button className="modal-btn confirm" onClick={handleLoginSubmit}>접속하기</button>
            </div>
          </div>
        </div>
      )}

      {/* Schedule Create / Edit Modal (과외용 주차별 진도표) */}
      {isScheduleModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '440px' }}>
            <h3 style={{ marginTop: 0, marginBottom: '16px', color: '#FFD700' }}>
              {editScheduleId ? '✏️ 주차별 진도 수정' : `➕ ${activeScheduleStudent} 학생 주차 진도 등록`}
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', gap: '10px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', color: '#aaa' }}>주차 (예: 1주차) *</label>
                  <input 
                    type="text" 
                    value={scheduleForm.week} 
                    onChange={(e) => setScheduleForm({ ...scheduleForm, week: e.target.value })}
                    className="modal-input"
                    placeholder="예: 1주차"
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', color: '#aaa' }}>기간</label>
                  <input 
                    type="text" 
                    value={scheduleForm.period} 
                    onChange={(e) => setScheduleForm({ ...scheduleForm, period: e.target.value })}
                    className="modal-input"
                    placeholder="예: 8/19 ~ 8/24"
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', color: '#aaa' }}>과목</label>
                  <input 
                    type="text" 
                    value={scheduleForm.subject} 
                    onChange={(e) => setScheduleForm({ ...scheduleForm, subject: e.target.value })}
                    className="modal-input"
                    placeholder="예: 공통수학1"
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', color: '#aaa' }}>진행 상태</label>
                  <select 
                    value={scheduleForm.status} 
                    onChange={(e) => setScheduleForm({ ...scheduleForm, status: e.target.value })}
                    className="modal-input"
                    style={{ backgroundColor: '#2A2D3A', color: '#fff' }}
                  >
                    <option value="current">🔥 이번 주 진도</option>
                    <option value="completed">✅ 완료</option>
                    <option value="upcoming">⏳ 예정</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', color: '#aaa' }}>
                  예상 단원 * <span style={{ color: '#FFD700', fontSize: '11px' }}>(해당 주차에 나갈 예상 단원명)</span>
                </label>
                <input 
                  type="text"
                  value={scheduleForm.chapter} 
                  onChange={(e) => setScheduleForm({ ...scheduleForm, chapter: e.target.value })}
                  className="modal-input"
                  placeholder="예: 2단원. 복소수와 이차방정식"
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', color: '#aaa' }}>
                  세부 메모 / 참고사항 (선택)
                </label>
                <input 
                  type="text"
                  value={scheduleForm.topic} 
                  onChange={(e) => setScheduleForm({ ...scheduleForm, topic: e.target.value })}
                  className="modal-input"
                  placeholder="예: 핵심 개념 정리 및 실전 기출 풀이"
                />
              </div>
            </div>
            
            <div className="modal-buttons" style={{ marginTop: '20px' }}>
              <button className="modal-btn cancel" onClick={() => setIsScheduleModalOpen(false)}>취소</button>
              <button className="modal-btn confirm" onClick={handleSaveSchedule}>
                {editScheduleId ? '수정 저장' : '등록 완료'}
              </button>
            </div>
          </div>
        </div>
      )}


      {/* Edit Test Modal */}
      {isEditTestModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3 style={{ marginTop: 0, marginBottom: '20px', color: '#4CAF50' }}>테스트 수정 및 분석</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', color: '#aaa' }}>학생 이름</label>
                <input 
                  type="text" 
                  value={editTestStudent} 
                  onChange={(e) => setEditTestStudent(e.target.value)}
                  className="modal-input"
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', color: '#aaa' }}>과목/시험명</label>
                <input 
                  type="text" 
                  value={editTestTitle} 
                  onChange={(e) => setEditTestTitle(e.target.value)}
                  className="modal-input"
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', color: '#aaa' }}>점수</label>
                <input 
                  type="text" 
                  value={editTestScore} 
                  onChange={(e) => setEditTestScore(e.target.value)}
                  className="modal-input"
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', color: '#aaa' }}>시험 틀린 것 분석 및 코멘트</label>
                <textarea 
                  value={editTestComment} 
                  onChange={(e) => setEditTestComment(e.target.value)}
                  className="modal-input"
                  style={{ minHeight: '120px', resize: 'vertical' }}
                  placeholder="예: 객관식 3번 계산실수, 서술형 2번 개념 미숙..."
                />
              </div>
            </div>
            
            <div className="modal-buttons" style={{ marginTop: '20px' }}>
              <button className="modal-btn cancel" onClick={() => setIsEditTestModalOpen(false)}>닫기</button>
              <button className="modal-btn confirm" onClick={handleEditTestSubmit} style={{ backgroundColor: '#4CAF50', color: 'white' }}>저장하기</button>
            </div>
          </div>
        </div>
      )}
    {/* AI Analytics Modal */}
      {isAiModalOpen && (
        <div className="modal-overlay" style={{ zIndex: 1000 }}>
          <div className="modal-content" style={{ maxWidth: '600px' }}>
            <h3 style={{ marginTop: 0, marginBottom: '16px', color: '#673AB7', display: 'flex', alignItems: 'center', gap: '8px' }}>
              🤖 {aiStudentName} 학생 성적 종합 분석
            </h3>

            {!isAiLoading && !aiFeedbackText && (
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', color: '#aaa' }}>추가 요청사항/세부사항 (선택)</label>
                <textarea 
                  value={aiCustomDetails}
                  onChange={(e) => setAiCustomDetails(e.target.value)}
                  className="modal-input"
                  placeholder="예: '최근 다항식 단원에서 실수가 잦은데, 이 부분을 강조해줘'"
                  style={{ minHeight: '80px', resize: 'vertical', fontSize: '14px', lineHeight: '1.5' }}
                />
              </div>
            )}
            
            {(isAiLoading || aiFeedbackText) && (
              <div style={{
                backgroundColor: '#1A1B23', 
                padding: '20px', 
                borderRadius: '8px', 
                minHeight: '200px',
                maxHeight: '400px',
                overflowY: 'auto',
                color: '#ddd',
                fontSize: '14px',
                lineHeight: '1.6',
                whiteSpace: 'pre-wrap'
              }}>
                {isAiLoading ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '200px', gap: '12px' }}>
                    <div className="spinner" style={{ width: '40px', height: '40px', border: '3px solid #333', borderTop: '3px solid #673AB7', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
                    <span style={{ color: '#888' }}>학생의 성적 데이터와 오답 기록을 종합 분석하고 있습니다...</span>
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
                  onClick={handleAiAnalyzeStudentExecute}
                  style={{ backgroundColor: '#673AB7', color: 'white' }}
                >
                  분석 시작
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Promo Image Zoom Lightbox Modal */}
      {zoomPromoImage && (
        <div 
          className="modal-overlay" 
          style={{ zIndex: 12000, backgroundColor: 'rgba(0,0,0,0.92)', padding: '16px' }}
          onClick={() => setZoomPromoImage(null)}
        >
          <div 
            style={{ 
              maxWidth: '92vw', 
              maxHeight: '92vh', 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center', 
              justifyContent: 'center',
              position: 'relative' 
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setZoomPromoImage(null)}
              style={{
                position: 'absolute',
                top: '-40px',
                right: '0',
                background: '#FFD700',
                color: '#000',
                border: 'none',
                borderRadius: '50%',
                width: '36px',
                height: '36px',
                fontSize: '18px',
                fontWeight: 'bold',
                cursor: 'pointer'
              }}
            >
              ✕
            </button>
            <img 
              src={zoomPromoImage} 
              alt="홍보 이미지 확대"
              style={{ maxWidth: '100%', maxHeight: '88vh', borderRadius: '12px', objectFit: 'contain' }}
            />
          </div>
        </div>
      )}

    </div>
  );
}
