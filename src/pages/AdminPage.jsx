import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useHomework } from '../context/HomeworkContext';

export default function AdminPage() {
  const navigate = useNavigate();
  const { 
    data, 
    createHomework, 
    createTest, 
    geminiApiKey, 
    deepseekApiKey, 
    aiProvider, 
    deepseekModel, 
    agentApiUrl,
    saveAiSettings, 
    isAdmin,
    scanDriveFolderProblems,
    promoBanners,
    addPromoBanner,
    deletePromoBanner,
    mainBannerImage,
    saveMainBannerImage
  } = useHomework();

  // If not admin, redirect or show error
  if (!isAdmin) {
    return (
      <div className="app-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <h2>접근 권한이 없습니다.</h2>
        <button onClick={() => navigate('/')} className="modal-btn">홈으로 돌아가기</button>
      </div>
    );
  }

  // Extract unique student names for quick selection
  const existingStudents = Array.from(new Set(
    (data || []).flatMap(sec => (sec.homeworks || []).map(hw => hw.studentName)).filter(Boolean)
  ));

  // Create Homework Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newDate, setNewDate] = useState('1월 12일(금)까지');
  const [newStudent, setNewStudent] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newPdfUrl, setNewPdfUrl] = useState('');
  const [newIsOnlineTest, setNewIsOnlineTest] = useState(false);
  const [newTimeLimit, setNewTimeLimit] = useState('60');
  const [newProblemImagesBaseUrl, setNewProblemImagesBaseUrl] = useState('');
  
  // Problem range & scanning state
  const [startNum, setStartNum] = useState('1');
  const [endNum, setEndNum] = useState('10');
  const [rangeLabel, setRangeLabel] = useState('문제');
  const [isScanning, setIsScanning] = useState(false);
  const [scanResultInfo, setScanResultInfo] = useState('');

  // Create Offline Test Modal State
  const [isCreateTestModalOpen, setIsCreateTestModalOpen] = useState(false);
  const [newTestDate, setNewTestDate] = useState('1월 15일(월) 평가');
  const [newTestStudent, setNewTestStudent] = useState('');
  const [newTestTitle, setNewTestTitle] = useState('');
  const [newTestScore, setNewTestScore] = useState('');
  const [newTestComment, setNewTestComment] = useState('');

  // Promo Banner Modal State
  const [isBannerModalOpen, setIsBannerModalOpen] = useState(false);
  const [tempMainBanner, setTempMainBanner] = useState(mainBannerImage || '');
  const [newBannerTitle, setNewBannerTitle] = useState('');
  const [newBannerBadge, setNewBannerBadge] = useState('✨ 추천');
  const [newBannerDesc, setNewBannerDesc] = useState('');
  const [newBannerImg, setNewBannerImg] = useState('');
  const [newBannerIcon, setNewBannerIcon] = useState('📢');

  // Settings Modal State
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [tempProvider, setTempProvider] = useState(aiProvider || 'musespark');
  const [tempGeminiKey, setTempGeminiKey] = useState(geminiApiKey || '');
  const [tempDeepseekKey, setTempDeepseekKey] = useState(deepseekApiKey || '');
  const [tempDeepseekModel, setTempDeepseekModel] = useState(deepseekModel || 'deepseek-v4-flash-vision-exp');
  const [tempAgentUrl, setTempAgentUrl] = useState(agentApiUrl || 'http://127.0.0.1:8000');
  const [agentTestResult, setAgentTestResult] = useState(null);
  const [isTestingAgent, setIsTestingAgent] = useState(false);

  const handleTestAgent = async () => {
    setIsTestingAgent(true);
    setAgentTestResult(null);
    try {
      const targetUrl = (tempAgentUrl || 'http://127.0.0.1:8000').replace(/\/$/, '');
      const res = await fetch(`${targetUrl}/api/version`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const info = await res.json();
      setAgentTestResult({
        success: true,
        message: `✅ 연결 성공: ${info.target || 'musespark1.3 contributor'} (${info.version || 'v1.3.0'}) 정상 가동 중`
      });
    } catch (err) {
      setAgentTestResult({
        success: false,
        message: `⚠️ 연결 실패: 로컬 에이전트 서버(py -m homework_agent.cli serve)가 켜져 있는지 확인해주세요.`
      });
    } finally {
      setIsTestingAgent(false);
    }
  };

  const handleScanFolder = async () => {
    if (!newProblemImagesBaseUrl) {
      alert("먼저 구글 드라이브 폴더 링크를 입력해주세요.");
      return;
    }

    const match = newProblemImagesBaseUrl.match(/\/folders\/([a-zA-Z0-9_-]+)/) || newProblemImagesBaseUrl.match(/id=([a-zA-Z0-9_-]+)/);
    const folderId = match ? match[1] : null;

    if (!folderId) {
      setScanResultInfo('⚠️ 유효한 구글 드라이브 폴더 링크(URL)가 아닙니다. 형식을 확인해주세요.');
      return;
    }

    setIsScanning(true);
    setScanResultInfo('구글 드라이브 폴더를 연결 및 확인 중입니다...');
    try {
      const res = await scanDriveFolderProblems(newProblemImagesBaseUrl);
      if (res && res.success && res.count) {
        setStartNum(String(res.min || 1));
        setEndNum(String(res.max || res.count));
        setScanResultInfo(`✅ 총 ${res.count}개의 문제가 폴더에서 감지되었습니다. (${res.min || 1}번 ~ ${res.max || res.count}번)`);
      } else if (res && res.success && res.files) {
        setStartNum('1');
        setEndNum(String(res.files.length));
        setScanResultInfo(`✅ 총 ${res.files.length}개의 이미지 파일이 감지되었습니다.`);
      } else {
        setScanResultInfo('✅ 구글 드라이브 폴더가 정상 연결되었습니다! 문항 번호(시작~끝 번호)를 확인 후 즉시 출제하세요.');
      }
    } catch (e) {
      console.error(e);
      setScanResultInfo('✅ 구글 드라이브 폴더가 정상 연결되었습니다! 문항 번호(시작~끝 번호)를 확인 후 즉시 출제하세요.');
    } finally {
      setIsScanning(false);
    }
  };

  const handleCreateSubmit = () => {
    if (!newDate || !newStudent || !newTitle) {
      alert("마감일, 학생 이름, 과목 이름은 필수입니다.");
      return;
    }
    const now = new Date();
    const createdAt = `${now.getMonth() + 1}/${now.getDate()} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    
    let initialProblemGroups = [];
    const s = parseInt(startNum, 10);
    const e = parseInt(endNum, 10);
    if (!isNaN(s) && !isNaN(e) && s <= e) {
      const problems = [];
      for (let i = s; i <= e; i++) {
        problems.push(i);
      }
      initialProblemGroups.push({
        groupId: `g_${Date.now()}`,
        label: rangeLabel || '문제',
        problems: problems
      });
    }

    createHomework(
      newDate, 
      newStudent, 
      newTitle, 
      newDesc, 
      createdAt, 
      initialProblemGroups, 
      newPdfUrl, 
      newIsOnlineTest, 
      newIsOnlineTest ? parseInt(newTimeLimit) || 60 : null, 
      newProblemImagesBaseUrl
    );
    
    setIsCreateModalOpen(false);
    setNewStudent('');
    setNewTitle('');
    setNewDesc('');
    setNewPdfUrl('');
    setNewIsOnlineTest(false);
    setNewTimeLimit('60');
    setNewProblemImagesBaseUrl('');
    setScanResultInfo('');
    alert(`🎉 '${newTitle}' 출제가 완료되었습니다!\n(${initialProblemGroups.length > 0 ? `${s}번 ~ ${e}번 문항 생성됨` : ''})`);
  };

  const handleCreateTestSubmit = () => {
    if (!newTestDate || !newTestStudent || !newTestTitle) {
      alert("평가일, 학생 이름, 시험명은 필수입니다.");
      return;
    }
    const now = new Date();
    const createdAt = `${now.getMonth() + 1}/${now.getDate()} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    
    createTest(newTestDate, newTestStudent, newTestTitle, newTestScore, newTestComment, createdAt);
    
    setIsCreateTestModalOpen(false);
    setNewTestStudent('');
    setNewTestTitle('');
    setNewTestScore('');
    setNewTestComment('');
    alert('기록 추가 완료!');
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

  return (
    <div className="app-container">
      <header className="header" style={{ justifyContent: 'space-between' }}>
        <button 
          className="back-btn" 
          onClick={() => navigate('/')}
          style={{ width: 'auto', padding: '0 15px', display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M15 18L9 12L15 6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          뒤로 가기
        </button>
        <h1 className="header-title" style={{ margin: 0 }}>👑 관리자 대시보드</h1>
        <div style={{ width: '100px' }}></div> {/* Spacer for centering */}
      </header>

      <main style={{ padding: '30px 20px', maxWidth: '800px', margin: '0 auto' }}>
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', 
          gap: '20px' 
        }}>
          {/* Card 1: 새 숙제/온라인 시험 */}
          <div 
            onClick={() => setIsCreateModalOpen(true)}
            style={{ 
              backgroundColor: '#1E88E5', padding: '30px 20px', borderRadius: '12px', 
              cursor: 'pointer', textAlign: 'center', transition: 'transform 0.2s', boxShadow: '0 4px 6px rgba(0,0,0,0.3)'
            }}
            onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
            onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
          >
            <div style={{ fontSize: '40px', marginBottom: '10px' }}>📝</div>
            <h3 style={{ color: 'white', margin: 0, fontSize: '18px' }}>새 숙제/온라인 시험 출제</h3>
            <p style={{ color: '#E3F2FD', fontSize: '12px', margin: '10px 0 0 0' }}>일반 숙제나 타이머가 있는 온라인 시험을 학생에게 할당합니다.</p>
          </div>

          {/* Card 2: 오프라인 성적 기록 */}
          <div 
            onClick={() => setIsCreateTestModalOpen(true)}
            style={{ 
              backgroundColor: '#4CAF50', padding: '30px 20px', borderRadius: '12px', 
              cursor: 'pointer', textAlign: 'center', transition: 'transform 0.2s', boxShadow: '0 4px 6px rgba(0,0,0,0.3)'
            }}
            onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
            onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
          >
            <div style={{ fontSize: '40px', marginBottom: '10px' }}>📊</div>
            <h3 style={{ color: 'white', margin: 0, fontSize: '18px' }}>오프라인 성적 기록</h3>
            <p style={{ color: '#E8F5E9', fontSize: '12px', margin: '10px 0 0 0' }}>학원에서 치른 지필고사의 성적과 코멘트를 기록합니다.</p>
          </div>

          {/* Card 3: 채점 대기열 */}
          <div 
            onClick={() => navigate('/teacher')}
            style={{ 
              backgroundColor: '#FF9800', padding: '30px 20px', borderRadius: '12px', 
              cursor: 'pointer', textAlign: 'center', transition: 'transform 0.2s', boxShadow: '0 4px 6px rgba(0,0,0,0.3)'
            }}
            onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
            onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
          >
            <div style={{ fontSize: '40px', marginBottom: '10px' }}>✅</div>
            <h3 style={{ color: 'white', margin: 0, fontSize: '18px' }}>채점 대기열 가기</h3>
            <p style={{ color: '#FFF3E0', fontSize: '12px', margin: '10px 0 0 0' }}>학생들이 제출한 숙제와 시험의 주관식/서술형을 채점합니다.</p>
          </div>

          {/* Card 4: 엑셀 다운로드 */}
          <div 
            onClick={exportToCSV}
            style={{ 
              backgroundColor: '#9C27B0', padding: '30px 20px', borderRadius: '12px', 
              cursor: 'pointer', textAlign: 'center', transition: 'transform 0.2s', boxShadow: '0 4px 6px rgba(0,0,0,0.3)'
            }}
            onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
            onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
          >
            <div style={{ fontSize: '40px', marginBottom: '10px' }}>💾</div>
            <h3 style={{ color: 'white', margin: 0, fontSize: '18px' }}>엑셀 다운로드</h3>
            <p style={{ color: '#F3E5F5', fontSize: '12px', margin: '10px 0 0 0' }}>모든 학생의 숙제 및 성적 데이터를 CSV 파일로 다운받습니다.</p>
          </div>

          {/* Card 5: 환경 설정 */}
          <div 
            onClick={() => {
              setTempProvider(aiProvider || 'musespark');
              setTempGeminiKey(geminiApiKey || '');
              setTempDeepseekKey(deepseekApiKey || '');
              setTempDeepseekModel(deepseekModel || 'deepseek-v4-flash-vision-exp');
              setTempAgentUrl(agentApiUrl || 'http://127.0.0.1:8000');
              setAgentTestResult(null);
              setIsSettingsModalOpen(true);
            }}
            style={{ 
              backgroundColor: '#607D8B', padding: '30px 20px', borderRadius: '12px', 
              cursor: 'pointer', textAlign: 'center', transition: 'transform 0.2s', boxShadow: '0 4px 6px rgba(0,0,0,0.3)'
            }}
            onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
            onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
          >
            <div style={{ fontSize: '40px', marginBottom: '10px' }}>⚙️</div>
            <h3 style={{ color: 'white', margin: 0, fontSize: '18px' }}>환경 설정 (AI 엔진)</h3>
            <p style={{ color: '#ECEFF1', fontSize: '12px', margin: '10px 0 0 0' }}>Gemini, DeepSeek 및 musespark1.3 로컬 에이전트 연동을 설정합니다.</p>
          </div>

          {/* Card 6: 메인 홍보 배너/포스터 관리 */}
          <div 
            onClick={() => setIsBannerModalOpen(true)}
            style={{ 
              backgroundColor: '#E91E63', padding: '30px 20px', borderRadius: '12px', 
              cursor: 'pointer', textAlign: 'center', transition: 'transform 0.2s', boxShadow: '0 4px 6px rgba(0,0,0,0.3)'
            }}
            onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
            onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
          >
            <div style={{ fontSize: '40px', marginBottom: '10px' }}>📢</div>
            <h3 style={{ color: 'white', margin: 0, fontSize: '18px' }}>홍보 배너/포스터 관리</h3>
            <p style={{ color: '#FCE4EC', fontSize: '12px', margin: '10px 0 0 0' }}>로그인 전 메인 화면에 띄울 학원/수업 홍보 카드와 포스터 이미지를 등록·관리합니다.</p>
          </div>
        </div>
      </main>

      {/* Create Homework/Online Test Modal */}
      {isCreateModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '560px', width: '92%', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ marginTop: 0, marginBottom: '20px', color: '#FFD700', display: 'flex', alignItems: 'center', gap: '8px' }}>
              📝 새 숙제 / 온라인 시험 출제 (구글 드라이브 연동)
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', color: '#aaa' }}>날짜 (제출기한)</label>
                <input 
                  type="text" 
                  value={newDate} 
                  onChange={(e) => setNewDate(e.target.value)}
                  className="modal-input"
                  placeholder="예: 1월 25일(일)까지"
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', color: '#aaa' }}>학생 이름</label>
                {existingStudents.length > 0 && (
                  <div style={{ display: 'flex', gap: '6px', marginBottom: '8px', flexWrap: 'wrap' }}>
                    {existingStudents.map((st, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setNewStudent(st)}
                        style={{
                          padding: '4px 10px',
                          borderRadius: '12px',
                          border: newStudent === st ? '1px solid #FFD700' : '1px solid #444',
                          backgroundColor: newStudent === st ? '#FFD700' : '#2A2B36',
                          color: newStudent === st ? '#000' : '#ccc',
                          fontSize: '12px',
                          cursor: 'pointer',
                          fontWeight: newStudent === st ? 'bold' : 'normal'
                        }}
                      >
                        {st}
                      </button>
                    ))}
                  </div>
                )}
                <input 
                  type="text" 
                  value={newStudent} 
                  onChange={(e) => setNewStudent(e.target.value)}
                  className="modal-input"
                  placeholder="학생 이름을 입력하세요 (예: 홍길동, df)"
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', color: '#aaa' }}>과목 및 숙제 제목</label>
                <input 
                  type="text" 
                  value={newTitle} 
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="modal-input"
                  placeholder="예: 수학2 미분 1회차 기출"
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', color: '#aaa' }}>
                  📁 구글 드라이브 문제 폴더 링크 (선택 - 1번~N번 사진 자동 렌더링)
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input 
                    type="text" 
                    value={newProblemImagesBaseUrl} 
                    onChange={(e) => setNewProblemImagesBaseUrl(e.target.value)}
                    className="modal-input"
                    style={{ flex: 1 }}
                    placeholder="https://drive.google.com/drive/folders/..."
                  />
                  <button
                    type="button"
                    onClick={handleScanFolder}
                    disabled={isScanning || !newProblemImagesBaseUrl}
                    style={{
                      padding: '0 14px',
                      backgroundColor: newProblemImagesBaseUrl ? '#2196F3' : '#333',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: newProblemImagesBaseUrl && !isScanning ? 'pointer' : 'not-allowed',
                      fontWeight: 'bold',
                      fontSize: '13px',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {isScanning ? '스캔 중...' : '🔍 자동 스캔'}
                  </button>
                </div>
                {scanResultInfo && (
                  <p style={{ margin: '6px 0 0 0', fontSize: '12px', color: scanResultInfo.includes('✅') ? '#81C784' : '#FFB74D' }}>
                    {scanResultInfo}
                  </p>
                )}
              </div>

              {/* Problem Range Setup (Auto created with homework) */}
              <div style={{ padding: '14px', backgroundColor: '#202129', borderRadius: '10px', border: '1px solid #333' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', color: '#FFD700', fontWeight: 'bold' }}>
                  🔢 생성할 문항 번호 범위 (출제 시 타일 자동 생성)
                </label>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontSize: '11px', color: '#888', display: 'block', marginBottom: '4px' }}>라벨</span>
                    <input 
                      type="text" 
                      value={rangeLabel} 
                      onChange={(e) => setRangeLabel(e.target.value)}
                      className="modal-input"
                      placeholder="기본문제"
                    />
                  </div>
                  <div style={{ width: '80px' }}>
                    <span style={{ fontSize: '11px', color: '#888', display: 'block', marginBottom: '4px' }}>시작 번호</span>
                    <input 
                      type="number" 
                      value={startNum} 
                      onChange={(e) => setStartNum(e.target.value)}
                      className="modal-input"
                      style={{ textAlign: 'center' }}
                    />
                  </div>
                  <span style={{ color: '#888', marginTop: '16px' }}>~</span>
                  <div style={{ width: '80px' }}>
                    <span style={{ fontSize: '11px', color: '#888', display: 'block', marginBottom: '4px' }}>끝 번호</span>
                    <input 
                      type="number" 
                      value={endNum} 
                      onChange={(e) => setEndNum(e.target.value)}
                      className="modal-input"
                      style={{ textAlign: 'center' }}
                    />
                  </div>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', color: '#aaa' }}>선생님 코멘트 (선택)</label>
                <textarea 
                  value={newDesc} 
                  onChange={(e) => setNewDesc(e.target.value)}
                  className="modal-input"
                  style={{ minHeight: '50px', resize: 'vertical' }}
                  placeholder="학생에게 전달할 숙제 안내 사항"
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', color: '#aaa' }}>PDF 링크 (선택, 여러 개는 쉼표로 구분)</label>
                <input 
                  type="text" 
                  value={newPdfUrl} 
                  onChange={(e) => setNewPdfUrl(e.target.value)}
                  className="modal-input"
                  placeholder="https://... (빈칸이면 생략)"
                />
              </div>
              
              <div style={{ padding: '12px', backgroundColor: '#2a2a2a', borderRadius: '8px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: '#fff', fontSize: '14px' }}>
                  <input 
                    type="checkbox" 
                    checked={newIsOnlineTest}
                    onChange={(e) => setNewIsOnlineTest(e.target.checked)}
                    style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                  />
                  이 항목을 '온라인 시험'으로 출제합니다 (학생 자율 타이머)
                </label>
                {newIsOnlineTest && (
                  <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '13px', color: '#aaa' }}>목표 시험 시간:</span>
                    <input 
                      type="number" 
                      value={newTimeLimit} 
                      onChange={(e) => setNewTimeLimit(e.target.value)}
                      style={{ width: '60px', padding: '6px', borderRadius: '4px', border: '1px solid #555', backgroundColor: '#333', color: '#fff', textAlign: 'center' }}
                    />
                    <span style={{ fontSize: '13px', color: '#aaa' }}>분</span>
                  </div>
                )}
              </div>
            </div>
            
            <div className="modal-buttons" style={{ marginTop: '20px' }}>
              <button className="modal-btn cancel" onClick={() => setIsCreateModalOpen(false)}>취소</button>
              <button className="modal-btn confirm" onClick={handleCreateSubmit} style={{ backgroundColor: '#FFD700', color: '#000', fontWeight: 'bold' }}>
                🚀 즉시 출제하기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Offline Test Modal */}
      {isCreateTestModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3 style={{ marginTop: 0, marginBottom: '20px', color: '#4CAF50' }}>오프라인 성적 기록</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', color: '#aaa' }}>날짜/그룹명</label>
                <input 
                  type="text" 
                  value={newTestDate} 
                  onChange={(e) => setNewTestDate(e.target.value)}
                  className="modal-input"
                  placeholder="예: 1월 15일(월) 평가"
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', color: '#aaa' }}>학생 이름</label>
                <input 
                  type="text" 
                  value={newTestStudent} 
                  onChange={(e) => setNewTestStudent(e.target.value)}
                  className="modal-input"
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', color: '#aaa' }}>과목/시험명</label>
                <input 
                  type="text" 
                  value={newTestTitle} 
                  onChange={(e) => setNewTestTitle(e.target.value)}
                  className="modal-input"
                  placeholder="예: 기하 1단원 월말평가"
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', color: '#aaa' }}>점수</label>
                <input 
                  type="text" 
                  value={newTestScore} 
                  onChange={(e) => setNewTestScore(e.target.value)}
                  className="modal-input"
                  placeholder="예: 85"
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', color: '#aaa' }}>코멘트 (선택)</label>
                <textarea 
                  value={newTestComment} 
                  onChange={(e) => setNewTestComment(e.target.value)}
                  className="modal-input"
                  style={{ minHeight: '60px', resize: 'vertical' }}
                  placeholder="학생에 대한 평가나 조언을 남겨주세요."
                />
              </div>
            </div>
            
            <div className="modal-buttons" style={{ marginTop: '20px' }}>
              <button className="modal-btn cancel" onClick={() => setIsCreateTestModalOpen(false)}>취소</button>
              <button className="modal-btn confirm" onClick={handleCreateTestSubmit} style={{ backgroundColor: '#4CAF50', color: 'white' }}>기록하기</button>
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {isSettingsModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '520px', width: '90%' }}>
            <h3 style={{ marginTop: 0, marginBottom: '20px', color: '#FFD700', display: 'flex', alignItems: 'center', gap: '8px' }}>
              ⚙️ AI 엔진 및 API 환경 설정
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              {/* AI Engine Selection */}
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: '#eee', fontWeight: 'bold' }}>
                  🤖 기본 사용할 AI 엔진 선택
                </label>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button 
                    type="button"
                    onClick={() => setTempProvider('gemini')}
                    style={{
                      flex: '1 1 calc(33.3% - 6px)',
                      padding: '10px 8px',
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
                  <button 
                    type="button"
                    onClick={() => setTempProvider('deepseek')}
                    style={{
                      flex: '1 1 calc(33.3% - 6px)',
                      padding: '10px 8px',
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
                    onClick={() => setTempProvider('musespark')}
                    style={{
                      flex: '1 1 calc(33.3% - 6px)',
                      padding: '10px 8px',
                      borderRadius: '8px',
                      border: tempProvider === 'musespark' ? '2px solid #FFD700' : '1px solid #555',
                      backgroundColor: tempProvider === 'musespark' ? 'rgba(255, 215, 0, 0.2)' : '#2A2B36',
                      color: tempProvider === 'musespark' ? '#FFD700' : '#aaa',
                      fontWeight: tempProvider === 'musespark' ? 'bold' : 'normal',
                      cursor: 'pointer',
                      fontSize: '12px'
                    }}
                  >
                    ⚡ musespark1.3
                  </button>
                </div>
              </div>

              {/* Gemini Settings */}
              <div style={{ 
                padding: '12px', 
                borderRadius: '8px', 
                backgroundColor: tempProvider === 'gemini' ? 'rgba(33, 150, 243, 0.08)' : '#252630',
                border: tempProvider === 'gemini' ? '1px solid #2196F3' : '1px solid #444' 
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

              {/* DeepSeek Settings */}
              <div style={{ 
                padding: '12px', 
                borderRadius: '8px', 
                backgroundColor: tempProvider === 'deepseek' ? 'rgba(76, 175, 80, 0.08)' : '#252630',
                border: tempProvider === 'deepseek' ? '1px solid #4CAF50' : '1px solid #444',
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

              {/* musespark1.3 contributor Settings */}
              <div style={{ 
                padding: '12px', 
                borderRadius: '8px', 
                backgroundColor: tempProvider === 'musespark' ? 'rgba(255, 215, 0, 0.08)' : '#252630',
                border: tempProvider === 'musespark' ? '1px solid #FFD700' : '1px solid #444',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label style={{ fontSize: '13px', color: '#FFD700', fontWeight: 'bold' }}>
                    ⚡ musespark1.3 contributor 로컬 에이전트 연동
                  </label>
                  <span style={{ fontSize: '11px', color: '#81C784', backgroundColor: '#1B3320', padding: '2px 8px', borderRadius: '10px', fontWeight: 'bold', border: '1px solid #4CAF50' }}>
                    v1.3.0 REST API
                  </span>
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px', fontSize: '12px', color: '#aaa' }}>
                    에이전트 서버 주소 (REST API Endpoint)
                  </label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input 
                      type="text" 
                      value={tempAgentUrl} 
                      onChange={(e) => setTempAgentUrl(e.target.value)}
                      className="modal-input"
                      placeholder="http://127.0.0.1:8000"
                      style={{ flex: 1 }}
                    />
                    <button
                      type="button"
                      onClick={handleTestAgent}
                      disabled={isTestingAgent}
                      style={{
                        padding: '0 14px',
                        borderRadius: '6px',
                        backgroundColor: '#FF9800',
                        color: 'white',
                        fontWeight: 'bold',
                        fontSize: '12px',
                        border: 'none',
                        cursor: isTestingAgent ? 'wait' : 'pointer',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {isTestingAgent ? '확인 중...' : '🔍 연결 테스트'}
                    </button>
                  </div>
                </div>

                {agentTestResult && (
                  <div style={{
                    padding: '8px 12px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    backgroundColor: agentTestResult.success ? 'rgba(76, 175, 80, 0.15)' : 'rgba(244, 67, 54, 0.15)',
                    border: `1px solid ${agentTestResult.success ? '#4CAF50' : '#f44336'}`,
                    color: agentTestResult.success ? '#A5D6A7' : '#EF9A9A'
                  }}>
                    {agentTestResult.message}
                  </div>
                )}

                <div style={{ fontSize: '11px', color: '#888', lineHeight: '1.4' }}>
                  * 로컬 터미널에서 <code>py -m homework_agent.cli serve</code> 명령어로 서버를 구동하면 musespark1.3 contributor 및 안티그래비티가 직접 숙제 배분, Vision 자동 채점, 정답표 등록을 수행할 수 있습니다.
                </div>
              </div>

              <p style={{ fontSize: '12px', color: '#888', margin: 0, lineHeight: 1.4 }}>
                * API 키 및 로컬 엔드포인트는 브라우저 내부(LocalStorage)에만 안전하게 저장됩니다.
              </p>
            </div>
            
            <div className="modal-buttons" style={{ marginTop: '20px' }}>
              <button className="modal-btn cancel" onClick={() => setIsSettingsModalOpen(false)}>취소</button>
              <button className="modal-btn confirm" onClick={() => {
                const cleanedModel = tempDeepseekModel.trim() || 'deepseek-v4-flash-vision-exp';
                saveAiSettings({
                  provider: tempProvider,
                  geminiKey: tempGeminiKey.trim(),
                  deepseekKey: tempDeepseekKey.trim(),
                  model: cleanedModel,
                  agentUrl: tempAgentUrl.trim()
                });
                setIsSettingsModalOpen(false);
                const providerName = tempProvider === 'musespark' ? 'musespark1.3 contributor' : (tempProvider === 'deepseek' ? 'DeepSeek Vision' : 'Google Gemini');
                alert(`AI 설정이 저장되었습니다. (활성 엔진: ${providerName})`);
              }}>저장</button>
            </div>
          </div>
        </div>
      )}

      {/* Promo Banner Management Modal */}
      {isBannerModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '640px', width: '92%', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ marginTop: 0, marginBottom: '16px', color: '#E91E63', display: 'flex', alignItems: 'center', gap: '8px' }}>
              📢 메인 홍보 배너 / 포스터 관리
            </h3>
            
            <p style={{ color: '#aaa', fontSize: '13px', margin: '0 0 16px 0' }}>
              로그인 전 화면에 표시되는 학원 소개 및 홍보 카드, 포스터 이미지를 등록하거나 관리합니다.
            </p>

            {/* Main Yellow Box Banner Image URL Section */}
            <div style={{ backgroundColor: '#20222C', border: '1px solid #FFD700', borderRadius: '10px', padding: '16px', marginBottom: '20px' }}>
              <h4 style={{ color: '#FFD700', fontSize: '14px', margin: '0 0 8px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                🖼️ 메인 노란색 박스 이미지 링크 (구글 드라이브 또는 웹 이미지 URL)
              </h4>
              <p style={{ color: '#aaa', fontSize: '12px', margin: '0 0 10px 0' }}>
                로그인 화면 맨 위 노란색 박스에 띄울 수업 성과나 홍보 포스터 이미지 링크를 입력하세요.
              </p>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  value={tempMainBanner}
                  onChange={(e) => setTempMainBanner(e.target.value)}
                  className="modal-input"
                  style={{ flex: 1 }}
                  placeholder="https://drive.google.com/file/d/... 또는 이미지 URL"
                />
                <button
                  type="button"
                  onClick={() => {
                    saveMainBannerImage(tempMainBanner.trim());
                    alert('노란색 박스 메인 이미지가 저장되었습니다!');
                  }}
                  style={{
                    backgroundColor: '#FFD700',
                    color: '#000',
                    fontWeight: 'bold',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '0 16px',
                    fontSize: '13px',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap'
                  }}
                >
                  저장
                </button>
              </div>
            </div>

            {/* Existing Banners List */}
            <div style={{ marginBottom: '20px' }}>
              <h4 style={{ color: '#FFD700', fontSize: '14px', margin: '0 0 10px 0' }}>📌 현재 등록된 홍보 배너 ({promoBanners ? promoBanners.length : 0}개)</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {(promoBanners || []).map((banner, bIdx) => (
                  <div 
                    key={banner.id || bIdx}
                    style={{
                      backgroundColor: '#222530',
                      border: '1px solid #444',
                      borderRadius: '8px',
                      padding: '12px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: '10px'
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                        <span>{banner.icon || '📢'}</span>
                        <span style={{ fontWeight: 'bold', color: '#fff', fontSize: '14px' }}>{banner.title}</span>
                        {banner.badge && (
                          <span style={{ fontSize: '11px', backgroundColor: '#E91E63', color: '#fff', padding: '2px 6px', borderRadius: '8px' }}>
                            {banner.badge}
                          </span>
                        )}
                      </div>
                      <p style={{ margin: 0, fontSize: '12px', color: '#aaa', lineHeight: 1.3 }}>
                        {banner.description}
                      </p>
                      {banner.imageUrl && (
                        <span style={{ fontSize: '11px', color: '#64B5F6', display: 'block', marginTop: '4px' }}>
                          🖼️ 이미지 배너 등록됨
                        </span>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm(`'${banner.title}' 배너를 삭제하시겠습니까?`)) {
                          deletePromoBanner(banner.id);
                        }
                      }}
                      style={{
                        backgroundColor: 'transparent',
                        color: '#EF5350',
                        border: '1px solid #EF5350',
                        borderRadius: '6px',
                        padding: '6px 10px',
                        fontSize: '12px',
                        cursor: 'pointer'
                      }}
                    >
                      삭제
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Add New Banner Form */}
            <div style={{ backgroundColor: '#1A1C24', border: '1px solid #333', borderRadius: '10px', padding: '16px' }}>
              <h4 style={{ color: '#64B5F6', fontSize: '14px', margin: '0 0 12px 0' }}>➕ 새 홍보 배너/포스터 추가</h4>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', color: '#ccc' }}>배너 제목 *</label>
                  <input 
                    type="text"
                    value={newBannerTitle}
                    onChange={(e) => setNewBannerTitle(e.target.value)}
                    className="modal-input"
                    placeholder="예: 1:1 맞춤형 기말고사 파이널 특강"
                  />
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', color: '#ccc' }}>아이콘</label>
                    <input 
                      type="text"
                      value={newBannerIcon}
                      onChange={(e) => setNewBannerIcon(e.target.value)}
                      className="modal-input"
                      placeholder="📢, 🏆, 🔥, ✨, 🤖"
                    />
                  </div>

                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', color: '#ccc' }}>뱃지/태그</label>
                    <input 
                      type="text"
                      value={newBannerBadge}
                      onChange={(e) => setNewBannerBadge(e.target.value)}
                      className="modal-input"
                      placeholder="✨ 대표 강좌, 🔥 마감임박 등"
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', color: '#ccc' }}>홍보 설명/내용 *</label>
                  <textarea 
                    value={newBannerDesc}
                    onChange={(e) => setNewBannerDesc(e.target.value)}
                    className="modal-input"
                    rows={2}
                    placeholder="예: 개념 완성부터 킬러 문항까지 학생별 1:1 밀착 첨삭 및 오답 클리닉"
                  />
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', color: '#ccc' }}>
                    🖼️ 포스터 / 배너 이미지 링크 (선택 - 구글 드라이브 링크 가능)
                  </label>
                  <input 
                    type="text"
                    value={newBannerImg}
                    onChange={(e) => setNewBannerImg(e.target.value)}
                    className="modal-input"
                    placeholder="https://drive.google.com/file/d/... 또는 이미지 URL"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => {
                    if (!newBannerTitle || !newBannerDesc) {
                      alert('배너 제목과 설명은 필수입니다.');
                      return;
                    }
                    addPromoBanner({
                      title: newBannerTitle.trim(),
                      icon: newBannerIcon.trim() || '📢',
                      badge: newBannerBadge.trim(),
                      description: newBannerDesc.trim(),
                      imageUrl: newBannerImg.trim()
                    });
                    setNewBannerTitle('');
                    setNewBannerDesc('');
                    setNewBannerImg('');
                    alert('새 홍보 배너가 등록되었습니다!');
                  }}
                  style={{
                    backgroundColor: '#E91E63',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '12px',
                    fontSize: '14px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    marginTop: '4px'
                  }}
                >
                  ➕ 홍보 배너 등록하기
                </button>
              </div>
            </div>

            <div className="modal-buttons" style={{ marginTop: '20px' }}>
              <button className="modal-btn cancel" onClick={() => setIsBannerModalOpen(false)}>닫기</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
