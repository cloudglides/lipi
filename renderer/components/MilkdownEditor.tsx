import React from 'react';
import { Milkdown, useEditor } from '@milkdown/react';
import { nord } from '@milkdown/theme-nord';
import { gfm } from '@milkdown/preset-gfm';
import { Editor, defaultValueCtx, rootCtx } from '@milkdown/core';
import { listener, listenerCtx } from '@milkdown/plugin-listener';

interface MilkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
}

const MilkdownEditor: React.FC<MilkdownEditorProps> = ({ value, onChange }) => {
  useEditor((root) => {
    return Editor.make()
      .config((ctx) => {
        ctx.set(rootCtx, root);
        ctx.set(defaultValueCtx, value);
        ctx.get(listenerCtx).markdownUpdated((_, md) => {
          onChange(md);
        });
      })
      .use(nord)
      .use(gfm)
      .use(listener);
  }, [value]);

  return <Milkdown />;
};

export default MilkdownEditor; 