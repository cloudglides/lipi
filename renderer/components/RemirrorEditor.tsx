import React, { useEffect, useRef } from 'react';
import { Remirror, useRemirror, ThemeProvider } from '@remirror/react';
import { MarkdownExtension } from '@remirror/extension-markdown';

const extensions = () => [new MarkdownExtension({ copyAsMarkdown: true })];

interface RemirrorEditorProps {
  value: string;
  onChange: (markdown: string) => void;
  isTransparent?: boolean;
}

const InnerRemirrorEditor: React.FC<RemirrorEditorProps> = ({ value, onChange, isTransparent }) => {
  const { manager, state, setState } = useRemirror({
    extensions,
    content: value,
    selection: 'start',
    stringHandler: 'markdown',
  });

  // Only reset state if the value prop changes due to file switch
  const lastValueRef = useRef<string | null>(null);
  useEffect(() => {
    if (lastValueRef.current !== value) {
      setState(manager.createState({ content: value || '', stringHandler: 'markdown' }));
      lastValueRef.current = value;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <ThemeProvider>
      <style>{`
        .remirror-editor.ProseMirror:focus {
          outline: none !important;
          box-shadow: none !important;
          border-color: transparent !important;
        }
      `}</style>
      <Remirror
        manager={manager}
        state={state}
        onChange={({ helpers }) => {
          const markdown = helpers.getMarkdown();
          onChange(markdown);
        }}
        autoFocus
        classNames={[isTransparent ? 'bg-transparent text-black' : 'bg-white text-black']}
      />
    </ThemeProvider>
  );
};

export default React.memo(InnerRemirrorEditor); 