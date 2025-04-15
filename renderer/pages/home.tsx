'use client'; // if using Next.js app directory

import dynamic from 'next/dynamic';
import React, { useState, useEffect } from 'react';
import MdxEditor from '../components/InitializedMDXEditor';
import { useRouter } from 'next/navigation';
import { RealmProvider } from '@mdxeditor/editor';
import { MDXEditor } from '@mdxeditor/editor';
// import '@mdxeditor/editor/style.css'

import { BlockTypeSelect, BoldItalicUnderlineToggles, Button, ButtonOrDropdownButton, UndoRedo, headingsPlugin, imagePlugin, linkPlugin, listsPlugin, quotePlugin, thematicBreakPlugin, toolbarPlugin } from '@mdxeditor/editor';

declare global {
  interface Window {
    ipc: {
      send: (channel: string, value: unknown) => void;
      on: (channel: string, callback: (...args: unknown[]) => void) => () => void;
    };
  }
}

interface FileNode {
  id: string;
  name: string;
  type: 'file' | 'folder';
  content?: string;
  parentId: string | null;
  children?: FileNode[];
}

const translations = {
  'editor.bold': 'Bold',
  'editor.italic': 'Italic',
  'editor.quote': 'Quote',
  'editor.code': 'Code',
  'editor.heading': 'Heading',
  'editor.link': 'Link',
  'editor.image': 'Image',
  'editor.bulletedList': 'Bulleted List',
  'editor.numberedList': 'Numbered List',
  'editor.checkList': 'Check List',
  'editor.codeBlock': 'Code Block',
  'editor.table': 'Table',
  'editor.divider': 'Divider',
  'editor.frontmatter': 'Frontmatter',
  'editor.undo': 'Undo',
  'editor.redo': 'Redo'
};

const translate = (key: string) => translations[key] || key;

