import ffmpeg from 'fluent-ffmpeg';
import path from 'path';

import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import ffprobeInstaller from '@ffprobe-installer/ffprobe';

ffmpeg.setFfmpegPath(ffmpegInstaller.path);
ffmpeg.setFfprobePath(ffprobeInstaller.path);

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
                '-vsync 1', '-async 1',
                '-c:v libx264',
                '-preset veryfast',
                '-crf 23'
            ])
            .output(outputPath)
            .on('end', () => resolve(outputPath))
            .on('error', (err: Error) => reject(err))
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
        
        inputPaths.forEach(path => command.addInput(path));

        const complexFilter: string[] = [];
        let concatInputs = '';

        inputPaths.forEach((_, i) => {
            complexFilter.push(`[${i}:v]scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30[v${i}]`);
            complexFilter.push(`[${i}:a]aresample=48000[a${i}]`);
            concatInputs += `[v${i}][a${i}]`;
        });

        complexFilter.push(`${concatInputs}concat=n=${inputPaths.length}:v=1:a=1[outv][outa]`);

        command.complexFilter(complexFilter)
            .outputOptions([
                '-map [outv]', '-map [outa]',
                '-c:v libx264',
                '-preset veryfast', 
                '-crf 23',          
                '-pix_fmt yuv420p',
                '-c:a aac', '-b:a 192k'
            ])
            .output(outputPath)
            .on('end', () => resolve(outputPath))
            .on('error', (err: any) => reject(err))
            .run();
    });
};

export const improveQuality = (inputPath: string, outputPath: string): Promise<string> => {
    return new Promise((resolve, reject) => {
        console.log(`✨ Improving video quality and transcoding...`);

        ffmpeg(inputPath)
            .outputOptions([
                '-c:v libx264',
                '-crf 23',
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
        console.log(`⏱️ Checking audio streams for speed change...`);

        ffmpeg.ffprobe(inputPath, (err, metadata) => {
            if (err) {
                console.error("❌ Error probing video:", err);
                return reject(err);
            }

            // 1. Check if the video has an audio stream
            const hasAudio = metadata.streams.some(stream => stream.codec_type === 'audio');
            console.log(`⏱️ Audio track detected: ${hasAudio}. Changing speed to ${speedFactor}x...`);

            const videoPts = 1 / speedFactor;
            
            // 2. Build the ffmpeg command with appropriate filters based on whether audio is present
            let command = ffmpeg(inputPath).videoFilters(`setpts=${videoPts}*PTS`);

            // 3. Add audio filter only if the video has an audio stream
            if (hasAudio) {
                command = command.audioFilters(`atempo=${speedFactor}`);
            }

            // 4. Resulting output options for both cases (with or without audio)
            command.outputOptions([
                '-c:v libx264',
                '-crf 23',
                '-pix_fmt yuv420p' // Support for a wide range of players
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
        
    });
};

export const trimVideo = (inputPath: string, outputPath: string, startTime: number, duration: number): Promise<string> => {
    return new Promise((resolve, reject) => {
        console.log(`✂️ Trimming video: starting at ${startTime}s for ${duration}s...`);

        ffmpeg(inputPath)
            .setStartTime(startTime)
            .setDuration(duration)
            .outputOptions([
                '-c:v libx264',
                '-crf 23',
                '-c:a aac',
                '-pix_fmt yuv420p' // Support for a wide range of players
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

export const singlePassEdit = (inputPath: string, outputPath: string, actions: string[], 
    params: { speedFactor: number, trimStart: number, trimDuration: number }
): Promise<string> => {
    return new Promise((resolve, reject) => {
        console.log(`🚀 Starting Single-Pass Edit for: ${actions.join(', ')}`);

        let command = ffmpeg(inputPath);
        let videoFilters: string[] = [];
        let audioFilters: string[] = [];
        let removeAudio = actions.includes('remove-audio');

        // 1. Add trim filter if requested
        if (actions.includes('trim')) {
            videoFilters.push(`trim=start=${params.trimStart}:duration=${params.trimDuration},setpts=PTS-STARTPTS`);
            if (!removeAudio) {
                audioFilters.push(`atrim=start=${params.trimStart}:duration=${params.trimDuration},asetpts=PTS-STARTPTS`);
            }
        }

        // 2. Add speed change filter if requested
        if (actions.includes('speed')) {
            videoFilters.push(`setpts=${1/params.speedFactor}*PTS`);
            if (!removeAudio) {
                audioFilters.push(`atempo=${params.speedFactor}`);
            }
        }

        // 3. Add reverse filter if requested
        if (actions.includes('reverse')) {
            videoFilters.push('reverse');
            if (!removeAudio) {
                audioFilters.push('areverse');
            }
        }

        // Build the filter string
        if (videoFilters.length > 0) command.videoFilters(videoFilters.join(','));
        
        if (removeAudio) {
            command.noAudio();
        } else if (audioFilters.length > 0) {
            command.audioFilters(audioFilters.join(','));
        }

        command.outputOptions([
            '-c:v libx264',
            '-preset veryfast',
            '-crf 23',
            '-pix_fmt yuv420p',
            '-movflags +faststart' // Optimized for fast streaming over the internet
        ]);

        if (!removeAudio) {
            command.outputOptions(['-c:a aac', '-b:a 192k', '-ar 48000']);
        }

        command.output(outputPath)
            .on('end', () => {
                console.log('✅ Single-Pass Edit completed!');
                resolve(outputPath);
            })
            .on('error', (err: Error) => reject(err))
            .run();
    });
};