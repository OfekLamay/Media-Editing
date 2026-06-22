# 🎬 Video Studio Pro (Web Application)

A powerful, full-stack web application for quick and efficient video editing, built with **React**, **TypeScript**, and **Node.js**. 

Video Studio Pro features a smart hybrid-processing architecture that dynamically routes video editing tasks between the client's browser (using WebAssembly) and a dedicated backend server, optimizing performance and bypassing standard browser memory constraints.

## ✨ Features

* **⏱️ Change Speed:** Speed up or slow down videos (e.g., 1.5x, 0.5x).
* **✂️ Trim Video:** Cut specific segments out of a video based on start time and duration.
* **🔄 Boomerang Effect:** Seamlessly clone, reverse, and stitch videos to create an endless loop.
* **⏪ Reverse Video:** Play your videos backwards.
* **🔇 Remove Audio:** Strip audio tracks from video files instantly without re-encoding the video stream.
* **🔗 Concatenate Videos:** Merge multiple video files into a single, continuous timeline with automatic resolution and framerate normalization.
* **✨ Improve Quality:** Apply smart contrast, brightness adjustments, and sharpening filters to enhance video quality.
* **⛓️ Action Chaining (Pipeline):** Chain multiple actions together (e.g., Trim + Reverse + Improve) in a customizable execution order using an intuitive drag-and-drop interface.

## 🛠️ Tech Stack

* **Frontend:** React, TypeScript, Vite, CSS3
* **Backend:** Node.js, Express, Multer
* **Media Engine (Server):** FFmpeg (via `fluent-ffmpeg`)
* **Media Engine (Client):** `@ffmpeg/ffmpeg` (WebAssembly / WASM)

## 🧠 Architecture Highlights

* **Two-Tier Hybrid Routing:** The application intelligently analyzes the requested action and file size. Smaller tasks are processed entirely locally in the browser using FFmpeg.wasm for instant results and zero server load. Heavy operations are automatically routed to the Node.js backend.
* **Streamlined Pipeline Processing:** The backend dynamically builds and executes FFmpeg command chains based on the user's custom drag-and-drop sequence, managing temporary files and cleanup automatically.
* **Real-time SSE Progress:** Server-Sent Events (SSE) keep the client updated with real-time progress during heavy backend processing.

## 🚀 Getting Started

### Prerequisites
* [Node.js](https://nodejs.org/) installed on your machine.
* FFmpeg installed on your local machine (for backend processing).

### Installation & Running Locally

1. Clone the repository:
   ```bash
   git clone https://github.com/OfekLamay/Media-Editing.git
   ```

2. Start the Backend Server:
   Open a terminal and navigate to the backend directory:
   ```bash
   cd Media-Editing/video-editor-backend
   npm install
   npm run dev
   ```
   The server will start running on http://localhost:3003

3. Start the Frontend Client:
   Open a new terminal window and navigate to the client directory:
   ```bash
   cd Media-Editing/video-editor-client
   npm install
   npm run dev
   ```
   The application will open in your default browser.


## 💡 Usage

1. Select your desired video editing action(s) from the top menu.
2. If actions require parameters (like Speed or Trim), configure them in the settings panel.
3. Drag and drop to rearrange the execution order if chaining multiple actions.
4. Upload your video file(s).
5. Click Start Editing. The system will automatically choose the best processing route (Local WASM or Cloud Server) and download the final video when complete.
