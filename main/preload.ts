import { contextBridge, ipcRenderer } from 'electron'

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld(
  'electron',
  {
    ipcRenderer: {
      invoke: (channel: string, ...args: any[]) => {
        return ipcRenderer.invoke(channel, ...args)
      },
      send: (channel: string, ...args: any[]) => {
        ipcRenderer.send(channel, ...args)
      },
      on: (channel: string, func: (...args: any[]) => void) => {
        ipcRenderer.on(channel, (event, ...args) => func(...args))
        return () => ipcRenderer.removeListener(channel, func)
      }
    }
  }
)
