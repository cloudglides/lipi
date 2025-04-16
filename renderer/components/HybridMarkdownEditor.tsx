import React, { useState, useRef, useEffect } from 'react';

const fadedStyle = {
  opacity: 0.5,
  marginRight: '0.5em',
  fontWeight: 'normal',
};

export default function HybridMarkdownEditor({ value, onChange }) {
  const [lines, setLines] = useState(value.split('\n'));
  const [activeLine, setActiveLine] = useState(0);
  const [dynamicPadding, setDynamicPadding] = useState(50);
  const textareaRef = useRef(null);
  const overlayRef = useRef(null);

  // Calculate padding based on text content
  useEffect(() => {
    const currentLine = lines[activeLine] || '';
    if (!currentLine.startsWith('#')) {
      setDynamicPadding(8);
      return;
    }
    
    // For heading lines, adjust padding based on content
    const headingMatch = currentLine.match(/^(#+) (.*)$/);
    if (!headingMatch) {
      setDynamicPadding(8);
      return;
    }

    const hashLength = headingMatch[1].length;
    const hashText = headingMatch[1];
    // Calculate padding based on hash symbols width
    const hashWidth = hashText.length * 10; // Approximate width of hash symbols
    setDynamicPadding(hashWidth + 12);
  }, [lines, activeLine]);

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

  const isActiveLineHeading = lines[activeLine]?.match(/^#+/);

  // Overlay styles
  const overlayStyle = {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    pointerEvents: 'none' as const,
    color: '#111',
    fontSize: '0.85em',
    fontFamily: 'inherit',
    whiteSpace: 'pre-wrap' as const,
    wordBreak: 'break-word' as const,
    padding: '28px 8px 8px 8px',
    paddingLeft: isActiveLineHeading ? `${dynamicPadding}px` : '8px',
    boxSizing: 'border-box' as const,
    overflow: 'auto' as const,
    lineHeight: '1.5',
  };

  const containerStyle = {
    position: 'relative' as const,
    width: '100%',
  };



  const textareaStyle = {
    width: '100%',
    fontSize: isActiveLineHeading ? '1.15em' : '0.85em', // Slightly reduced sizes
    fontFamily: 'inherit',
    color: 'transparent',
    background: 'white',
    caretColor: '#000',
    position: 'relative' as const,
    zIndex: 1,
    resize: 'none' as const,
    padding: '19px 8px 8px 8px', // Reduced top padding
    paddingLeft: isActiveLineHeading ? `${dynamicPadding}px` : '8px',
    boxSizing: 'border-box' as const,
    border: 'none',
    outline: 'none',
    overflow: 'auto' as const,
    lineHeight: isActiveLineHeading ? '1.2' : '1.5',
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
        style={{ ...overlayStyle, zIndex: 2 }}
        aria-hidden="true"
      >
        {lines.map((line, idx) => {
          const headingMatch = line.match(/^(#+) (.*)$/);
          if (headingMatch) {
            const hashes = headingMatch[1];
            const text = headingMatch[2];
            if (idx === activeLine) {
              return (
                <div key={idx} style={{ fontWeight: 'bold', fontSize: '1.15em', lineHeight: '1.2' }}>
                  <span style={fadedStyle}>{hashes}</span>
                  {text}
                </div>
              );
            } else {
              return (
                <div key={idx} style={{ fontWeight: 'bold', fontSize: '1.15em', lineHeight: '1.2' }}>
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