import React from 'react';
import { FiFolder, FiFile, FiFolderPlus, FiFilePlus, FiEdit2, FiTrash2, FiChevronRight, FiChevronDown } from 'react-icons/fi';

interface FileItem {
  name: string;
  path: string;
  type: 'directory' | 'file';
  size: number;
  modified: string;
}

interface FileTreeProps {
  items: FileItem[];
  currentPath: string | null;
  onFileSelect: (path: string) => void;
  onCreateFile: (path: string) => void;
  onCreateFolder: (path: string) => void;
  onRename: (path: string) => void;
  onDelete: (path: string) => void;
}

export default function FileTree({
  items,
  currentPath,
  onFileSelect,
  onCreateFile,
  onCreateFolder,
  onRename,
  onDelete
}: FileTreeProps) {
  const [expandedFolders, setExpandedFolders] = React.useState<Set<string>>(new Set());
  const [contextMenu, setContextMenu] = React.useState<{
    x: number;
    y: number;
    item: FileItem;
  } | null>(null);

  const toggleFolder = (path: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const handleContextMenu = (e: React.MouseEvent, item: FileItem) => {
    e.preventDefault();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      item
    });
  };

  React.useEffect(() => {
    const handleClickOutside = () => setContextMenu(null);
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);

  const renderItem = (item: FileItem) => {
    const isFolder = item.type === 'directory';
    const isExpanded = expandedFolders.has(item.path);
    const isSelected = currentPath === item.path;

    return (
      <div key={item.path} className="select-none">
        <div
          className={`group flex items-center px-2 py-1 rounded-md cursor-pointer ${
            isSelected ? 'bg-blue-100' : 'hover:bg-gray-100'
          }`}
          onClick={() => isFolder ? toggleFolder(item.path) : onFileSelect(item.path)}
          onContextMenu={(e) => handleContextMenu(e, item)}
        >
          <div className="flex items-center flex-1 min-w-0">
            {isFolder && (
              <div className="w-4 h-4 mr-1 text-gray-400">
                {isExpanded ? <FiChevronDown /> : <FiChevronRight />}
              </div>
            )}
            <div className={`w-5 h-5 mr-2 ${isFolder ? 'text-yellow-500' : 'text-blue-500'}`}>
              {isFolder ? <FiFolder /> : <FiFile />}
            </div>
            <span className="truncate text-sm text-gray-700">{item.name}</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="relative">
      <div className="space-y-0.5">
        {items.map(renderItem)}
      </div>

      {contextMenu && (
        <div
          className="fixed z-50 w-48 bg-white rounded-md shadow-lg ring-1 ring-black ring-opacity-5 py-1"
          style={{
            top: contextMenu.y,
            left: contextMenu.x,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {contextMenu.item.type === 'directory' && (
            <>
              <button
                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                onClick={() => {
                  onCreateFile(contextMenu.item.path);
                  setContextMenu(null);
                }}
              >
                <FiFilePlus className="w-4 h-4 mr-2" />
                New File
              </button>
              <button
                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                onClick={() => {
                  onCreateFolder(contextMenu.item.path);
                  setContextMenu(null);
                }}
              >
                <FiFolderPlus className="w-4 h-4 mr-2" />
                New Folder
              </button>
              <div className="h-px bg-gray-200 my-1" />
            </>
          )}
          <button
            className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
            onClick={() => {
              onRename(contextMenu.item.path);
              setContextMenu(null);
            }}
          >
            <FiEdit2 className="w-4 h-4 mr-2" />
            Rename
          </button>
          <button
            className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100 flex items-center"
            onClick={() => {
              onDelete(contextMenu.item.path);
              setContextMenu(null);
            }}
          >
            <FiTrash2 className="w-4 h-4 mr-2" />
            Delete
          </button>
        </div>
      )}
    </div>
  );
} 