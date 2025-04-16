import React, { useEffect } from 'react';
import { Remirror, useRemirror, ThemeProvider } from '@remirror/react';
import { MarkdownExtension } from '@remirror/extension-markdown';

interface RemirrorEditorProps {
  value: string;
  onChange: (markdown: string) => void;
  isTransparent?: boolean;
}

const RemirrorEditor: React.FC<RemirrorEditorProps> = ({ value, onChange, isTransparent }) => {
  const { manager, state, setState } = useRemirror({
    extensions: () => [
      new MarkdownExtension({ copyAsMarkdown: true }),
    ],
    content: value,
    selection: 'start',
    stringHandler: 'markdown',
  });

  // Sync value state when value prop changes (e.g. file switch)
  useEffect(() => {
    setState(manager.createState({ content: value || '', stringHandler: 'markdown' }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <ThemeProvider>
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

export default RemirrorEditor; 