import React, { createContext, useState, useContext, useEffect, useRef } from 'react';
import { isValidImageUrl } from '../utils/gemini';

const HomeworkContext = createContext();

export const useHomework = () => useContext(HomeworkContext);

const GAS_URL = 'https://script.google.com/macros/s/AKfycbxaYVDgDHHkKz1wJazeMDlsYl3VGS8m05YQGpgdnyGxG4-12bWHsVP7I3pcKOMLBnU/exec';

const DEFAULT_DEEPSEEK_KEY = import.meta.env.VITE_DEEPSEEK_API_KEY || '';
const DEFAULT_OPENROUTER_KEY = import.meta.env.VITE_OPENROUTER_API_KEY || '';
const DEFAULT_META_KEY = import.meta.env.VITE_META_API_KEY || '';

export const REGISTERED_STUDENTS = [];
export const ADMIN_ACCOUNTS = ['mathkorea', 'admin', '선생님', '원장샘'];
const SYSTEM_ACCOUNT_NAMES = new Set(['전체', '공통', '원장샘', 'mathkorea', 'admin', '선생님']);
const REGISTERED_STUDENTS_KEY = 'homework_app_registered_students_v1';
const REMOVED_STUDENTS_KEY = 'homework_app_removed_students_v1';
const CLEAN_RESET_FLAG = 'homework_app_clean_reset_20261110';

const runCleanStudentResetOnce = () => {
  if (typeof window === 'undefined') return;
  try {
    if (localStorage.getItem(CLEAN_RESET_FLAG)) return;
    localStorage.removeItem('cachedHomeworkData');
    localStorage.removeItem('homework_app_syllabus_v7');
    localStorage.removeItem('homework_app_school_materials_v3');
    localStorage.removeItem('homework_app_school_materials_v2');
    localStorage.removeItem('homework_app_school_materials_v1');
    localStorage.removeItem(REGISTERED_STUDENTS_KEY);
    localStorage.removeItem(REMOVED_STUDENTS_KEY);
    const prevUser = localStorage.getItem('homeworkAppUser');
    if (prevUser && !ADMIN_ACCOUNTS.some(a => a.toLowerCase() === prevUser.trim().toLowerCase())) {
      localStorage.removeItem('homeworkAppUser');
    }
    localStorage.setItem(CLEAN_RESET_FLAG, '1');
  } catch (e) {}
};

runCleanStudentResetOnce();

const loadStringArray = (key) => {
  try {
    const saved = localStorage.getItem(key);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) return parsed.filter(s => typeof s === 'string' && s.trim());
    }
  } catch (e) {}
  return [];
};

const loadRegisteredStudents = () => loadStringArray(REGISTERED_STUDENTS_KEY);
const loadRemovedStudents = () => loadStringArray(REMOVED_STUDENTS_KEY);

export const normalizeStudentName = (name) => {
  if (!name || typeof name !== 'string') return '';
  const trimmed = name.trim();
  const matchedAdmin = ADMIN_ACCOUNTS.find(a => a.toLowerCase() === trimmed.toLowerCase());
  if (matchedAdmin) return matchedAdmin;
  return trimmed;
};

export const isInitialValidUser = (name) => {
  if (!name || typeof name !== 'string') return false;
  const norm = normalizeStudentName(name);
  if (ADMIN_ACCOUNTS.some(a => a.toLowerCase() === norm.toLowerCase())) return true;
  if (REGISTERED_STUDENTS.includes(norm) || loadRegisteredStudents().includes(norm)) return true;
  return false;
};

const fallbackInitialData = [];

