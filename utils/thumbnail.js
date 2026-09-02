const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs');

/**
 * Generate a thumbnail from a video file.
 * Extracts a single frame at 25% of the video duration.
 *
 * @param {string} videoPath - Absolute path to the video file
 * @param {string} thumbnailFilename - Desired thumbnail filename (e.g., "uuid.jpg")
 * @returns {Promise<{thumbnailPath: string, duration: number}>}
 */
function generateThumbnail(videoPath, thumbnailFilename) {
  const thumbnailDir = path.join(__dirname, '..', 'uploads', 'thumbnails');
  const thumbnailPath = path.join(thumbnailDir, thumbnailFilename);

  return new Promise((resolve, reject) => {
    // First, get the video duration
    ffmpeg.ffprobe(videoPath, (err, metadata) => {
      if (err) {
        console.warn('FFprobe failed (FFmpeg may not be installed):', err.message);
        // Return without thumbnail — graceful fallback
        return resolve({ thumbnailPath: null, duration: null });
      }

      const duration = metadata.format.duration || 0;
      const seekTime = Math.max(0, duration * 0.25); // 25% into the video

      ffmpeg(videoPath)
        .seekInput(seekTime)
        .frames(1)
        .size('640x360')
        .output(thumbnailPath)
        .on('end', () => {
          resolve({
            thumbnailPath: `thumbnails/${thumbnailFilename}`,
            duration: duration,
          });
        })
        .on('error', (ffmpegErr) => {
          console.warn('Thumbnail generation failed:', ffmpegErr.message);
          // Graceful fallback — return duration if we got it
          resolve({ thumbnailPath: null, duration: duration });
        })
        .run();
    });
  });
}

/**
 * Get video duration only (without generating thumbnail).
 * @param {string} videoPath
 * @returns {Promise<number|null>}
 */
function getVideoDuration(videoPath) {
  return new Promise((resolve) => {
    ffmpeg.ffprobe(videoPath, (err, metadata) => {
      if (err) {
        console.warn('FFprobe failed:', err.message);
        return resolve(null);
      }
      resolve(metadata.format.duration || null);
    });
  });
}

module.exports = { generateThumbnail, getVideoDuration };
