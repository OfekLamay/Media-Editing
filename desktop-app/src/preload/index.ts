import { contextBridge, ipcRenderer, webUtils } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for renderer
const videoAPI = {
  // API to process video with given file paths and actions
  processVideo: (filePaths: string[], actions: string[]) => 
    ipcRenderer.invoke('video:process', filePaths, actions),
  
  // API to listen for progress updates during video processing
  onProgress: (callback: (msg: string) => void) => {
    ipcRenderer.removeAllListeners('video:progress');
    ipcRenderer.on('video:progress', (_event, msg) => callback(msg));
  },

  // This API allows the renderer to get a file path for a given File object, 
  // which is useful for processing files selected by the user
  getPathForFile: (file: File) => webUtils.getPathForFile(file)
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('videoAPI', videoAPI) // Adding our custom videoAPI to the renderer's global scope
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.videoAPI = videoAPI
}
