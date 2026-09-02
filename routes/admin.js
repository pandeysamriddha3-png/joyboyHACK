const express = require('express');
const path = require('path');
const fs = require('fs');
const db = require('../config/database');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// All admin routes require auth + admin role
router.use(requireAuth);
router.use(requireAdmin);

// ── GET /admin — Dashboard ──
router.get('/', (req, res) => {
  const users = db.prepare(`
    SELECT u.*, 
      (SELECT COUNT(*) FROM videos WHERE user_id = u.id) as video_count,
      (SELECT COALESCE(SUM(views), 0) FROM videos WHERE user_id = u.id) as total_views
    FROM users u
    ORDER BY u.created_at DESC
  `).all();

  const stats = {
    totalUsers: db.prepare('SELECT COUNT(*) as count FROM users').get().count,
    totalVideos: db.prepare('SELECT COUNT(*) as count FROM videos').get().count,
    totalViews: db.prepare('SELECT COALESCE(SUM(views), 0) as count FROM videos').get().count,
    totalStorage: db.prepare('SELECT COALESCE(SUM(file_size), 0) as total FROM videos').get().total,
  };

  res.render('admin/dashboard', {
    title: 'Admin Dashboard',
    users,
    stats,
  });
});

// ── POST /admin/users/:id/role — Toggle user role ──
router.post('/users/:id/role', (req, res) => {
  const userId = parseInt(req.params.id, 10);
  const currentUser = res.locals.currentUser;

  // Cannot change own role
  if (userId === currentUser.id) {
    req.session.errorMessage = 'You cannot change your own role.';
    return res.redirect('/admin');
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!user) {
    req.session.errorMessage = 'User not found.';
    return res.redirect('/admin');
  }

  const newRole = user.role === 'admin' ? 'user' : 'admin';
  db.prepare('UPDATE users SET role = ? WHERE id = ?').run(newRole, userId);

  req.session.successMessage = `${user.username} is now ${newRole === 'admin' ? 'an admin' : 'a regular user'}.`;
  res.redirect('/admin');
});

// ── POST /admin/users/:id/delete — Delete user ──
router.post('/users/:id/delete', (req, res) => {
  const userId = parseInt(req.params.id, 10);
  const currentUser = res.locals.currentUser;

  // Cannot delete self
  if (userId === currentUser.id) {
    req.session.errorMessage = 'You cannot delete your own account.';
    return res.redirect('/admin');
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!user) {
    req.session.errorMessage = 'User not found.';
    return res.redirect('/admin');
  }

  // Delete all user's video files
  const videos = db.prepare('SELECT filename, thumbnail FROM videos WHERE user_id = ?').all(userId);
  videos.forEach(video => {
    const videoPath = path.join(__dirname, '..', 'uploads', 'videos', video.filename);
    if (fs.existsSync(videoPath)) fs.unlinkSync(videoPath);

    if (video.thumbnail) {
      const thumbPath = path.join(__dirname, '..', 'uploads', video.thumbnail);
      if (fs.existsSync(thumbPath)) fs.unlinkSync(thumbPath);
    }
  });

  // Delete avatar
  if (user.avatar) {
    const avatarPath = path.join(__dirname, '..', 'uploads', 'avatars', user.avatar);
    if (fs.existsSync(avatarPath)) fs.unlinkSync(avatarPath);
  }

  // Delete user (cascades to videos via FK)
  db.prepare('DELETE FROM users WHERE id = ?').run(userId);

  req.session.successMessage = `User "${user.username}" and all their content have been deleted.`;
  res.redirect('/admin');
});

module.exports = router;
