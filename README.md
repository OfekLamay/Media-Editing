# 🎬 Video Studio Pro

A powerful, cross-platform desktop application for quick and efficient video editing, built with **Electron**, **React**, and **TypeScript**. 

Video Studio Pro allows users to perform heavy video processing tasks entirely locally on their machine, bypassing the common memory constraints, file-size limits, and privacy concerns of cloud-based or browser-only processing tools.

## ✨ Features

* **🔄 Boomerang Effect:** Seamlessly clone, reverse, and stitch videos to create an endless loop.
* **⏪ Reverse Video:** Play your videos backwards.
* **🔇 Remove Audio:** Strip audio tracks from video files instantly without re-encoding the video stream.
* **🔗 Concatenate Videos:** Merge multiple video files into a single, continuous timeline with automatic resolution and framerate normalization.
* **✨ Improve Quality:** Apply smart contrast, brightness adjustments, and sharpening filters to enhance video quality.
* **⛓️ Action Chaining (Pipeline):** Chain multiple actions together (e.g., Reverse + Remove Audio + Improve) in a customizable execution order using an intuitive drag-and-drop interface.

## 🛠️ Tech Stack

* **Frontend:** React, TypeScript, Vite, CSS3
* **Backend / Desktop Environment:** Electron, Node.js
* **Media Engine:** FFmpeg (via `fluent-ffmpeg` and `@ffmpeg-installer/ffmpeg`)
* **IPC Communication:** Secure Context Bridge between the Electron Main process and React Renderer.

## 🧠 Architecture Highlights

Initially designed as a standard Client-Server web application, this project was architecturally pivoted to a Desktop Application using Electron. 
* **Zero Cloud Dependency:** By bundling a static FFmpeg binary directly into the application, all video processing uses 100% of the host machine's CPU and RAM.
* **No File Size Limits:** Circumvents the strict WebAssembly (WASM) and browser sandbox memory limitations (typically crashing around 1-2GB of RAM usage), allowing for processing of massive video files.
* **Privacy First:** User videos never leave their local device.

## 🚀 Getting Started

### Prerequisites
* [Node.js](https://nodejs.org/) installed on your machine.

### Installation

1. Clone the repository:
   ```bash
   git clone [https://github.com/OfekLamay/Media-Editing.git](https://github.com/OfekLamay/Media-Editing.git)
   cd Media-Editing/desktop-app
   ```

2. Install dependencies:
    ```bash
    npm install
    ```

3. Start the application in development mode:
    ```bash
    npm run dev
    ```

### Building for Production
To package the application into a standalone executable (e.g., .exe for Windows):
```bash
npm run build:win
```

The output executable will be located in the dist folder.


## 💡 Usage
Select your desired video editing action(s) from the top menu.

Drag and drop to rearrange the execution order if chaining multiple actions.

Upload your video file(s).

Click Start Editing. The progress will be displayed, and the final video will be automatically saved to your computer's Downloads folder.
