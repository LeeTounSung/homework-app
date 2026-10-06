import React, { useState, useEffect, useRef, useCallback } from 'react';
import './MathInkComponent.css';

const PEN_DEFAULT = 4;
const MAX_STROKES = 500;

export default function MathInkComponent({ onInsert, onCancel, geminiApiKey, aiConfig }) {
  const canvasRef = useRef(null);

  const [isExpanded, setIsExpanded] = useState(false);
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [msg, setMsg] = useState({ text: '', isErr: false });
  const [eraser, setEraser] = useState(false);
  const [penSize, setPenSize] = useState(PEN_DEFAULT);
  const [eraserSize, setEraserSize] = useState(20);
  const [penColor, setPenColor] = useState('#000000');

  // Drawing state refs
  const strokesRef = useRef([]);
  const baseImageRef = useRef(null);
  const isDrawingRef = useRef(false);
  const currentStrokeRef = useRef(null);

  const showMsg = (text, isErr = false) => setMsg({ text, isErr });

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
    redraw();
  }, [redraw]);

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

  // 1. ✨ 글씨+수식 자동인식 (AI OCR + LaTeX 렌더링)
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

  // 2. ✍️ 필기 넣기 (그린 손글씨 그대로 바로 삽입)
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

  const content = (
    <div className={`mathink-container ${isExpanded ? 'expanded' : 'inline'}`}>
      {/* Header */}
      <div className="mathink-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '15px', fontWeight: 'bold', color: '#111' }}>
            ✍️ 수식 및 풀이 필기 입력
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {/* Top Primary Action Buttons */}
          <button 
            className="mathink-primary-btn" 
            onClick={handleAutoRecognize} 
            disabled={isRecognizing}
            style={{ 
              backgroundColor: '#1E88E5',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '5px',
              fontSize: '13px',
              padding: '7px 12px',
              borderRadius: '8px',
              border: 'none',
              cursor: isRecognizing ? 'not-allowed' : 'pointer',
              fontWeight: 'bold',
              whiteSpace: 'nowrap',
              boxShadow: '0 2px 4px rgba(30, 136, 229, 0.3)'
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
              justifyContent: 'center',
              gap: '5px',
              fontSize: '13px',
              padding: '7px 12px',
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 'bold',
              whiteSpace: 'nowrap',
              boxShadow: '0 2px 4px rgba(67, 160, 71, 0.3)'
            }}
          >
            ✍️ 필기 넣기
          </button>

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
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              whiteSpace: 'nowrap'
            }}
          >
            {isExpanded ? '🗗 기본 크기로 축소' : '⛶ 필기창 전체확대'}
          </button>
          <button className="mathink-cancel" onClick={onCancel} style={{ padding: '7px 12px', fontSize: '13px', whiteSpace: 'nowrap' }}>✕ 닫기</button>
        </div>
      </div>

      {/* Main Canvas & Tools */}
      <div className="mathink-main">
        <div className="mathink-panel" style={{ padding: '14px', gap: '12px' }}>
          {/* Toolbar */}
          <div className="mathink-toolbar" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <button onClick={clearCanvas} className="mathink-tool">모두 지우기</button>
            
            <div style={{ borderLeft: '1px solid #ccc', height: '24px', margin: '0 4px' }}></div>
            
            {/* Color Selector */}
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

            {/* Pen & Eraser Selection */}
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

          {/* Drawing Canvas Area */}
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

          {msg.text && (
            <p className={`mathink-msg ${msg.isErr ? 'err' : ''}`} style={{ textAlign: 'center', margin: '4px 0', fontSize: '13px', fontWeight: 'bold' }}>
              {msg.text}
            </p>
          )}
        </div>
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
