import path from 'path'
import { app, ipcMain, BrowserWindow, dialog } from 'electron'
import serve from 'electron-serve'
import { createWindow } from './helpers'
import fs from 'fs'

const isProd = process.env.NODE_ENV === 'production'

if (isProd) {
  serve({ directory: 'app' })
} else {
  app.setPath('userData', `${app.getPath('userData')} (development)`)
}

let mainWindow: BrowserWindow;

// Add these helper functions at the top
const validateDirectory = async (dirPath: string) => {
  try {
    // Check if directory exists
    const stats = await fs.promises.stat(dirPath);
    if (!stats.isDirectory()) {
      throw new Error('Selected path is not a directory');
    }
    
    // Check if we have write permissions
    await fs.promises.access(dirPath, fs.constants.W_OK);
    
    return true;
  } catch (error) {
    console.error('Directory validation error:', error);
    return false;
  }
};

const initializeDirectory = async (basePath: string) => {
  const lipiPath = path.join(basePath, 'lipi');
  
  try {
    // Check if lipi directory exists
    if (fs.existsSync(lipiPath)) {
      // Validate if it's a directory and we have permissions
      const isValid = await validateDirectory(lipiPath);
      if (!isValid) {
        throw new Error('Existing lipi directory is not valid or accessible');
      }
      return { path: lipiPath, existed: true };
    }

    // Create new lipi directory
    await fs.promises.mkdir(lipiPath, { recursive: true });
    
    // Create initial welcome file with correct name
    const welcomePath = path.join(lipiPath, 'Welcome.md');
    const welcomeContent = '# Welcome to Lipi\n\nThis is your first note. Start writing!';
    await fs.promises.writeFile(welcomePath, welcomeContent);

    return { path: lipiPath, existed: false };
  } catch (error) {
    console.error('Directory initialization error:', error);
    throw error;
  }
};

const validateLipiDirectory = async (dirPath: string) => {
  try {
    // Check if directory exists
    const stats = await fs.promises.stat(dirPath);
    if (!stats.isDirectory()) {
      throw new Error('Selected path is not a directory');
    }
    
    // Check if we have write permissions
    await fs.promises.access(dirPath, fs.constants.W_OK);
    
    // Check if lipi directory exists
    const lipiPath = path.join(dirPath, 'lipi');
    if (!fs.existsSync(lipiPath)) {
      throw new Error('No lipi directory found in the selected location');
    }
    
    // Verify lipi directory is accessible
    const lipiStats = await fs.promises.stat(lipiPath);
    if (!lipiStats.isDirectory()) {
      throw new Error('lipi is not a directory');
    }
    
    return true;
  } catch (error) {
    console.error('Directory validation error:', error);
    return false;
  }
};

interface DirectoryItem {
  name: string;
  path: string;
  type: 'directory' | 'file';
  size: number;
  modified: string;
  children?: DirectoryItem[];
}

;(async () => {
  await app.whenReady()

  mainWindow = createWindow('main', {
    width: 1000,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
    frame: false,
  })

  if (isProd) {
    await mainWindow.loadURL('app://./home')
  } else {
    const port = process.argv[2]
    await mainWindow.loadURL(`http://localhost:${port}/home`)
    mainWindow.webContents.openDevTools()
  }
})()

app.on('window-all-closed', () => {
  app.quit()
})

ipcMain.on('message', async (event, arg) => {
  event.reply('message', `${arg} World!`)
})

// Handle transparency toggle
ipcMain.on('toggle-transparency', (event, isTransparent) => {
  if (mainWindow) {
    mainWindow.setBackgroundColor(isTransparent ? '#2563eb33' : '#2563eb');
  }
});

// Handle app restart
ipcMain.on('restart-app', () => {
  app.relaunch();
  app.exit();
});

// Handle window controls
ipcMain.on('window-control', (event, action) => {
  if (!mainWindow) return;

  switch (action) {
    case 'minimize':
      mainWindow.minimize();
      break;
    case 'maximize':
      if (mainWindow.isMaximized()) {
        mainWindow.unmaximize();
      } else {
        mainWindow.maximize();
      }
      break;
    case 'close':
      mainWindow.close();
      break;
  }
});

