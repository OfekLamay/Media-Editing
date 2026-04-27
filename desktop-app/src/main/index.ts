import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'

import { createBoomerang, removeAudio, reverseVideo, concatVideos, improveQuality } from './videoEditor';
import fs from 'fs';
import path from 'path';
import os from 'os';

function createWindow(): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // IPC test
  ipcMain.on('ping', () => console.log('pong'))

  createWindow()

  // Listen for video processing requests from the renderer
  ipcMain.handle('video:process', async (_event, filePaths: string[], actions: string[]) => {
    const mainWindow = BrowserWindow.getAllWindows()[0];
    const sendProgress = (msg: string) => mainWindow.webContents.send('video:progress', msg);

    // Create a temporary directory for outputs if it doesn't exist
    const outputsDir = path.join(os.tmpdir(), 'video-studio-outputs');
    if (!fs.existsSync(outputsDir)) fs.mkdirSync(outputsDir, { recursive: true });

    const tempFilesToCleanup: string[] = [];

    try {
      const outputName = `final_video_${Date.now()}.mp4`;
      const finalOutputPath = path.join(app.getPath('downloads'), outputName);

      // Concatenation is a special case that needs to be handled upfront since it operates 
      // on multiple files at once
      if (actions.includes('concat')) {
        sendProgress('🔗 Concatenating videos...');
        await concatVideos(filePaths, finalOutputPath);
        sendProgress('✅ Done! Concatenated video saved to downloads.');
        return finalOutputPath;
      }

      // All other actions are applied sequentially on the first video (filePaths[0]), 
      // and the output of one action becomes the input for the next
      let currentVideoPath = filePaths[0];

      for (let i = 0; i < actions.length; i++) {
        const action = actions[i];
        const isLastAction = i === actions.length - 1;
        
        // Save the output of the last action directly to the final destination, 
        // otherwise save to temp for next iteration
        const nextPath = isLastAction 
          ? finalOutputPath 
          : path.join(outputsDir, `temp_${Date.now()}_${i}.mp4`);

        if (action === 'boomerang') {
        sendProgress('Creating boomerang effect 🔄');
          await createBoomerang(currentVideoPath, nextPath);
        } else if (action === 'remove-audio') {
        sendProgress('Removing audio 🔇');
          await removeAudio(currentVideoPath, nextPath);
        } else if (action === 'reverse') {
          sendProgress('⏪ Reversing video...');
          await reverseVideo(currentVideoPath, nextPath);
        } else if (action === 'improve') {
          sendProgress('✨ Improving video quality...');
          await improveQuality(currentVideoPath, nextPath);
        }

        // Save temp files for cleanup later, but only if it's not the final output 
        // (we want to keep the final output file)
        if (!isLastAction) {
          tempFilesToCleanup.push(nextPath);
          currentVideoPath = nextPath;
        }
      }

      sendProgress('✅ Done! Video processing completed, check your downloads folder');

      // Cleaning all temp files
      tempFilesToCleanup.forEach(filePath => {
        try {
          if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        } catch (cleanupErr) {
          console.error(`Error deleting temp file ${filePath}:`, cleanupErr);
        }
      });

      return finalOutputPath;

    } catch (error: any) {
      console.error(error);
      
      // Cleaning temp files also in case of failure
      tempFilesToCleanup.forEach(filePath => {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      });
      
      throw new Error(error.message);
    }
  });

  
  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
