import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useHomework } from '../context/HomeworkContext';

export default function TeacherDashboard() {
  const navigate = useNavigate();
  const { getSubmittedHomeworks } = useHomework();
  
  const submitted = getSubmittedHomeworks();

  return (
    <div className="app-container">
      {/* Header */}
      <header className="header" style={{ backgroundColor: '#1A1B23' }}>
        <button className="back-btn" onClick={() => navigate('/')}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <h1 className="header-title" style={{ color: '#FFD700' }}>[관리자] 평가 대기열</h1>
        <div style={{width: '24px'}}></div>
      </header>

      {/* Main Content */}
      <main className="content-list">
        {submitted.length === 0 ? (
          <div style={{ textAlign: 'center', marginTop: '40px', color: '#888' }}>
            현재 평가 대기중인 숙제가 없습니다.
          </div>
        ) : (
          <div style={{ marginTop: '24px' }}>
            {submitted.map(hw => (
              <div 
                key={hw.id} 
                className="homework-card" 
                onClick={() => navigate(`/teacher/evaluate/${hw.id}`)}
                style={{ borderLeft: '4px solid #FFD700' }}
              >
                <div className="card-header">
                  <div className="sender-receiver">
                    <div className="profile-container">
                      <img 
                        src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${hw.studentName}`} 
                        alt="Profile" 
                        className="profile-pic"
                      />
                    </div>
                    <div className="names">
                      <span>{hw.studentName}</span>
                      <span className="arrow">제출 완료</span>
                    </div>
                  </div>
                </div>
                
                <div className="card-content">
                  <h3 className="hw-title">{hw.title}</h3>
                  <p className="hw-desc">{hw.description}</p>
                </div>
                
                <div className="card-footer">
                  <span className="tag">평가 대기 중</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