// Update the select-directory handler
ipcMain.handle('select-directory', async () => {
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory', 'createDirectory'],
      title: 'Select Directory for Lipi Notes',
      buttonLabel: 'Select Directory'
    });

    if (!result.canceled) {
      const selectedPath = result.filePaths[0];
      
      // Validate base directory
      const isValid = await validateDirectory(selectedPath);
      if (!isValid) {
        throw new Error('Selected directory is not valid or accessible');
      }

      // Initialize the lipi directory
      const { path: lipiPath } = await initializeDirectory(selectedPath);
      
      // Save the lipi directory path to user preferences
      const userDataPath = path.join(app.getPath('userData'), 'preferences.json');
      await fs.promises.writeFile(userDataPath, JSON.stringify({ lipiPath }));
      
      return {
        path: lipiPath,
        success: true
      };
    }
    return { success: false, reason: 'cancelled' };
  } catch (error) {
    console.error('Error in select-directory:', error);
    return {
      success: false,
      reason: error.message || 'Unknown error occurred'
    };
  }
});

// Add new IPC handlers for file operations
ipcMain.handle('read-directory', async (event, dirPath) => {
  try {
    const readDirRecursive = async (currentPath: string): Promise<DirectoryItem[]> => {
      const items = await fs.promises.readdir(currentPath, { withFileTypes: true });
      const contents = await Promise.all(items.map(async (item) => {
        const fullPath = path.join(currentPath, item.name);
        const stats = await fs.promises.stat(fullPath);
        
        const result: DirectoryItem = {
          name: item.name,
          path: fullPath,
          type: item.isDirectory() ? 'directory' : 'file',
          size: stats.size,
          modified: stats.mtime.toISOString()
        };

        if (item.isDirectory()) {
          result.children = await readDirRecursive(fullPath);
        }

        return result;
      }));
      
      return contents;
    };

    const contents = await readDirRecursive(dirPath);
    return { success: true, contents };
  } catch (error) {
    console.error('Error reading directory:', error);
    return { success: false, reason: error.message };
  }
});

