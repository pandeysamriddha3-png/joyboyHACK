const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const MAX_VIDEO_SIZE = parseInt(process.env.MAX_VIDEO_SIZE) || 524288000; // 500MB
const MAX_AVATAR_SIZE = parseInt(process.env.MAX_AVATAR_SIZE) || 5242880; // 5MB

const ALLOWED_VIDEO_TYPES = [
  'video/mp4',
  'video/webm',
  'video/quicktime',    // .mov
  'video/x-msvideo',    // .avi
  'video/x-matroska',   // .mkv
  'video/ogg',
];

const ALLOWED_VIDEO_EXTS = ['.mp4', '.webm', '.mov', '.avi', '.mkv', '.ogv'];

const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
];

const ALLOWED_IMAGE_EXTS = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];

// ── Video upload config ──
const videoStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '..', 'uploads', 'videos'));
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueName = `${uuidv4()}${ext}`;
    cb(null, uniqueName);
  }
});

const videoUpload = multer({
  storage: videoStorage,
  limits: { fileSize: MAX_VIDEO_SIZE },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ALLOWED_VIDEO_TYPES.includes(file.mimetype) && ALLOWED_VIDEO_EXTS.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid video format. Allowed: ${ALLOWED_VIDEO_EXTS.join(', ')}`));
    }
  }
});

// ── Avatar upload config ──
const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '..', 'uploads', 'avatars'));
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueName = `${uuidv4()}${ext}`;
    cb(null, uniqueName);
  }
});

const avatarUpload = multer({
  storage: avatarStorage,
  limits: { fileSize: MAX_AVATAR_SIZE },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ALLOWED_IMAGE_TYPES.includes(file.mimetype) && ALLOWED_IMAGE_EXTS.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid image format. Allowed: ${ALLOWED_IMAGE_EXTS.join(', ')}`));
    }
  }
});

module.exports = { videoUpload, avatarUpload };
