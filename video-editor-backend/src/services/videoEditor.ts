import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import { stderr } from 'process';

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
                '-vsync 1',
                '-async 1',
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

export const removeAudio = (inputPath: string, outputPath: string): Promise<string> => {
    return new Promise((resolve, reject) => {
        console.log(`🔇 Removing audio from video...`);

        ffmpeg(inputPath)
            .noAudio()
            .videoCodec('copy')
            .output(outputPath)
            .on('end', () => {
                console.log(`✅ Success! Audio removed. Ready for delivery.`);
                resolve(outputPath);
            })
            .on('error', (err: Error) => {
                console.error(`❌ Error removing audio:`, err.message);
                reject(err);
            })
            .run();
    });
};

export const reverseVideo = (inputPath: string, outputPath: string): Promise<string> => {
    return new Promise((resolve, reject) => {
        console.log(`⏪ Reversing video...`);

        ffmpeg(inputPath)
            .videoFilters('reverse')
            .audioFilters('areverse')
            .outputOptions([
                '-vsync 1',
                '-async 1',
                '-c:v libx264',
                '-preset fast',
                '-crf 18',
                '-pix_fmt yuv420p',
                '-c:a aac',
                '-b:a 192k'
            ])
            .output(outputPath)
            .on('end', () => {
                console.log(`✅ Success! Video reversed. Ready for delivery.`);
                resolve(outputPath);
            })
            .on('error', (err: Error) => {
                console.error(`❌ Error reversing video:`, err.message);
                reject(err);
            })
            .run();
    });
};

// פונקציה לחיבור מספר סרטונים יחד (עם נרמול רזולוציה אוטומטי)
export const concatVideos = (inputPaths: string[], outputPath: string): Promise<string> => {
    return new Promise((resolve, reject) => {
        console.log(`🔗 Concatenating ${inputPaths.length} videos with resolution normalization...`);

        const command = ffmpeg();
        
        // 1. הוספת כל הקבצים כ-inputs
        inputPaths.forEach(path => {
            command.addInput(path);
        });

        // 2. בניית שרשור הפילטרים הדינמי
        const complexFilter: string[] = [];
        let concatInputs = '';

        inputPaths.forEach((_, i) => {
            // מנרמלים כל ערוץ וידאו: שינוי גודל ל-1920x1080, הוספת שוליים שחורים אם צריך למניעת עיוות, וקביעת 30FPS
            complexFilter.push(`[${i}:v]scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30[v${i}]`);
            // מנרמלים כל ערוץ אודיו: המרה לתדר דגימה אחיד של 48000Hz
            complexFilter.push(`[${i}:a]aresample=48000[a${i}]`);
            
            // אוספים את השמות של הערוצים המנורמלים לקראת החיבור
            concatInputs += `[v${i}][a${i}]`;
        });

        // פעולת החיבור עצמה על הערוצים המנורמלים
        complexFilter.push(`${concatInputs}concat=n=${inputPaths.length}:v=1:a=1[outv][outa]`);

        command
            .complexFilter(complexFilter)
            .outputOptions([
                '-map [outv]',
                '-map [outa]',
                '-c:v libx264',
                '-preset fast',
                '-crf 18',
                '-pix_fmt yuv420p',
                '-c:a aac',
                '-b:a 192k'
            ])
            .output(outputPath)
            .on('end', () => {
                console.log(`✅ Success! Videos concatenated. Ready for delivery.`);
                resolve(outputPath);
            })
            .on('error', (err: any) => {
                console.error(`❌ Error concatenating videos:`, err.message);
                reject(err);
            })
            .run();
    });
};

export const improveQuality = (inputPath: string, outputPath: string): Promise<string> => {
    return new Promise((resolve, reject) => {
        console.log(`✨ Improving video quality and transcoding...`);

        ffmpeg(inputPath)
            .outputOptions([
                '-c:v libx264',
                '-preset slow',
                '-crf 17',
                '-profile:v high',
                '-level 4.2',
                '-pix_fmt yuv420p',
                '-c:a aac',
                '-b:a 192k',
                '-ar 48000',
                '-movflags +faststart'
            ])
            .output(outputPath)
            .on('end', () => {
                console.log(`✅ Success! Quality improved. Ready for delivery.`);
                resolve(outputPath);
            })
            .on('error', (err: Error) => {
                console.error(`❌ Error improving quality:`, err.message);
                reject(err);
            })
            .run();
    });
};