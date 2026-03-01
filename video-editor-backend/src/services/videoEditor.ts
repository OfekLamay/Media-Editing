import ffmpeg from 'fluent-ffmpeg';
import path from 'path';

export const createBoomerang = (inputPath: string, outputPath: string): Promise<string> => {
    return new Promise((resolve, reject) => {
        console.log(`🎬 Processing boomerang video...`);

        ffmpeg(inputPath)
            .complexFilter([
                '[0:v]reverse[rev]',
                '[0:v][rev]concat=n=2:v=1:a=0[outv]'
            ])
            .outputOptions([
                '-map [outv]',
                '-r 30',             // CFR למניעת קרטועים
                '-c:v libx264',
                '-preset fast',
                '-crf 18'
            ])
            .output(outputPath)
            .on('end', () => {
                console.log(`✅ Success! Video processing completed. Ready for delivery.`);
                resolve(outputPath);
            })
            .on('error', (err: Error) => {
                console.error(`❌ Error processing video:`, err.message);
                reject(err);
            })
            .run();
    });
};