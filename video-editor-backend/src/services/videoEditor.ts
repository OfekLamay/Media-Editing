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
                '-pix_fmt yuv420p',
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
    return new Promise(async (resolve, reject) => {
        
        console.log(`🔗 Concatenating ${inputPaths.length} videos...`);
        const command = ffmpeg();
        // To avoid audio error, check if there is a video without audio
        const metadataList = await Promise.all(inputPaths.map(p => getVideoMetadata(p)));
        // Use the dimensions of the first video as the target for scaling
        const targetWidth = metadataList[0].width;
        const targetHeight = metadataList[0].height;
        const targetFps = metadataList[0].fps;

        const allHaveAudio = metadataList.every(m => m.hasAudio);
        const complexFilter: string[] = [];
        let concatInputs = '';

        inputPaths.forEach((filePath, i) => {
            command.input(filePath);
            
            complexFilter.push(`[${i}:v]scale=${targetWidth}:${targetHeight}:force_original_aspect_ratio=decrease,
                pad=${targetWidth}:${targetHeight}:(ow-iw)/2:(oh-ih)/2,setsar=1,
                fps=${targetFps}[v${i}]`);
            
            // If all videos have audio, use the audio streams; otherwise, only use video streams
            if (allHaveAudio) {
                complexFilter.push(`[${i}:a]aresample=48000[a${i}]`);
                concatInputs += `[v${i}][a${i}]`;
            } else {
                concatInputs += `[v${i}]`;
            }
        });

        if (allHaveAudio) {
            complexFilter.push(`${concatInputs}concat=n=${inputPaths.length}:v=1:a=1[outv][outa]`);
            command.outputOptions(['-map [outv]', '-map [outa]', '-c:a aac', '-b:a 192k']);
        } else {
            complexFilter.push(`${concatInputs}concat=n=${inputPaths.length}:v=1:a=0[outv]`);
            command.outputOptions(['-map [outv]']);
        }

        command.complexFilter(complexFilter)
            .outputOptions([
                '-c:v libx264',
                '-preset veryfast', 
                '-crf 23',          
                '-pix_fmt yuv420p'
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

        // Note: 'atempo' filter only accepts values between 0.5 and 100.
        // If a speed < 0.5 is ever needed (e.g. 0.25x), multiple atempo filters must be chained (atempo=0.5,atempo=0.5).
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

const getVideoMetadata = (filePath: string): Promise<{width: number, height: number, hasAudio: boolean, fps: string}> => {
    return new Promise((resolve) => {
        ffmpeg.ffprobe(filePath, (err, metadata) => {
            // Check the fps, height and width of the video stream, and whether it has an audio stream
            if (err) {
                console.warn("Could not read metadata, falling back to 1080x1920, 30fps", err);
                return resolve({ width: 1080, height: 1920, hasAudio: true, fps: '30' }); 
            }
            
            const videoStream = metadata.streams.find(s => s.codec_type === 'video');
            const hasAudio = metadata.streams.some(s => s.codec_type === 'audio'); 
            
            if (videoStream) {
                let width = videoStream.width || 1080;
                let height = videoStream.height || 1920;
                const fps = videoStream.r_frame_rate || '30';
                
                const rotation = videoStream.tags?.rotate || videoStream.tags?.ROTATE;
                if (rotation === '90' || rotation === '270') {
                    [width, height] = [height, width];
                }
                resolve({ width, height, hasAudio, fps });
            } else {
                resolve({ width: 1080, height: 1920, hasAudio, fps: '30' });
            }
        });
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
        const crfValue = actions.includes('improve') ? '18' : '23';

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
            `-crf ${crfValue}`,
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