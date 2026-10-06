import React, { useState, useEffect, useRef, useCallback } from 'react';
import './MathInkComponent.css';
import { useHomework } from '../context/HomeworkContext';

const PEN_DEFAULT = 4;
const MAX_STROKES = 500;

export default function MathInkComponent({ onInsert, onCancel, geminiApiKey, aiConfig }) {
  const { myscriptAppKey, myscriptHmacKey, saveMyscriptSettings } = useHomework();

  // Mode: 'myscript' (Interactive Ink) vs 'canvas' (Classic free drawing)
  const [inputMode, setInputMode] = useState(() => {
    return (myscriptAppKey && myscriptHmacKey) ? 'myscript' : 'canvas';
  });

  const canvasRef = useRef(null);
  const myscriptElRef = useRef(null);
  const myscriptCanvasRef = useRef(null);

  const [isExpanded, setIsExpanded] = useState(false);
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [msg, setMsg] = useState({ text: '', isErr: false });
  const [eraser, setEraser] = useState(false);
  const [penSize, setPenSize] = useState(PEN_DEFAULT);
  const [eraserSize, setEraserSize] = useState(20);
  const [penColor, setPenColor] = useState('#000000');

  // MyScript interactive states
  const [liveLatex, setLiveLatex] = useState('');
  const [isConverting, setIsConverting] = useState(false);
  const [myscriptStatus, setMyscriptStatus] = useState('idle'); // 'idle' | 'loading' | 'ready' | 'error'
  const [tempAppKey, setTempAppKey] = useState(myscriptAppKey || '');
  const [tempHmacKey, setTempHmacKey] = useState(myscriptHmacKey || '');

  // Classic drawing state refs
  const strokesRef = useRef([]);
  const baseImageRef = useRef(null);
  const isDrawingRef = useRef(false);
  const currentStrokeRef = useRef(null);

  const showMsg = (text, isErr = false) => setMsg({ text, isErr });

  // -------------------------------------------------------------
  // 1. MyScript Interactive Ink Lifecycle & Handlers
  // -------------------------------------------------------------
  useEffect(() => {
    if (inputMode !== 'myscript' || !myscriptAppKey || !myscriptHmacKey || !myscriptElRef.current) {
      return;
    }

    let isDestroyed = false;
    let canvasInstance = null;

    const initMyScript = async () => {
      try {
        setMyscriptStatus('loading');
        const { Canvas } = await import('iink-ts/dist/iink.esm.js');
        if (isDestroyed || !myscriptElRef.current) return;

        // Clear container first
        myscriptElRef.current.innerHTML = '';

        const options = {
          configuration: {
            server: {
              scheme: 'https',
              host: 'cloud.myscript.com',
              applicationKey: myscriptAppKey,
              hmacKey: myscriptHmacKey,
            },
            recognition: {
              type: 'MATH'
            },
            math: {
              mimeTypes: ['application/x-latex', 'application/mathml+xml']
            }
          }
        };

        canvasInstance = await Canvas.load(myscriptElRef.current, 'INTERACTIVE_INK', options);
        if (isDestroyed) {
          canvasInstance?.destroy?.();
          return;
        }

        myscriptCanvasRef.current = canvasInstance;
        setMyscriptStatus('ready');
        showMsg('⚡ MyScript 실시간 수식 필기 준비 완료');

        const handleExported = (e) => {
          const exports = e.detail?.exports || e.detail;
          if (exports && exports['application/x-latex']) {
            setLiveLatex(exports['application/x-latex']);
          }
        };

        myscriptElRef.current.addEventListener('exported', handleExported);
      } catch (err) {
        console.error('MyScript init error:', err);
        setMyscriptStatus('error');
        showMsg(`MyScript 초기화 실패: ${err.message}`, true);
      }
    };

    initMyScript();

    return () => {
      isDestroyed = true;
      if (myscriptCanvasRef.current) {
        try {
          myscriptCanvasRef.current.destroy?.();
        } catch (e) {
          console.warn('Canvas destroy error:', e);
        }
        myscriptCanvasRef.current = null;
      }
      setMyscriptStatus('idle');
    };
  }, [inputMode, myscriptAppKey, myscriptHmacKey]);

  const handleMyScriptConvert = async () => {
    if (!myscriptCanvasRef.current) return;
    setIsConverting(true);
    try {
      await myscriptCanvasRef.current.convert();
      const res = await myscriptCanvasRef.current.export(['application/x-latex']);
      if (res && res['application/x-latex']) {
        setLiveLatex(res['application/x-latex']);
      }
      showMsg('✨ 수식이 활자체 LaTeX로 변환되었습니다.');
    } catch (err) {
      console.warn('Convert error:', err);
      showMsg('수식 변환 중 오류가 발생했습니다.', true);
    } finally {
      setIsConverting(false);
    }
  };

  const handleMyScriptClear = async () => {
    if (!myscriptCanvasRef.current) return;
    try {
      await myscriptCanvasRef.current.clear();
      setLiveLatex('');
      showMsg('캔버스가 초기화되었습니다.');
    } catch (err) {
      console.warn('Clear error:', err);
    }
  };

  const handleMyScriptUndo = () => {
    try {
      myscriptCanvasRef.current?.history?.undo?.();
    } catch (e) {
      console.warn('Undo error:', e);
    }
  };

  const handleMyScriptRedo = () => {
    try {
      myscriptCanvasRef.current?.history?.redo?.();
    } catch (e) {
      console.warn('Redo error:', e);
    }
  };

  const handleSaveQuickKeys = () => {
    if (!tempAppKey.trim() || !tempHmacKey.trim()) {
      showMsg('Application Key와 HMAC Key를 모두 입력해주세요.', true);
      return;
    }
    saveMyscriptSettings(tempAppKey, tempHmacKey);
    showMsg('MyScript 키가 저장되었습니다. 엔진을 로드합니다.');
  };

  const handleApplyMyScriptAnswer = async () => {
    let currentLatex = liveLatex;
    if (!currentLatex && myscriptCanvasRef.current) {
      try {
        const exported = await myscriptCanvasRef.current.export(['application/x-latex']);
        if (exported && exported['application/x-latex']) {
          currentLatex = exported['application/x-latex'];
          setLiveLatex(currentLatex);
        }
      } catch (e) {
        console.warn('Export error:', e);
      }
    }

    if (!currentLatex) {
      showMsg('인식된 수식이 없습니다. 화면에 수식을 작성해주세요.', true);
      return;
    }

    try {
      const png = await latexToPng(currentLatex);
      onInsert(png, currentLatex);
    } catch (err) {
      onInsert(null, currentLatex);
    }
  };

  // -------------------------------------------------------------
  // 2. Classic Drawing Canvas Logic
  // -------------------------------------------------------------
  const drawStroke = useCallback((ctx, s) => {
    ctx.strokeStyle = s.color;
    ctx.lineWidth = s.size;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    s.points.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.stroke();
  }, []);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const CW = canvas.width;
    const CH = canvas.height;
    
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, CW, CH);
    
    const baseImg = baseImageRef.current;
    if (baseImg) {
      const scale = Math.min(CW / baseImg.naturalWidth, CH / baseImg.naturalHeight);
      const w = baseImg.naturalWidth * scale;
      const h = baseImg.naturalHeight * scale;
      ctx.drawImage(baseImg, (CW - w) / 2, (CH - h) / 2, w, h);
    }
    for (const s of strokesRef.current) drawStroke(ctx, s);
  }, [drawStroke]);

  useEffect(() => { 
    if (inputMode === 'canvas') {
      redraw(); 
    }
  }, [inputMode, redraw]);

  const clearCanvas = () => {
    strokesRef.current = [];
    baseImageRef.current = null;
    redraw();
    setMsg({ text: '', isErr: false });
  };

  const getXY = (e) => {
    const canvas = canvasRef.current;
    const r = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - r.left) * (canvas.width / r.width),
      y: (e.clientY - r.top) * (canvas.height / r.height),
    };
  };

  const onPointerDown = (e) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    canvas.setPointerCapture(e.pointerId);
    isDrawingRef.current = true;
    currentStrokeRef.current = {
      points: [getXY(e)],
      size: eraser ? eraserSize : penSize,
      color: eraser ? '#ffffff' : penColor,
    };
    strokesRef.current.push(currentStrokeRef.current);
    if (strokesRef.current.length > MAX_STROKES) strokesRef.current.shift();
    drawStroke(canvas.getContext('2d'), currentStrokeRef.current);
  };

  const onPointerMove = (e) => {
    if (!isDrawingRef.current) return;
    const p = getXY(e);
    const stroke = currentStrokeRef.current;
    const prev = stroke.points[stroke.points.length - 1];
    stroke.points.push(p);
    drawStroke(canvasRef.current.getContext('2d'), { ...stroke, points: [prev, p] });
  };

  const onPointerUp = () => {
    isDrawingRef.current = false;
    currentStrokeRef.current = null;
  };

  const whenMathJaxReady = () => {
    return new Promise((resolve) => {
      const deadline = Date.now() + 15000;
      const check = () => {
        if (window.MathJax && typeof MathJax.tex2svg === 'function' && MathJax.startup && MathJax.startup.promise) {
          MathJax.startup.promise.then(resolve);
        } else if (Date.now() > deadline) resolve();
        else setTimeout(check, 50);
      };
      check();
    });
  };

  const stripDelimiters = (s) => s.replace(/^\\\[/, '').replace(/\\\]$/, '').replace(/^\\\(/, '').replace(/\\\)$/, '').replace(/^\$\$/, '').replace(/\$\$$/, '').replace(/^\$/, '').replace(/\$$/, '').trim();

  const latexToPng = async (latex) => {
    await whenMathJaxReady();
    return new Promise((resolve) => {
      let svg = null;
      try {
        if (latex && window.MathJax && typeof window.MathJax.tex2svg === 'function') {
          const node = window.MathJax.tex2svg(stripDelimiters(latex), { display: true });
          svg = node.querySelector('svg');
        }
      } catch (err) {
        console.error('MathJax tex2svg error:', err);
      }

      if (!svg) return resolve(null);

      try {
        const scale = 3;
        let vbWidth = 0;
        let vbHeight = 0;

        const viewBox = svg.getAttribute('viewBox');
        if (viewBox) {
          const parts = viewBox.trim().split(/\s+/).map(Number);
          if (parts.length === 4 && parts[2] > 0 && parts[3] > 0) {
            vbWidth = parts[2];
            vbHeight = parts[3];
          }
        }

        let mathW = vbWidth > 0 ? Math.round((vbWidth / 1000) * 16 * scale) : 320;
        let mathH = vbHeight > 0 ? Math.round((vbHeight / 1000) * 16 * scale) : 120;

        if (mathW <= 0 || mathH <= 0) {
          const wAttr = parseFloat(svg.getAttribute('width')) || 16;
          const hAttr = parseFloat(svg.getAttribute('height')) || 6;
          mathW = Math.round(wAttr * 16 * scale);
          mathH = Math.round(hAttr * 16 * scale);
        }

        mathW = Math.max(120, mathW);
        mathH = Math.max(60, mathH);

        const clonedSvg = svg.cloneNode(true);
        clonedSvg.setAttribute('width', `${mathW}px`);
        clonedSvg.setAttribute('height', `${mathH}px`);
        clonedSvg.removeAttribute('style');

        const svgString = new XMLSerializer().serializeToString(clonedSvg);
        const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const img = new Image();

        img.onload = () => {
          const c = document.createElement('canvas');
          const cctx = c.getContext('2d');
          const pad = 20 * scale;
          c.width = mathW + pad * 2;
          c.height = mathH + pad * 2;
          cctx.fillStyle = '#ffffff';
          cctx.fillRect(0, 0, c.width, c.height);
          cctx.drawImage(img, pad, pad, mathW, mathH);
          URL.revokeObjectURL(url);
          resolve(c.toDataURL('image/png'));
        };

        img.onerror = () => {
          URL.revokeObjectURL(url);
          resolve(null);
        };

        img.src = url;
      } catch (calcErr) {
        console.error('latexToPng calculation error:', calcErr);
        resolve(null);
      }
    });
  };

  const handleAutoRecognize = async () => {
    const config = typeof aiConfig === 'object' && aiConfig !== null 
      ? aiConfig
      : { provider: 'deepseek', geminiApiKey: geminiApiKey, deepseekApiKey: geminiApiKey };

    const provider = config.provider || 'musespark';
    const hasKey = (provider === 'musespark' || provider === 'meta')
      ? (config.musesparkApiKey || import.meta.env.VITE_META_API_KEY || 'LLM_2161394044719218_Lv8NcmLsyd5kH8je0bbvj4tyQlg')
      : (provider === 'deepseek'
        ? (config.deepseekApiKey || (typeof geminiApiKey === 'string' && geminiApiKey.startsWith('sk-') ? geminiApiKey : null))
        : (config.geminiApiKey || geminiApiKey));

    if (!hasKey) {
      showMsg('API 키가 설정되지 않았습니다. 관리자 페이지에서 API 키를 등록해주세요.', true);
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    if (strokesRef.current.length === 0 && !baseImageRef.current) {
      showMsg('먼저 화면에 수식이나 글씨를 작성해주세요.', true);
      return;
    }

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    const ctx = tempCanvas.getContext('2d');
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
    ctx.drawImage(canvas, 0, 0);
    const base64Img = tempCanvas.toDataURL('image/jpeg', 0.9);

    setIsRecognizing(true);
    showMsg('✨ AI가 글씨와 수식을 인식하여 변환 중입니다...');

    try {
      const prompt = `이 이미지는 학생이 손으로 쓴 글씨와 수학 수식입니다.
텍스트와 수식을 모두 읽어서 단일 줄의 LaTeX 문자열로 출력해주세요.
일반 텍스트(한글, 영어 등)는 반드시 \\text{...} 안에 넣어주시고, 수식은 그 외 부분에 올바른 LaTeX로 작성해주세요.
마크다운 코드 블록(\`\`\`latex 등)이나 설명 없이, 오직 LaTeX 결과 문자열만 반환해주세요.
예시: \\text{다음 } 3 \\text{이}`;
      
      const { callAIAPI } = await import('../utils/gemini');
      let result = await callAIAPI(config, prompt, base64Img);
      result = result.replace(/```latex/gi, '').replace(/```/g, '').trim();

      const png = await latexToPng(result);
      if (png) {
        onInsert(png, result);
      } else {
        onInsert(tempCanvas.toDataURL('image/png'), result);
      }
    } catch (err) {
      showMsg(`자동인식 실패: ${err.message}. [필기 넣기]로 바로 제출하실 수 있습니다.`, true);
    } finally {
      setIsRecognizing(false);
    }
  };

  const handleDirectInsert = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (strokesRef.current.length === 0 && !baseImageRef.current) {
      showMsg('먼저 화면에 수식이나 글씨를 작성해주세요.', true);
      return;
    }

    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = canvas.width;
    exportCanvas.height = canvas.height;
    const ctx = exportCanvas.getContext('2d');
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
    ctx.drawImage(canvas, 0, 0);
    onInsert(exportCanvas.toDataURL('image/png'), null);
  };

  // -------------------------------------------------------------
  // Render Main Content
  // -------------------------------------------------------------
  const content = (
    <div className={`mathink-container ${isExpanded ? 'expanded' : 'inline'}`}>
      {/* Header */}
      <div className="mathink-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '15px', fontWeight: 'bold', color: '#111' }}>
            ✍️ 수식 필기 입력기
          </span>
          {/* Mode Switch Tabs */}
          <div style={{ display: 'flex', gap: '4px', backgroundColor: '#f1f5f9', padding: '3px', borderRadius: '8px' }}>
            <button
              type="button"
              className={`mathink-mode-tab ${inputMode === 'myscript' ? 'active' : ''}`}
              onClick={() => setInputMode('myscript')}
              title="획(Stroke) 실시간 추적 및 초고속 LaTeX 변환"
            >
              ⚡ MyScript 대화형 수식
            </button>
            <button
              type="button"
              className={`mathink-mode-tab ${inputMode === 'canvas' ? 'active' : ''}`}
              onClick={() => setInputMode('canvas')}
              title="자유 드로잉 펜 & 지우개 캔버스"
            >
              🎨 클래식 캔버스
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {inputMode === 'myscript' ? (
            <>
              {myscriptAppKey && myscriptHmacKey && (
                <>
                  <button 
                    className="mathink-primary-btn" 
                    onClick={handleMyScriptConvert} 
                    disabled={isConverting}
                    style={{ 
                      backgroundColor: '#0284C7',
                      color: '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      fontSize: '13px',
                      padding: '7px 12px',
                      borderRadius: '8px',
                      border: 'none',
                      cursor: isConverting ? 'not-allowed' : 'pointer',
                      fontWeight: 'bold'
                    }}
                  >
                    {isConverting ? '⏳ 변환 중...' : '✨ 활자체 수식 변환'}
                  </button>

                  <button 
                    className="mathink-primary-btn" 
                    onClick={handleApplyMyScriptAnswer}
                    style={{ 
                      backgroundColor: '#16A34A',
                      color: '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      fontSize: '13px',
                      padding: '7px 12px',
                      borderRadius: '8px',
                      border: 'none',
                      cursor: 'pointer',
                      fontWeight: 'bold'
                    }}
                  >
                    ✅ 답안으로 적용
                  </button>
                </>
              )}
            </>
          ) : (
            <>
              <button 
                className="mathink-primary-btn" 
                onClick={handleAutoRecognize} 
                disabled={isRecognizing}
                style={{ 
                  backgroundColor: '#1E88E5',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  fontSize: '13px',
                  padding: '7px 12px',
                  borderRadius: '8px',
                  border: 'none',
                  cursor: isRecognizing ? 'not-allowed' : 'pointer',
                  fontWeight: 'bold'
                }}
              >
                {isRecognizing ? '🔍 AI 인식 중...' : '✨ 자동인식'}
              </button>

              <button 
                className="mathink-primary-btn" 
                onClick={handleDirectInsert} 
                disabled={isRecognizing}
                style={{ 
                  backgroundColor: '#43A047',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  fontSize: '13px',
                  padding: '7px 12px',
                  borderRadius: '8px',
                  border: 'none',
                  cursor: 'pointer',
                  fontWeight: 'bold'
                }}
              >
                ✍️ 필기 넣기
              </button>
            </>
          )}

          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            style={{
              padding: '7px 12px',
              borderRadius: '8px',
              border: isExpanded ? '1px solid #1E88E5' : '1px solid #cbd5e1',
              backgroundColor: isExpanded ? '#E3F2FD' : '#f8f9fa',
              color: isExpanded ? '#1565C0' : '#334155',
              fontSize: '13px',
              fontWeight: 'bold',
              cursor: 'pointer'
            }}
          >
            {isExpanded ? '🗗 축소' : '⛶ 전체확대'}
          </button>
          <button className="mathink-cancel" onClick={onCancel} style={{ padding: '7px 12px', fontSize: '13px' }}>✕ 닫기</button>
        </div>
      </div>

      {/* Main Area */}
      <div className="mathink-main">
        {inputMode === 'myscript' ? (
          /* MyScript Panel */
          <div className="mathink-panel" style={{ padding: '12px', gap: '10px' }}>
            {(!myscriptAppKey || !myscriptHmacKey) ? (
              /* MyScript Key Setup Banner */
              <div style={{
                backgroundColor: '#F8FAFC',
                border: '1.5px dashed #0284C7',
                borderRadius: '12px',
                padding: '20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '15px', fontWeight: 'bold', color: '#0369A1' }}>
                    ⚡ MyScript Interactive Ink 활성화
                  </span>
                  <a 
                    href="https://developer.myscript.com" 
                    target="_blank" 
                    rel="noreferrer"
                    style={{ fontSize: '12px', color: '#0284C7', textDecoration: 'underline' }}
                  >
                    MyScript Developer에서 무료 키 발급 ↗
                  </a>
                </div>
                <p style={{ margin: 0, fontSize: '13px', color: '#475569', lineHeight: 1.5 }}>
                  MyScript는 손글씨 획(Stroke) 좌표를 실시간 분석하여 최고 수준의 LaTeX 수식 변환을 제공합니다. 아래에 발급받은 무료 키를 입력하시면 즉시 활성화됩니다.
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '11px', color: '#64748B', fontWeight: 'bold' }}>
                      Application Key
                    </label>
                    <input 
                      type="text"
                      value={tempAppKey}
                      onChange={(e) => setTempAppKey(e.target.value)}
                      placeholder="MyScript Application Key"
                      style={{ width: '100%', boxSizing: 'border-box', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontFamily: 'monospace', fontSize: '12px' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '11px', color: '#64748B', fontWeight: 'bold' }}>
                      HMAC Key (Secret)
                    </label>
                    <input 
                      type="password"
                      value={tempHmacKey}
                      onChange={(e) => setTempHmacKey(e.target.value)}
                      placeholder="MyScript HMAC Key"
                      style={{ width: '100%', boxSizing: 'border-box', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontFamily: 'monospace', fontSize: '12px' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                  <button
                    type="button"
                    onClick={handleSaveQuickKeys}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: '#0284C7',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '8px',
                      fontWeight: 'bold',
                      fontSize: '13px',
                      cursor: 'pointer'
                    }}
                  >
                    💾 키 저장 및 즉시 활성화
                  </button>
                  <button
                    type="button"
                    onClick={() => setInputMode('canvas')}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: '#f1f5f9',
                      color: '#475569',
                      border: '1px solid #cbd5e1',
                      borderRadius: '8px',
                      fontWeight: 'bold',
                      fontSize: '13px',
                      cursor: 'pointer'
                    }}
                  >
                    🎨 일반 캔버스 필기 모드로 전환
                  </button>
                </div>
              </div>
            ) : (
              /* Active MyScript Canvas Surface */
              <>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <button onClick={handleMyScriptUndo} className="mathink-tool" title="실행 취소">↩ 되돌리기</button>
                    <button onClick={handleMyScriptRedo} className="mathink-tool" title="다시 실행">↪ 다시실행</button>
                    <button onClick={handleMyScriptClear} className="mathink-tool" title="전체 지우기">🗑️ 지우기</button>
                  </div>
                  <span style={{ fontSize: '12px', color: '#0369A1', backgroundColor: '#E0F2FE', padding: '4px 8px', borderRadius: '6px', fontWeight: 'bold' }}>
                    ⚡ 펜/터치로 수식을 작성하세요 (실시간 추적 중)
                  </span>
                </div>

                {/* MyScript Canvas Container */}
                <div 
                  style={{ 
                    width: '100%', 
                    height: isExpanded ? 'calc(100vh - 290px)' : '350px',
                    borderRadius: '10px', 
                    border: '2px solid #0EA5E9',
                    backgroundColor: '#ffffff',
                    position: 'relative'
                  }}
                >
                  <div 
                    ref={myscriptElRef}
                    className="myscript-surface"
                    style={{ width: '100%', height: '100%' }}
                  />
                </div>

                {/* Live LaTeX Math Preview Banner */}
                {liveLatex && (
                  <div style={{
                    backgroundColor: '#F0FDF4',
                    border: '1.5px solid #22C55E',
                    borderRadius: '8px',
                    padding: '8px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '10px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '12px', color: '#166534', fontWeight: 'bold' }}>실시간 인식 수식:</span>
                      <code style={{ fontSize: '13px', color: '#15803D', backgroundColor: '#DCFCE7', padding: '2px 6px', borderRadius: '4px', fontFamily: 'monospace' }}>
                        {liveLatex}
                      </code>
                    </div>
                    <button
                      type="button"
                      onClick={handleApplyMyScriptAnswer}
                      style={{
                        padding: '4px 10px',
                        backgroundColor: '#16A34A',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: 'bold',
                        cursor: 'pointer'
                      }}
                    >
                      답안에 넣기 ➔
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        ) : (
          /* Classic Drawing Canvas Panel */
          <div className="mathink-panel" style={{ padding: '14px', gap: '12px' }}>
            <div className="mathink-toolbar" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <button onClick={clearCanvas} className="mathink-tool">모두 지우기</button>
              
              <div style={{ borderLeft: '1px solid #ccc', height: '24px', margin: '0 4px' }}></div>
              
              <div style={{ display: 'flex', gap: '6px' }}>
                <button 
                  onClick={() => { setPenColor('#000000'); setEraser(false); }}
                  style={{ width: '24px', height: '24px', borderRadius: '50%', backgroundColor: '#000000', border: penColor === '#000000' && !eraser ? '2px solid #2196F3' : '2px solid transparent', cursor: 'pointer', padding: 0 }}
                  title="검은색"
                />
                <button 
                  onClick={() => { setPenColor('#FF3B30'); setEraser(false); }}
                  style={{ width: '24px', height: '24px', borderRadius: '50%', backgroundColor: '#FF3B30', border: penColor === '#FF3B30' && !eraser ? '2px solid #2196F3' : '2px solid transparent', cursor: 'pointer', padding: 0 }}
                  title="빨간색"
                />
                <button 
                  onClick={() => { setPenColor('#007AFF'); setEraser(false); }}
                  style={{ width: '24px', height: '24px', borderRadius: '50%', backgroundColor: '#007AFF', border: penColor === '#007AFF' && !eraser ? '2px solid #2196F3' : '2px solid transparent', cursor: 'pointer', padding: 0 }}
                  title="파란색"
                />
              </div>

              <div style={{ borderLeft: '1px solid #ccc', height: '24px', margin: '0 4px' }}></div>

              <button 
                onClick={() => setEraser(false)} 
                className={`mathink-tool ${!eraser ? 'active' : ''}`}
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <span>✏️ 펜</span>
                <span style={{ 
                  display: 'inline-block', 
                  width: '10px', 
                  height: '10px', 
                  borderRadius: '50%', 
                  backgroundColor: penColor,
                  border: '1px solid #999'
                }}></span>
              </button>

              <button 
                onClick={() => setEraser(true)} 
                className={`mathink-tool ${eraser ? 'active' : ''}`}
              >
                🧹 지우개
              </button>
              
              <div style={{ flex: 1 }}></div>

              <label className="mathink-tool-label" style={{ fontSize: '13px', color: '#555' }}>
                {eraser ? '지우개 크기' : '펜 굵기'}
              </label>
              <input 
                type="range" 
                min="1" 
                max={eraser ? "50" : "18"} 
                value={eraser ? eraserSize : penSize} 
                onChange={(e) => eraser ? setEraserSize(Number(e.target.value)) : setPenSize(Number(e.target.value))} 
              />
            </div>

            <div 
              className="mathink-canvas-wrap"
              style={{ width: '100%', borderRadius: '10px', border: '2px solid #cbd5e1' }}
            >
              <canvas
                ref={canvasRef}
                width="1200"
                height={isExpanded ? "850" : "700"}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
                className="mathink-draw-canvas"
              />
            </div>
          </div>
        )}

        {msg.text && (
          <p className={`mathink-msg ${msg.isErr ? 'err' : ''}`} style={{ textAlign: 'center', margin: '4px 0', fontSize: '13px', fontWeight: 'bold' }}>
            {msg.text}
          </p>
        )}
      </div>
    </div>
  );

  if (isExpanded) {
    return (
      <div className="mathink-overlay">
        {content}
      </div>
    );
  }

  return (
    <div className="mathink-inline-container">
      {content}
    </div>
  );
}
