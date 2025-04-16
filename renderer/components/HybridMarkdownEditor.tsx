import React, { useRef, useEffect, useState } from 'react';

const editorStyle: React.CSSProperties = {
  width: '100%',
  height: '100%',
  padding: '16px 32px 8px 32px',
  fontSize: '1em',
  lineHeight: '1.5',
  fontFamily: 'inherit',
  outline: 'none',
  whiteSpace: 'pre-wrap',
  overflowWrap: 'break-word',
  overflowY: 'auto',
  background: 'white',
  border: 'none',
};

export default function HybridMarkdownEditor({ value, onChange }) {
  // Local editing value (not in React state)
  const editorRef = useRef<HTMLDivElement>(null);
  const currentValueRef = useRef(value);
  const lastCaretOffsetRef = useRef(0);
  const [activeLineIdx, setActiveLineIdx] = useState(0);

  // Escape HTML for code
  function escapeHTML(str: string): string {
    return str.replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;', "'":'&#39;'}[c] || c));
  }

  // Render a single line with markdown cues if active
  function renderMarkdownLine(line: string, isActive: boolean): string {
    // Heading: # heading
    if (/^#\s/.test(line)) {
      // Always render #, but faded if active, invisible if not
      const hashStyle = isActive
        ? 'opacity:0.5;color:#94a3b8;user-select:none;display:inline-block;width:1ch;'
        : 'opacity:0;visibility:hidden;user-select:none;display:inline-block;width:0;';
      return `<span style='${hashStyle}'>#</span><span style='font-weight:700;font-size:1.3em;'>${line.slice(1)}</span>`;
    }
    // Bold: **bold**
    if (isActive) {
      line = line.replace(/\*\*(.+?)\*\*/g, (_, boldText) =>
        `<span style='opacity:0.5;color:#94a3b8;user-select:none;'>**</span><strong style='font-weight:800;'>${boldText}</strong><span style='opacity:0.5;color:#94a3b8;user-select:none;'>**</span>`
      );
    } else {
      line = line.replace(/\*\*(.+?)\*\*/g, (_, boldText) =>
        `<strong style='font-weight:800;'>${boldText}</strong>`
      );
    }
    // Inline code: `code`
    if (isActive) {
      line = line.replace(/`([^`]+)`/g, (_, codeText) =>
        `<span style='opacity:0.5;color:#94a3b8;user-select:none;'></span><code style='background:#f1f5f9;padding:2px 4px;border-radius:4px;'>${escapeHTML(codeText)}</code><span style='opacity:0.5;color:#94a3b8;user-select:none;'></span>`
      );
    } else {
      line = line.replace(/`([^`]+)`/g, (_, codeText) =>
        `<code style='background:#f1f5f9;padding:2px 4px;border-radius:4px;'>${escapeHTML(codeText)}</code>`
      );
    }
    return line;
  }

  // Render the full text, only active line gets faded cues
  function markdownToHTML(text: string, activeLineIdx: number): string {
    const lines = text.split(/\n/);
    return lines.map((line, idx) => renderMarkdownLine(line, idx === activeLineIdx)).join('<br>');
  }

  // Get caret offset in plain text
  function getCaretCharacterOffsetWithin(element: HTMLElement) {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return 0;
    const range = selection.getRangeAt(0);
    let preCaretRange = range.cloneRange();
    preCaretRange.selectNodeContents(element);
    preCaretRange.setEnd(range.endContainer, range.endOffset);
    return preCaretRange.toString().length;
  }

  // Get active line index based on caret offset
  function getActiveLineIndex(text: string, caretOffset: number): number {
    let count = 0, idx = 0;
    for (const line of text.split('\n')) {
      if (caretOffset <= count + line.length) return idx;
      count += line.length + 1; // +1 for \n
      idx++;
    }
    return idx;
  }

  // On mount/update: render HTML and set caret
  // Only update DOM if value prop changes from outside
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    if (value !== currentValueRef.current) {
      // Set content and move caret to end
      editor.innerHTML = markdownToHTML(value, activeLineIdx);
      setCaretToOffset(editor, value.length);
      currentValueRef.current = value;
    }
  }, [value, activeLineIdx]);

  // Listen for caret/selection changes globally
  useEffect(() => {
    function handleSelectionChange() {
      const editor = editorRef.current;
      if (!editor || document.activeElement !== editor) return;
      const caretOffset = getCaretCharacterOffsetWithin(editor);
      lastCaretOffsetRef.current = caretOffset;
      const plain = editor.innerText;
      const newActiveLineIdx = getActiveLineIndex(plain, caretOffset);
      if (newActiveLineIdx !== activeLineIdx) {
        setActiveLineIdx(newActiveLineIdx);
        // Re-render cues only, do NOT forcibly move caret
        editor.innerHTML = markdownToHTML(plain, newActiveLineIdx);
        // DO NOT call setCaretToOffset here!
      }
    }
    document.addEventListener('selectionchange', handleSelectionChange);
    return () => document.removeEventListener('selectionchange', handleSelectionChange);
  }, [activeLineIdx]);

  // On input: update value and re-render HTML with caret
  const handleInput = () => {
    const editor = editorRef.current;
    if (!editor) return;
    // Save caret position in plain text BEFORE parsing
    const caretOffset = getCaretCharacterOffsetWithin(editor);
    lastCaretOffsetRef.current = caretOffset;
    // Get plain text from DOM (user input)
    const plain = editor.innerText;
    currentValueRef.current = plain;
    // Update cues/active line and re-render HTML if needed
    const newActiveLineIdx = getActiveLineIndex(plain, caretOffset);
    setActiveLineIdx(newActiveLineIdx);
    editor.innerHTML = markdownToHTML(plain, newActiveLineIdx);
    // Restore caret after re-render
    setCaretToOffset(editor, caretOffset);
  };


  // On blur, sync to React state
  const handleBlur = () => {
    onChange(currentValueRef.current);
  };


  // Custom Enter handler to fix newline at end of formatted line
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const editor = editorRef.current;
      if (!editor) return;
      // Use current plain value as source of truth
      const caretOffset = getCaretCharacterOffsetWithin(editor);
      let plain = currentValueRef.current;
      // Insert newline at caret
      plain = plain.slice(0, caretOffset) + '\n' + plain.slice(caretOffset);
      currentValueRef.current = plain;
      // Figure out which line and column we are now on
      const before = plain.slice(0, caretOffset);
      const linesBefore = before.split('\n');
      const currentLineIdx = linesBefore.length - 1;
      const colInLine = linesBefore[linesBefore.length - 1].length;
      const newLineIdx = currentLineIdx + 1;
      setActiveLineIdx(newLineIdx);
      // Re-render
      editor.innerHTML = markdownToHTML(plain, newLineIdx);
      // Place caret at start of the new line
      setCaretByLineCol(editor, newLineIdx, 0);
      lastCaretOffsetRef.current = caretOffset + 1;
    }
  };



  // Set caret at plain text offset robustly (multi-line, HTML nodes)
  function setCaretToOffset(element: HTMLElement, offset: number): void {
    let current = 0;
    let found = false;
    const walker = document.createTreeWalker(
      element,
      NodeFilter.SHOW_TEXT,
      null
    );
    let node: Text | null = walker.nextNode() as Text;
    while (node) {
      const next = current + node.length;
      if (offset <= next) {
        const sel = window.getSelection();
        const range = document.createRange();
        try {
          range.setStart(node, Math.max(0, offset - current));
          range.collapse(true);
          sel?.removeAllRanges();
          sel?.addRange(range);
        } catch (e) {}
        found = true;
        break;
      }
      current = next;
      node = walker.nextNode() as Text;
    }
    // If we didn't find a node, set at end
    if (!found && element.childNodes.length > 0) {
      const last = element.childNodes[element.childNodes.length - 1];
      const sel = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(last);
      range.collapse(false);
      sel?.removeAllRanges();
      sel?.addRange(range);
    }
  }

  // Helper: set caret by line and column (for Enter)
  function setCaretByLineCol(element: HTMLElement, lineIdx: number, col: number) {
    // Find the text node at the start of the desired line
    let currentLine = 0;
    let currentCol = 0;
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, null);
    let node: Text | null = walker.nextNode() as Text;
    while (node) {
      const text = node.textContent || '';
      let lineBreaks = text.split('\n');
      for (let i = 0; i < lineBreaks.length; i++) {
        if (currentLine === lineIdx) {
          const sel = window.getSelection();
          const range = document.createRange();
          try {
            range.setStart(node, Math.min(col, lineBreaks[i].length));
            range.collapse(true);
            sel?.removeAllRanges();
            sel?.addRange(range);
          } catch (e) {}
          return;
        }
        currentLine++;
      }
      node = walker.nextNode() as Text;
    }
  }

  return (
    <div
      ref={editorRef}
      contentEditable
      onInput={handleInput}
      onKeyDown={handleKeyDown}
      onBlur={handleBlur}
      style={editorStyle}
      spellCheck={false}
      suppressContentEditableWarning
      // Only set initial value from React; after that, DOM is source of truth
      dangerouslySetInnerHTML={{ __html: markdownToHTML(currentValueRef.current, activeLineIdx) }}
    />
  );
}