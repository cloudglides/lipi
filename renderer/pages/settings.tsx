'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

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

export default function SettingsPage() {
  const [isTransparent, setIsTransparent] = useState(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('transparency') : null;
    return saved ? JSON.parse(saved) : false;
  });
  const [showRestartPrompt, setShowRestartPrompt] = useState(false);
  const [currentDirectory, setCurrentDirectory] = useState<string | null>(null);
  const [showDirectoryChangeWarning, setShowDirectoryChangeWarning] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // Get current directory
    const getCurrentDirectory = async () => {
      const savedPath = await window.electron.ipcRenderer.invoke('get-saved-directory');
      setCurrentDirectory(savedPath);
    };
    getCurrentDirectory();

    // Send initial transparency state to main process
    window.electron.ipcRenderer.send('toggle-transparency', isTransparent);
  }, []);

  const handleTransparencyToggle = () => {
    setIsTransparent(!isTransparent);
    localStorage.setItem('transparency', JSON.stringify(!isTransparent));
    setShowRestartPrompt(true);
  };

  const handleRestart = () => {
    window.electron.ipcRenderer.send('restart-app', null);
  };

  const handleDirectoryChange = async () => {
    setShowDirectoryChangeWarning(true);
  };

  const handleConfirmDirectoryChange = async () => {
    try {
      const result = await window.electron.ipcRenderer.invoke('select-directory');
      if (result.success) {
        setCurrentDirectory(result.path);
        setShowDirectoryChangeWarning(false);
      }
    } catch (error) {
      console.error('Error changing directory:', error);
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Settings</h1>
      
      <div className="space-y-6">
        {/* Transparency Setting */}
        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
          <div>
            <h2 className="text-lg font-medium">Transparent Background</h2>
            <p className="text-sm text-gray-600">Enable or disable window transparency</p>
          </div>
          <button
            onClick={handleTransparencyToggle}
            className={`px-4 py-2 rounded-md ${
              isTransparent ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700'
            }`}
          >
            {isTransparent ? 'Enabled' : 'Disabled'}
          </button>
        </div>

        {/* Directory Setting */}
        <div className="p-4 bg-gray-50 rounded-lg">
          <h2 className="text-lg font-medium mb-2">Notes Directory</h2>
          <p className="text-sm text-gray-600 mb-4">
            Current location: {currentDirectory || 'Not set'}
          </p>
          <button
            onClick={handleDirectoryChange}
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
          >
            Change Directory
          </button>
        </div>

        {/* Directory Change Warning Modal */}
        {showDirectoryChangeWarning && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
              <h3 className="text-lg font-semibold mb-4">Change Directory Warning</h3>
              <p className="text-gray-600 mb-4">
                Changing the directory will create a new location for your notes. Your previous notes
                will remain in their current location and will not be moved automatically.
              </p>
              <div className="flex justify-end space-x-4">
                <button
                  onClick={() => setShowDirectoryChangeWarning(false)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmDirectoryChange}
                  className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
                >
                  Continue
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Restart Prompt */}
        {showRestartPrompt && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
              <h3 className="text-lg font-semibold mb-4">Restart Required</h3>
              <p className="text-gray-600 mb-4">
                The application needs to restart for the changes to take effect.
              </p>
              <div className="flex justify-end">
                <button
                  onClick={handleRestart}
                  className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
                >
                  Restart Now
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 