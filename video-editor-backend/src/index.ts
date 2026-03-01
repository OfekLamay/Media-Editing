import express from 'express';
import type { Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { createBoomerang } from './services/videoEditor';
import cors from 'cors';

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

app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
});