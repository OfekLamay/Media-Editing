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
                '-threads 1',
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
        console.log(`🔗 Concatenating ${inputPaths.length} videos with resolution normalization...`);

        const command = ffmpeg();
        
        // 1. Add all input videos to the command
        inputPaths.forEach(path => {
            command.addInput(path);
        });

        // 2. Build the complex filter to normalize resolution and concatenate
        const complexFilter: string[] = [];
        let concatInputs = '';

        inputPaths.forEach((_, i) => {
            // Normalize each video stream: resize to 1920x1080, add black borders if needed to prevent distortion, and set frame rate to 30FPS
            complexFilter.push(`[${i}:v]scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30[v${i}]`);
            // Normalize each audio stream: resample to a consistent sample rate of 48000Hz
            complexFilter.push(`[${i}:a]aresample=48000[a${i}]`);
            
            // Collect the names of the normalized streams for concatenation
            concatInputs += `[v${i}][a${i}]`;
        });

        // The concatenation operation itself on the normalized streams
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

export const changeSpeed = (inputPath: string, outputPath: string, speedFactor: number): Promise<string> => {
    return new Promise((resolve, reject) => {
        console.log(`⏱️ Changing video speed to ${speedFactor}x...`);
        
        // Make the video faster by reducing the presentation timestamp (PTS) of each frame, 
        // and adjust the audio speed using atempo filter
        const videoPts = 1 / speedFactor;

        ffmpeg(inputPath)
            // Change video speed
            .videoFilters(`setpts=${videoPts}*PTS`)
            // Change audio speed
            .audioFilters(`atempo=${speedFactor}`)
            .outputOptions([
                '-c:v libx264',
                '-preset fast',
                '-crf 18'
            ])
            .output(outputPath)
            .on('end', () => {
                console.log(`✅ Success! Speed changed to ${speedFactor}x.`);
                resolve(outputPath);
            })
            .on('error', (err: Error) => {
                console.error(`❌ Error changing speed:`, err.message);
                reject(err);
            })
            .run();
    });
};

export const trimVideo = (inputPath: string, outputPath: string, startTime: number, duration: number): Promise<string> => {
    return new Promise((resolve, reject) => {
        console.log(`✂️ Trimming video: starting at ${startTime}s for ${duration}s...`);

        ffmpeg(inputPath)
            // Change the start time of the video
            .setStartTime(startTime)
            // Change the duration of the video
            .setDuration(duration)
            .outputOptions([
                '-c:v libx264',
                '-preset fast',
                '-crf 18',
                '-c:a aac'
            ])
            .output(outputPath)
            .on('end', () => {
                console.log(`✅ Success! Video trimmed.`);
                resolve(outputPath);
            })
            .on('error', (err: Error) => {
                console.error(`❌ Error trimming video:`, err.message);
                reject(err);
            })
            .run();
    });
};