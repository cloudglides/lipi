import React, { useState, useRef, useEffect } from 'react';

const MARKDOWN_PATTERNS = {
  heading: /^(#{1,6})\s(.+)$/,
  bulletList: /^(\*|\-|\+)\s(.+)$/,
  numberList: /^(\d+\.)\s(.+)$/,
  blockquote: /^(>)\s(.+)$/,
  codeBlock: /^(`{3})/,
  bold: /(\*\*|__)(.+?)\1/g,
  italic: /(\*|_)(.+?)\1/g,
  inlineCode: /`(.+?)`/g,
};

const fadedStyle = {
  opacity: 0.5,
  marginRight: '0.5em',
  fontWeight: 'normal',
  color: '#94a3b8',
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

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const currentLineIndex = e.target.value.substring(0, e.target.selectionStart).split('\n').length - 1;
      const currentLine = lines[currentLineIndex];
      const newLines = [...lines];

      // Check for list continuation
      const bulletMatch = currentLine.match(MARKDOWN_PATTERNS.bulletList);
      const numberMatch = currentLine.match(MARKDOWN_PATTERNS.numberList);
      const blockquoteMatch = currentLine.match(MARKDOWN_PATTERNS.blockquote);
      
      if (currentLine.trim() === '') {
        // Empty line - break the pattern
        newLines.splice(currentLineIndex + 1, 0, '');
      } else if (bulletMatch) {
        newLines.splice(currentLineIndex + 1, 0, `${bulletMatch[1]} `);
      } else if (numberMatch) {
        const nextNumber = parseInt(numberMatch[1]) + 1;
        newLines.splice(currentLineIndex + 1, 0, `${nextNumber}. `);
      } else if (blockquoteMatch) {
        newLines.splice(currentLineIndex + 1, 0, '> ');
      } else {
        newLines.splice(currentLineIndex + 1, 0, '');
      }
      
      setLines(newLines);
      onChange(newLines.join('\n'));
    }
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
    height: "100%",
    padding: "9px 0px"
  };

  const textareaStyle = {
    width: '100%',
    fontSize: isActiveLineHeading ? '1.15em' : '0.85em', // Slightly reduced sizes
    fontFamily: 'inherit',
    color: 'transparent',
    background: 'white',
    caretColor: '#000',
    position: 'relative' as const,
    height: "100%",
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

  const renderMarkdownLine = (line: string, isActive: boolean) => {
    const styles: React.CSSProperties = {
      fontSize: '0.85em',
      lineHeight: '1.5',
      display: 'flex',
      alignItems: 'baseline',
    };

    // Handle headings
    const headingMatch = line.match(MARKDOWN_PATTERNS.heading);
    if (headingMatch) {
      const [_, hashes, text] = headingMatch;
      return (
        <div style={styles}>
          {isActive && <span style={fadedStyle}>{hashes} </span>}
          <span style={{ 
            fontSize: `${2 - (hashes.length * 0.1)}em`,
            fontWeight: 'bold' 
          }}>{text}</span>
        </div>
      );
    }

    // Handle bullet lists
    const bulletMatch = line.match(MARKDOWN_PATTERNS.bulletList);
    if (bulletMatch) {
      const [_, bullet, text] = bulletMatch;
      return (
        <div style={styles}>
          {isActive && <span style={fadedStyle}>{bullet}</span>}
          <span className='flex items-center gap-2 justify-center'><span className='h-1 w-1 flex rounded-full bg-gray-800/30'></span>{text}</span>
        </div>
      );
    }

    // Handle numbered lists
    const numberMatch = line.match(MARKDOWN_PATTERNS.numberList);
    if (numberMatch) {
      const [_, number, text] = numberMatch;
      return (
        <div style={styles}>
          {isActive && <span style={fadedStyle}>{number} </span>}
          <span>{text}</span>
        </div>
      );
    }

    // Handle blockquotes
    const quoteMatch = line.match(MARKDOWN_PATTERNS.blockquote);
    if (quoteMatch) {
      const [_, quote, text] = quoteMatch;
      return (
        <div style={{
          ...styles,
          borderLeft: '3px solid #cbd5e1',
          paddingLeft: '1em',
          color: '#64748b'
        }}>
          {isActive && <span style={fadedStyle}>{quote} </span>}
          <span>{text}</span>
        </div>
      );
    }

    return <div style={styles}>{line || '\u200B'}</div>;
  };

  return (
    <div style={containerStyle}>
      <textarea
        className='textarea'
        ref={textareaRef}
        value={lines.join('\n')}
        onChange={handleInput}
        onKeyDown={handleKeyDown}
        onSelect={handleSelect}
        onScroll={handleScroll}
        style={textareaStyle}
        spellCheck={false}
      />
      <div
        ref={overlayRef}
        style={{ ...overlayStyle, zIndex: 2 }}
        aria-hidden="true"
      >
        {lines.map((line, idx) => (
          <div key={idx}>
            {renderMarkdownLine(line, idx === activeLine)}
          </div>
        ))}
      </div>
    </div>
  );
}