import React from 'react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  handleReset = () => {
    try {
      localStorage.removeItem('cachedHomeworkData');
    } catch (e) {}
    window.location.reload();
  };

  handleFullClear = () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch (e) {}
    const baseUrl = import.meta.env.BASE_URL || '/';
    window.location.href = baseUrl;
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          backgroundColor: '#121214',
          color: '#fff',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          textAlign: 'center',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
          <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: '#FFD700', marginBottom: '8px' }}>
            화면을 불러오는 중 오류가 발생했습니다
          </h2>
          <p style={{ fontSize: '13px', color: '#aaa', maxWidth: '420px', marginBottom: '20px', lineHeight: '1.6' }}>
            일시적인 캐시 또는 네트워크 문제입니다.<br />
            아래 [새로고침] 버튼을 눌러 다시 시도해주세요.
          </p>
          {this.state.error && (
            <div style={{
              backgroundColor: '#1E1E24',
              border: '1px solid #444',
              borderRadius: '8px',
              padding: '10px 14px',
              maxWidth: '90%',
              fontSize: '11px',
              color: '#EF5350',
              fontFamily: 'monospace',
              marginBottom: '20px',
              wordBreak: 'break-all'
            }}>
              {String(this.state.error.message || this.state.error)}
            </div>
          )}
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
            <button
              onClick={this.handleReset}
              style={{
                padding: '10px 22px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: '#FFD700',
                color: '#000',
                fontWeight: 'bold',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              🔄 새로고침
            </button>
            <button
              onClick={this.handleFullClear}
              style={{
                padding: '10px 22px',
                borderRadius: '8px',
                border: '1px solid #555',
                backgroundColor: '#262834',
                color: '#ccc',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              🗑️ 캐시 초기화 후 이동
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
