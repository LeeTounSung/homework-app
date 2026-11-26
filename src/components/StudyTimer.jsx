import React, { useState, useEffect, useMemo } from 'react';

const SUBJECTS = ['공통수학1', '공통수학2', '대수(수1)', '미적분1(수2)', '미적분2', '확통', '기하', '숙제·오답'];
const GOAL_MIN_SEC = 90 * 60;  // 1시간 30분 (1등급 최소 기준)
const GOAL_MAX_SEC = 120 * 60; // 2시간 (1등급 완성 기준)

const getTodayKey = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const getPast7Days = () => {
  const days = [];
  const weekday = ['일', '월', '화', '수', '목', '금', '토'];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    days.push({
      key: `${y}-${m}-${day}`,
      label: i === 0 ? '오늘' : `${d.getMonth() + 1}/${d.getDate()}(${weekday[d.getDay()]})`
    });
  }
  return days;
};

const formatHMS = (totalSec) => {
  const s = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
};

const formatKoreanDuration = (totalSec) => {
  const s = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0 && m > 0) return `${h}시간 ${m}분`;
  if (h > 0) return `${h}시간`;
  return `${m}분`;
};

export default function StudyTimer({ studentName }) {
  const userKey = (studentName || 'guest').trim();
  const logsStorageKey = `homework_app_study_logs_v1_${userKey}`;
  const activeStorageKey = `homework_app_study_active_v1_${userKey}`;

  const [subject, setSubject] = useState('대수(수1)');
  const [logs, setLogs] = useState(() => {
    try {
      const raw = localStorage.getItem(logsStorageKey);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  // Active timer state persisted across reloads
  const [isRunning, setIsRunning] = useState(false);
  const [startedAt, setStartedAt] = useState(null);
  const [accumulatedSec, setAccumulatedSec] = useState(0);
  const [tickNow, setTickNow] = useState(Date.now());

  // Reload logs & active timer when user changes
  useEffect(() => {
    try {
      const rawLogs = localStorage.getItem(logsStorageKey);
      setLogs(rawLogs ? JSON.parse(rawLogs) : []);
    } catch {
      setLogs([]);
    }
    try {
      const rawActive = localStorage.getItem(activeStorageKey);
      if (rawActive) {
        const parsed = JSON.parse(rawActive);
        setSubject(parsed.subject || '대수(수1)');
        setAccumulatedSec(Number(parsed.accumulatedSec) || 0);
        setIsRunning(Boolean(parsed.isRunning));
        setStartedAt(parsed.startedAt || null);
      } else {
        setAccumulatedSec(0);
        setIsRunning(false);
        setStartedAt(null);
      }
    } catch {
      setAccumulatedSec(0);
      setIsRunning(false);
      setStartedAt(null);
    }
  }, [logsStorageKey, activeStorageKey]);

  // Persist active timer state
  useEffect(() => {
    try {
      localStorage.setItem(activeStorageKey, JSON.stringify({
        subject,
        accumulatedSec,
        isRunning,
        startedAt
      }));
    } catch {}
  }, [activeStorageKey, subject, accumulatedSec, isRunning, startedAt]);

  // 1-second tick when running
  useEffect(() => {
    if (!isRunning) return;
    const id = setInterval(() => setTickNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [isRunning]);

  const currentElapsedSec = isRunning && startedAt
    ? accumulatedSec + Math.max(0, Math.floor((tickNow - startedAt) / 1000))
    : accumulatedSec;

  const handleStart = () => {
    if (isRunning) return;
    setStartedAt(Date.now());
    setTickNow(Date.now());
    setIsRunning(true);
  };

  const handlePause = () => {
    if (!isRunning) return;
    const extra = startedAt ? Math.max(0, Math.floor((Date.now() - startedAt) / 1000)) : 0;
    setAccumulatedSec(prev => prev + extra);
    setStartedAt(null);
    setIsRunning(false);
  };

  const handleReset = () => {
    if (currentElapsedSec > 0 && !window.confirm('현재 측정 중인 시간을 초기화할까요?')) return;
    setIsRunning(false);
    setStartedAt(null);
    setAccumulatedSec(0);
  };

  const handleSaveSession = () => {
    const total = currentElapsedSec;
    if (total < 10) {
      alert('최소 10초 이상 공부한 뒤 기록을 저장할 수 있습니다.');
      return;
    }
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const newEntry = {
      id: Date.now(),
      date: getTodayKey(),
      subject,
      seconds: total,
      savedAt: timeStr
    };
    const nextLogs = [newEntry, ...logs];
    setLogs(nextLogs);
    try {
      localStorage.setItem(logsStorageKey, JSON.stringify(nextLogs));
    } catch {}
    setIsRunning(false);
    setStartedAt(null);
    setAccumulatedSec(0);
  };

  const handleDeleteLog = (id) => {
    if (!window.confirm('이 공부 기록을 삭제할까요?')) return;
    const nextLogs = logs.filter(l => l.id !== id);
    setLogs(nextLogs);
    try {
      localStorage.setItem(logsStorageKey, JSON.stringify(nextLogs));
    } catch {}
  };

  const todayKey = getTodayKey();
  const todayLogs = useMemo(() => logs.filter(l => l.date === todayKey), [logs, todayKey]);
  const todaySavedSec = useMemo(() => todayLogs.reduce((sum, l) => sum + (l.seconds || 0), 0), [todayLogs]);
  const todayTotalSec = todaySavedSec + currentElapsedSec;

  const progressPct = Math.min(100, Math.round((todayTotalSec / GOAL_MAX_SEC) * 100));
  const minMarkerPct = Math.round((GOAL_MIN_SEC / GOAL_MAX_SEC) * 100); // 75%

  const past7Days = useMemo(() => {
    const days = getPast7Days();
    return days.map(d => {
      const sec = logs
        .filter(l => l.date === d.key)
        .reduce((sum, l) => sum + (l.seconds || 0), 0) + (d.key === todayKey ? currentElapsedSec : 0);
      return { ...d, seconds: sec };
    });
  }, [logs, todayKey, currentElapsedSec]);

  const weeklyAvgSec = useMemo(() => {
    const activeDays = past7Days.filter(d => d.seconds > 0);
    if (activeDays.length === 0) return 0;
    const total = activeDays.reduce((s, d) => s + d.seconds, 0);
    return Math.round(total / activeDays.length);
  }, [past7Days]);

  const allTimeStats = useMemo(() => {
    const byDate = {};
    logs.forEach(l => {
      if (!l.date) return;
      byDate[l.date] = (byDate[l.date] || 0) + (l.seconds || 0);
    });
    if (currentElapsedSec > 0) {
      byDate[todayKey] = (byDate[todayKey] || 0) + currentElapsedSec;
    }
    const dayTotals = Object.values(byDate).filter(sec => sec > 0);
    const totalDays = dayTotals.length;
    const totalSec = dayTotals.reduce((s, v) => s + v, 0);
    const avgSec = totalDays > 0 ? Math.round(totalSec / totalDays) : 0;
    return { totalDays, totalSec, avgSec };
  }, [logs, todayKey, currentElapsedSec]);

  const streakDays = useMemo(() => {
    let streak = 0;
    for (let i = past7Days.length - 1; i >= 0; i--) {
      if (past7Days[i].seconds >= GOAL_MIN_SEC) {
        streak++;
      } else if (i < past7Days.length - 1) {
        break;
      }
    }
    return streak;
  }, [past7Days]);

  const statusBadge = todayTotalSec >= GOAL_MAX_SEC
    ? { text: '🏆 오늘 1등급 2시간 완벽 달성!', bg: 'rgba(16,185,129,0.2)', color: '#34D399', border: 'rgba(16,185,129,0.45)' }
    : todayTotalSec >= GOAL_MIN_SEC
      ? { text: '✨ 1등급 최소 기준(1시간 30분) 달성!', bg: 'rgba(255,215,0,0.16)', color: '#FFD700', border: 'rgba(255,215,0,0.45)' }
      : { text: `🔥 1등급 기준까지 ${formatKoreanDuration(GOAL_MIN_SEC - todayTotalSec)} 남음`, bg: 'rgba(59,130,246,0.16)', color: '#93C5FD', border: 'rgba(59,130,246,0.4)' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '860px', margin: '0 auto' }}>
      {/* 1등급 습관 각인 배너 */}
      <div style={{
        padding: '16px 18px',
        borderRadius: '14px',
        background: 'linear-gradient(135deg, rgba(30,58,138,0.45) 0%, rgba(17,24,39,0.95) 100%)',
        border: '1px solid rgba(96,165,250,0.35)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
          <div style={{ fontSize: '15.5px', fontWeight: '800', color: '#FFD700', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>🏆</span>
            <span>1등급의 절대 조건: 매일 수학 1시간 30분 ~ 2시간</span>
          </div>
          <span style={{
            fontSize: '12px', fontWeight: '700', padding: '4px 10px', borderRadius: '999px',
            backgroundColor: statusBadge.bg, color: statusBadge.color, border: `1px solid ${statusBadge.border}`
          }}>
            {statusBadge.text}
          </span>
        </div>
        <p style={{ margin: 0, fontSize: '12.5px', color: '#CBD5E1', lineHeight: 1.5 }}>
          매일 끊기지 않는 수학 공부량이 1등급을 만듭니다. 하루 평균 <strong style={{ color: '#FFFFFF' }}>1시간 30분~2시간</strong> 루틴을 습관으로 각인하세요!
        </p>

        {/* 오늘 진행률 바 */}
        <div style={{ marginTop: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#94A3B8', marginBottom: '6px' }}>
            <span>오늘 누적: <strong style={{ color: '#FFFFFF', fontSize: '13.5px' }}>{formatKoreanDuration(todayTotalSec)}</strong></span>
            <span>목표: <strong style={{ color: '#FFD700' }}>1시간 30분</strong> ~ <strong style={{ color: '#34D399' }}>2시간</strong> ({progressPct}%)</span>
          </div>
          <div style={{ position: 'relative', height: '12px', backgroundColor: '#1E293B', borderRadius: '999px', overflow: 'hidden', border: '1px solid #334155' }}>
            <div style={{
              width: `${progressPct}%`,
              height: '100%',
              background: todayTotalSec >= GOAL_MAX_SEC
                ? 'linear-gradient(90deg, #10B981, #34D399)'
                : todayTotalSec >= GOAL_MIN_SEC
                  ? 'linear-gradient(90deg, #F59E0B, #FFD700)'
                  : 'linear-gradient(90deg, #2563EB, #60A5FA)',
              transition: 'width 0.35s ease'
            }} />
            {/* 90분(75%) 1등급 최소 기준선 */}
            <div title="1등급 최소 기준 (1시간 30분)" style={{
              position: 'absolute', left: `${minMarkerPct}%`, top: 0, bottom: 0,
              width: '2px', backgroundColor: '#FFD700'
            }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10.5px', color: '#64748B', marginTop: '4px' }}>
            <span>0분</span>
            <span style={{ color: '#FFD700', marginLeft: '45%' }}>▲ 1h 30m (1등급 기준)</span>
            <span style={{ color: '#34D399' }}>2h (완벽)</span>
          </div>
        </div>
      </div>

      {/* 메인 스톱워치 카드 */}
      <div style={{
        padding: '20px',
        borderRadius: '14px',
        backgroundColor: '#141927',
        border: isRunning ? '1.5px solid #3B82F6' : '1px solid #263047',
        textAlign: 'center',
        boxShadow: isRunning ? '0 0 24px rgba(37,99,235,0.22)' : 'none'
      }}>
        {/* 과목 선택 */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', flexWrap: 'wrap', marginBottom: '18px' }}>
          {SUBJECTS.map(subj => (
            <button
              key={subj}
              type="button"
              onClick={() => setSubject(subj)}
              style={{
                padding: '5px 11px',
                borderRadius: '999px',
                border: subject === subj ? '1px solid #60A5FA' : '1px solid #2D3854',
                backgroundColor: subject === subj ? 'rgba(37,99,235,0.25)' : '#1B2234',
                color: subject === subj ? '#FFFFFF' : '#94A3B8',
                fontSize: '12px',
                fontWeight: subject === subj ? '700' : '500',
                cursor: 'pointer'
              }}
            >
              {subj}
            </button>
          ))}
        </div>

        {/* 디지털 시간 표시 */}
        <div style={{
          fontSize: '46px',
          fontWeight: '800',
          fontVariantNumeric: 'tabular-nums',
          letterSpacing: '2px',
          color: isRunning ? '#60A5FA' : '#F8FAFC',
          marginBottom: '6px',
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace'
        }}>
          {formatHMS(currentElapsedSec)}
        </div>
        <div style={{ fontSize: '12.5px', color: '#94A3B8', marginBottom: '20px' }}>
          선택 과목: <strong style={{ color: '#E2E8F0' }}>{subject}</strong> {isRunning ? '· 집중 측정 중...' : '· 대기 중'}
        </div>

        {/* 컨트롤 버튼 */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {!isRunning ? (
            <button
              type="button"
              onClick={handleStart}
              style={{
                padding: '11px 24px', borderRadius: '10px', border: 'none',
                background: 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)',
                color: '#FFFFFF', fontWeight: '800', fontSize: '14px', cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(37,99,235,0.35)'
              }}
            >
              ▶ 공부 시작
            </button>
          ) : (
            <button
              type="button"
              onClick={handlePause}
              style={{
                padding: '11px 24px', borderRadius: '10px', border: '1px solid #F59E0B',
                backgroundColor: 'rgba(245,158,11,0.18)',
                color: '#FCD34D', fontWeight: '800', fontSize: '14px', cursor: 'pointer'
              }}
            >
              ⏸ 일시정지
            </button>
          )}
          <button
            type="button"
            onClick={handleSaveSession}
            disabled={currentElapsedSec < 10}
            style={{
              padding: '11px 20px', borderRadius: '10px', border: 'none',
              backgroundColor: currentElapsedSec >= 10 ? '#10B981' : '#1E293B',
              color: currentElapsedSec >= 10 ? '#FFFFFF' : '#64748B',
              fontWeight: '800', fontSize: '14px',
              cursor: currentElapsedSec >= 10 ? 'pointer' : 'not-allowed'
            }}
          >
            💾 기록 저장
          </button>
          <button
            type="button"
            onClick={handleReset}
            style={{
              padding: '11px 16px', borderRadius: '10px', border: '1px solid #334155',
              backgroundColor: '#1B2234', color: '#CBD5E1', fontWeight: '700', fontSize: '13.5px', cursor: 'pointer'
            }}
          >
            ↺ 초기화
          </button>
        </div>
      </div>

      {/* 요약 통계 4카드 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px' }}>
        <div style={{ padding: '12px', borderRadius: '12px', backgroundColor: '#141927', border: '1px solid #263047', textAlign: 'center' }}>
          <div style={{ fontSize: '11.5px', color: '#94A3B8', marginBottom: '4px' }}>오늘 공부량</div>
          <div style={{ fontSize: '16px', fontWeight: '800', color: '#60A5FA' }}>{formatKoreanDuration(todayTotalSec)}</div>
        </div>
        <div style={{ padding: '12px', borderRadius: '12px', backgroundColor: '#141927', border: '1px solid rgba(255,215,0,0.3)', textAlign: 'center' }}>
          <div style={{ fontSize: '11.5px', color: '#94A3B8', marginBottom: '4px' }}>
            전체 누적 일평균 {allTimeStats.totalDays > 0 ? `(${allTimeStats.totalDays}일)` : ''}
          </div>
          <div style={{ fontSize: '16px', fontWeight: '800', color: allTimeStats.avgSec >= GOAL_MIN_SEC ? '#34D399' : '#FFD700' }}>
            {formatKoreanDuration(allTimeStats.avgSec)}
          </div>
        </div>
        <div style={{ padding: '12px', borderRadius: '12px', backgroundColor: '#141927', border: '1px solid #263047', textAlign: 'center' }}>
          <div style={{ fontSize: '11.5px', color: '#94A3B8', marginBottom: '4px' }}>최근 7일 일평균</div>
          <div style={{ fontSize: '16px', fontWeight: '800', color: weeklyAvgSec >= GOAL_MIN_SEC ? '#34D399' : '#CBD5E1' }}>
            {formatKoreanDuration(weeklyAvgSec)}
          </div>
        </div>
        <div style={{ padding: '12px', borderRadius: '12px', backgroundColor: '#141927', border: '1px solid #263047', textAlign: 'center' }}>
          <div style={{ fontSize: '11.5px', color: '#94A3B8', marginBottom: '4px' }}>1등급 루틴 연속</div>
          <div style={{ fontSize: '16px', fontWeight: '800', color: '#F59E0B' }}>🔥 {streakDays}일</div>
        </div>
      </div>

      {/* 최근 7일 공부량 막대 그래프 */}
      <div style={{ padding: '16px', borderRadius: '14px', backgroundColor: '#141927', border: '1px solid #263047' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h3 style={{ margin: 0, fontSize: '14px', fontWeight: '700', color: '#F8FAFC' }}>📊 최근 7일 수학 공부량</h3>
          <span style={{ fontSize: '11px', color: '#FFD700' }}>노란선 = 1시간 30분 (1등급 기준)</span>
        </div>
        <div style={{ position: 'relative', height: '130px', display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '8px', alignItems: 'end', paddingTop: '14px' }}>
          {/* 90분 기준선 (max 150분 기준 60% 높이) */}
          <div style={{
            position: 'absolute', left: 0, right: 0, bottom: '76px',
            borderTop: '1px dashed rgba(255,215,0,0.55)', pointerEvents: 'none'
          }} />
          {past7Days.map(d => {
            const maxBarSec = 150 * 60;
            const hPct = Math.min(100, Math.round((d.seconds / maxBarSec) * 100));
            const reached = d.seconds >= GOAL_MIN_SEC;
            return (
              <div key={d.key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end', gap: '4px' }}>
                <span style={{ fontSize: '10px', color: reached ? '#FFD700' : '#94A3B8', fontWeight: reached ? '700' : '500' }}>
                  {d.seconds > 0 ? `${Math.round(d.seconds / 60)}분` : '-'}
                </span>
                <div style={{
                  width: '100%', maxWidth: '34px',
                  height: `${Math.max(d.seconds > 0 ? 6 : 2, hPct)}%`,
                  maxHeight: '86px',
                  borderRadius: '6px 6px 2px 2px',
                  background: d.seconds >= GOAL_MAX_SEC
                    ? '#10B981'
                    : reached
                      ? '#F59E0B'
                      : d.seconds > 0 ? '#3B82F6' : '#1E293B'
                }} />
                <span style={{ fontSize: '10px', color: d.key === todayKey ? '#FFFFFF' : '#64748B', fontWeight: d.key === todayKey ? '700' : '500' }}>
                  {d.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 오늘 저장된 공부 기록 */}
      <div style={{ padding: '16px', borderRadius: '14px', backgroundColor: '#141927', border: '1px solid #263047' }}>
        <h3 style={{ margin: '0 0 10px 0', fontSize: '14px', fontWeight: '700', color: '#F8FAFC' }}>
          📝 오늘의 공부 기록 ({todayLogs.length}건)
        </h3>
        {todayLogs.length === 0 ? (
          <div style={{ fontSize: '12.5px', color: '#64748B', textAlign: 'center', padding: '16px 0' }}>
            아직 저장된 오늘의 기록이 없습니다. 타이머로 공부한 뒤 <strong>💾 기록 저장</strong>을 눌러 누적해 보세요!
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {todayLogs.map(log => (
              <div key={log.id} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '8px 12px', borderRadius: '8px', backgroundColor: '#1B2234', border: '1px solid #28334E'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '11px', fontWeight: '700', padding: '2px 8px', borderRadius: '999px', backgroundColor: '#1E3A5F', color: '#60A5FA' }}>
                    {log.subject}
                  </span>
                  <span style={{ fontSize: '13px', fontWeight: '700', color: '#F8FAFC' }}>
                    {formatHMS(log.seconds)}
                  </span>
                  <span style={{ fontSize: '11px', color: '#64748B' }}>({log.savedAt} 저장)</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleDeleteLog(log.id)}
                  style={{ background: 'none', border: 'none', color: '#64748B', fontSize: '12px', cursor: 'pointer' }}
                  title="기록 삭제"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
