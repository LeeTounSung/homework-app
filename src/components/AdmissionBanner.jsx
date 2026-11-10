import React from 'react';

const ADMISSION_GROUPS = [
  {
    id: 'medical',
    label: '의대',
    labelColor: '#F472B6',
    dotColor: '#F472B6',
    chipBg: 'rgba(244, 114, 182, 0.13)',
    chipBorder: 'rgba(244, 114, 182, 0.42)',
    chipColor: '#FBCFE8',
    chipWeight: 700,
    items: [
      { univ: '연세대 의예과', name: '장O호' },
      { univ: '가톨릭대 의예과', name: '이O휘' }
    ]
  },
  {
    id: 'sky',
    label: 'SKY',
    labelColor: '#FFD700',
    dotColor: '#FFD700',
    chipBg: 'rgba(255, 215, 0, 0.12)',
    chipBorder: 'rgba(255, 215, 0, 0.38)',
    chipColor: '#FFE57F',
    chipWeight: 700,
    items: [
      { univ: '서울대', name: '오O진' },
      { univ: '서울대', name: '이O준' },
      { univ: '서울대', name: '오O나' },
      { univ: '서울대', name: '김O규' },
      { univ: '서울대', name: '동O영' },
      { univ: '연세대', name: '정O영' },
      { univ: '연세대', name: '정O주' },
      { univ: '고려대', name: '정O은' },
      { univ: '고려대', name: '이O준' },
      { univ: '고려대', name: '김O도' }
    ]
  },
  {
    id: 'seoul-metro',
    label: 'IN 서울 · 수도권 주요 대학',
    labelColor: '#64B5F6',
    dotColor: '#64B5F6',
    chipBg: 'rgba(59, 130, 246, 0.12)',
    chipBorder: 'rgba(59, 130, 246, 0.3)',
    chipColor: '#BFDBFE',
    chipWeight: 600,
    items: [
      { univ: '서강대', name: '송O은' },
      { univ: '성균관대', name: '윤O민' },
      { univ: '한양대', name: '정O영' },
      { univ: '한양대', name: '김O연' },
      { univ: '경희대', name: '이O찬' },
      { univ: '경희대', name: '김O준' },
      { univ: '경희대', name: '박O현' },
      { univ: '한국외대', name: '이O호' },
      { univ: '홍익대', name: '김O연' },
      { univ: '숙명여대', name: '고O주' },
      { univ: '숙명여대', name: '김O현' },
      { univ: '국민대', name: '김O진' },
      { univ: '숭실대', name: '국O헌' },
      { univ: '세종대', name: '김O현' },
      { univ: '광운대', name: '김O윤' },
      { univ: '아주대', name: '김O현' },
      { univ: '단국대', name: '황O연' },
      { univ: '경기대', name: '김O현' },
      { univ: '가천대', name: '김O연' },
      { univ: '가천대', name: '김O화' },
      { univ: '가천대', name: '이O진' },
      { univ: '가천대', name: '김O은' }
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
    items: [{ univ: '일본 오사카 대학', name: '권형O' }]
  }
];

/**
 * Renders an aligned dark-mode university admission card inside the logged-out
 * landing banner box showing each university alongside the student's masked name.
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
          누적 합격 현황
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

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: group.items.length === 1 ? '1fr' : 'repeat(2, minmax(0, 1fr))',
              gap: '6px'
            }}
          >
            {group.items.map((item, idx) => (
              <div
                key={`${item.univ}-${item.name}-${idx}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '6px',
                  backgroundColor: group.chipBg,
                  border: `1px solid ${group.chipBorder}`,
                  borderRadius: '8px',
                  padding: '5px 9px',
                  minWidth: 0
                }}
              >
                <span
                  style={{
                    fontSize: '12px',
                    fontWeight: group.chipWeight,
                    color: group.chipColor,
                    whiteSpace: 'nowrap'
                  }}
                >
                  {item.univ}
                </span>
                <span
                  style={{
                    fontSize: '11.5px',
                    fontWeight: 500,
                    color: '#CBD5E1',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {item.name}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