ipcMain.handle('read-file', async (_, filePath: string) => {
  try {
    console.log('=== READ FILE START ===');
    console.log('File path:', filePath);
    console.log('File exists:', fs.existsSync(filePath));
    
    if (!fs.existsSync(filePath)) {
      console.error('File does not exist:', filePath);
      return { success: false, reason: 'File does not exist' };
    }

    const stats = await fs.promises.stat(filePath);
    console.log('File stats:', {
      path: filePath,
      size: stats.size,
      isFile: stats.isFile(),
      isDirectory: stats.isDirectory(),
      modified: stats.mtime,
      created: stats.birthtime
    });

    if (stats.isDirectory()) {
      console.error('Path is a directory:', filePath);
      return { success: false, reason: 'Path is a directory' };
    }

    // Read file content with explicit encoding
    const content = await fs.promises.readFile(filePath, { encoding: 'utf-8' });
    console.log('File content:', {
      path: filePath,
      contentLength: content.length,
      contentPreview: content.substring(0, 100),
      isEmpty: content.length === 0,
      firstFewChars: content.substring(0, 20)
    });

    console.log('=== READ FILE END ===');
    return { success: true, content };
  } catch (error) {
    console.error('Error reading file:', {
      path: filePath,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    return { success: false, reason: error instanceof Error ? error.message : String(error) };
  }
});

ipcMain.handle('write-file', async (_, filePath: string, content: string) => {
  try {
    console.log('=== WRITE FILE START ===');
    console.log('File path:', filePath);
    console.log('Content length:', content.length);
    console.log('Content preview:', content.substring(0, 100));
    
    // Ensure directory exists
    const dir = path.dirname(filePath);
    console.log('Parent directory:', dir);
    console.log('Directory exists:', fs.existsSync(dir));
    
    if (!fs.existsSync(dir)) {
      console.log('Creating directory:', dir);
      await fs.promises.mkdir(dir, { recursive: true });
    }

    // Write file content with explicit encoding
    console.log('Writing content to file...');
    await fs.promises.writeFile(filePath, content, { encoding: 'utf-8' });
    console.log('Content written to file');

    // Verify the write
    console.log('Verifying write...');
    const writtenContent = await fs.promises.readFile(filePath, { encoding: 'utf-8' });
    console.log('Verification result:', {
      expectedLength: content.length,
      actualLength: writtenContent.length,
      matches: content === writtenContent,
      contentPreview: writtenContent.substring(0, 100),
      firstFewChars: writtenContent.substring(0, 20)
    });

    // Get file stats after write
    const stats = await fs.promises.stat(filePath);
    console.log('File stats after write:', {
      path: filePath,
      size: stats.size,
      isFile: stats.isFile(),
      isDirectory: stats.isDirectory(),
      modified: stats.mtime,
      created: stats.birthtime
    });

    console.log('=== WRITE FILE END ===');
    return { success: true };
  } catch (error) {
    console.error('Error writing file:', {
      path: filePath,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    return { success: false, reason: error instanceof Error ? error.message : String(error) };
  }
});

ipcMain.handle('create-file', async (event, dirPath, fileName) => {
  try {
    console.log('Creating file:', fileName, 'in:', dirPath);

    // Verify the directory is within the lipi directory
    const userDataPath = path.join(app.getPath('userData'), 'preferences.json');
    const preferences = JSON.parse(await fs.promises.readFile(userDataPath, 'utf-8'));
    const lipiPath = preferences.lipiPath;
    
    if (!dirPath.startsWith(lipiPath)) {
      throw new Error('Directory must be within the lipi directory');
    }

    const filePath = path.join(dirPath, fileName);
    if (fs.existsSync(filePath)) {
      throw new Error('File already exists');
    }

    // Ensure directory exists
    if (!fs.existsSync(dirPath)) {
      await fs.promises.mkdir(dirPath, { recursive: true });
    }

    // Create file
    await fs.promises.writeFile(filePath, '', 'utf-8');
    
    // Verify creation
    if (!fs.existsSync(filePath)) {
      throw new Error('File creation verification failed');
    }
    
    console.log('File created successfully');
    return { success: true, path: filePath };
  } catch (error) {
    console.error('Error creating file:', error);
    return { success: false, reason: error.message };
  }
});

ipcMain.handle('create-directory', async (event, dirPath, dirName) => {
  try {
    const newDirPath = path.join(dirPath, dirName);
    if (fs.existsSync(newDirPath)) {
      throw new Error('Directory already exists');
    }
    await fs.promises.mkdir(newDirPath);
    return { success: true, path: newDirPath };
  } catch (error) {
    console.error('Error creating directory:', error);
    return { success: false, reason: error.message };
  }
});

ipcMain.handle('delete-item', async (event, itemPath) => {
  try {
    const stats = await fs.promises.stat(itemPath);
    if (stats.isDirectory()) {
      await fs.promises.rm(itemPath, { recursive: true });
    } else {
      await fs.promises.unlink(itemPath);
    }
    return { success: true };
  } catch (error) {
    console.error('Error deleting item:', error);
    return { success: false, reason: error.message };
  }
});

ipcMain.handle('rename-item', async (event, oldPath, newName) => {
  try {
    console.log('Renaming item:', {
      oldPath,
      newName
    });

    // Verify the file is within the lipi directory
    const userDataPath = path.join(app.getPath('userData'), 'preferences.json');
    const preferences = JSON.parse(await fs.promises.readFile(userDataPath, 'utf-8'));
    const lipiPath = preferences.lipiPath;
    
    if (!oldPath.startsWith(lipiPath)) {
      throw new Error('Item must be within the lipi directory');
    }

    const dirPath = path.dirname(oldPath);
    const newPath = path.join(dirPath, newName);
    
    if (fs.existsSync(newPath)) {
      throw new Error('An item with this name already exists');
    }
    
    // Read content before rename if it's a file
    let content = '';
    if (fs.existsSync(oldPath) && !fs.statSync(oldPath).isDirectory()) {
      content = await fs.promises.readFile(oldPath, 'utf-8');
      console.log('Content before rename:', {
        path: oldPath,
        content
      });
    }
    
    // Rename
    await fs.promises.rename(oldPath, newPath);
    
    // Verify rename
    if (!fs.existsSync(newPath)) {
      throw new Error('Rename verification failed');
    }
    
    // If it was a file, verify content
    if (content) {
      const newContent = await fs.promises.readFile(newPath, 'utf-8');
      console.log('Content after rename:', {
        path: newPath,
        content: newContent,
        match: content === newContent
      });
      if (newContent !== content) {
        throw new Error('Content verification failed after rename');
      }
    }
    
    console.log('Item renamed successfully');
    return { success: true, path: newPath };
  } catch (error) {
    console.error('Error renaming item:', error);
    return { success: false, reason: error.message };
  }
});

ipcMain.handle('get-saved-directory', async () => {
  try {
    const configPath = path.join(app.getPath('userData'), 'lipi-config.json');
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(await fs.promises.readFile(configPath, 'utf-8'));
      return config.lastDirectory || null;
    }
    return null;
  } catch (error) {
    console.error('Error reading config:', error);
    return null;
  }
});

ipcMain.handle('save-directory', async (_, directory: string) => {
  try {
    const configPath = path.join(app.getPath('userData'), 'lipi-config.json');
    const config = {
      lastDirectory: directory
    };
    await fs.promises.writeFile(configPath, JSON.stringify(config), 'utf-8');
    return { success: true };
  } catch (error) {
    console.error('Error saving config:', error);
    return { success: false, reason: error instanceof Error ? error.message : String(error) };
  }
});
