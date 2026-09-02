const express = require('express');
const path = require('path');
const fs = require('fs');
const { body, validationResult } = require('express-validator');
const db = require('../config/database');
const { requireAuth, requireOwnerOrAdmin } = require('../middleware/auth');
const { videoUpload } = require('../middleware/upload');
const { generateThumbnail } = require('../utils/thumbnail');

const router = express.Router();

// ── GET /videos — Homepage feed ──
router.get('/', requireAuth, (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = 12;
  const offset = (page - 1) * limit;
  const search = req.query.search || '';

  let videos, totalCount;

  if (search) {
    videos = db.prepare(`
      SELECT v.*, u.username, u.avatar
      FROM videos v
      JOIN users u ON v.user_id = u.id
      WHERE v.visibility = 'public'
        AND (v.title LIKE ? OR v.description LIKE ?)
      ORDER BY v.created_at DESC
      LIMIT ? OFFSET ?
    `).all(`%${search}%`, `%${search}%`, limit, offset);

    totalCount = db.prepare(`
      SELECT COUNT(*) as count FROM videos
      WHERE visibility = 'public'
        AND (title LIKE ? OR description LIKE ?)
    `).get(`%${search}%`, `%${search}%`).count;
  } else {
    videos = db.prepare(`
      SELECT v.*, u.username, u.avatar
      FROM videos v
      JOIN users u ON v.user_id = u.id
      WHERE v.visibility = 'public'
      ORDER BY v.created_at DESC
      LIMIT ? OFFSET ?
    `).all(limit, offset);

    totalCount = db.prepare("SELECT COUNT(*) as count FROM videos WHERE visibility = 'public'").get().count;
  }

  const totalPages = Math.ceil(totalCount / limit);

  res.render('home', {
    title: 'Home',
    videos,
    currentPage: page,
    totalPages,
    search,
  });
});

// ── GET /videos/upload — Upload form ──
router.get('/upload', requireAuth, (req, res) => {
  res.render('videos/upload', { title: 'Upload Video', errors: [] });
});

