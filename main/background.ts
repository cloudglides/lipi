import path from 'path'
import { app, ipcMain, BrowserWindow } from 'electron'
import serve from 'electron-serve'
import { createWindow } from './helpers'

const isProd = process.env.NODE_ENV === 'production'

if (isProd) {
  serve({ directory: 'app' })
} else {
  app.setPath('userData', `${app.getPath('userData')} (development)`)
}

let mainWindow: BrowserWindow;

;(async () => {
  await app.whenReady()

  mainWindow = createWindow('main', {
    width: 1000,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  })

  if (isProd) {
    await mainWindow.loadURL('app://./home')
  } else {
    const port = process.argv[2]
    await mainWindow.loadURL(`http://localhost:${port}/home`)
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
