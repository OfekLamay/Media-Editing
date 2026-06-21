import express from 'express';
import type { Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import cors from 'cors';
import { EventEmitter } from 'events';

import { createBoomerang, removeAudio, reverseVideo, concatVideos, improveQuality, changeSpeed, trimVideo } from './services/videoEditor';

const app = express();
app.use(cors());
const PORT = process.env.PORT || 3003;

// Set up multer for file uploads, specifying the destination and filename format
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        // Extract the file extension from the original filename
        const ext = path.extname(file.originalname);
        // Create a unique filename that includes the extension
        const uniqueName = `video-${Date.now()}-${Math.round(Math.random() * 1E9)}${ext}`;
        cb(null, uniqueName);
    }
});

const upload = multer({ storage: storage });

const progressEmitter = new EventEmitter();

const outputsDir = path.join(__dirname, '../outputs');
if (!fs.existsSync(outputsDir)) {
    fs.mkdirSync(outputsDir, { recursive: true });
}

app.get('/api/video/progress', (req: Request, res: Response) => {
    // Keep the connection open for SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const onProgress = (msg: string) => {
        // SSE format: "data: message\n\n"
        res.write(`data: ${msg}\n\n`);
    };

    // Listen for progress updates and send them to the client
    progressEmitter.on('update', onProgress);

    // Cleanup when the client disconnects
    req.on('close', () => {
        progressEmitter.off('update', onProgress);
    });
});

app.post('/api/video/boomerang', upload.single('video'), async (req: Request, res: Response): Promise<void> => {
    try {
        if (!req.file) {
            res.status(400).json({ error: 'No video file uploaded.' });
            return;
        }

        const inputVideoPath = req.file.path; 
        const outputFileName = `boomerang_${Date.now()}.mp4`;
        const outputVideoPath = path.join(outputsDir, outputFileName);

        await createBoomerang(inputVideoPath, outputVideoPath);

        res.download(outputVideoPath, outputFileName, (err) => {
            if (err) {
                console.error('Error sending file to client:', err);
            }
            
            try {
                fs.unlinkSync(inputVideoPath);
                fs.unlinkSync(outputVideoPath);
            } catch (cleanupErr) {
                console.error('Error deleting temporary files:', cleanupErr);
            }
        });

    } catch (error) {
        console.error('Error in boomerang creation:', error);
        res.status(500).json({ error: 'An error occurred while editing the video on the server.' });
    }
});

app.post('/api/video/remove-audio', upload.single('video'), async (req: Request, res: Response): Promise<void> => {
    try {
        if (!req.file) {
            res.status(400).json({ error: 'No video file uploaded.' });
            return;
        }

        const inputVideoPath = req.file.path; 
        const outputFileName = `no_audio_${Date.now()}.mp4`;
        const outputVideoPath = path.join(outputsDir, outputFileName);

        await removeAudio(inputVideoPath, outputVideoPath);

        res.download(outputVideoPath, outputFileName, (err) => {
            if (err) {
                console.error('Error sending file to client:', err);
            }
            
            try {
                fs.unlinkSync(inputVideoPath);
                fs.unlinkSync(outputVideoPath);
            } catch (cleanupErr) {
                console.error('Error deleting temporary files:', cleanupErr);
            }
        });

    } catch (error) {
        console.error('Error in audio removal:', error);
        res.status(500).json({ error: 'An error occurred while removing audio on the server.' });
    }
});

app.post('/api/video/reverse', upload.single('video'), async (req: Request, res: Response): Promise<void> => {
    try {
        if (!req.file) {
            res.status(400).json({ error: 'No video file uploaded.' });
            return;
        }

        const inputVideoPath = req.file.path; 
        const outputFileName = `reversed_${Date.now()}.mp4`;
        const outputVideoPath = path.join(outputsDir, outputFileName);

        await reverseVideo(inputVideoPath, outputVideoPath);

        res.download(outputVideoPath, outputFileName, (err) => {
            if (err) {
                console.error('Error sending file to client:', err);
            }
            
            try {
                fs.unlinkSync(inputVideoPath);
                fs.unlinkSync(outputVideoPath);
            } catch (cleanupErr) {
                console.error('Error deleting temporary files:', cleanupErr);
            }
        });

    } catch (error) {
        console.error('Error in reversing video:', error);
        res.status(500).json({ error: 'An error occurred while reversing the video on the server.' });
    }
});

app.post('/api/video/concat', upload.array('videos', 10), async (req: Request, res: Response): Promise<void> => {
    try {
        const files = req.files as Express.Multer.File[];
        
        if (!files || files.length < 2) {
            res.status(400).json({ error: 'Please upload at least 2 videos to concatenate.' });
            return;
        }

        const inputPaths = files.map(file => file.path); 
        const outputFileName = `concatenated_${Date.now()}.mp4`;
        const outputVideoPath = path.join(outputsDir, outputFileName);

        await concatVideos(inputPaths, outputVideoPath);

        res.download(outputVideoPath, outputFileName, (err) => {
            if (err) {
                console.error('Error sending file to client:', err);
            }
            
            try {
                inputPaths.forEach(p => fs.unlinkSync(p));
                fs.unlinkSync(outputVideoPath);
            } catch (cleanupErr) {
                console.error('Error deleting temporary files:', cleanupErr);
            }
        });

    } catch (error) {
        console.error('Error in concatenating videos:', error);
        res.status(500).json({ error: 'An error occurred while concatenating the videos on the server.' });
    }
});