export default function HomePage() {
  const [fileSystem, setFileSystem] = useState<FileNode[]>([{
    id: 'root',
    name: 'root',
    type: 'folder',
    parentId: null,
    children: [{
      id: 'welcome',
      name: 'Welcome.md',
      type: 'file',
      content: '# Welcome to Lipi\n\nThis is your first note. Start writing!',
      parentId: 'root'
    }]
  }]);
  const [value, setValue] = useState(``);
  const [isTransparent, setIsTransparent] = useState(false);
  const [showRestartPrompt, setShowRestartPrompt] = useState(false);
  const [currentFile, setCurrentFile] = useState<string | null>('welcome');
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [renameTarget, setRenameTarget] = useState<FileNode | null>(null);
  
  const router = useRouter();
  const editorRef = React.useRef(null);

  useEffect(() => {
    // Get transparency state from localStorage after component mounts
    const saved = typeof window !== 'undefined' ? localStorage.getItem('transparency') : null;
    if (saved) {
      setIsTransparent(JSON.parse(saved));
    }
    // Send initial transparency state to main process
    window.ipc.send('toggle-transparency', isTransparent);
  }, []);

  // Load file system from localStorage on mount
  useEffect(() => {
    const savedFileSystem = localStorage.getItem('fileSystem');
    if (savedFileSystem) {
      setFileSystem(JSON.parse(savedFileSystem));
    }
  }, []);

  // Save file system to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('fileSystem', JSON.stringify(fileSystem));
  }, [fileSystem]);

  // Load file content when switching files
  useEffect(() => {
    if (currentFile) {
      const file = findFileById(currentFile, fileSystem);
      if (file && file.type === 'file') {
        setValue(file.content || '');
      }
    }
  }, [currentFile]);

  // Save file content when it changes
  useEffect(() => {
    if (currentFile) {
      const updatedFS = updateFileContent(currentFile, value, fileSystem);
      setFileSystem(updatedFS);
    }
  }, [value]);

  const findFileById = (id: string, nodes: FileNode[] = fileSystem): FileNode | null => {
    for (const node of nodes) {
      if (node.id === id) return node;
      if (node.children) {
        const found = findFileById(id, node.children);
        if (found) return found;
      }
    }
    return null;
  };

  const updateFileContent = (id: string, content: string, nodes: FileNode[]): FileNode[] => {
    return nodes.map(node => {
      if (node.id === id) {
        return { ...node, content };
      }
      if (node.children) {
        return { ...node, children: updateFileContent(id, content, node.children) };
      }
      return node;
    });
  };

  const generateUniqueId = () => {
    return Math.random().toString(36).substr(2, 9);
  };

  const handleTransparencyToggle = () => {
    setIsTransparent(!isTransparent);
    setShowRestartPrompt(true);
  };

  const handleRestart = () => {
    window.ipc.send('restart-app', null);
  };

  const handleWindowControl = (action: 'minimize' | 'maximize' | 'close') => {
    window.ipc.send('window-control', action);
  };

  const handleNewFile = (parentId: string) => {
    const newFile: FileNode = {
      id: generateUniqueId(),
      name: 'New File.md',
      type: 'file',
      content: '',
      parentId
    };
    addNodeToFileSystem(parentId, newFile);
    setCurrentFile(newFile.id);
    handleRename(newFile);
  };

  const handleNewFolder = (parentId: string) => {
    const newFolder: FileNode = {
      id: generateUniqueId(),
      name: 'New Folder',
      type: 'folder',
      children: [],
      parentId
    };
    addNodeToFileSystem(parentId, newFolder);
    handleRename(newFolder);
  };

  const addNodeToFileSystem = (parentId: string, newNode: FileNode) => {
    const updateNodes = (nodes: FileNode[]): FileNode[] => {
      return nodes.map(node => {
        if (node.id === parentId) {
          return {
            ...node,
            children: [...(node.children || []), newNode]
          };
        }
        if (node.children) {
          return {
            ...node,
            children: updateNodes(node.children)
          };
        }
        return node;
      });
    };
    setFileSystem(updateNodes(fileSystem));
  };

  const handleDelete = (id: string) => {
    const deleteNode = (nodes: FileNode[]): FileNode[] => {
      return nodes.filter(node => {
        if (node.id === id) {
          if (currentFile === id) {
            setCurrentFile(null);
          }
          return false;
        }
        if (node.children) {
          return {
            ...node,
            children: deleteNode(node.children)
          };
        }
        return true;
      });
    };
    setFileSystem(deleteNode(fileSystem));
  };

  const handleRename = (node: FileNode) => {
    setRenameTarget(node);
    setShowRenameModal(true);
  };

  const confirmRename = (newName: string) => {
    if (!renameTarget || !newName.trim()) return;
    
    const renameNode = (nodes: FileNode[]): FileNode[] => {
      return nodes.map(node => {
        if (node.id === renameTarget.id) {
          return { ...node, name: newName };
        }
        if (node.children) {
          return { ...node, children: renameNode(node.children) };
        }
        return node;
      });
    };
    
    setFileSystem(renameNode(fileSystem));
    setShowRenameModal(false);
    setRenameTarget(null);
  };

  const handleFileSelect = (id: string) => {
    setCurrentFile(id);
  };

  const handleBack = () => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1);
      const previousFile = history[historyIndex - 1];
      setCurrentFile(previousFile);
      // TODO: Load file content
      setValue(`# ${previousFile}\n\nStart writing here...`);
    }
  };

  const handleForward = () => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(historyIndex + 1);
      const nextFile = history[historyIndex + 1];
      setCurrentFile(nextFile);
      // TODO: Load file content
      setValue(`# ${nextFile}\n\nStart writing here...`);
    }
  };

  const handleEditorChange = (value: string) => {
    setValue(value);
  };

  const plugins = [
    headingsPlugin(),
    listsPlugin(),
    thematicBreakPlugin(),
    linkPlugin(),
    imagePlugin(),
    quotePlugin()
  ];

  return (
    <RealmProvider>
      <div className={`flex flex-col h-screen ${isTransparent ? 'bg-transparent' : 'bg-white'}`}>
        {/* Titlebar */}
        <div className={`flex items-center justify-between ${isTransparent ? 'bg-transparent' : 'bg-white'} text-black px-4 py-2 border-b border-gray-200`}>
          <div className="flex items-center space-x-4">
            <span className="font-semibold text-black">Lipi Editor</span>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => handleWindowControl('minimize')}
              className="p-2 hover:bg-gray-200 rounded-full transition-colors"
              title="Minimize"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-700" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
              </svg>
            </button>
            <button
              onClick={() => handleWindowControl('maximize')}
              className="p-2 hover:bg-gray-200 rounded-full transition-colors"
              title="Maximize"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-700" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M3 4a1 1 0 011-1h4a1 1 0 010 2H6.414l2.293 2.293a1 1 0 01-1.414 1.414L5 6.414V8a1 1 0 01-2 0V4zm9 1a1 1 0 010-2h4a1 1 0 011 1v4a1 1 0 01-2 0V6.414l-2.293 2.293a1 1 0 11-1.414-1.414L13.586 5H12zm-9 7a1 1 0 012 0v1.586l2.293-2.293a1 1 0 111.414 1.414L6.414 15H8a1 1 0 010 2H4a1 1 0 01-1-1v-4zm13-1a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 010-2h1.586l-2.293-2.293a1 1 0 111.414-1.414L15 13.586V12a1 1 0 011-1z" clipRule="evenodd" />
              </svg>
            </button>
            <button
              onClick={() => handleWindowControl('close')}
              className="p-2 hover:bg-red-500 hover:text-white rounded-full transition-colors"
              title="Close"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-700" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left Sidebar */}
          <div className={`w-[240px] flex flex-col py-2 ${isTransparent ? 'bg-transparent' : 'bg-gray-50'} border-r border-gray-200`}>
            {/* File Tree Header */}
            <div className="px-2 py-1 flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">Files</span>
              <div className="flex items-center space-x-1">
                <button 
                  onClick={() => handleNewFile('root')}
                  className="p-1 hover:bg-gray-200 rounded" 
                  title="New File"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-600" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                  </svg>
                </button>
                <button 
                  onClick={() => handleNewFolder('root')}
                  className="p-1 hover:bg-gray-200 rounded" 
                  title="New Folder"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-600" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
                    <path stroke="#374151" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v4m-2-2h4" />
                  </svg>
                </button>
              </div>
            </div>

            {/* File Tree */}
            <div className="flex-1 overflow-y-auto px-1 py-2">
              {fileSystem[0].children?.map((node) => (
                <div 
                  key={node.id}
                  className={`group flex items-center justify-between px-2 py-1 rounded hover:bg-gray-200 ${
                    currentFile === node.id ? 'bg-gray-200' : ''
                  }`}
                >
                  <div 
                    className="flex items-center flex-1 cursor-pointer"
                    onClick={() => node.type === 'file' ? handleFileSelect(node.id) : null}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-600 mr-2" viewBox="0 0 20 20" fill="currentColor">
                      {node.type === 'folder' ? (
                        <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
                      ) : (
                        <>
                          <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
                          <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" />
                        </>
                      )}
                    </svg>
                    <span className="text-sm text-gray-700">{node.name}</span>
                  </div>
                  <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100">
                    <button
                      onClick={() => handleRename(node)}
                      className="p-1 hover:bg-gray-300 rounded"
                      title="Rename"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-gray-600" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                      </svg>
                    </button>
                    {node.type === 'folder' && (
                      <>
                        <button
                          onClick={() => handleNewFile(node.id)}
                          className="p-1 hover:bg-gray-300 rounded"
                          title="New File"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-gray-600" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 3a1 1 0 00-1 1v5H4a1 1 0 100 2h5v5a1 1 0 102 0v-5h5a1 1 0 100-2h-5V4a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleNewFolder(node.id)}
                          className="p-1 hover:bg-gray-300 rounded"
                          title="New Folder"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-gray-600" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
                            <path stroke="#374151" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v4m-2-2h4" />
                          </svg>
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => handleDelete(node.id)}
                      className="p-1 hover:bg-red-100 rounded"
                      title="Delete"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-red-600" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Editor Area */}
          <div className="flex-1 flex flex-col">
            {/* Editor Toolbar */}
            <div className={`flex items-center px-4 py-1 ${isTransparent ? 'bg-transparent' : 'bg-white'} border-b border-gray-200`}>
              <div className="flex items-center space-x-2">
                <button 
                  onClick={handleBack}
                  disabled={historyIndex <= 0}
                  className={`p-1.5 rounded ${
                    historyIndex > 0 ? 'hover:bg-gray-100 text-gray-600' : 'text-gray-300 cursor-not-allowed'
                  }`} 
                  title="Back"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
                  </svg>
                </button>
                <button 
                  onClick={handleForward}
                  disabled={historyIndex >= history.length - 1}
                  className={`p-1.5 rounded ${
                    historyIndex < history.length - 1 ? 'hover:bg-gray-100 text-gray-600' : 'text-gray-300 cursor-not-allowed'
                  }`} 
                  title="Forward"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
              <span className="ml-4 text-sm text-gray-600">{currentFile}</span>
            </div>

            {/* Editor Content */}
            <div className="flex-1 overflow-auto">
              {currentFile && (
                <MDXEditor
                  markdown={findFileById(currentFile, fileSystem)?.content || ''}
                  onChange={handleEditorChange}
                  plugins={plugins}
                  contentEditableClassName="prose max-w-none"
                  translation={translate}
                />
              )}
            </div>
          </div>
        </div>
        
        {/* Restart Prompt */}
        {showRestartPrompt && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
            <div className="bg-white rounded-lg p-6 max-w-sm w-full mx-4">
              <h3 className="text-lg font-semibold text-black mb-4">Restart Required</h3>
              <p className="text-gray-600 mb-6">The transparency setting has been changed. The application needs to restart to apply this change.</p>
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setShowRestartPrompt(false)}
                  className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
                >
                  Later
                </button>
                <button
                  onClick={handleRestart}
                  className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                >
                  Restart Now
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Bottom Bar */}
        <div className={`flex items-center justify-between px-4 py-2 ${isTransparent ? 'bg-transparent' : 'bg-white'} border-t border-gray-200`}>
          <button
            onClick={() => router.push('/settings')}
            className="p-1.5 hover:bg-gray-200 rounded-full transition-colors"
            title="Settings"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-700" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        {/* Rename Modal */}
        {showRenameModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
            <div className="bg-white rounded-lg p-6 max-w-sm w-full mx-4">
              <h3 className="text-lg font-semibold text-black mb-4">Rename {renameTarget?.type}</h3>
              <input
                type="text"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                defaultValue={renameTarget?.name}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    confirmRename(e.currentTarget.value);
                  }
                }}
                autoFocus
              />
              <div className="flex justify-end space-x-3 mt-4">
                <button
                  onClick={() => setShowRenameModal(false)}
                  className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={(e) => {
                    const input = e.currentTarget.parentElement?.previousElementSibling as HTMLInputElement;
                    if (input) {
                      confirmRename(input.value);
                    }
                  }}
                  className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                >
                  Rename
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </RealmProvider>
  );
}
