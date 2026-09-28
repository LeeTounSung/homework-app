import React, { useEffect, useRef } from 'react';

/**
 * TikZBlock: Renders a single LaTeX TikZ block using TikZJax WebAssembly engine.
 */
function TikZBlock({ code }) {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;

    let cleanCode = code.trim();
    // Clean outer ```tikz and ``` if present
    cleanCode = cleanCode.replace(/^```tikz\s*/i, '').replace(/```$/, '').trim();

    // Ensure it is wrapped in tikzpicture if missing
    if (!cleanCode.includes('\\begin{tikzpicture}')) {
      cleanCode = `\\begin{tikzpicture}\n${cleanCode}\n\\end{tikzpicture}`;
    }

    // Reset container and create <script type="text/tikz">
    containerRef.current.innerHTML = '';
    const script = document.createElement('script');
    script.type = 'text/tikz';
    script.textContent = cleanCode;
    containerRef.current.appendChild(script);

    // Trigger TikZJax processing
    const runTikz = () => {
      if (window.processJax) {
        window.processJax();
      }
    };

    if (window.processJax) {
      runTikz();
    } else {
      // If TikZJax is still loading over CDN, poll briefly
      const interval = setInterval(() => {
        if (window.processJax) {
          runTikz();
          clearInterval(interval);
        }
      }, 250);
      return () => clearInterval(interval);
    }
  }, [code]);

  return (
    <div 
      className="tikz-graph-wrapper"
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '16px 8px',
        margin: '14px 0',
        backgroundColor: '#fafafa',
        borderRadius: '8px',
        border: '1px dashed #BDBDBD',
        overflowX: 'auto',
        minHeight: '80px'
      }}
    >
      <div ref={containerRef} style={{ display: 'inline-block', maxWidth: '100%' }} />
    </div>
  );
}

/**
 * ProblemStatementView: Renders a problem statement containing both LaTeX formulas (MathJax)
 * and geometric graphics/diagrams (TikZJax).
 */
export default function ProblemStatementView({ statement }) {
  const textRef = useRef(null);

  // Trigger MathJax whenever statement changes
  useEffect(() => {
    if (window.MathJax && window.MathJax.typesetPromise && textRef.current) {
      window.MathJax.typesetPromise([textRef.current]).catch(err => console.warn(err));
    }
  }, [statement]);

  if (!statement) return null;

  // Pattern to detect TikZ blocks
  const tikzRegex = /(?:```tikz\s*([\s\S]*?)```|(\\begin\{tikzpicture\}[\s\S]*?\\end\{tikzpicture\}))/gi;

  const parts = [];
  let lastIndex = 0;
  let match;

  while ((match = tikzRegex.exec(statement)) !== null) {
    if (match.index > lastIndex) {
      parts.push({
        type: 'text',
        content: statement.slice(lastIndex, match.index)
      });
    }

    const tikzCode = match[1] || match[2] || match[0];
    parts.push({
      type: 'tikz',
      content: tikzCode
    });

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < statement.length) {
    parts.push({
      type: 'text',
      content: statement.slice(lastIndex)
    });
  }

  // If there's no TikZ, render simple MathJax text view
  if (parts.length === 0 || (parts.length === 1 && parts[0].type === 'text')) {
    return (
      <div 
        ref={textRef}
        style={{ fontSize: '15px', lineHeight: 1.7, color: '#111', whiteSpace: 'pre-wrap' }}
      >
        {statement}
      </div>
    );
  }

  return (
    <div ref={textRef} style={{ fontSize: '15px', lineHeight: 1.7, color: '#111' }}>
      {parts.map((part, idx) => {
        if (part.type === 'tikz') {
          return <TikZBlock key={`tikz-${idx}`} code={part.content} />;
        }
        return (
          <div 
            key={`txt-${idx}`} 
            style={{ whiteSpace: 'pre-wrap', marginBottom: '8px' }}
          >
            {part.content}
          </div>
        );
      })}
    </div>
  );
}