// ── POST /videos/upload — Process upload ──
router.post('/upload', requireAuth, (req, res, next) => {
  videoUpload.single('video')(req, res, async (err) => {
    if (err) {
      return res.render('videos/upload', {
        title: 'Upload Video',
        errors: [{ msg: err.message }],
      });
    }

    if (!req.file) {
      return res.render('videos/upload', {
        title: 'Upload Video',
        errors: [{ msg: 'Please select a video file.' }],
      });
    }

    const { title, description, visibility } = req.body;

    if (!title || title.trim().length === 0) {
      // Clean up uploaded file
      fs.unlinkSync(req.file.path);
      return res.render('videos/upload', {
        title: 'Upload Video',
        errors: [{ msg: 'Video title is required.' }],
      });
    }

    try {
      // Generate thumbnail
      const thumbnailFilename = path.basename(req.file.filename, path.extname(req.file.filename)) + '.jpg';
      const { thumbnailPath, duration } = await generateThumbnail(req.file.path, thumbnailFilename);

      const result = db.prepare(`
        INSERT INTO videos (title, description, filename, thumbnail, duration, file_size, mime_type, user_id, visibility)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        title.trim(),
        description ? description.trim() : null,
        req.file.filename,
        thumbnailPath,
        duration,
        req.file.size,
        req.file.mimetype,
        req.session.userId,
        visibility === 'private' ? 'private' : 'public'
      );

      req.session.successMessage = 'Video uploaded successfully!';
      res.redirect(`/videos/${result.lastInsertRowid}`);
    } catch (error) {
      console.error('Upload error:', error);
      // Clean up file on error
      if (fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      res.render('videos/upload', {
        title: 'Upload Video',
        errors: [{ msg: 'Failed to process video. Please try again.' }],
      });
    }
  });
});

// ── GET /videos/:id — Watch video ──
router.get('/:id', requireAuth, (req, res) => {
  const videoId = parseInt(req.params.id, 10);
  if (isNaN(videoId)) {
    return res.status(404).render('error', { title: '404', message: 'Video not found.', code: 404 });
  }

  const video = db.prepare(`
    SELECT v.*, u.username, u.avatar, u.id as uploader_id
    FROM videos v
    JOIN users u ON v.user_id = u.id
    WHERE v.id = ?
  `).get(videoId);

  if (!video) {
    return res.status(404).render('error', { title: '404', message: 'Video not found.', code: 404 });
  }

  // Check visibility — only owner and admin can see private videos
  const currentUser = res.locals.currentUser;
  if (video.visibility === 'private' && video.user_id !== currentUser.id && currentUser.role !== 'admin') {
    return res.status(403).render('error', { title: '403', message: 'This video is private.', code: 403 });
  }

  // Increment view count
  db.prepare('UPDATE videos SET views = views + 1 WHERE id = ?').run(videoId);
  video.views += 1;

  // Get more videos from same uploader
  const moreFromUploader = db.prepare(`
    SELECT v.*, u.username FROM videos v
    JOIN users u ON v.user_id = u.id
    WHERE v.user_id = ? AND v.id != ? AND v.visibility = 'public'
    ORDER BY v.created_at DESC LIMIT 6
  `).all(video.user_id, videoId);

  res.render('videos/watch', {
    title: video.title,
    video,
    moreFromUploader,
    isOwner: currentUser.id === video.user_id,
    isAdmin: currentUser.role === 'admin',
  });
});

// ── GET /videos/:id/edit — Edit form ──
router.get('/:id/edit', requireAuth, requireOwnerOrAdmin('video'), (req, res) => {
  const video = db.prepare('SELECT * FROM videos WHERE id = ?').get(parseInt(req.params.id, 10));
  if (!video) {
    return res.status(404).render('error', { title: '404', message: 'Video not found.', code: 404 });
  }

  res.render('videos/edit', { title: `Edit: ${video.title}`, video, errors: [] });
});

// ── POST /videos/:id/edit — Process edit ──
router.post('/:id/edit', requireAuth, requireOwnerOrAdmin('video'), [
  body('title').trim().notEmpty().withMessage('Title is required.'),
], (req, res) => {
  const videoId = parseInt(req.params.id, 10);
  const errors = validationResult(req);
  const video = db.prepare('SELECT * FROM videos WHERE id = ?').get(videoId);

  if (!video) {
    return res.status(404).render('error', { title: '404', message: 'Video not found.', code: 404 });
  }

  if (!errors.isEmpty()) {
    return res.render('videos/edit', {
      title: `Edit: ${video.title}`,
      video,
      errors: errors.array(),
    });
  }

  const { title, description, visibility } = req.body;

  db.prepare(`
    UPDATE videos SET title = ?, description = ?, visibility = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    title.trim(),
    description ? description.trim() : null,
    visibility === 'private' ? 'private' : 'public',
    videoId
  );

  req.session.successMessage = 'Video updated successfully!';
  res.redirect(`/videos/${videoId}`);
});

// ── POST /videos/:id/delete — Delete video ──
router.post('/:id/delete', requireAuth, requireOwnerOrAdmin('video'), (req, res) => {
  const videoId = parseInt(req.params.id, 10);
  const video = db.prepare('SELECT * FROM videos WHERE id = ?').get(videoId);

  if (!video) {
    return res.status(404).render('error', { title: '404', message: 'Video not found.', code: 404 });
  }

  // Delete files
  const videoPath = path.join(__dirname, '..', 'uploads', 'videos', video.filename);
  if (fs.existsSync(videoPath)) fs.unlinkSync(videoPath);

  if (video.thumbnail) {
    const thumbPath = path.join(__dirname, '..', 'uploads', video.thumbnail);
    if (fs.existsSync(thumbPath)) fs.unlinkSync(thumbPath);
  }

  // Delete from DB
  db.prepare('DELETE FROM videos WHERE id = ?').run(videoId);

  req.session.successMessage = 'Video deleted successfully.';
  res.redirect('/videos');
});

// ── GET /videos/stream/:filename — Stream video with range support ──
router.get('/stream/:filename', requireAuth, (req, res) => {
  const filename = path.basename(req.params.filename); // prevent path traversal
  const videoPath = path.join(__dirname, '..', 'uploads', 'videos', filename);

  if (!fs.existsSync(videoPath)) {
    return res.status(404).send('Video file not found.');
  }

  const stat = fs.statSync(videoPath);
  const fileSize = stat.size;
  const range = req.headers.range;

  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunksize = end - start + 1;

    const file = fs.createReadStream(videoPath, { start, end });
    const head = {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunksize,
      'Content-Type': 'video/mp4',
    };

    res.writeHead(206, head);
    file.pipe(res);
  } else {
    const head = {
      'Content-Length': fileSize,
      'Content-Type': 'video/mp4',
    };
    res.writeHead(200, head);
    fs.createReadStream(videoPath).pipe(res);
  }
});

module.exports = router;