app.post('/api/video/improve', upload.single('video'), async (req: Request, res: Response): Promise<void> => {
    try {
        if (!req.file) {
            res.status(400).json({ error: 'No video file uploaded.' });
            return;
        }

        const inputVideoPath = req.file.path; 
        const outputFileName = `improved_${Date.now()}.mp4`;
        const outputVideoPath = path.join(outputsDir, outputFileName);

        await improveQuality(inputVideoPath, outputVideoPath);

        res.download(outputVideoPath, outputFileName, (err) => {
            if (err) {
                console.error('Error sending file to client:', err);
            }
            
            try {
                fs.unlinkSync(inputVideoPath);
                fs.unlinkSync(outputVideoPath);
            } catch (cleanupErr) {
                console.error('Error deleting temporary files:', cleanupErr);
            }
        });

    } catch (error) {
        console.error('Error in improving video quality:', error);
        res.status(500).json({ error: 'An error occurred while improving the video on the server.' });
    }
});


app.post('/api/video/pipeline', upload.array('videos', 10), async (req: Request, res: Response): Promise<void> => {
    const tempFilesToCleanup: string[] = [];

    // Dictionary to map action names to user-friendly messages for progress updates
    const actionNames: Record<string, string> = {
        'boomerang': 'Creating boomerang 🔄',
        'reverse': 'Reversing video ⏪',
        'remove-audio': 'Removing audio 🔇',
        'improve': 'Improving quality ✨',
        'speed': 'Changing speed ⏱️',
        'trim': 'Trimming video ✂️'
    };

    try {
        const files = req.files as Express.Multer.File[];
        const actions: string[] = JSON.parse(req.body.actions || '[]');

        if (!files || files.length === 0) {
            res.status(400).json({ error: 'No video files uploaded.' });
            return;
        }
        if (actions.length === 0) {
            res.status(400).json({ error: 'No actions selected.' });
            return;
        }

        files.forEach(f => tempFilesToCleanup.push(f.path));
        let currentVideoPath = files[0]!.path;

        progressEmitter.emit('update', 'Starting to process the files... ⏳');

        if (actions.includes('concat')) {
            if (files.length < 2) {
                res.status(400).json({ error: 'Need at least 2 files to concat.' });
                return;
            }
            
            progressEmitter.emit('update', 'Concatenating videos... 🔗');
            const nextTempPath = path.join(outputsDir, `temp_concat_${Date.now()}.mp4`);
            const inputPaths = files.map(f => f.path);
            await concatVideos(inputPaths, nextTempPath);
            
            currentVideoPath = nextTempPath;
            tempFilesToCleanup.push(nextTempPath);
            actions.splice(actions.indexOf('concat'), 1);
        }

        // Get additional parameters for speed and trim actions, if they exist
        const speedFactor = parseFloat(req.body.speedFactor) || 1.5; 
        const trimStart = parseFloat(req.body.trimStart) || 0;
        const trimDuration = parseFloat(req.body.trimDuration) || 5;

        for (const action of actions) {
            const nextTempPath = path.join(outputsDir, `temp_${action}_${Date.now()}.mp4`);
            
            // Show user-friendly progress message based on the action being performed
            progressEmitter.emit('update', `${actionNames[action] || action}...`);

            if (action === 'boomerang') await createBoomerang(currentVideoPath, nextTempPath);
            else if (action === 'reverse') await reverseVideo(currentVideoPath, nextTempPath);
            else if (action === 'remove-audio') await removeAudio(currentVideoPath, nextTempPath);
            else if (action === 'improve') await improveQuality(currentVideoPath, nextTempPath);
            else if (action === 'speed') await changeSpeed(currentVideoPath, nextTempPath, speedFactor);
            else if (action === 'trim') await trimVideo(currentVideoPath, nextTempPath, trimStart, trimDuration);

            currentVideoPath = nextTempPath; 
            tempFilesToCleanup.push(nextTempPath);
        }

        progressEmitter.emit('update', 'Preparing the final file for download... 📦');
        const finalFileName = `final_video_${Date.now()}.mp4`;
        
        res.download(currentVideoPath, finalFileName, (err) => {
            if (err) console.error('Error sending file:', err);
            
            tempFilesToCleanup.forEach(filePath => {
                try {
                    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
                } catch (cleanupErr) {
                    console.error(`Error deleting temp file ${filePath}:`, cleanupErr);
                }
            });
        });

    } catch (error) {
        console.error('Error in processing pipeline:', error);
        progressEmitter.emit('update', '❌ An error occurred in the processing pipeline.');
        res.status(500).json({ error: 'An error occurred during the video processing pipeline.' });
        
        tempFilesToCleanup.forEach(filePath => {
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
});