export const HomeworkProvider = ({ children }) => {
  const [data, setData] = useState(() => {
    try {
      const cached = localStorage.getItem('cachedHomeworkData');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}
    return [];
  });
  const [isLoading, setIsLoading] = useState(() => {
    try {
      const cached = localStorage.getItem('cachedHomeworkData');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) return false;
      }
    } catch (e) {}
    return true;
  });
  const [isSaving, setIsSaving] = useState(false);
  const dataRef = useRef(data);
  dataRef.current = data;

  const [registeredStudents, setRegisteredStudents] = useState(() => loadRegisteredStudents());

  const [viewMode, setViewModeState] = useState(() => {
    try {
      const saved = localStorage.getItem('homework_app_view_mode');
      if (saved === 'desktop' || saved === 'mobile') return saved;
    } catch (e) {}
    return 'mobile';
  });

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-view-mode', viewMode);
    }
    try {
      localStorage.setItem('homework_app_view_mode', viewMode);
    } catch (e) {}
  }, [viewMode]);

  const setViewMode = (mode) => {
    setViewModeState(mode === 'desktop' ? 'desktop' : 'mobile');
  };

  const toggleViewMode = () => {
    setViewModeState(prev => (prev === 'desktop' ? 'mobile' : 'desktop'));
  };

  const isDesktopMode = viewMode === 'desktop';

  const saveRegisteredStudentsList = (nextList) => {
    setRegisteredStudents(nextList);
    try {
      localStorage.setItem(REGISTERED_STUDENTS_KEY, JSON.stringify(nextList));
    } catch (e) {}
  };

  const ensureStudentRegistered = (rawName) => {
    const cleanName = normalizeStudentName(rawName);
    if (!cleanName || SYSTEM_ACCOUNT_NAMES.has(cleanName) || ADMIN_ACCOUNTS.some(a => a.toLowerCase() === cleanName.toLowerCase())) {
      return;
    }
    const removed = loadRemovedStudents().filter(s => s !== cleanName);
    try { localStorage.setItem(REMOVED_STUDENTS_KEY, JSON.stringify(removed)); } catch (e) {}
    setRegisteredStudents(prev => {
      if (prev.includes(cleanName)) return prev;
      const next = [...prev, cleanName];
      try {
        localStorage.setItem(REGISTERED_STUDENTS_KEY, JSON.stringify(next));
      } catch (e) {}
      return next;
    });
  };

  const addRegisteredStudent = (rawName) => {
    const cleanName = normalizeStudentName(rawName);
    if (!cleanName) {
      return { success: false, message: '학생 이름을 입력해주세요.' };
    }
    if (SYSTEM_ACCOUNT_NAMES.has(cleanName) || ADMIN_ACCOUNTS.some(a => a.toLowerCase() === cleanName.toLowerCase())) {
      return { success: false, message: '관리자 또는 시스템 예약 명칭은 학생으로 등록할 수 없습니다.' };
    }
    if (registeredStudents.includes(cleanName)) {
      return { success: false, message: `이미 등록된 학생입니다: "${cleanName}"` };
    }
    const removed = loadRemovedStudents().filter(s => s !== cleanName);
    try { localStorage.setItem(REMOVED_STUDENTS_KEY, JSON.stringify(removed)); } catch (e) {}
    saveRegisteredStudentsList([...registeredStudents, cleanName]);
    return { success: true, name: cleanName };
  };

  // Authentication State
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const userFromUrl = urlParams.get('user');
      if (userFromUrl) {
        const norm = normalizeStudentName(userFromUrl);
        if (isInitialValidUser(norm)) {
          localStorage.setItem('homeworkAppUser', norm);
          return norm;
        }
      }
    } catch (e) {}
    const saved = localStorage.getItem('homeworkAppUser');
    if (saved) {
      const norm = normalizeStudentName(saved);
      const hasSavedStudentData = (() => {
        try {
          const cached = JSON.parse(localStorage.getItem('cachedHomeworkData') || '[]');
          if (Array.isArray(cached) && cached.some(sec => sec.homeworks?.some(hw => hw.studentName === norm))) return true;
          const syll = JSON.parse(localStorage.getItem('homework_app_syllabus_v7') || '[]');
          if (Array.isArray(syll) && syll.some(s => s.studentName === norm)) return true;
        } catch (e) {}
        return false;
      })();
      if (isInitialValidUser(norm) || hasSavedStudentData) {
        return norm;
      } else {
        localStorage.removeItem('homeworkAppUser');
        return null;
      }
    }
    return null;
  });

  const login = (rawUsername) => {
    if (!rawUsername || typeof rawUsername !== 'string') {
      return { success: false, message: '이름 또는 아이디를 입력해주세요.' };
    }
    const norm = normalizeStudentName(rawUsername);
    const isDynamicStudent =
      registeredStudents.includes(norm) ||
      (schedules && schedules.some(s => s.studentName === norm)) ||
      (data && data.some(sec => sec.homeworks && sec.homeworks.some(hw => hw.studentName === norm)));

    if (!isInitialValidUser(norm) && !isDynamicStudent) {
      return {
        success: false,
        message: `등록되지 않은 학생 이름입니다: "${rawUsername.trim()}". 본인의 이름을 정확하게 입력해주세요.`
      };
    }

    setCurrentUser(norm);
    localStorage.setItem('homeworkAppUser', norm);
    return { success: true, username: norm };
  };

  const logout = () => {
    setCurrentUser(null);
    localStorage.removeItem('homeworkAppUser');
  };

  const isAdmin = currentUser === 'mathkorea' || currentUser === 'admin' || currentUser === '선생님' || currentUser === '원장샘';

  // AI Settings State (Gemini / DeepSeek / Meta Muse Spark / TypeSafe Jev)
  const [aiProvider, setAiProvider] = useState(() => {
    const saved = localStorage.getItem('aiProvider');
    if (saved === 'musespark') {
      localStorage.setItem('aiProvider', 'jev');
      return 'jev';
    }
    return saved || 'jev';
  });

  const [geminiApiKey, setGeminiApiKey] = useState(() => {
    return localStorage.getItem('geminiApiKey') || '';
  });

  const [openrouterApiKey, setOpenrouterApiKey] = useState(() => {
    const saved = localStorage.getItem('openrouterApiKey');
    return (saved && saved.trim()) ? saved.trim() : (DEFAULT_OPENROUTER_KEY || '');
  });

  const [openrouterModel, setOpenrouterModel] = useState(() => {
    const saved = localStorage.getItem('openrouterModel');
    if (!saved || saved === 'typesafe/jev-1.13') {
      localStorage.setItem('openrouterModel', 'typesafe/jev-1.14');
      return 'typesafe/jev-1.14';
    }
    return saved;
  });

  const [deepseekApiKey, setDeepseekApiKey] = useState(() => {
    const saved = localStorage.getItem('deepseekApiKey');
    if (saved && saved.startsWith('sk-c5728fda')) {
      localStorage.removeItem('deepseekApiKey');
      return '';
    }
    return (saved && saved.trim()) ? saved.trim() : '';
  });

  const [deepseekModel, setDeepseekModel] = useState(() => {
    const saved = localStorage.getItem('deepseekModel');
    if (!saved || saved === 'deepseek-chat') {
      return 'deepseek-v4-flash-vision-exp';
    }
    return saved;
  });

  const [musesparkApiKey, setMusesparkApiKey] = useState(() => {
    const saved = localStorage.getItem('musesparkApiKey');
    if (saved && (saved.startsWith('LLM_') || saved.includes('2161394044719218'))) {
      localStorage.removeItem('musesparkApiKey');
      return '';
    }
    return saved || '';
  });

  const [musesparkModel, setMusesparkModel] = useState(() => {
    return localStorage.getItem('musesparkModel') || 'muse-spark-1.3-contributor';
  });

  const [agentApiUrl, setAgentApiUrl] = useState(() => {
    return localStorage.getItem('agentApiUrl') || 'http://127.0.0.1:8000';
  });

  // Student-specific Progress Plan by Subject (과목별 주차별 예상 진도 단원 - coach-plan 수립)
  const initialSchedules = [];

  const [schedules, setSchedules] = useState(() => {
    try {
      const saved = localStorage.getItem('homework_app_syllabus_v7');
      return saved ? JSON.parse(saved) : initialSchedules;
    } catch {
      return initialSchedules;
    }
  });

  const saveSchedules = (newSchedules) => {
    setSchedules(newSchedules);
    try {
      localStorage.setItem('homework_app_syllabus_v7', JSON.stringify(newSchedules));
    } catch (err) {
      console.error('Failed to save syllabus', err);
    }
  };

  const addSchedule = (scheduleData) => {
    ensureStudentRegistered(scheduleData?.studentName);
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

  const removeRegisteredStudent = (targetName, removeDataToo = true) => {
    const cleanName = normalizeStudentName(targetName);
    if (!cleanName) return;
    const removed = Array.from(new Set([...loadRemovedStudents(), cleanName]));
    try { localStorage.setItem(REMOVED_STUDENTS_KEY, JSON.stringify(removed)); } catch (e) {}
    saveRegisteredStudentsList(registeredStudents.filter(s => s !== cleanName));
    saveSchedules(schedules.filter(s => s.studentName !== cleanName));
    if (removeDataToo) {
      updateStateAndSave(prevData =>
        prevData
          .map(section => ({
            ...section,
            homeworks: (section.homeworks || []).filter(hw => hw.studentName !== cleanName)
          }))
          .filter(section => section.homeworks.length > 0)
      );
    }
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

  const saveAiSettings = ({ provider, geminiKey, deepseekKey, model, musesparkKey, musesparkModel: mModel, openrouterKey, openrouterModel: oModel, agentUrl }) => {
    if (provider !== undefined) {
      setAiProvider(provider);
      localStorage.setItem('aiProvider', provider);
    }
    if (geminiKey !== undefined) {
      const k = (geminiKey || '').trim();
      setGeminiApiKey(k);
      if (k) localStorage.setItem('geminiApiKey', k);
      else localStorage.removeItem('geminiApiKey');
    }
    if (openrouterKey !== undefined) {
      const finalKey = (openrouterKey || '').trim();
      setOpenrouterApiKey(finalKey);
      if (finalKey) localStorage.setItem('openrouterApiKey', finalKey);
      else localStorage.removeItem('openrouterApiKey');
    }
    if (oModel !== undefined) {
      const finalModel = (oModel && oModel.trim()) ? oModel.trim() : 'typesafe/jev-1.14';
      setOpenrouterModel(finalModel);
      localStorage.setItem('openrouterModel', finalModel);
    }
    if (deepseekKey !== undefined) {
      const finalDeepKey = (deepseekKey || '').trim();
      setDeepseekApiKey(finalDeepKey);
      if (finalDeepKey) localStorage.setItem('deepseekApiKey', finalDeepKey);
      else localStorage.removeItem('deepseekApiKey');
    }
    if (model !== undefined) {
      setDeepseekModel(model);
      localStorage.setItem('deepseekModel', model);
    }
    if (musesparkKey !== undefined) {
      const finalMetaKey = (musesparkKey || '').trim();
      setMusesparkApiKey(finalMetaKey);
      if (finalMetaKey) {
        localStorage.setItem('musesparkApiKey', finalMetaKey);
      } else {
        localStorage.removeItem('musesparkApiKey');
      }
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
    const k = (key || '').trim();
    setGeminiApiKey(k);
    if (k) localStorage.setItem('geminiApiKey', k);
    else localStorage.removeItem('geminiApiKey');
  };

  const saveOpenrouterApiKey = (key) => {
    const finalKey = (key || '').trim();
    setOpenrouterApiKey(finalKey);
    if (finalKey) localStorage.setItem('openrouterApiKey', finalKey);
    else localStorage.removeItem('openrouterApiKey');
  };

  const saveOpenrouterModel = (model) => {
    const finalModel = (model && model.trim()) ? model.trim() : 'typesafe/jev-1.14';
    setOpenrouterModel(finalModel);
    localStorage.setItem('openrouterModel', finalModel);
  };

  const saveDeepseekApiKey = (key) => {
    const finalKey = (key || '').trim();
    setDeepseekApiKey(finalKey);
    if (finalKey) localStorage.setItem('deepseekApiKey', finalKey);
    else localStorage.removeItem('deepseekApiKey');
  };

  const saveMusesparkApiKey = (key) => {
    const finalKey = (key || '').trim();
    setMusesparkApiKey(finalKey);
    if (finalKey) {
      localStorage.setItem('musesparkApiKey', finalKey);
    } else {
      localStorage.removeItem('musesparkApiKey');
    }
  };

  const aiConfig = {
    provider: aiProvider || 'jev',
    geminiApiKey: (geminiApiKey || '').trim(),
    openrouterApiKey: (openrouterApiKey || '').trim(),
    openrouterModel: (openrouterModel && openrouterModel.trim()) || 'typesafe/jev-1.14',
    deepseekApiKey: (deepseekApiKey || '').trim(),
    deepseekModel: (deepseekModel && deepseekModel !== 'deepseek-chat') ? deepseekModel : 'deepseek-v4-flash-vision-exp',
    musesparkApiKey: (musesparkApiKey || '').trim(),
    musesparkModel: musesparkModel || 'muse-spark-1.3-contributor',
    agentApiUrl: agentApiUrl || 'http://127.0.0.1:8000'
  };

  const isAiConfigured = (aiProvider === 'jev' && !!(openrouterApiKey && openrouterApiKey.trim())) ||
                         (aiProvider === 'deepseek' && !!(deepseekApiKey && deepseekApiKey.trim())) ||
                         (aiProvider === 'gemini' && !!(geminiApiKey && geminiApiKey.trim())) ||
                         (aiProvider === 'musespark' && !!(musesparkApiKey && musesparkApiKey.trim()));

  // Fetch data on mount with smart merge (Prioritize latest GitHub/Local graded results, never overwrite 'correct')
  useEffect(() => {
    const fetchData = async () => {
      let currentBaseData = data;

      // 0. Fetch public/students.json (registered students managed via Arbalest / homework_agent)
      try {
        const baseUrl = import.meta.env.BASE_URL || '/';
        const cleanBase = baseUrl.endsWith('/') ? baseUrl : baseUrl + '/';
        const studentsRes = await fetch(`${cleanBase}students.json?t=${Date.now()}`);
        if (studentsRes.ok) {
          const publicStudents = await studentsRes.json();
          if (Array.isArray(publicStudents)) {
            const removedSet = new Set(loadRemovedStudents());
            setRegisteredStudents(prev => {
              const merged = Array.from(new Set([
                ...publicStudents.filter(s => typeof s === 'string' && s.trim() && !removedSet.has(s.trim())),
                ...prev
              ]));
              try {
                localStorage.setItem(REGISTERED_STUDENTS_KEY, JSON.stringify(merged));
              } catch (e) {}
              return merged;
            });
          }
        }
      } catch (e) {
        console.warn("Local students.json fetch skipped:", e);
      }

      // 1. Fetch latest public/homeworkData.json (GitHub Pages / Local build) with Smart Merge
      try {
        const baseUrl = import.meta.env.BASE_URL || '/';
        const cleanBase = baseUrl.endsWith('/') ? baseUrl : baseUrl + '/';
        const publicRes = await fetch(`${cleanBase}homeworkData.json?t=${Date.now()}`);
        if (publicRes.ok) {
          const publicData = await publicRes.json();
          if (Array.isArray(publicData)) {
            // 로컬에 이미 저장된 캐시(학생 풀이/채점 데이터)가 있는지 확인
            let localCache = null;
            try {
              const raw = localStorage.getItem('cachedHomeworkData');
              if (raw) {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed) && parsed.length > 0) localCache = parsed;
              }
            } catch (e) {}

            if (publicData.length === 0 && !localCache) {
              currentBaseData = [];
              setData([]);
              setIsLoading(false);
            } else {
              let mergedData = publicData;
              if (localCache) {
                // 로컬 캐시의 풀이 및 채점 상태를 최우선 보존(Smart Merge)하여 새로고침 시 초기화 원천 차단
                const localHwIds = new Set();
                localCache.forEach(sec => sec.homeworks?.forEach(h => localHwIds.add(String(h.id))));

                mergedData = localCache.map(sec => {
                  const pubSec = publicData.find(ps => ps.date === sec.date);
                  if (!pubSec) return sec;
                  return {
                    ...sec,
                    homeworks: sec.homeworks.map(hw => {
                      const pubHw = pubSec.homeworks?.find(ph => String(ph.id) === String(hw.id));
                      if (!pubHw) return hw;
                      const localSubmitted = hw.submittedProblems || [];
                      return {
                        ...pubHw,
                        ...hw,
                        submittedProblems: localSubmitted.length > 0 ? localSubmitted : (pubHw.submittedProblems || [])
                      };
                    })
                  };
                });

                // publicData에 신규 배포된 과제가 있다면 추가
                publicData.forEach(pubSec => {
                  const existingSec = mergedData.find(ms => ms.date === pubSec.date);
                  if (!existingSec) {
                    mergedData.push(pubSec);
                  } else {
                    pubSec.homeworks?.forEach(pubHw => {
                      if (!localHwIds.has(String(pubHw.id))) {
                        existingSec.homeworks.push(pubHw);
                        localHwIds.add(String(pubHw.id));
                      }
                    });
                  }
                });
              }

              currentBaseData = mergedData;
              setData(mergedData);
              try {
                localStorage.setItem('cachedHomeworkData', JSON.stringify(mergedData));
              } catch (e) {}
              setIsLoading(false);
            }
          }
        }
      } catch (e) {
        console.warn("Local homeworkData.json fetch skipped:", e);
      }

      // 2. Query cloud GAS in background with 12s timeout for live sync,
      //    safely merging without ever overwriting graded (correct) status!
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);

      try {
        const response = await fetch(GAS_URL, { signal: controller.signal });
        clearTimeout(timeoutId);
        if (response.ok) {
          const cloudData = await response.json();
          if (Array.isArray(cloudData) && cloudData.length > 0) {
            // Smart Merge: Preserve 'correct' statuses and AI feedback from base data
            setData(prev => {
              const base = (prev && prev.length > 0)
                ? prev
                : (currentBaseData && currentBaseData.length > 0 ? currentBaseData : cloudData);
              const merged = base.map(section => {
                const cloudSec = cloudData.find(cs => cs.date === section.date) || section;
                return {
                  ...section,
                  homeworks: section.homeworks.map(hw => {
                    const cloudHw = cloudSec.homeworks?.find(ch => String(ch.id) === String(hw.id));
                    if (!cloudHw) return hw;

                    // Merge submittedProblems safely
                    const baseSubmitted = hw.submittedProblems || [];
                    const cloudSubmitted = cloudHw.submittedProblems || [];
                    const gradedStatuses = new Set(['correct', 'incorrect', 'indeterminate']);

                    const mergedSubmitted = [...baseSubmitted];
                    cloudSubmitted.forEach(cProb => {
                      const existingIdx = mergedSubmitted.findIndex(b =>
                        (b.groupId === cProb.groupId || !b.groupId || !cProb.groupId) &&
                        Number(b.problemNumber) === Number(cProb.problemNumber)
                      );
                      if (existingIdx === -1) {
                        // New problem submitted from student
                        mergedSubmitted.push(cProb);
                      } else {
                        const existing = mergedSubmitted[existingIdx];
                        if (cProb.status === 'correct') {
                          // Cloud is correct: adopt it along with latest score & feedback
                          mergedSubmitted[existingIdx] = { ...existing, ...cProb };
                        } else if (!gradedStatuses.has(existing.status) && (
                          gradedStatuses.has(cProb.status) ||
                          isValidImageUrl(cProb.imageUrl) ||
                          (cProb.studentAnswer !== null && cProb.studentAnswer !== undefined && String(cProb.studentAnswer).trim() !== '')
                        )) {
                          mergedSubmitted[existingIdx] = { ...existing, ...cProb };
                        }
                      }
                    });

                    return {
                      ...hw,
                      answers: cloudHw.answers || hw.answers,
                      submittedProblems: mergedSubmitted
                    };
                  })
                };
              });

              try {
                localStorage.setItem('cachedHomeworkData', JSON.stringify(merged));
              } catch (e) {}
              return merged;
            });
          }
        }
      } catch (error) {
        console.warn("GAS fetch skipped or timed out, safely using local/GitHub data:", error);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchData();
  }, []);

  const saveDataToDrive = async (newData) => {
    try {
      const response = await fetch(GAS_URL, {
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
      if (!response.ok) {
        console.warn("GAS save HTTP warning:", response.status);
        return false;
      }
      return true;
    } catch (error) {
      console.error("Error saving data to cloud:", error);
      return false;
    }
  };

  const updateStateAndSave = (updaterFn, { syncCloud = true } = {}) => {
    const newData = updaterFn(dataRef.current);
    dataRef.current = newData;
    setData(newData);
    try {
      localStorage.setItem('cachedHomeworkData', JSON.stringify(newData));
    } catch (e) {}
    if (syncCloud) {
      return saveDataToDrive(newData);
    }
    return Promise.resolve(true);
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
      let shouldUploadToDrive = false;
      let mimeType = 'image/jpeg';
      let base64Data = null;
      let finalImageUrl = imageBase64 || null;
      
      if (imageBase64 && typeof imageBase64 === 'string') {
        if (imageBase64.startsWith('data:')) {
          // Extract base64 if it is base64 encoded
          const matches = imageBase64.match(/^data:([a-zA-Z0-9-+\/]+);(?:charset=[^;]+;)?base64,(.+)$/);
          if (matches && matches.length === 3) {
            mimeType = matches[1];
            base64Data = matches[2];
            shouldUploadToDrive = true;
          } else {
            // It's a data URL but not base64 (e.g. SVG utf8 from MathType)
            shouldUploadToDrive = false;
          }
        } else if (imageBase64.startsWith('http')) {
          // It's an external URL (e.g. from MathType server or already hosted)
          shouldUploadToDrive = false;
        }
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

      if (shouldUploadToDrive && base64Data) {
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
              const prev = newSubmitted[existingIndex];
              const wasIncorrect = prev.status === 'incorrect' || (prev.wrongCount > 0) || Boolean(prev.hasBeenIncorrect);
              newSubmitted[existingIndex] = { 
                ...prev, 
                imageUrl: isValidImageUrl(finalImageUrl) ? finalImageUrl : (isValidImageUrl(prev.imageUrl) ? prev.imageUrl : null), 
                status: statusToSet,
                studentAnswer: studentAnswer !== null ? studentAnswer : (prev.studentAnswer || null),
                aiFeedback: aiFeedback !== undefined ? aiFeedback : null,
                aiGrade: aiGrade !== undefined ? aiGrade : null,
                hasBeenIncorrect: wasIncorrect,
                wrongCount: prev.wrongCount || (prev.status === 'incorrect' ? 1 : 0)
              };
            } else {
              newSubmitted.push({ 
                groupId, 
                problemNumber: parseInt(problemNumber), 
                imageUrl: isValidImageUrl(finalImageUrl) ? finalImageUrl : null, 
                status: statusToSet,
                studentAnswer: studentAnswer || null,
                aiFeedback: aiFeedback || null,
                aiGrade: aiGrade || null,
                wrongCount: 0,
                hasBeenIncorrect: false
              });
            }
            
            return { ...hw, submittedProblems: newSubmitted };
          }
          return hw;
        })
      })));

    } catch (error) {
      console.error("과제 저장 오류:", error);
      alert("과제 저장 중 오류가 발생했습니다: " + (error.message || "다시 시도해주세요."));
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

  const applySingleProblemEvaluation = (submittedProblems, groupId, problemNumber, gradeResult, aiFeedback = null, dateStr = '') => {
    const targetNum = parseInt(problemNumber);
    const existingIndex = (submittedProblems || []).findIndex(
      p => (p.groupId === groupId || !groupId || !p.groupId) && parseInt(p.problemNumber) === targetNum
    );
    if (existingIndex < 0) return submittedProblems;

    const newSubmitted = [...submittedProblems];
    const currentItem = newSubmitted[existingIndex];
    const currentAttempts = currentItem.attempts || 1;
    const currentWrongCount = currentItem.wrongCount || (currentItem.status === 'incorrect' ? 1 : 0);

    let statusToSet = 'incorrect';
    if (gradeResult === true || gradeResult === 'correct') {
      statusToSet = 'correct';
    } else if (gradeResult === 'indeterminate' || gradeResult === 'unclear' || gradeResult === 'pending') {
      statusToSet = 'indeterminate';
    } else if (gradeResult === false || gradeResult === 'incorrect') {
      statusToSet = 'incorrect';
    }

    // 오답 횟수(wrongCount): 이번 채점에서 오답이면 +1 누적, 맞았으면 기존 오답 횟수 유지
    let newWrongCount = currentWrongCount;
    if (statusToSet === 'incorrect') {
      newWrongCount = currentWrongCount + 1;
    }

    const newAttempts = currentAttempts + 1;
    const existingHistory = Array.isArray(currentItem.history) ? currentItem.history : [];
    const newHistoryEntry = {
      attempt: newAttempts,
      date: dateStr,
      status: statusToSet,
      wrongCount: newWrongCount,
      imageUrl: isValidImageUrl(currentItem.imageUrl) ? currentItem.imageUrl : null,
      studentAnswer: currentItem.studentAnswer,
      aiFeedback: aiFeedback !== null ? aiFeedback : currentItem.aiFeedback
    };

    newSubmitted[existingIndex] = {
      ...currentItem,
      status: statusToSet,
      aiGrade: statusToSet === 'correct' ? '⭕ 정답' : (statusToSet === 'indeterminate' ? '🔺 확인' : '❌ 오답'),
      attempts: newAttempts,
      wrongCount: newWrongCount,
      aiFeedback: aiFeedback !== null ? aiFeedback : currentItem.aiFeedback,
      history: [...existingHistory, newHistoryEntry],
      hasBeenIncorrect: currentItem.hasBeenIncorrect || statusToSet === 'incorrect' || newWrongCount > 0
    };
    return newSubmitted;
  };

  const evaluateSingleProblem = (id, groupId, problemNumber, gradeResult, aiFeedback = null) => {
    const now = new Date();
    const dateStr = `${now.getMonth() + 1}/${now.getDate()} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    return updateStateAndSave(prevData => prevData.map(section => ({
      ...section,
      homeworks: section.homeworks.map(hw => {
        if (hw.id === parseInt(id)) {
          return {
            ...hw,
            submittedProblems: applySingleProblemEvaluation(hw.submittedProblems, groupId, problemNumber, gradeResult, aiFeedback, dateStr)
          };
        }
        return hw;
      })
    })));
  };

  const evaluateProblemsBatch = async (id, evaluations) => {
    if (!Array.isArray(evaluations) || evaluations.length === 0) return true;
    const now = new Date();
    const dateStr = `${now.getMonth() + 1}/${now.getDate()} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    return await updateStateAndSave(prevData => prevData.map(section => ({
      ...section,
      homeworks: section.homeworks.map(hw => {
        if (hw.id === parseInt(id)) {
          let updatedSubmitted = [...(hw.submittedProblems || [])];
          evaluations.forEach(ev => {
            updatedSubmitted = applySingleProblemEvaluation(
              updatedSubmitted,
              ev.groupId,
              ev.problemNumber,
              ev.gradeResult,
              ev.aiFeedback !== undefined ? ev.aiFeedback : null,
              dateStr
            );
          });
          return { ...hw, submittedProblems: updatedSubmitted };
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
            const hasText = p.studentAnswer !== null && p.studentAnswer !== undefined && String(p.studentAnswer).trim() !== '';
            if (p.status === 'exempt' || (!isValidImageUrl(p.imageUrl) && !hasText)) return p;
            
            const isWrong = wrongNumbersArray.includes(p.problemNumber);
            const currentAttempts = p.attempts || 1;
            const currentWrongCount = p.wrongCount || (p.status === 'incorrect' ? 1 : 0);
            const newWrongCount = isWrong ? currentWrongCount + 1 : currentWrongCount;
            const wasIncorrect = p.hasBeenIncorrect || isWrong || currentWrongCount > 0;
            
            return {
              ...p,
              status: isWrong ? 'incorrect' : 'correct',
              attempts: currentAttempts + 1,
              wrongCount: newWrongCount,
              hasBeenIncorrect: wasIncorrect,
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
          let baseAnswers = {};
          if (Array.isArray(hw.answers)) {
            hw.answers.forEach(item => {
              if (item && item.problemNumber !== undefined) {
                baseAnswers[item.problemNumber] = item.answer !== undefined ? item.answer : item;
              }
            });
          } else if (typeof hw.answers === 'object' && hw.answers !== null) {
            baseAnswers = { ...hw.answers };
          }
          return {
            ...hw,
            answers: { ...baseAnswers, ...answers }
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
    ensureStudentRegistered(studentName);
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
    ensureStudentRegistered(studentName);
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
      evaluateProblemsBatch,
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
      openrouterApiKey,
      saveOpenrouterApiKey,
      openrouterModel,
      saveOpenrouterModel,
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
      saveMainBannerImage,
      registeredStudents,
      addRegisteredStudent,
      removeRegisteredStudent,
      adminAccounts: ADMIN_ACCOUNTS,
      normalizeStudentName,
      viewMode,
      setViewMode,
      toggleViewMode,
      isDesktopMode
    }}>
      {children}
    </HomeworkContext.Provider>
  );
};
