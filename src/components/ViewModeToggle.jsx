import React from 'react';
import { useHomework } from '../context/HomeworkContext';

export default function ViewModeToggle({ fullWidth = false, compact = false }) {
  const { isDesktopMode, toggleViewMode } = useHomework();

  return (
    <button
      type="button"
      onClick={toggleViewMode}
      title={isDesktopMode ? '스마트폰(모바일) 화면으로 전환' : '태블릿·PC용 데스크톱 대시보드 화면으로 전환'}
      style={{
        width: fullWidth ? '100%' : 'auto',
        flexShrink: 0,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: compact ? '4px' : '6px',
        padding: fullWidth ? '10px 14px' : compact ? '6px 8px' : '7px 12px',
        borderRadius: fullWidth ? '10px' : '16px',
        border: isDesktopMode ? '1px solid #3B82F6' : '1px solid #3E445B',
        background: isDesktopMode
          ? 'linear-gradient(135deg, #1E3A8A 0%, #1D4ED8 100%)'
          : '#1E2230',
        color: isDesktopMode ? '#FFFFFF' : '#CBD5E1',
        fontSize: compact ? '11.5px' : '12.5px',
        fontWeight: '700',
        whiteSpace: 'nowrap',
        cursor: 'pointer',
        boxShadow: isDesktopMode ? '0 2px 10px rgba(37, 99, 235, 0.35)' : 'none',
        transition: 'all 0.2s ease'
      }}
    >
      <span style={{ fontSize: compact ? '13px' : '14px', lineHeight: 1 }}>
        {isDesktopMode ? '📱' : '💻'}
      </span>
      <span>
        {fullWidth
          ? (isDesktopMode ? '모바일 버전으로 전환' : '데스크톱 버전으로 전환')
          : compact
            ? (isDesktopMode ? '모바일' : 'PC버전')
            : (isDesktopMode ? '모바일 뷰' : '데스크톱 뷰')}
      </span>
    </button>
  );
}
