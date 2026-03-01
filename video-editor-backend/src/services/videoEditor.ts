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

export const concatVideos = (inputPaths: string[], outputPath: string): Promise<string> => {
    return new Promise((resolve, reject) => {
        console.log(`🔗 Concatenating ${inputPaths.length} videos...`);

        const command = ffmpeg();

        inputPaths.forEach(path => {
            command.addInput(path);
        });

        let filterInputs = '';
        for (let i = 0; i < inputPaths.length; i++) {
            filterInputs += `[${i}:v][${i}:a]`;
        }

        command
            .complexFilter([
                `${filterInputs}concat=n=${inputPaths.length}:v=1:a=1[outv][outa]`
            ])
            .outputOptions([
                '-map [outv]',
                '-map [outa]',
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
                console.log(`✅ Success! Videos concatenated. Ready for delivery.`);
                resolve(outputPath);
            })
            .on('error', (err: Error) => {
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