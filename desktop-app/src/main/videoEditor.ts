
import ffmpeg from 'fluent-ffmpeg';

import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';

// Set the path to the ffmpeg binary provided by the installer package
ffmpeg.setFfmpegPath(ffmpegInstaller.path);

export const createBoomerang = (inputPath: string, outputPath: string): Promise<string> => {
    return new Promise((resolve, reject) => {
        console.log(`🎬 Processing boomerang video...`);

        ffmpeg(inputPath)
            .complexFilter([
                // Deconstructing the boomerang effect into clear steps:
                // Create two streams from the input video: one for the normal version and one for the reversed version
                '[0:v]split=2[v1][v2]',
                // Reverse the second stream to create the boomerang effect
                '[v2]reverse[rev]',
                // Add the original and reversed streams together in sequence (concat) to create the final output
                '[v1][rev]concat=n=2:v=1:a=0[outv]'
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
            .on('start', (commandLine) => {
                // Log the full FFmpeg command for debugging purposes
                console.log('🚀 Executing FFmpeg Command:', commandLine);
            })
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
        
        // Add all input files to the command
        inputPaths.forEach(path => {
            command.addInput(path);
        });

        // Building a complex filter to normalize resolution and frame rate for all videos before concatenation
        const complexFilter: string[] = [];
        let concatInputs = '';

        inputPaths.forEach((_, i) => {
            // Normalize each video stream: scale to 1920x1080 while maintaining aspect ratio, 
            // pad if necessary, set sample aspect ratio to 1, and ensure a consistent frame rate of 30fps
            complexFilter.push(`[${i}:v]scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30[v${i}]`);
            // Normalize each audio stream: resample to a consistent sample rate of 48000Hz
            complexFilter.push(`[${i}:a]aresample=48000[a${i}]`);
            
            // Collect the names of the normalized streams for concatenation
            concatInputs += `[v${i}][a${i}]`;
        });

        // Perform the concatenation itself on the normalized streams
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