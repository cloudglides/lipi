'use client'; // if using Next.js app directory

import dynamic from 'next/dynamic';
import React, { useState, useEffect } from 'react';
import MdxEditor from '../components/InitializedMDXEditor';
import { useRouter } from 'next/navigation';
import { RealmProvider } from '@mdxeditor/editor';
import { MDXEditor } from '@mdxeditor/editor';
import '@mdxeditor/editor/style.css';
import DirectoryModal from '../components/DirectoryModal';
import path from 'path';

declare global {
  interface Window {
    electron: {
      ipcRenderer: {
        invoke(channel: string, ...args: any[]): Promise<any>;
        send(channel: string, ...args: any[]): void;
        on(channel: string, callback: (...args: any[]) => void): () => void;
      };
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
  path?: string;
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

const plugins: any[] = []; // Empty plugins array

const globalStyles = `
  .mdxeditor-content-editable {
    color: inherit !important;
  }
  [data-lexical-editor] {
    color: inherit !important;
  }
  [data-lexical-editor] *,
  [data-lexical-editor] [contenteditable="true"],
  [data-lexical-editor] [contenteditable="true"] * {
    color: inherit !important;
  }
  [contenteditable="true"] {
    color: inherit !important;
  }
`;

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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; nodeId: string } | null>(null);
  const [showDirectoryModal, setShowDirectoryModal] = useState(true);
  const [lipiDirectory, setLipiDirectory] = useState<string | null>(null);
  
  const router = useRouter();
  const editorRef = React.useRef(null);

  useEffect(() => {
    const checkSavedDirectory = async () => {
      const savedPath = await window.electron.ipcRenderer.invoke('get-saved-directory');
      if (savedPath) {
        setLipiDirectory(savedPath);
        setShowDirectoryModal(false);
      }
    };
    checkSavedDirectory();
  }, []);

  useEffect(() => {
    // Get transparency state from localStorage after component mounts
    const saved = typeof window !== 'undefined' ? localStorage.getItem('transparency') : null;
    if (saved) {
      setIsTransparent(JSON.parse(saved));
    }
    // Send initial transparency state to main process
    window.electron.ipcRenderer.send('toggle-transparency', isTransparent);
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

  // Load file system from disk on mount
  useEffect(() => {
    const loadFileSystem = async () => {
      if (lipiDirectory) {
        console.log('Loading file system from directory:', lipiDirectory);
        const result = await window.electron.ipcRenderer.invoke('read-directory', lipiDirectory);
        if (result.success) {
          console.log('Directory contents:', result.contents);
          
          const rootNode: FileNode = {
            id: 'root',
            name: 'root',
            type: 'folder',
            parentId: null,
            children: [],
            path: lipiDirectory
          };

          const processItems = async (items: any[], parentId: string): Promise<FileNode[]> => {
            const nodes: FileNode[] = [];
            for (const item of items) {
              console.log('Processing item:', {
                name: item.name,
                path: item.path,
                type: item.type
              });

              // Generate a stable ID based on the file path
              const nodeId = Buffer.from(item.path).toString('base64');

              const node: FileNode = {
                id: nodeId,
                name: item.name,
                type: item.type === 'directory' ? 'folder' : 'file',
                parentId,
                path: item.path,
                children: item.type === 'directory' ? [] : undefined
              };

              if (item.type === 'file') {
                // Load file content
                console.log('Loading content for file:', {
                  name: item.name,
                  path: item.path
                });
                const contentResult = await window.electron.ipcRenderer.invoke('read-file', item.path);
                if (contentResult.success) {
                  console.log('File content loaded:', {
                    name: item.name,
                    path: item.path,
                    content: contentResult.content
                  });
                  node.content = contentResult.content;
                  // If this is the current file, update the editor value
                  if (currentFile === nodeId) {
                    setValue(contentResult.content);
                  }
                } else {
                  console.error('Failed to load file content:', {
                    name: item.name,
                    path: item.path,
                    error: contentResult.reason
                  });
                }
              }

              if (item.type === 'directory' && item.children) {
                node.children = await processItems(item.children, nodeId);
              }

              nodes.push(node);
            }
            return nodes;
          };

          rootNode.children = await processItems(result.contents, 'root');
          console.log('Final file system state:', rootNode);
          setFileSystem([rootNode]);
        } else {
          console.error('Failed to load directory:', result.reason);
        }
      }
    };
    loadFileSystem();
  }, [lipiDirectory, currentFile]);

  // Handle Ctrl+S for saving
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (currentFile) {
          const file = findFileById(currentFile, fileSystem);
          if (file && file.type === 'file') {
            console.log('Manual save triggered:', {
              id: currentFile,
              name: file.name,
              path: file.path,
              content: value
            });
            handleEditorChange(value);
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentFile, value, fileSystem]);

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
    window.electron.ipcRenderer.send('restart-app', null);
  };

  const handleWindowControl = (action: 'minimize' | 'maximize' | 'close') => {
    window.electron.ipcRenderer.send('window-control', action);
  };

  const handleEditorChange = async (newValue: string) => {
    console.log('=== HANDLE EDITOR CHANGE START ===');
    console.log('handleEditorChange called with:', {
      currentValue: value,
      newValue,
      currentFile,
      valueLength: newValue.length,
      newValuePreview: newValue.substring(0, 50)
    });

    if (!currentFile) {
      console.error('No current file selected');
      return;
    }

    const file = findFileById(currentFile, fileSystem);
    if (!file || file.type !== 'file') {
      console.error('File not found or not a file:', {
        currentFile,
        file
      });
      return;
    }

    // Update in-memory state
    setValue(newValue);
    const updatedFS = updateFileContent(currentFile, newValue, fileSystem);
    setFileSystem(updatedFS);

    // Save to disk
    try {
      const filePath = path.join(lipiDirectory, file.name);
      console.log('Saving to file:', {
        filePath,
        contentLength: newValue.length,
        contentPreview: newValue.substring(0, 50)
      });

      const result = await window.electron.ipcRenderer.invoke('write-file', filePath, newValue);
      if (!result.success) {
        console.error('Failed to save file:', result.reason);
      }
    } catch (error) {
      console.error('Error saving file:', error);
    }

    console.log('=== HANDLE EDITOR CHANGE END ===');
  };

  const confirmRename = async (id: string, newName: string) => {
    if (!newName.trim()) return;
    
    const node = findFileById(id, fileSystem);
    if (!node) return;

    console.log('Renaming file:', {
      id,
      oldPath: node.path,
      newName
    });

    // Update in-memory state
    const renameNode = (nodes: FileNode[]): FileNode[] => {
      return nodes.map(node => {
        if (node.id === id) {
          const newPath = path.join(path.dirname(node.path), newName);
          return { ...node, name: newName, path: newPath };
        }
        if (node.children) {
          return { ...node, children: renameNode(node.children) };
        }
        return node;
      });
    };
    
    const updatedFileSystem = renameNode(fileSystem);
    setFileSystem(updatedFileSystem);
    setEditingId(null);

    // Save rename to disk
    const result = await window.electron.ipcRenderer.invoke('rename-item', node.path, newName);
    if (!result.success) {
      console.error('Failed to rename file:', result.reason);
      return;
    }

    console.log('Rename successful:', {
      id,
      newPath: result.path
    });

    // If this is the current file, update its state
    if (currentFile === id) {
      const updatedFile = findFileById(id, updatedFileSystem);
      if (updatedFile && updatedFile.type === 'file') {
        // Reload content from the new path
        console.log('Reloading content from new path:', result.path);
        const contentResult = await window.electron.ipcRenderer.invoke('read-file', result.path);
        if (contentResult.success) {
          setValue(contentResult.content);
          const finalFileSystem = updateFileContent(id, contentResult.content, updatedFileSystem);
          setFileSystem(finalFileSystem);
        } else {
          console.error('Failed to reload content:', contentResult.reason);
        }
      }
    }
  };

  const handleNewFile = async (parentId: string) => {
    const parent = findFileById(parentId, fileSystem);
    if (!parent) return;

    // Find the next available untitled file number
    let untitledNumber = 1;
    const existingFiles = getAllFiles(fileSystem);
    while (existingFiles.some(file => file.name === `untitled${untitledNumber}.md`)) {
      untitledNumber++;
    }

    const newFileName = `untitled${untitledNumber}.md`;
    const newFilePath = path.join(parent.path || lipiDirectory || '', newFileName);

    const newFile: FileNode = {
      id: generateUniqueId(),
      name: newFileName,
      type: 'file',
      content: '',
      parentId,
      path: newFilePath
    };

    // Create file on disk
    const result = await window.electron.ipcRenderer.invoke('create-file', parent.path || lipiDirectory || '', newFileName);
    if (!result.success) {
      console.error('Failed to create file:', result.reason);
      return;
    }

    // Update the path with the actual path returned from the main process
    newFile.path = result.path;

    // Update in-memory state
    const updateNodes = (nodes: FileNode[]): FileNode[] => {
      return nodes.map(node => {
        if (node.id === parentId) {
          return {
            ...node,
            children: [...(node.children || []), newFile]
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
    setCurrentFile(newFile.id);
    handleRename(newFile);
  };

  const getAllFiles = (nodes: FileNode[]): FileNode[] => {
    let files: FileNode[] = [];
    nodes.forEach(node => {
      if (node.type === 'file') {
        files.push(node);
      }
      if (node.children) {
        files = [...files, ...getAllFiles(node.children)];
      }
    });
    return files;
  };

  const handleNewFolder = async (parentId: string) => {
    const parent = findFileById(parentId, fileSystem);
    if (!parent) return;

    const newFolderName = 'New Folder';
    const newFolderPath = path.join(parent.path || lipiDirectory || '', newFolderName);

    const newFolder: FileNode = {
      id: generateUniqueId(),
      name: newFolderName,
      type: 'folder',
      children: [],
      parentId,
      path: newFolderPath
    };

    // Create folder on disk
    const result = await window.electron.ipcRenderer.invoke('create-directory', parent.path || lipiDirectory || '', newFolderName);
    if (!result.success) {
      console.error('Failed to create folder:', result.reason);
      return;
    }

    // Update the path with the actual path returned from the main process
    newFolder.path = result.path;

    // Update in-memory state
    const updateNodes = (nodes: FileNode[]): FileNode[] => {
      return nodes.map(node => {
        if (node.id === parentId) {
          return {
            ...node,
            children: [...(node.children || []), newFolder]
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
    handleRename(newFolder);
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
    setEditingId(node.id);
  };

  const handleFileSelect = async (id: string) => {
    console.log('=== FILE SELECT START ===');
    console.log('Selecting file:', {
      id,
      currentFile,
      value
    });
    
    // If we're switching from a file that has unsaved changes, save them first
    if (currentFile) {
      const currentFileNode = findFileById(currentFile, fileSystem);
      if (currentFileNode && currentFileNode.type === 'file') {
        console.log('Saving current file before switch:', {
          id: currentFile,
          name: currentFileNode.name,
          path: currentFileNode.path,
          content: value
        });
        await handleEditorChange(value);
      }
    }
    
    setCurrentFile(id);
    
    const file = findFileById(id, fileSystem);
    if (file && file.type === 'file') {
      console.log('Loading file content:', {
        id,
        name: file.name,
        path: file.path
      });
      
      // Load content from disk
      const result = await window.electron.ipcRenderer.invoke('read-file', file.path);
      console.log('Read file result:', {
        success: result.success,
        contentLength: result.success ? result.content.length : 0,
        error: !result.success ? result.reason : null
      });

      if (result.success) {
        console.log('Updating editor with content:', {
          id,
          name: file.name,
          contentLength: result.content.length,
          contentPreview: result.content.substring(0, 100)
        });
        
        // Update both the editor value and file system state
        setValue(result.content);
        const updatedFS = updateFileContent(id, result.content, fileSystem);
        setFileSystem(updatedFS);
        
        // Force editor to update by setting a temporary value and then the actual content
        setValue('');
        setTimeout(() => {
          setValue(result.content);
        }, 0);
      } else {
        console.error('Failed to load file content:', {
          id,
          name: file.name,
          error: result.reason
        });
      }
    }
    console.log('=== FILE SELECT END ===');
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

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (contextMenu && !(event.target as Element).closest('.context-menu')) {
        setContextMenu(null);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [contextMenu]);

  const handleDirectorySelect = async (path: string) => {
    setLipiDirectory(path);
    setShowDirectoryModal(false);
    // Save the selected directory
    await window.electron.ipcRenderer.invoke('save-directory', path);
  };

  const renderFileTree = (nodes: FileNode[], level: number = 0) => {
    return nodes.map((node) => (
      <div key={node.id}>
        <div 
          className={`group flex items-center px-2 py-1.5 rounded-md transition-all duration-200 ${
            currentFile === node.id ? 'bg-gray-100' : 'hover:bg-gray-50'
          }`}
          style={{ paddingLeft: `${level * 12 + 8}px` }}
          onClick={() => {
            if (node.type === 'file') {
              handleFileSelect(node.id);
            } else {
              // Toggle folder selection
              setCurrentFile(currentFile === node.id ? null : node.id);
            }
          }}
          onDoubleClick={() => handleRename(node)}
          onContextMenu={(e) => {
            e.preventDefault();
            setContextMenu({
              x: e.clientX,
              y: e.clientY,
              nodeId: node.id
            });
          }}
        >
          <div className="flex items-center flex-1 cursor-pointer">
            {node.type === 'folder' ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-500 mr-2" viewBox="0 0 20 20" fill="currentColor">
                <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-500 mr-2" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
              </svg>
            )}
            {editingId === node.id ? (
              <input
                type="text"
                className="text-sm text-gray-700 bg-transparent border-none focus:ring-0 p-0 w-full"
                defaultValue={node.name}
                autoFocus
                onBlur={(e) => confirmRename(node.id, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    confirmRename(node.id, e.currentTarget.value);
                  } else if (e.key === 'Escape') {
                    setEditingId(null);
                  }
                }}
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <span className="text-sm text-gray-700 font-medium">{node.name}</span>
            )}
          </div>
        </div>
        {node.type === 'folder' && node.children && node.children.length > 0 && (
          <div className="ml-2">
            {renderFileTree(node.children, level + 1)}
          </div>
        )}
      </div>
    ));
  };

  return (
    <RealmProvider>
      <style jsx global>{globalStyles}</style>
      <div className={`flex flex-col h-screen ${isTransparent ? 'bg-transparent' : 'bg-white'}`}>
        {showDirectoryModal && (
          <DirectoryModal
            onDirectorySelect={handleDirectorySelect}
            defaultPath={lipiDirectory}
          />
        )}
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
                  onClick={() => handleNewFile(currentFile || 'root')}
                  className="p-1 hover:bg-gray-200 rounded" 
                  title="New File"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-600" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M10 3a1 1 0 00-1 1v5H4a1 1 0 100 2h5v5a1 1 0 102 0v-5h5a1 1 0 100-2h-5V4a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </button>
                <button 
                  onClick={() => handleNewFolder(currentFile || 'root')}
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
              {renderFileTree(fileSystem[0].children || [])}
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
            <div className={`flex-1 overflow-auto ${isTransparent ? '' : 'bg-white'}`}>
              {currentFile && (
                <MDXEditor
                  key={currentFile}
        markdown={value}
                  onChange={(newValue) => {
                    console.log('=== EDITOR ONCHANGE START ===');
                    console.log('Editor content changed:', {
                      currentValue: value,
                      newValue,
                      currentFile,
                      valueLength: newValue.length,
                      newValuePreview: newValue.substring(0, 100),
                      isDifferent: newValue !== value
                    });
                    
                    // Update the value state immediately
                    setValue(newValue);
                    
                    // Then call handleEditorChange
                    handleEditorChange(newValue);
                    console.log('=== EDITOR ONCHANGE END ===');
                  }}
                  plugins={plugins}
                  contentEditableClassName={`prose max-w-none bg-transparent p-4 outline-none focus:outline-none focus:ring-0 [&_*]:outline-none [&_*]:focus:outline-none [&_*]:focus:ring-0 ${
                    isTransparent 
                      ? 'text-white [&]:text-white [&_*]:text-white' 
                      : 'text-black [&]:text-black [&_*]:text-black'
                  }`}
                  className={`outline-none focus:outline-none focus:ring-0 ${
                    isTransparent 
                      ? 'text-white bg-transparent' 
                      : 'text-black bg-white'
                  }`}
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

        {/* Context Menu */}
        {contextMenu && (
          <div 
            className="context-menu fixed z-50 min-w-[180px] py-1 bg-white rounded-lg shadow-lg ring-1 ring-black ring-opacity-5 text-sm"
            style={{
              top: `${contextMenu.y}px`,
              left: `${contextMenu.x}px`,
            }}
          >
            <button
              onClick={(e) => {
                e.stopPropagation();
                const node = findFileById(contextMenu.nodeId, fileSystem);
                if (node) handleRename(node);
                setContextMenu(null);
              }}
              className="w-full text-left px-3 py-1.5 text-gray-700 hover:bg-gray-50 flex items-center group"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2 text-gray-400 group-hover:text-gray-500" viewBox="0 0 20 20" fill="currentColor">
                <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
              </svg>
              Rename
            </button>
            {findFileById(contextMenu.nodeId, fileSystem)?.type === 'folder' && (
              <>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleNewFile(contextMenu.nodeId);
                    setContextMenu(null);
                  }}
                  className="w-full text-left px-3 py-1.5 text-gray-700 hover:bg-gray-50 flex items-center group"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2 text-gray-400 group-hover:text-gray-500" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 3a1 1 0 00-1 1v5H4a1 1 0 100 2h5v5a1 1 0 102 0v-5h5a1 1 0 100-2h-5V4a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  New File
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleNewFolder(contextMenu.nodeId);
                    setContextMenu(null);
                  }}
                  className="w-full text-left px-3 py-1.5 text-gray-700 hover:bg-gray-50 flex items-center group"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2 text-gray-400 group-hover:text-gray-500" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
                    <path stroke="#374151" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v4m-2-2h4" />
                  </svg>
                  New Folder
                </button>
              </>
            )}
            <div className="h-px bg-gray-200 my-1"></div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDelete(contextMenu.nodeId);
                setContextMenu(null);
              }}
              className="w-full text-left px-3 py-1.5 text-red-600 hover:bg-gray-50 flex items-center group"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2 text-red-500" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              Delete
            </button>
          </div>
        )}
    </div>
    </RealmProvider>
  );
}
