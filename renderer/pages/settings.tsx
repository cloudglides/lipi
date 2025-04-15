'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

declare global {
  interface Window {
    ipc: {
      send: (channel: string, value: unknown) => void;
      on: (channel: string, callback: (...args: unknown[]) => void) => () => void;
    };
  }
}

export default function SettingsPage() {
  const [isTransparent, setIsTransparent] = useState(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('transparency') : null;
    return saved ? JSON.parse(saved) : false;
  });
  const [showRestartPrompt, setShowRestartPrompt] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // Send initial transparency state to main process
    window.ipc.send('toggle-transparency', isTransparent);
  }, []);

  const handleTransparencyToggle = () => {
    setIsTransparent(!isTransparent);
    localStorage.setItem('transparency', JSON.stringify(!isTransparent));
    setShowRestartPrompt(true);
  };

  const handleRestart = () => {
    window.ipc.send('restart-app', null);
  };

  return (
    <div className="flex flex-col h-screen bg-white">
      {/* Titlebar */}
      <div className="flex items-center justify-between bg-white text-black px-4 py-2 border-b border-gray-200">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => router.back()}
            className="p-2 hover:bg-gray-200 rounded-full transition-colors"
            title="Back"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-700" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
            </svg>
          </button>
          <span className="font-semibold text-black">Settings</span>
        </div>
      </div>

      {/* Settings Content */}
      <div className="flex-1 p-4">
        <div className="max-w-md mx-auto">
          <div className="flex items-center justify-between py-4">
            <span className="text-gray-700">Transparent Background</span>
            <button
              onClick={handleTransparencyToggle}
              className={`w-12 h-6 rounded-full transition-colors ${
                isTransparent ? 'bg-blue-600' : 'bg-gray-300'
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-white transition-transform ${
                  isTransparent ? 'translate-x-6' : 'translate-x-2'
                }`}
              />
            </button>
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
    </div>
  );
} 