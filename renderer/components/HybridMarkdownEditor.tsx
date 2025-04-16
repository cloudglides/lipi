import React, { useState, useRef } from 'react';

const fadedStyle = {
  opacity: 0.5,
  marginRight: '0.5em',
  fontWeight: 'normal',
};

export default function HybridMarkdownEditor({ value, onChange }) {
  const [lines, setLines] = useState(value.split('\n'));
  const [activeLine, setActiveLine] = useState(0);
  const textareaRef = useRef(null);
  const overlayRef = useRef(null);

  // Sync scroll between textarea and overlay
  const handleScroll = () => {
    if (textareaRef.current && overlayRef.current) {
      overlayRef.current.scrollTop = textareaRef.current.scrollTop;
      overlayRef.current.scrollLeft = textareaRef.current.scrollLeft;
    }
  };

  const handleInput = (e) => {
    const newValue = e.target.value;
    const newLines = newValue.split('\n');
    setLines(newLines);
    onChange(newValue);
  };

  const handleSelect = (e) => {
    const pos = e.target.selectionStart;
    const before = e.target.value.slice(0, pos);
    setActiveLine(before.split('\n').length - 1);
  };

  // Overlay styles
  const overlayStyle = {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    pointerEvents: 'none' as const,
    color: '#111',
    fontSize: '1.1em',
    fontFamily: 'inherit',
    whiteSpace: 'pre-wrap' as const,
    wordBreak: 'break-word' as const,
    padding: '8px',
    boxSizing: 'border-box' as const,
    overflow: 'auto' as const,
  };

  const containerStyle = {
    position: 'relative' as const,
    width: '100%',
  };

  const textareaStyle = {
    width: '100%',
    fontSize: '1.1em',
    fontFamily: 'inherit',
    color: 'transparent',
    background: 'white',
    caretColor: '#111',
    position: 'relative' as const,
    zIndex: 2,
    resize: 'none' as const,
    padding: '8px',
    boxSizing: 'border-box' as const,
    border: 'none',
    outline: 'none',
    overflow: 'auto' as const,
  };

  return (
    <div style={containerStyle}>
      <textarea
        ref={textareaRef}
        value={lines.join('\n')}
        onChange={handleInput}
        onSelect={handleSelect}
        onScroll={handleScroll}
        rows={lines.length}
        style={textareaStyle}
        spellCheck={false}
      />
      <div
        ref={overlayRef}
        style={{ ...overlayStyle, zIndex: 1 }}
        aria-hidden="true"
      >
        {lines.map((line, idx) => {
          const headingMatch = line.match(/^(#+) (.*)$/);
          if (headingMatch) {
            const hashes = headingMatch[1];
            const text = headingMatch[2];
            if (idx === activeLine) {
              return (
                <div key={idx} style={{ fontWeight: 'bold', fontSize: '1.5em' }}>
                  <span style={fadedStyle}>{hashes}</span>
                  {text}
                </div>
              );
            } else {
              return (
                <div key={idx} style={{ fontWeight: 'bold', fontSize: '1.5em' }}>
                  {text}
                </div>
              );
            }
          }
          return <div key={idx}>{line || '\u200B'}</div>;
        })}
      </div>
    </div>
  );
} 