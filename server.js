const express = require('express');
const multer = require('multer');
const ffmpeg = require('fluent-ffmpeg');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

// Setup FFmpeg paths
function setupFfmpeg() {
  // Check if running in packaged Electron app
  const isPackaged = process.env.DATA_DIR && process.env.DATA_DIR.includes('Application Support');

  if (isPackaged) {
    // In packaged app, binaries are in Resources folder (next to app.asar)
    const resourcesPath = path.join(__dirname, '..');
    const ffmpegPath = path.join(resourcesPath, 'ffmpeg');
    const ffprobePath = path.join(resourcesPath, 'ffprobe');
    ffmpeg.setFfmpegPath(ffmpegPath);
    ffmpeg.setFfprobePath(ffprobePath);
    console.log('Using packaged FFmpeg:', ffmpegPath);
  } else {
    // In development, use ffmpeg-static
    try {
      execSync('which ffmpeg', { stdio: 'ignore' });
      console.log('Using system FFmpeg');
    } catch {
      const ffmpegPath = require('ffmpeg-static');
      const ffprobePath = require('ffprobe-static').path;
      ffmpeg.setFfmpegPath(ffmpegPath);
      ffmpeg.setFfprobePath(ffprobePath);
      console.log('Using bundled FFmpeg');
    }
  }
}
setupFfmpeg();

const app = express();
const PORT = process.env.PORT || 51234;

// Use DATA_DIR from Electron, or current directory for dev
const dataDir = process.env.DATA_DIR || '.';
const uploadsDir = path.join(dataDir, 'uploads');
const convertedDir = path.join(dataDir, 'converted');

// In-memory job storage
const jobs = new Map();

// Ensure directories exist
[uploadsDir, convertedDir].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// Multer setup for file uploads
const storage = multer.diskStorage({
  destination: uploadsDir,
  filename: (req, file, cb) => cb(null, `${uuidv4()}${path.extname(file.originalname)}`)
});

const upload = multer({
  storage,
  limits: { fileSize: 1024 * 1024 * 1024 }, // 1GB limit
  fileFilter: (req, file, cb) => {
    const allowed = ['.mp4', '.avi', '.mkv', '.webm', '.mov', '.m4v', '.flv', '.wmv'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Unsupported file format'));
    }
  }
});

// Serve static files (handle both dev and packaged app paths)
const publicPath = path.join(__dirname, 'public');
app.use(express.static(publicPath));

// POST /api/convert - Upload and start conversion
app.post('/api/convert', (req, res) => {
  upload.single('video')(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ error: true, message: 'File exceeds 1GB limit' });
      }
      return res.status(400).json({ error: true, message: err.message });
    }

    if (!req.file) {
      return res.status(400).json({ error: true, message: 'No valid video file uploaded' });
    }

    const jobId = uuidv4();
    const inputPath = req.file.path;
    const outputPath = path.join(convertedDir, `${jobId}.amv`);
    const originalName = path.basename(req.file.originalname, path.extname(req.file.originalname));

    jobs.set(jobId, {
      id: jobId,
      status: 'processing',
      progress: 0,
      inputPath,
      outputPath,
      originalName,
      error: null
    });

    // Start conversion asynchronously
    convertToAMV(inputPath, outputPath, jobId);

    res.json({ jobId, status: 'processing' });
  });
});

// GET /api/status/:jobId - Check conversion progress
app.get('/api/status/:jobId', (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job) {
    return res.status(404).json({ error: true, message: 'Job not found' });
  }
  res.json({
    jobId: job.id,
    status: job.status,
    progress: job.progress,
    error: job.error
  });
});

// POST /api/cancel/:jobId - Cancel conversion
app.post('/api/cancel/:jobId', (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job) {
    return res.status(404).json({ error: true, message: 'Job not found' });
  }
  if (job.command) {
    job.command.kill('SIGKILL');
  }
  job.status = 'cancelled';
  // Cleanup files
  if (job.inputPath) fs.unlink(job.inputPath, () => {});
  if (job.outputPath) fs.unlink(job.outputPath, () => {});
  jobs.delete(req.params.jobId);
  res.json({ success: true });
});

// GET /api/download/:jobId - Download converted file
app.get('/api/download/:jobId', (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job) {
    return res.status(404).json({ error: true, message: 'Job not found' });
  }
  if (job.status !== 'completed') {
    return res.status(400).json({ error: true, message: 'File not ready' });
  }

  const downloadName = `${job.originalName}.amv`;
  res.download(job.outputPath, downloadName, (err) => {
    if (!err) {
      // Schedule cleanup after download
      scheduleCleanup(req.params.jobId, 60000);
    }
  });
});

// Check if input file has audio stream
function hasAudioStream(inputPath) {
  return new Promise((resolve) => {
    ffmpeg.ffprobe(inputPath, (err, metadata) => {
      if (err) {
        resolve(false);
        return;
      }
      const hasAudio = metadata.streams.some(s => s.codec_type === 'audio');
      resolve(hasAudio);
    });
  });
}

// FFmpeg conversion function
async function convertToAMV(inputPath, outputPath, jobId) {
  const hasAudio = await hasAudioStream(inputPath);

  // AMV requires exactly 2 streams (video + audio)
  const cmd = ffmpeg(inputPath);

  // Add silent audio source if input has no audio
  if (!hasAudio) {
    cmd.input('anullsrc=r=22050:cl=mono').inputFormat('lavfi');
  }

  const outputOptions = [
    '-vf', 'scale=320:240:force_original_aspect_ratio=decrease,pad=320:240:(ow-iw)/2:(oh-ih)/2',
    '-r', '14',
    '-pix_fmt', 'yuvj420p',
    '-c:v', 'amv',
    '-c:a', 'adpcm_ima_amv',
    '-ac', '1',
    '-ar', '22050',
    '-block_size', '1575'
  ];

  if (!hasAudio) {
    outputOptions.push('-shortest');
  }

  // Store command reference for cancellation
  const job = jobs.get(jobId);
  if (job) {
    job.command = cmd;
  }

  cmd.outputOptions(outputOptions)
    .output(outputPath)
    .on('progress', (progress) => {
      const job = jobs.get(jobId);
      if (job) {
        job.progress = Math.round(progress.percent || 0);
      }
    })
    .on('end', () => {
      const job = jobs.get(jobId);
      if (job) {
        job.status = 'completed';
        job.progress = 100;
        // Cleanup input file
        fs.unlink(inputPath, () => {});
        // Schedule final cleanup after 1 hour
        scheduleCleanup(jobId, 3600000);
      }
    })
    .on('error', (err, stdout, stderr) => {
      console.error('FFmpeg error:', err.message);
      console.error('FFmpeg stderr:', stderr);
      const job = jobs.get(jobId);
      if (job) {
        job.status = 'error';
        job.error = 'Conversion failed. The file may be corrupted or use an unsupported codec.';
      }
      fs.unlink(inputPath, () => {});
    })
    .run();
}

// Cleanup function
function scheduleCleanup(jobId, delay) {
  setTimeout(() => {
    const job = jobs.get(jobId);
    if (job) {
      if (job.inputPath) fs.unlink(job.inputPath, () => {});
      if (job.outputPath) fs.unlink(job.outputPath, () => {});
      jobs.delete(jobId);
    }
  }, delay);
}

app.listen(PORT, () => {
  console.log(`AMV Converter running on http://localhost:${PORT}`);
});
