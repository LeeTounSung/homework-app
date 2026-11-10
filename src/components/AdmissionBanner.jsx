import React from 'react';

const ADMISSION_GROUPS = [
  {
    id: 'medical-sky',
    label: '의대 · SKY',
    labelColor: '#FFD700',
    dotColor: '#FFD700',
    chipBg: 'rgba(255, 215, 0, 0.12)',
    chipBorder: 'rgba(255, 215, 0, 0.4)',
    chipColor: '#FFE57F',
    chipWeight: 700,
    universities: [
      '연세대 의예과',
      '가톨릭대 의예과',
      '서울대',
      '연세대',
      '고려대'
    ]
  },
  {
    id: 'seoul-metro',
    label: 'IN 서울 · 수도권 주요 대학',
    labelColor: '#64B5F6',
    dotColor: '#64B5F6',
    chipBg: 'rgba(59, 130, 246, 0.12)',
    chipBorder: 'rgba(59, 130, 246, 0.32)',
    chipColor: '#BFDBFE',
    chipWeight: 600,
    universities: [
      '서강대',
      '성균관대',
      '한양대',
      '경희대',
      '한국외대',
      '홍익대',
      '숙명여대',
      '국민대',
      '숭실대',
      '세종대',
      '광운대',
      '아주대',
      '단국대',
      '경기대',
      '가천대'
    ]
  },
  {
    id: 'overseas',
    label: '해외 대학',
    labelColor: '#81C784',
    dotColor: '#81C784',
    chipBg: 'rgba(129, 199, 132, 0.12)',
    chipBorder: 'rgba(129, 199, 132, 0.34)',
    chipColor: '#C8E6C9',
    chipWeight: 600,
    universities: ['일본 오사카 대학']
  }
];

/**
 * Renders a compact dark-mode university admission showcase inside the
 * logged-out landing banner box when no custom image banner is configured.
 */
export default function AdmissionBanner() {
  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
          paddingBottom: '8px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '16px' }}>🏆</span>
          <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#FFFFFF' }}>
            주요 대학 합격 실적
          </h3>
        </div>
        <span
          style={{
            fontSize: '11px',
            fontWeight: 600,
            color: '#FFD700',
            backgroundColor: 'rgba(255, 215, 0, 0.1)',
            border: '1px solid rgba(255, 215, 0, 0.28)',
            padding: '2px 8px',
            borderRadius: '999px',
            whiteSpace: 'nowrap'
          }}
        >
          누적 합격 대학
        </span>
      </div>

      {ADMISSION_GROUPS.map((group) => (
        <div key={group.id} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                backgroundColor: group.dotColor,
                flexShrink: 0
              }}
            />
            <span style={{ fontSize: '12px', fontWeight: 700, color: group.labelColor }}>
              {group.label}
            </span>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {group.universities.map((univ) => (
              <span
                key={univ}
                style={{
                  fontSize: '12px',
                  fontWeight: group.chipWeight,
                  color: group.chipColor,
                  backgroundColor: group.chipBg,
                  border: `1px solid ${group.chipBorder}`,
                  borderRadius: '8px',
                  padding: '4px 9px',
                  lineHeight: 1.35,
                  whiteSpace: 'nowrap'
                }}
              >
                {univ}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
