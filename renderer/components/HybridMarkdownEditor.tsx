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

const AUTOSAVE_KEY = 'hybrid-markdown-editor-autosave';

export default function HybridMarkdownEditor({ value, onChange }) {
  // Local editing value (not in React state)
  const editorRef = useRef<HTMLDivElement>(null);
  const currentValueRef = useRef(value);
  const lastCaretOffsetRef = useRef(0);
  const [activeLineIdx, setActiveLineIdx] = useState(0);
  const [saveStatus, setSaveStatus] = useState<'idle'|'saving'|'saved'>('idle');
  const autosaveTimeout = useRef<NodeJS.Timeout|null>(null);

  // Escape HTML for code//
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
  // On mount, load from autosave if present (ONLY ONCE)
  useEffect(() => {
    const saved = localStorage.getItem(AUTOSAVE_KEY);
    if (saved && saved !== value) {
      currentValueRef.current = saved;
      const editor = editorRef.current;
      if (editor) {
        editor.innerHTML = markdownToHTML(saved, 0);
        setCaretToOffset(editor, saved.length);
      }
      if (onChange) onChange(saved);
    }
    // Only run on mount
    // eslint-disable-next-line
  }, []);

  // Only update DOM if value prop changes from outside
  // Track last externally loaded value
  const lastLoadedValueRef = useRef(value);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    // Only update DOM from value if it actually changed from outside
    if (value !== lastLoadedValueRef.current && value) {
      editor.innerHTML = markdownToHTML(value, activeLineIdx);
      setCaretToOffset(editor, value.length);
      currentValueRef.current = value;
      lastLoadedValueRef.current = value;
    } else {
      // For all other updates (typing, autosave, saveStatus):
      editor.innerHTML = markdownToHTML(currentValueRef.current, activeLineIdx);
      setCaretToOffset(editor, lastCaretOffsetRef.current);
    }
  }, [value, activeLineIdx, saveStatus]);

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
  // Auto-save logic
  function triggerAutoSave(val: string) {
    setSaveStatus('saving');
    if (autosaveTimeout.current) clearTimeout(autosaveTimeout.current);
    autosaveTimeout.current = setTimeout(() => {
      localStorage.setItem(AUTOSAVE_KEY, val);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 1000);
    }, 1000);
  }

  const handleInput = () => {
    const editor = editorRef.current;
    if (!editor) return;
    // Save caret position in plain text BEFORE parsing
    const caretOffset = getCaretCharacterOffsetWithin(editor);
    lastCaretOffsetRef.current = caretOffset;
    // Get plain text from DOM (user input)
    const plain = editor.innerText;
    // Always update currentValueRef.current BEFORE DOM update
    currentValueRef.current = plain;
    // Update cues/active line and re-render HTML if needed
    const newActiveLineIdx = getActiveLineIndex(plain, caretOffset);
    setActiveLineIdx(newActiveLineIdx);
    editor.innerHTML = markdownToHTML(currentValueRef.current, newActiveLineIdx);
    // Restore caret after re-render
    setCaretToOffset(editor, caretOffset);
    triggerAutoSave(plain);
  };


  // On blur, sync to React state
  const handleBlur = () => {
    if (onChange) onChange(currentValueRef.current);
    triggerAutoSave(currentValueRef.current);
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
      // Always update currentValueRef.current BEFORE any re-render/caret logic
      currentValueRef.current = plain;
      lastCaretOffsetRef.current = caretOffset + 1;
      // Figure out which line and column we are now on
      const before = plain.slice(0, caretOffset);
      const linesBefore = before.split('\n');
      const currentLineIdx = linesBefore.length - 1;
      const newLineIdx = currentLineIdx + 1;
      setActiveLineIdx(newLineIdx);
      // Re-render
      editor.innerHTML = markdownToHTML(currentValueRef.current, newLineIdx);
      // Place caret at start of the new line
      setCaretToOffset(editor, caretOffset + 1);
      // Prevent input handler from running again immediately after Enter
      editor.focus();
    }
  };



  // Set caret at plain text offset robustly (multi-line, HTML nodes)
  function setCaretToOffset(element: HTMLElement, offset: number): void {
    let current = 0;
    let found = false;
    // Only count text nodes that are not inside a markdown cue span (user-select:none)
    function isCueNode(node: Node) {
      if (!node.parentElement) return false;
      const style = window.getComputedStyle(node.parentElement);
      return style.userSelect === 'none';
    }
    const walker = document.createTreeWalker(
      element,
      NodeFilter.SHOW_TEXT,
      null
    );
    let node: Text | null = walker.nextNode() as Text;
    while (node) {
      if (isCueNode(node)) {
        node = walker.nextNode() as Text;
        continue;
      }
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
    <div style={{position:'relative', height:'100%'}}>
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
      <div style={{position:'absolute',bottom:8,right:16,fontSize:'0.9em',color:'#888'}}>
        {saveStatus === 'saving' && 'Saving...'}
        {saveStatus === 'saved' && 'Saved'}
      </div>
    </div>
  );
}