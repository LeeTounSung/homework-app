import React, { createContext, useState, useContext, useEffect } from 'react';

const HomeworkContext = createContext();

export const useHomework = () => useContext(HomeworkContext);

const GAS_URL = 'https://script.google.com/macros/s/AKfycbxiOiQDxE1KXnE2-JqV29zIimsdNNAxjuw2692H1eeSlmw-4XUIQ7Buw-jC5ueBDyFE/exec';

const fallbackInitialData = [
  {
    date: "1월 10일(수)까지",
    homeworks: [
      {
        id: 1,
        teacherName: "mathkorea",
        studentName: "이소은",
        title: "숙제의 의미",
        description: "내준 숙제 주변에 각종 표시 설명",
        tag: "to 이소은",
        statusType: "none", 
        statusValue: null,
        problemGroups: [],
        submittedProblems: [], 
        evaluation: null 
      }
    ]
  },
  {
    date: "1월 11일(목)까지",
    homeworks: [
      {
        id: 2,
        teacherName: "mathkorea",
        studentName: "늘푸른내신대비반",
        title: "숙제의 의미",
        description: "내준 숙제 주변에 각종 표시 설명",
        tag: "# 늘푸른내신대비반",
        statusType: "none",
        statusValue: null,
        problemGroups: [],
        submittedProblems: [],
        evaluation: null
      }
    ]
  }
];

