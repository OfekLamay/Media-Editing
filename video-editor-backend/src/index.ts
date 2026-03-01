import express from 'express';
import type { Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import cors from 'cors';

import { createBoomerang, removeAudio, reverseVideo, concatVideos, improveQuality } from './services/videoEditor';

const app = express();
app.use(cors());
const PORT = 3003;

const upload = multer({ dest: 'uploads/' });

const outputsDir = path.join(__dirname, '../outputs');
if (!fs.existsSync(outputsDir)) {
    fs.mkdirSync(outputsDir, { recursive: true });
}

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

app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
});