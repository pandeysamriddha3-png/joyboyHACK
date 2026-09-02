const fs = require('fs');
const path = require('path');
const db = require('../config/database');

const user = db.prepare('SELECT * FROM users WHERE email = ?').get('admin@joyboy.local');
console.log('User found:', user ? user.username : 'none');

if (user) {
  const videoFileName = 'sample_demo_video.mp4';
  const videoPath = path.join(__dirname, '..', 'uploads', 'videos', videoFileName);
  if (!fs.existsSync(videoPath)) {
    fs.writeFileSync(videoPath, Buffer.alloc(1024 * 1024, 0)); // 1MB dummy file
  }

  const existing = db.prepare('SELECT * FROM videos WHERE filename = ?').get(videoFileName);
  if (!existing) {
    const info = db.prepare(`
      INSERT INTO videos (title, description, filename, thumbnail, duration, file_size, mime_type, user_id, visibility)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'Welcome to JoyBoy — Community Showcase',
      'This is an introductory video showing how videos are streamed, watched, and managed inside JoyBoy.',
      videoFileName,
      null,
      142.5,
      1024 * 1024,
      'video/mp4',
      user.id,
      'public'
    );
    console.log('Inserted sample demo video with ID:', info.lastInsertRowid);
  } else {
    console.log('Demo video already exists.');
  }
}
