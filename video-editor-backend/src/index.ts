import express from 'express';
import type { Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import cors from 'cors';
import { EventEmitter } from 'events';

import { createBoomerang, removeAudio, reverseVideo, concatVideos, improveQuality } from './services/videoEditor';

const app = express();
app.use(cors());
const PORT = 3003;

const upload = multer({ dest: 'uploads/' });

const progressEmitter = new EventEmitter();

const outputsDir = path.join(__dirname, '../outputs');
if (!fs.existsSync(outputsDir)) {
    fs.mkdirSync(outputsDir, { recursive: true });
}

// --- נתיב חדש: שידור עדכונים בזמן אמת (SSE) ---
app.get('/api/video/progress', (req: Request, res: Response) => {
    // הגדרות חובה כדי להשאיר את החיבור פתוח ולהזרים טקסט
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const onProgress = (msg: string) => {
        // SSE דורש פורמט ספציפי: data: [message] \n\n
        res.write(`data: ${msg}\n\n`);
    };

    // מאזינים לאירועי 'update'
    progressEmitter.on('update', onProgress);

    // כשהלקוח סוגר את החיבור, מנקים את המאזין כדי למנוע דליפת זיכרון
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

// --- הראוט המשולב (Pipeline) המעודכן ---
app.post('/api/video/pipeline', upload.array('videos', 10), async (req: Request, res: Response): Promise<void> => {
    const tempFilesToCleanup: string[] = [];

    // מילון נתונים קטן לתרגום הפעולות לעברית עבור הודעות ההתקדמות
    const actionNames: Record<string, string> = {
        'boomerang': 'מייצר בומרנג 🔄',
        'reverse': 'הופך את הסרטון ⏪',
        'remove-audio': 'מסיר את פס הקול 🔇',
        'improve': 'משפר איכות ורזולוציה ✨'
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

        progressEmitter.emit('update', 'מתחיל לעבד את הקבצים... ⏳');

        if (actions.includes('concat')) {
            if (files.length < 2) {
                res.status(400).json({ error: 'Need at least 2 files to concat.' });
                return;
            }
            
            progressEmitter.emit('update', 'מחבר את הסרטונים למקשה אחת 🔗...');
            const nextTempPath = path.join(outputsDir, `temp_concat_${Date.now()}.mp4`);
            const inputPaths = files.map(f => f.path);
            await concatVideos(inputPaths, nextTempPath);
            
            currentVideoPath = nextTempPath;
            tempFilesToCleanup.push(nextTempPath);
            actions.splice(actions.indexOf('concat'), 1);
        }

        for (const action of actions) {
            const nextTempPath = path.join(outputsDir, `temp_${action}_${Date.now()}.mp4`);
            
            // שידור הודעת ההתקדמות לפני תחילת הפעולה!
            progressEmitter.emit('update', `${actionNames[action] || action}...`);

            if (action === 'boomerang') await createBoomerang(currentVideoPath, nextTempPath);
            else if (action === 'reverse') await reverseVideo(currentVideoPath, nextTempPath);
            else if (action === 'remove-audio') await removeAudio(currentVideoPath, nextTempPath);
            else if (action === 'improve') await improveQuality(currentVideoPath, nextTempPath);

            currentVideoPath = nextTempPath; 
            tempFilesToCleanup.push(nextTempPath);
        }

        progressEmitter.emit('update', 'אורז את הקובץ הסופי להורדה... 📦');
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
        progressEmitter.emit('update', '❌ אירעה שגיאה בתהליך.');
        res.status(500).json({ error: 'An error occurred during the video processing pipeline.' });
        
        tempFilesToCleanup.forEach(filePath => {
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
});