import React, { useState } from 'react';

interface DirectoryModalProps {
  onDirectorySelect: (path: string) => void;
  defaultPath: string | null;
}

export default function DirectoryModal({ onDirectorySelect, defaultPath }: DirectoryModalProps) {
  const [customName, setCustomName] = useState('lipi');
  const [isCustomizing, setIsCustomizing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSelectDirectory = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const result = await window.electron.ipcRenderer.invoke('select-directory');
      
      if (result.success) {
        if (result.existed) {
          // Show warning but don't block
          console.warn('Using existing lipi directory');
        }
        onDirectorySelect(result.path);
      } else {
        if (result.reason === 'cancelled') {
          // User cancelled, no need to show error
          return;
        }
        setError(result.reason || 'Failed to set up directory');
      }
    } catch (error) {
      setError('An unexpected error occurred');
      console.error('Directory selection error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 space-y-6">
        <div className="text-center">
          <h2 className="text-2xl font-semibold text-gray-900 mb-2">Welcome to Lipi</h2>
          <p className="text-gray-600">
            Choose where you'd like to store your notes. A new folder named 'lipi' will be created in the selected location.
          </p>
        </div>

        <div className="space-y-4">
          {defaultPath && (
            <div className="p-3 bg-gray-50 rounded-md">
              <p className="text-sm text-gray-600 mb-1">Current Location:</p>
              <p className="text-gray-900 font-medium break-all">{defaultPath}</p>
            </div>
          )}

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <div className="space-y-2">
            {isCustomizing ? (
              <div className="space-y-2">
                <label htmlFor="folderName" className="block text-sm font-medium text-gray-700">
                  Folder Name
                </label>
                <input
                  type="text"
                  id="folderName"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter folder name"
                />
              </div>
            ) : (
              <button
                onClick={() => setIsCustomizing(true)}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                Customize folder name
              </button>
            )}
          </div>

          <button
            onClick={handleSelectDirectory}
            disabled={isLoading}
            className={`w-full flex items-center justify-center px-4 py-3 border border-transparent text-base font-medium rounded-md text-white transition-colors ${
              isLoading 
                ? 'bg-blue-400 cursor-not-allowed' 
                : 'bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
            }`}
          >
            {isLoading ? (
              <>
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Setting up...
              </>
            ) : (
              defaultPath ? 'Change Location' : 'Select Location'
            )}
          </button>

          {defaultPath && !isLoading && (
            <button
              onClick={() => onDirectorySelect(defaultPath)}
              className="w-full flex items-center justify-center px-4 py-3 border border-gray-300 text-base font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
            >
              Continue with Current Location
            </button>
          )}
        </div>

        <div className="text-center text-sm text-gray-500">
          <p>Your notes will be stored locally on your computer</p>
        </div>
      </div>
    </div>
  );
} 