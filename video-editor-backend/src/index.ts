import express from 'express';
import type { Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import cors from 'cors';
import { EventEmitter } from 'events';

import { createBoomerang, removeAudio, reverseVideo, concatVideos, improveQuality, changeSpeed, trimVideo, singlePassEdit } from './services/videoEditor';

const app = express();

const allowedOrigins = ['http://localhost:5173', 'https://media-editing.vercel.app/'];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  }
}));

// Action translation for progress messages
const actionNames: Record<string, string> = {
    'boomerang': 'Creating Boomerang 🔄',
    'reverse': 'Reversing Video ⏪',
    'remove-audio': 'Removing Audio 🔇',
    'improve': 'Improving Quality ✨',
    'speed': 'Changing Speed ⏱️',
    'trim': 'Trimming Video ✂️',
    'concat': 'Concatenating Videos 🔗'
};

const PORT = process.env.PORT || 3003;

const progressEmitter = new EventEmitter();

const outputsDir = path.join(__dirname, '../outputs');
if (!fs.existsSync(outputsDir)) {
    fs.mkdirSync(outputsDir, { recursive: true });
}

const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Set up multer for file uploads, specifying the destination and filename format
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        // Extract the file extension from the original filename
        const ext = path.extname(file.originalname);
        // Create a unique filename that includes the extension
        const uniqueName = `video-${Date.now()}-${Math.round(Math.random() * 1E9)}${ext}`;
        cb(null, uniqueName);
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 500 * 1024 * 1024 } // e.g. 500MB
});

app.get('/api/video/progress', (req, res) => {
    // Keep the connection open for SSE
    const jobId = req.query.jobId as string;
    
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Use the jobId to create a unique event name for this specific job's progress updates
    const eventName = `update-${jobId}`;
    
    const listener = (msg: string) => {
        res.write(`data: ${msg}\n\n`);
    };

    progressEmitter.on(eventName, listener);

    // Cleanup when the client disconnects
    req.on('close', () => {
        progressEmitter.removeListener(eventName, listener);
    });
});

app.post('/api/video/pipeline', upload.array('videos'), async (req, res) => {
    const files = req.files as Express.Multer.File[];
    const actions = JSON.parse(req.body.actions || '[]');
    const jobId = req.body.jobId; 
    
    if (!files || files.length === 0) return res.status(400).send('No files uploaded.');

    const tempFilesToCleanup: string[] = [...files.map(f => f.path)];
    const sendProgress = (msg: string) => { if (jobId) progressEmitter.emit(`update-${jobId}`, msg); };

    try {
        let currentVideoPath = files[0].path;
        const outputsDir = path.join(__dirname, '../outputs');
        
        // Useful flags to determine which actions are active
        const isConcatActive = actions.includes('concat');
        const isBoomerangActive = actions.includes('boomerang');
        
        // The actions that can be applied in a single pass
        const singlePassActions = actions.filter((a: string) => 
            ['trim', 'speed', 'reverse', 'remove-audio', 'improve'].includes(a)
        );

        const speedFactor = parseFloat(req.body.speedFactor) || 1.5; 
        const trimStart = parseFloat(req.body.trimStart) || 0;
        const trimDuration = parseFloat(req.body.trimDuration) || 5;

        // Step 1: Concatenate videos (if selected)
        if (isConcatActive) {
            sendProgress('🔗 Concatenating videos...');
            const nextTempPath = path.join(outputsDir, `temp_concat_${Date.now()}.mp4`);
            await concatVideos(files.map(f => f.path), nextTempPath);
            currentVideoPath = nextTempPath;
            tempFilesToCleanup.push(nextTempPath);
        }

        // Step 2: Create Boomerang (if selected)
        if (isBoomerangActive) {
            sendProgress('🔄 Creating Boomerang...');
            const nextTempPath = path.join(outputsDir, `temp_boomerang_${Date.now()}.mp4`);
            await createBoomerang(currentVideoPath, nextTempPath);
            currentVideoPath = nextTempPath;
            tempFilesToCleanup.push(nextTempPath);
        }

        // Step 3: Single-pass editing (if any actions are selected)
        if (singlePassActions.length > 0) {
            sendProgress('✨ Applying edits & optimizing...');
            const nextTempPath = path.join(outputsDir, `temp_final_${Date.now()}.mp4`);
            await singlePassEdit(currentVideoPath, nextTempPath, singlePassActions, { speedFactor, trimStart, trimDuration });
            currentVideoPath = nextTempPath; 
            tempFilesToCleanup.push(nextTempPath);
        }

        sendProgress('✅ Finished! Preparing download...');
        
        res.download(currentVideoPath, `video_studio_${Date.now()}.mp4`, (err) => {
            if (err) console.error("Error during download:", err);
            if (jobId) progressEmitter.emit(`update-${jobId}`, '✅ Download complete!');
        });

    } catch (error: any) {
        console.error("Pipeline processing error:", error);
        if (jobId) progressEmitter.emit(`update-${jobId}`, '❌ Error processing video');
        if (!res.headersSent) res.status(500).send('Processing failed');
    } finally {
        setTimeout(() => {
            tempFilesToCleanup.forEach(filePath => {
                try {
                    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
                } catch (e) {}
            });
        }, 10000); 
    }
});

app.listen(PORT as number, '0.0.0.0', () => {
    console.log(`Server is running on port ${PORT}`);
});