export const HomeworkProvider = ({ children }) => {
  const [data, setData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Authentication State
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const userFromUrl = urlParams.get('user');
      if (userFromUrl) {
        localStorage.setItem('homeworkAppUser', userFromUrl);
        return userFromUrl;
      }
    } catch (e) {}
    return localStorage.getItem('homeworkAppUser') || null;
  });

  const login = (username) => {
    setCurrentUser(username);
    localStorage.setItem('homeworkAppUser', username);
  };

  const logout = () => {
    setCurrentUser(null);
    localStorage.removeItem('homeworkAppUser');
  };

  const isAdmin = currentUser === 'mathkorea' || currentUser === 'admin' || currentUser === '선생님' || currentUser === '원장샘';

  // AI Settings State (Gemini / DeepSeek / Meta Muse Spark)
  const DEFAULT_DEEPSEEK_KEY = import.meta.env.VITE_DEEPSEEK_API_KEY || '';
  const DEFAULT_META_KEY = import.meta.env.VITE_META_API_KEY || 'LLM_2161394044719218_Lv8NcmLsyd5kH8je0bbvj4tyQlg';

  const [aiProvider, setAiProvider] = useState(() => {
    return localStorage.getItem('aiProvider') || 'musespark';
  });

  const [geminiApiKey, setGeminiApiKey] = useState(() => {
    return localStorage.getItem('geminiApiKey') || '';
  });

  const [deepseekApiKey, setDeepseekApiKey] = useState(() => {
    return localStorage.getItem('deepseekApiKey') || DEFAULT_DEEPSEEK_KEY;
  });

  const [deepseekModel, setDeepseekModel] = useState(() => {
    const saved = localStorage.getItem('deepseekModel');
    if (!saved || saved === 'deepseek-chat') {
      return 'deepseek-v4-flash-vision-exp';
    }
    return saved;
  });

  const [musesparkApiKey, setMusesparkApiKey] = useState(() => {
    return localStorage.getItem('musesparkApiKey') || DEFAULT_META_KEY;
  });

  const [musesparkModel, setMusesparkModel] = useState(() => {
    return localStorage.getItem('musesparkModel') || 'muse-spark-1.3-contributor';
  });

  const [agentApiUrl, setAgentApiUrl] = useState(() => {
    return localStorage.getItem('agentApiUrl') || 'http://127.0.0.1:8000';
  });

  // Student-specific Progress Plan by Subject (과목별 주차별 예상 진도 단원)
  const initialSchedules = [
    {
      id: 1,
      studentName: '강백',
      week: '1주차',
      period: '8/12(월) ~ 8/17(토)',
      subject: '공통수학1',
      chapter: '1단원. 다항식의 연산과 나머지정리',
      topic: '',
      status: 'completed'
    },
    {
      id: 2,
      studentName: '강백',
      week: '2주차',
      period: '8/19(월) ~ 8/24(토)',
      subject: '공통수학1',
      chapter: '2단원. 복소수와 이차방정식',
      topic: '',
      status: 'current'
    },
    {
      id: 3,
      studentName: '강백',
      week: '3주차',
      period: '8/26(월) ~ 8/31(토)',
      subject: '공통수학1',
      chapter: '3단원. 이차방정식과 이차함수',
      topic: '',
      status: 'upcoming'
    },
    {
      id: 4,
      studentName: '강백',
      week: '4주차',
      period: '9/02(월) ~ 9/07(토)',
      subject: '공통수학1',
      chapter: '4단원. 여러 가지 방정식과 부등식',
      topic: '',
      status: 'upcoming'
    },
    {
      id: 5,
      studentName: '이소은',
      week: '1주차',
      period: '8/19(월) ~ 8/24(토)',
      subject: '기하',
      chapter: '1단원. 이차곡선',
      topic: '',
      status: 'current'
    }
  ];

  const [schedules, setSchedules] = useState(() => {
    try {
      const saved = localStorage.getItem('homework_app_syllabus_v5');
      return saved ? JSON.parse(saved) : initialSchedules;
    } catch {
      return initialSchedules;
    }
  });

  const saveSchedules = (newSchedules) => {
    setSchedules(newSchedules);
    try {
      localStorage.setItem('homework_app_syllabus_v5', JSON.stringify(newSchedules));
    } catch (err) {
      console.error('Failed to save syllabus', err);
    }
  };

  const addSchedule = (scheduleData) => {
    const newSchedule = {
      id: Date.now(),
      ...scheduleData
    };
    saveSchedules([newSchedule, ...schedules]);
  };

  const updateSchedule = (id, updatedFields) => {
    const newSchedules = schedules.map(s => s.id === parseInt(id) ? { ...s, ...updatedFields } : s);
    saveSchedules(newSchedules);
  };

  const deleteSchedule = (id) => {
    const newSchedules = schedules.filter(s => s.id !== parseInt(id));
    saveSchedules(newSchedules);
  };

  // Promotional Banners & Notice Cards (로그인 화면 홍보 배너/소개 카드)
  const initialPromoBanners = [
    {
      id: 1,
      tag: "1:1 맞춤 과외",
      title: "프리미엄 1:1 맞춤 수학 클리닉",
      description: "개념 완성부터 킬러 문항 정복까지, 학생별 맞춤 밀착 지도 및 취약점 정밀 첨삭",
      imageUrl: "",
      badge: "✨ 대표 강좌",
      icon: "🏆"
    },
    {
      id: 2,
      tag: "AI 스마트 학습",
      title: "AI 손글씨 수식 인식 & 실시간 풀이 피드백",
      description: "학생이 직접 쓴 손글씨 풀이를 비전 AI가 분석하여 오류를 즉시 피드백하고 오답을 자동 누적합니다.",
      imageUrl: "",
      badge: "🤖 첨단 시스템",
      icon: "⚡"
    },
    {
      id: 3,
      tag: "학부모 안심 관리",
      title: "주차별 진도표 & 단원별 오답 누적 관리",
      description: "매주 진도 현황과 누적 시험 결과를 투명하게 공유하여 확실한 성적 향상을 보장합니다.",
      imageUrl: "",
      badge: "📊 진도 관리",
      icon: "📈"
    }
  ];

  const [promoBanners, setPromoBanners] = useState(() => {
    try {
      const saved = localStorage.getItem('homework_app_promo_banners_v1');
      return saved ? JSON.parse(saved) : initialPromoBanners;
    } catch {
      return initialPromoBanners;
    }
  });

  const savePromoBanners = (newBanners) => {
    setPromoBanners(newBanners);
    try {
      localStorage.setItem('homework_app_promo_banners_v1', JSON.stringify(newBanners));
    } catch (err) {
      console.error('Failed to save promo banners', err);
    }
  };

  const addPromoBanner = (bannerData) => {
    const newBanner = {
      id: Date.now(),
      ...bannerData
    };
    savePromoBanners([newBanner, ...promoBanners]);
  };

  const updatePromoBanner = (id, updatedFields) => {
    const newBanners = promoBanners.map(b => b.id === parseInt(id) ? { ...b, ...updatedFields } : b);
    savePromoBanners(newBanners);
  };

  const deletePromoBanner = (id) => {
    const newBanners = promoBanners.filter(b => b.id !== parseInt(id));
    savePromoBanners(newBanners);
  };

  // Main Landing Yellow Box Image Link (노란색 박스 메인 이미지 링크)
  const [mainBannerImage, setMainBannerImage] = useState(() => {
    return localStorage.getItem('homework_app_main_banner_v1') || '';
  });

  const saveMainBannerImage = (url) => {
    setMainBannerImage(url);
    localStorage.setItem('homework_app_main_banner_v1', url);
  };

  const saveAiSettings = ({ provider, geminiKey, deepseekKey, model, musesparkKey, musesparkModel: mModel, agentUrl }) => {
    if (provider !== undefined) {
      setAiProvider(provider);
      localStorage.setItem('aiProvider', provider);
    }
    if (geminiKey !== undefined) {
      setGeminiApiKey(geminiKey);
      localStorage.setItem('geminiApiKey', geminiKey);
    }
    if (deepseekKey !== undefined) {
      setDeepseekApiKey(deepseekKey);
      localStorage.setItem('deepseekApiKey', deepseekKey);
    }
    if (model !== undefined) {
      setDeepseekModel(model);
      localStorage.setItem('deepseekModel', model);
    }
    if (musesparkKey !== undefined) {
      setMusesparkApiKey(musesparkKey);
      localStorage.setItem('musesparkApiKey', musesparkKey);
    }
    if (mModel !== undefined) {
      setMusesparkModel(mModel);
      localStorage.setItem('musesparkModel', mModel);
    }
    if (agentUrl !== undefined) {
      setAgentApiUrl(agentUrl);
      localStorage.setItem('agentApiUrl', agentUrl);
    }
  };

  const saveGeminiApiKey = (key) => {
    setGeminiApiKey(key);
    localStorage.setItem('geminiApiKey', key);
  };

  const saveDeepseekApiKey = (key) => {
    setDeepseekApiKey(key);
    localStorage.setItem('deepseekApiKey', key);
  };

  const saveMusesparkApiKey = (key) => {
    setMusesparkApiKey(key);
    localStorage.setItem('musesparkApiKey', key);
  };

  const aiConfig = {
    provider: aiProvider || 'musespark',
    geminiApiKey,
    deepseekApiKey: deepseekApiKey || DEFAULT_DEEPSEEK_KEY,
    deepseekModel: (deepseekModel && deepseekModel !== 'deepseek-chat') ? deepseekModel : 'deepseek-v4-flash-vision-exp',
    musesparkApiKey,
    musesparkModel: musesparkModel || 'muse-spark-1.3-contributor',
    agentApiUrl: agentApiUrl || 'http://127.0.0.1:8000'
  };

  const isAiConfigured = (aiProvider === 'deepseek' && !!deepseekApiKey) ||
                         (aiProvider === 'gemini' && !!geminiApiKey) ||
                         (aiProvider === 'musespark' && !!musesparkApiKey);

  // Fetch data on mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch(GAS_URL);
        const result = await response.json();
        if (Array.isArray(result) && result.length > 0) {
          setData(result);
        } else {
          // If empty, initialize with fallback data and save to drive
          setData(fallbackInitialData);
          saveDataToDrive(fallbackInitialData);
        }
      } catch (error) {
        console.error("Error fetching data:", error);
        // Fallback to local memory if offline/error
        setData(fallbackInitialData);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchData();
  }, []);

  const saveDataToDrive = async (newData) => {
    try {
      await fetch(GAS_URL, {
        method: 'POST',
        redirect: 'follow',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        body: JSON.stringify({
          action: 'updateData',
          data: newData
        })
      });
    } catch (error) {
      console.error("Error saving data:", error);
    }
  };

  const updateStateAndSave = (updaterFn) => {
    setData(prevData => {
      const newData = updaterFn(prevData);
      saveDataToDrive(newData); // Async save in background
      return newData;
    });
  };

  const getHomeworkById = (id) => {
    for (const section of data) {
      const hw = section.homeworks.find(h => h.id === parseInt(id));
      if (hw) return hw;
    }
    return null;
  };

  const getSubmittedHomeworks = () => {
    let submitted = [];
    data.forEach(section => {
      section.homeworks.forEach(hw => {
        const hasSubmittedImages = hw.submittedProblems.some(p => p.status === 'submitted' || p.status === 'correct' || p.status === 'incorrect');
        if (hasSubmittedImages) {
          submitted.push(hw);
        }
      });
    });
    return submitted;
  };

  // ==========================
  // Problem Image Google Drive Integration
  // ==========================
  const scanDriveFolderProblems = async (folderUrl) => {
    try {
      const match = folderUrl.match(/\/folders\/([a-zA-Z0-9_-]+)/) || folderUrl.match(/id=([a-zA-Z0-9_-]+)/);
      const folderId = match ? match[1] : null;
      if (!folderId) {
        return { success: false, error: '유효한 구글 드라이브 폴더 링크가 아닙니다.' };
      }

      const response = await fetch(GAS_URL, {
        method: 'POST',
        redirect: 'follow',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'scanFolderProblems',
          folderId: folderId
        })
      });
      const result = await response.json();
      return result;
    } catch (e) {
      console.error("scanDriveFolderProblems error:", e);
      return { success: false, error: e.message };
    }
  };

  const getProblemImageFromDrive = async (folderUrl, fileName) => {
    try {
      const match = folderUrl.match(/\/folders\/([a-zA-Z0-9_-]+)/) || folderUrl.match(/id=([a-zA-Z0-9_-]+)/);
      const folderId = match ? match[1] : null;
      if (!folderId) return null;

      const response = await fetch(GAS_URL, {
        method: 'POST',
        redirect: 'follow',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'getProblemImage',
          folderId: folderId,
          fileName: fileName
        })
      });
      const result = await response.json();
      return result;
    } catch (e) {
      console.error(e);
      return null;
    }
  };

  const submitHomeworkProblem = async (id, groupId, problemNumber, imageBase64, aiFeedback = null, aiGrade = null, studentAnswer = null) => {
    setIsSaving(true);
    try {
      let shouldUploadToDrive = true;
      let mimeType = 'image/jpeg';
      let base64Data = imageBase64;
      
      if (imageBase64.startsWith('data:')) {
        // Extract base64 if it is base64 encoded
        const matches = imageBase64.match(/^data:([a-zA-Z0-9-+\/]+);(?:charset=[^;]+;)?base64,(.+)$/);
        if (matches && matches.length === 3) {
          mimeType = matches[1];
          base64Data = matches[2];
        } else {
          // It's a data URL but not base64 (e.g. SVG utf8 from MathType)
          shouldUploadToDrive = false;
        }
      } else if (imageBase64.startsWith('http')) {
        // It's an external URL (e.g. from MathType server)
        shouldUploadToDrive = false;
      }

      // Find homework and student info
      let hw = null;
      let hwDate = "";
      for (const section of data) {
        const found = (section.homeworks || []).find(h => h.id === parseInt(id));
        if (found) {
          hw = found;
          hwDate = section.date;
          break;
        }
      }

      const studentName = hw ? hw.studentName : 'Unknown';
      const hwTitle = hw ? hw.title : '과제';
      const cleanStudent = studentName.replace(/[\/\\?%*:|"<>]/g, '-');
      const cleanHwTitle = hwTitle.replace(/[\/\\?%*:|"<>]/g, '-');
      const cleanDate = hwDate.split('(')[0].replace(/ /g, '') || "날짜미상";

      let finalImageUrl = imageBase64;

      if (shouldUploadToDrive) {
        let label = '범위미상';
        if (hw && hw.problemGroups) {
          const group = hw.problemGroups.find(g => g.groupId === groupId);
          if (group && group.label) {
            label = group.label.replace(/[\/\\?%*:|"<>]/g, '-');
          }
        }
        
        const fileName = `${cleanStudent}_${cleanDate}_${cleanHwTitle}_${label}_${problemNumber}번.jpg`;

        const response = await fetch(GAS_URL, {
          method: 'POST',
          redirect: 'follow',
          headers: {
            'Content-Type': 'text/plain;charset=utf-8',
          },
          body: JSON.stringify({
            action: 'uploadImage',
            folderId: '1jh2auGT5QXNY6Te2mGX0QvJGico0eMGx',
            studentName: cleanStudent,
            hwTitle: cleanHwTitle,
            filename: fileName,
            mimeType: mimeType,
            base64: base64Data
          })
        });
        
        const result = await response.json();
        
        if (result.success && result.url) {
          finalImageUrl = result.url;
        } else {
          alert("이미지 업로드에 실패했습니다: " + (result.error || "알 수 없는 오류"));
          setIsSaving(false);
          return;
        }
      }

      // Send directly to Obsidian student folder (08. 학생관리/{studentName}/숙제제출/{hwTitle}/) via musespark1.3 / local agent
      try {
        const localAgentUrl = (agentApiUrl || 'http://127.0.0.1:8000').replace(/\/$/, '');
        fetch(`${localAgentUrl}/api/submit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            student_name: studentName,
            homework_title: hwTitle,
            problem_number: parseInt(problemNumber),
            image_data: imageBase64 || finalImageUrl,
            student_answer: studentAnswer,
            ai_feedback: aiFeedback,
            ai_grade: aiGrade
          })
        }).catch(err => console.log('Local Obsidian sync notice:', err));
      } catch (err) {
        console.log('Local Obsidian sync error ignored:', err);
      }
      
      // Update state with the final image URL, AI feedback and status
      updateStateAndSave(prevData => prevData.map(section => ({
        ...section,
        homeworks: section.homeworks.map(hw => {
          if (hw.id === parseInt(id)) {
            const existingIndex = hw.submittedProblems.findIndex(
              p => p.groupId === groupId && p.problemNumber === parseInt(problemNumber)
            );
            let newSubmitted = [...hw.submittedProblems];
            
            const statusToSet = aiGrade === '⭕ 정답' ? 'correct' : (aiGrade === '❌ 오답' ? 'incorrect' : 'submitted');

            if (existingIndex >= 0) {
              newSubmitted[existingIndex] = { 
                ...newSubmitted[existingIndex], 
                imageUrl: finalImageUrl, 
                status: statusToSet,
                studentAnswer: studentAnswer !== null ? studentAnswer : (newSubmitted[existingIndex].studentAnswer || null),
                aiFeedback: aiFeedback || newSubmitted[existingIndex].aiFeedback || null,
                aiGrade: aiGrade || newSubmitted[existingIndex].aiGrade || null
              };
            } else {
              newSubmitted.push({ 
                groupId, 
                problemNumber: parseInt(problemNumber), 
                imageUrl: finalImageUrl, 
                status: statusToSet,
                studentAnswer: studentAnswer || null,
                aiFeedback: aiFeedback || null,
                aiGrade: aiGrade || null
              });
            }
            
            return { ...hw, submittedProblems: newSubmitted };
          }
          return hw;
        })
      })));

    } catch (error) {
      console.error("Upload error:", error);
      alert("이미지 전송 중 오류가 발생했습니다.");
    } finally {
      setIsSaving(false);
    }
  };

  const exemptProblem = (id, groupId, problemNumber) => {
    updateStateAndSave(prevData => prevData.map(section => ({
      ...section,
      homeworks: section.homeworks.map(hw => {
        if (hw.id === parseInt(id)) {
          const existingIndex = hw.submittedProblems.findIndex(
            p => p.groupId === groupId && p.problemNumber === parseInt(problemNumber)
          );
          let newSubmitted = [...hw.submittedProblems];
          
          if (existingIndex >= 0) {
            newSubmitted[existingIndex] = { ...newSubmitted[existingIndex], imageUrl: null, status: 'exempt' };
          } else {
            newSubmitted.push({ groupId, problemNumber: parseInt(problemNumber), imageUrl: null, status: 'exempt' });
          }
          
          return { ...hw, submittedProblems: newSubmitted };
        }
        return hw;
      })
    })));
  };

  const toggleBookmarkProblem = (id, groupId, problemNumber) => {
    updateStateAndSave(prevData => prevData.map(section => ({
      ...section,
      homeworks: section.homeworks.map(hw => {
        if (hw.id === parseInt(id)) {
          const existingIndex = hw.submittedProblems.findIndex(
            p => p.groupId === groupId && p.problemNumber === parseInt(problemNumber)
          );
          let newSubmitted = [...hw.submittedProblems];
          if (existingIndex >= 0) {
            const currentItem = newSubmitted[existingIndex];
            newSubmitted[existingIndex] = {
              ...currentItem,
              isBookmarked: !currentItem.isBookmarked
            };
          } else {
            newSubmitted.push({
              groupId,
              problemNumber: parseInt(problemNumber),
              imageUrl: null,
              status: 'unsubmitted',
              isBookmarked: true
            });
          }
          return { ...hw, submittedProblems: newSubmitted };
        }
        return hw;
      })
    })));
  };

  const evaluateSingleProblem = (id, groupId, problemNumber, gradeResult, aiFeedback = null) => {
    const now = new Date();
    const dateStr = `${now.getMonth() + 1}/${now.getDate()} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    updateStateAndSave(prevData => prevData.map(section => ({
      ...section,
      homeworks: section.homeworks.map(hw => {
        if (hw.id === parseInt(id)) {
          const existingIndex = hw.submittedProblems.findIndex(
            p => p.groupId === groupId && p.problemNumber === parseInt(problemNumber)
          );
          if (existingIndex >= 0) {
            let newSubmitted = [...hw.submittedProblems];
            const currentItem = newSubmitted[existingIndex];
            const currentAttempts = currentItem.attempts || 1;
            
            let statusToSet = 'incorrect';
            if (gradeResult === true || gradeResult === 'correct') {
              statusToSet = 'correct';
            } else if (gradeResult === 'indeterminate' || gradeResult === 'unclear' || gradeResult === 'pending') {
              statusToSet = 'indeterminate';
            } else if (gradeResult === false || gradeResult === 'incorrect') {
              statusToSet = 'incorrect';
            }

            const newAttempts = (statusToSet === 'incorrect' && currentItem.status !== 'incorrect') || (statusToSet === 'correct' && currentItem.status === 'incorrect')
              ? currentAttempts + 1
              : currentAttempts;

            const existingHistory = Array.isArray(currentItem.history) ? currentItem.history : [];
            const newHistoryEntry = {
              attempt: newAttempts,
              date: dateStr,
              status: statusToSet,
              imageUrl: currentItem.imageUrl,
              aiFeedback: aiFeedback !== null ? aiFeedback : currentItem.aiFeedback
            };

            newSubmitted[existingIndex] = { 
              ...currentItem, 
              status: statusToSet,
              attempts: newAttempts,
              aiFeedback: aiFeedback !== null ? aiFeedback : currentItem.aiFeedback,
              history: [...existingHistory, newHistoryEntry],
              hasBeenIncorrect: currentItem.hasBeenIncorrect || statusToSet === 'incorrect'
            };
            return { ...hw, submittedProblems: newSubmitted };
          }
        }
        return hw;
      })
    })));
  };

  const evaluateBulkProblems = (id, wrongNumbersArray, bulkFeedback = '') => {
    updateStateAndSave(prevData => prevData.map(section => ({
      ...section,
      homeworks: section.homeworks.map(hw => {
        if (hw.id === parseInt(id)) {
          let newSubmitted = [...(hw.submittedProblems || [])];
          newSubmitted = newSubmitted.map(p => {
            if (p.status === 'exempt' || !p.imageUrl) return p;
            
            const isWrong = wrongNumbersArray.includes(p.problemNumber);
            const currentAttempts = p.attempts || 1;
            
            return {
              ...p,
              status: isWrong ? 'incorrect' : 'correct',
              attempts: isWrong && p.status !== 'incorrect' ? currentAttempts + 1 : currentAttempts,
              aiFeedback: bulkFeedback !== '' ? bulkFeedback : p.aiFeedback
            };
          });
          return { ...hw, submittedProblems: newSubmitted };
        }
        return hw;
      })
    })));
  };

  const addProblemRange = (id, label, startNum, endNum) => {
    updateStateAndSave(prevData => prevData.map(section => ({
      ...section,
      homeworks: section.homeworks.map(hw => {
        if (hw.id === parseInt(id)) {
          const newGroupId = 'g' + Date.now();
          const problems = [];
          for (let i = parseInt(startNum); i <= parseInt(endNum); i++) {
            problems.push(i);
          }
          const newGroup = {
            groupId: newGroupId,
            label,
            problems
          };
          return { ...hw, problemGroups: [...(hw.problemGroups || []), newGroup] };
        }
        return hw;
      })
    })));
  };

  const removeProblemGroup = (id, groupId) => {
    updateStateAndSave(prevData => prevData.map(section => ({
      ...section,
      homeworks: section.homeworks.map(hw => {
        if (hw.id === parseInt(id)) {
          const newProblemGroups = (hw.problemGroups || []).filter(g => g.groupId !== groupId);
          const newSubmittedProblems = (hw.submittedProblems || []).filter(p => p.groupId !== groupId);
          
          return { 
            ...hw, 
            problemGroups: newProblemGroups,
            submittedProblems: newSubmittedProblems 
          };
        }
        return hw;
      })
    })));
  };

  const updateHomeworkInfo = (id, title, description, studentName, pdfUrl) => {
    updateStateAndSave(prevData => prevData.map(section => ({
      ...section,
      homeworks: section.homeworks.map(hw => {
        if (hw.id === parseInt(id)) {
          return {
            ...hw,
            title: title !== undefined ? title : hw.title,
            description: description !== undefined ? description : hw.description,
            studentName: studentName !== undefined ? studentName : hw.studentName,
            pdfUrl: pdfUrl !== undefined ? pdfUrl : hw.pdfUrl
          };
        }
        return hw;
      })
    })));
  };

  const updateHomeworkAnswers = (id, answers) => {
    updateStateAndSave(prevData => prevData.map(section => ({
      ...section,
      homeworks: section.homeworks.map(hw => {
        if (hw.id === parseInt(id)) {
          return {
            ...hw,
            answers: { ...(hw.answers || {}), ...answers }
          };
        }
        return hw;
      })
    })));
  };

  const updateTestInfo = (id, title, studentName, score, comment) => {
    updateStateAndSave(prevData => prevData.map(section => ({
      ...section,
      homeworks: section.homeworks.map(hw => {
        if (hw.id === parseInt(id)) {
          return {
            ...hw,
            title: title !== undefined ? title : hw.title,
            studentName: studentName !== undefined ? studentName : hw.studentName,
            score: score !== undefined ? score : hw.score,
            comment: comment !== undefined ? comment : hw.comment
          };
        }
        return hw;
      })
    })));
  };

  const createHomework = (date, studentName, title, description, createdAt, initialProblemGroups = [], pdfUrl = "", isOnlineTest = false, timeLimit = null, problemImagesBaseUrl = "") => {
    updateStateAndSave(prevData => {
      let newData = [...prevData];
      let sectionIndex = newData.findIndex(sec => sec.date === date);
      
      const newId = Date.now();
      const newHw = {
        id: newId,
        studentName,
        title,
        description,
        createdAt,
        teacherName: "",
        tag: "",
        statusType: "none",
        statusValue: null,
        problemGroups: initialProblemGroups,
        submittedProblems: [],
        evaluation: null,
        pdfUrl: pdfUrl,
        isOnlineTest: isOnlineTest,
        timeLimit: timeLimit,
        problemImagesBaseUrl: problemImagesBaseUrl
      };

      if (sectionIndex >= 0) {
        newData[sectionIndex] = {
          ...newData[sectionIndex],
          homeworks: [...newData[sectionIndex].homeworks, newHw]
        };
      } else {
        newData.push({
          date,
          homeworks: [newHw]
        });
      }
      return newData;
    });
  };

  const createTest = (date, studentName, title, score, comment, createdAt) => {
    updateStateAndSave(prevData => {
      let newData = [...prevData];
      let sectionIndex = newData.findIndex(sec => sec.date === date);
      
      const newId = Date.now();
      const newTest = {
        id: newId,
        type: 'test',
        studentName,
        title,
        score,
        comment,
        createdAt,
        teacherName: "",
      };

      if (sectionIndex >= 0) {
        newData[sectionIndex] = {
          ...newData[sectionIndex],
          homeworks: [...newData[sectionIndex].homeworks, newTest]
        };
      } else {
        newData.push({
          date,
          homeworks: [newTest]
        });
      }
      return newData;
    });
  };

  const deleteHomework = (id) => {
    updateStateAndSave(prevData => {
      // Filter out the homework by id from all sections
      const newData = prevData.map(section => ({
        ...section,
        homeworks: section.homeworks.filter(hw => hw.id !== parseInt(id))
      })).filter(section => section.homeworks.length > 0); // Optionally remove empty sections
      
      return newData;
    });
  };

  const evaluateHomework = (id, evaluation) => {
    updateStateAndSave(prevData => prevData.map(section => ({
      ...section,
      homeworks: section.homeworks.map(hw => 
        hw.id === parseInt(id) 
          ? { ...hw, evaluation } 
          : hw
      )
    })));
  };

  // Self-study problem management (숙제 외 자율학습 문제 수집 및 보관)
  const addSelfStudyProblem = (studentName, problemData) => {
    const {
      workbook = '자율학습',
      chapter = '단원 미지정',
      problemNumber = '1',
      imageUrl = null,
      memo = '',
      status = 'incorrect'
    } = problemData;

    const parsedNum = parseInt(problemNumber) || (Date.now() % 10000);
    const grpId = `self_${workbook}_${chapter}`.replace(/[\s\.\-]+/g, '_');
    const grpLabel = `[자율] ${workbook} - ${chapter}`;

    updateStateAndSave(prevData => {
      let newData = [...prevData];
      let targetSection = newData[0];
      if (!targetSection) {
        targetSection = { date: '상시 자율학습', homeworks: [] };
        newData.push(targetSection);
      }

      let foundSecIdx = -1;
      let foundHwIdx = -1;

      for (let sIdx = 0; sIdx < newData.length; sIdx++) {
        const sec = newData[sIdx];
        const hIdx = (sec.homeworks || []).findIndex(
          h => (h.isSelfStudy || h.title === '[자율학습] 숙제 외 문제 보관') && h.studentName === studentName
        );
        if (hIdx >= 0) {
          foundSecIdx = sIdx;
          foundHwIdx = hIdx;
          break;
        }
      }

      const problemItem = {
        groupId: grpId,
        problemNumber: parsedNum,
        customDisplayNumber: problemNumber || String(parsedNum),
        workbook,
        chapter,
        imageUrl,
        memo,
        isBookmarked: true,
        isSelfStudy: true,
        status,
        attempts: 1,
        createdAt: new Date().toISOString()
      };

      if (foundHwIdx < 0) {
        const newSelfStudyHw = {
          id: Date.now(),
          teacherName: 'mathkorea',
          studentName,
          title: '[자율학습] 숙제 외 문제 보관',
          description: '학생이 스스로 공부하면서 수집한 문제 보관소',
          tag: '자율학습',
          isSelfStudy: true,
          statusType: 'none',
          statusValue: null,
          problemGroups: [
            {
              groupId: grpId,
              label: grpLabel,
              problems: [parsedNum]
            }
          ],
          submittedProblems: [problemItem],
          evaluation: null
        };
        targetSection.homeworks = [newSelfStudyHw, ...(targetSection.homeworks || [])];
      } else {
        const existingHw = newData[foundSecIdx].homeworks[foundHwIdx];
        let updatedGroups = [...(existingHw.problemGroups || [])];
        let grp = updatedGroups.find(g => g.groupId === grpId);
        if (!grp) {
          grp = { groupId: grpId, label: grpLabel, problems: [parsedNum] };
          updatedGroups.push(grp);
        } else if (!grp.problems.includes(parsedNum)) {
          grp.problems = [...grp.problems, parsedNum];
        }

        const updatedSubmitted = [...(existingHw.submittedProblems || []), problemItem];
        newData[foundSecIdx].homeworks[foundHwIdx] = {
          ...existingHw,
          problemGroups: updatedGroups,
          submittedProblems: updatedSubmitted
        };
      }

      return newData;
    });
  };

  const deleteSelfStudyProblem = (hwId, groupId, problemNumber) => {
    updateStateAndSave(prevData => prevData.map(section => ({
      ...section,
      homeworks: (section.homeworks || []).map(hw => {
        if (hw.id === parseInt(hwId)) {
          const newSubmitted = (hw.submittedProblems || []).filter(
            p => !(p.groupId === groupId && p.problemNumber === parseInt(problemNumber))
          );
          return {
            ...hw,
            submittedProblems: newSubmitted
          };
        }
        return hw;
      })
    })));
  };

  const updateSelfStudyProblem = (hwId, groupId, problemNumber, updates) => {
    updateStateAndSave(prevData => prevData.map(section => ({
      ...section,
      homeworks: (section.homeworks || []).map(hw => {
        if (hw.id === parseInt(hwId)) {
          const newSubmitted = (hw.submittedProblems || []).map(p => {
            if (p.groupId === groupId && p.problemNumber === parseInt(problemNumber)) {
              return { ...p, ...updates };
            }
            return p;
          });
          return {
            ...hw,
            submittedProblems: newSubmitted
          };
        }
        return hw;
      })
    })));
  };

  return (
    <HomeworkContext.Provider value={{
      data,
      isLoading,
      isSaving,
      currentUser,
      isAdmin,
      login,
      logout,
      getHomeworkById,
      getSubmittedHomeworks,
      submitHomeworkProblem,
      exemptProblem,
      toggleBookmarkProblem,
      evaluateSingleProblem,
      evaluateBulkProblems,
      addProblemRange,
      removeProblemGroup,
      updateHomeworkInfo,
      updateHomeworkAnswers,
      updateTestInfo,
      deleteHomework,
      evaluateHomework,
      addSelfStudyProblem,
      deleteSelfStudyProblem,
      updateSelfStudyProblem,
      geminiApiKey,
      saveGeminiApiKey,
      aiProvider,
      deepseekApiKey,
      deepseekModel,
      saveDeepseekApiKey,
      musesparkApiKey,
      musesparkModel,
      saveMusesparkApiKey,
      saveAiSettings,
      aiConfig,
      isAiConfigured,
      agentApiUrl,
      setAgentApiUrl,
      createHomework,
      createTest,
      getProblemImageFromDrive,
      scanDriveFolderProblems,
      schedules,
      addSchedule,
      updateSchedule,
      deleteSchedule,
      promoBanners,
      addPromoBanner,
      updatePromoBanner,
      deletePromoBanner,
      savePromoBanners,
      mainBannerImage,
      saveMainBannerImage
    }}>
      {children}
    </HomeworkContext.Provider>
  );
};
