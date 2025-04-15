'use client'; // if using Next.js app directory

import dynamic from 'next/dynamic';
import React, { useState } from 'react';
import MdxEditor from '../components/InitializedMDXEditor';
// import '@mdxeditor/editor/style.css'

import { BlockTypeSelect, BoldItalicUnderlineToggles, Button, ButtonOrDropdownButton, UndoRedo, headingsPlugin, imagePlugin, linkPlugin, listsPlugin, quotePlugin, thematicBreakPlugin, toolbarPlugin, translation$ } from '@mdxeditor/editor';

export default function HomePage() {
  const [value, setValue] = useState(``);

  const editorRef = React.useRef(null);

  return (
    <div className='lg:px-12 z-50 h-screen md:px-8 px-5 py-5 '>
      <MdxEditor
        className='w-full h-full  text-white'
        onChange={(value)=>{setValue(value); console.log(value)}}
        editorRef={editorRef}
        markdown={value}
        plugins={[
          headingsPlugin(),
          listsPlugin(),
          thematicBreakPlugin(),
          linkPlugin(),
          imagePlugin(),
          quotePlugin(),
          toolbarPlugin({
            toolbarContents: () => (
              <div className='flex items-center space-x-2'>
                <UndoRedo />
                <BoldItalicUnderlineToggles />
                <BlockTypeSelect/>
              </div>
            ),
          }),
        ]}
      />
    </div>
  );
}
