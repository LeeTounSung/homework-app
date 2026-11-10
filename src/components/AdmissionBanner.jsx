import React, { useState } from 'react';

const ADMISSION_GROUPS = [
  {
    id: 'medical',
    label: '의대',
    accentColor: '#F472B6',
    headerBg: 'rgba(244, 114, 182, 0.12)',
    borderColor: 'rgba(244, 114, 182, 0.35)',
    univColor: '#FBCFE8',
    items: [
      { univ: '연세대 의예과', name: '장O호' },
      { univ: '가톨릭대 의예과', name: '이O휘' }
    ]
  },
  {
    id: 'sky',
    label: 'SKY',
    accentColor: '#FFD700',
    headerBg: 'rgba(255, 215, 0, 0.1)',
    borderColor: 'rgba(255, 215, 0, 0.32)',
    univColor: '#FFE57F',
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
    accentColor: '#64B5F6',
    headerBg: 'rgba(59, 130, 246, 0.11)',
    borderColor: 'rgba(59, 130, 246, 0.28)',
    univColor: '#BFDBFE',
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
    accentColor: '#81C784',
    headerBg: 'rgba(129, 199, 132, 0.11)',
    borderColor: 'rgba(129, 199, 132, 0.3)',
    univColor: '#C8E6C9',
    singleCol: true,
    items: [
      { univ: '일본 오사카 대학', name: '권형O' },
      { univ: '델프트공대 우주항공', name: '서O원' }
    ]
  }
];

/**
 * Collapsible university admission banner shown inside the logged-out
 * landing frame. Starts compact and expands into an aligned 2-column table.
 */
export default function AdmissionBanner() {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: isExpanded ? '12px' : '0px' }}>
      <button
        type="button"
        aria-expanded={isExpanded}
        onClick={() => setIsExpanded((prev) => !prev)}
        style={{
          width: '100%',
          background: 'none',
          border: 'none',
          padding: 0,
          margin: 0,
          textAlign: 'left',
          cursor: 'pointer',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          color: 'inherit',
          fontFamily: 'inherit'
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px',
            width: '100%'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
            <span style={{ fontSize: '16px', flexShrink: 0 }}>🏆</span>
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#FFFFFF' }}>
              주요 대학 합격 실적
            </h3>
          </div>
          <span
            style={{
              fontSize: '11.5px',
              fontWeight: 700,
              color: '#FFD700',
              backgroundColor: 'rgba(255, 215, 0, 0.12)',
              border: '1px solid rgba(255, 215, 0, 0.35)',
              padding: '4px 10px',
              borderRadius: '999px',
              whiteSpace: 'nowrap',
              flexShrink: 0
            }}
          >
            {isExpanded ? '접기 ▲' : '명단 보기 ▼'}
          </span>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
            gap: '6px',
            width: '100%'
          }}
        >
          {ADMISSION_GROUPS.map((group) => (
            <div
              key={group.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '6px',
                backgroundColor: group.headerBg,
                border: `1px solid ${group.borderColor}`,
                borderRadius: '8px',
                padding: '6px 9px',
                minWidth: 0
              }}
            >
              <span
                style={{
                  fontSize: '12px',
                  fontWeight: 700,
                  color: group.accentColor,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}
              >
                {group.id === 'seoul-metro' ? 'IN 서울 · 수도권' : group.label}
              </span>
              <span
                style={{
                  fontSize: '11.5px',
                  fontWeight: 600,
                  color: '#E2E8F0',
                  whiteSpace: 'nowrap',
                  flexShrink: 0
                }}
              >
                {group.items.length}건
              </span>
            </div>
          ))}
        </div>
      </button>

      {isExpanded && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            paddingTop: '10px',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)'
          }}
        >
          {ADMISSION_GROUPS.map((group) => {
            const isSingleCol = Boolean(group.singleCol) || group.items.length === 1;
            return (
              <div
                key={group.id}
                style={{
                  border: `1px solid ${group.borderColor}`,
                  borderRadius: '10px',
                  overflow: 'hidden',
                  backgroundColor: '#131620'
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '6px 10px',
                    backgroundColor: group.headerBg,
                    borderBottom: `1px solid ${group.borderColor}`
                  }}
                >
                  <span style={{ fontSize: '12px', fontWeight: 700, color: group.accentColor }}>
                    {group.label}
                  </span>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: '#CBD5E1' }}>
                    {group.items.length}건
                  </span>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: isSingleCol ? '1fr' : 'repeat(2, minmax(0, 1fr))'
                  }}
                >
                  {group.items.map((item, idx) => {
                    const isLeftCol = !isSingleCol && idx % 2 === 0;
                    const rowCount = isSingleCol ? group.items.length : Math.ceil(group.items.length / 2);
                    const currentRow = isSingleCol ? idx : Math.floor(idx / 2);
                    const hasBottomBorder = currentRow < rowCount - 1;
                    return (
                      <div
                        key={`${item.univ}-${item.name}-${idx}`}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '6px',
                          padding: '6px 10px',
                          backgroundColor: currentRow % 2 === 1 ? 'rgba(255, 255, 255, 0.02)' : 'transparent',
                          borderRight: isLeftCol ? '1px solid rgba(255, 255, 255, 0.06)' : 'none',
                          borderBottom: hasBottomBorder ? '1px solid rgba(255, 255, 255, 0.06)' : 'none',
                          minWidth: 0
                        }}
                      >
                        <span
                          style={{
                            fontSize: '12px',
                            fontWeight: 600,
                            color: group.univColor,
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
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
