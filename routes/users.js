const express = require('express');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcrypt');
const { body, validationResult } = require('express-validator');
const db = require('../config/database');
const { requireAuth, requireOwnerOrAdmin } = require('../middleware/auth');
const { avatarUpload } = require('../middleware/upload');

const router = express.Router();

// ── GET /users/:id — User profile ──
router.get('/:id', requireAuth, (req, res) => {
  const userId = parseInt(req.params.id, 10);
  if (isNaN(userId)) {
    return res.status(404).render('error', { title: '404', message: 'User not found.', code: 404 });
  }

  const user = db.prepare('SELECT id, username, email, avatar, bio, role, created_at FROM users WHERE id = ?').get(userId);
  if (!user) {
    return res.status(404).render('error', { title: '404', message: 'User not found.', code: 404 });
  }

  const currentUser = res.locals.currentUser;
  const isOwner = currentUser.id === user.id;
  const isAdmin = currentUser.role === 'admin';

  // Get user's videos — show private ones only to owner/admin
  let videos;
  if (isOwner || isAdmin) {
    videos = db.prepare(`
      SELECT * FROM videos WHERE user_id = ? ORDER BY created_at DESC
    `).all(userId);
  } else {
    videos = db.prepare(`
      SELECT * FROM videos WHERE user_id = ? AND visibility = 'public' ORDER BY created_at DESC
    `).all(userId);
  }

  const totalViews = db.prepare('SELECT COALESCE(SUM(views), 0) as total FROM videos WHERE user_id = ?').get(userId).total;

  res.render('users/profile', {
    title: `${user.username}'s Profile`,
    profileUser: user,
    videos,
    totalViews,
    isOwner,
    isAdmin,
  });
});

// ── GET /users/:id/edit — Edit profile form ──
router.get('/:id/edit', requireAuth, requireOwnerOrAdmin('user'), (req, res) => {
  const user = db.prepare('SELECT id, username, email, avatar, bio, role, created_at FROM users WHERE id = ?').get(parseInt(req.params.id, 10));
  if (!user) {
    return res.status(404).render('error', { title: '404', message: 'User not found.', code: 404 });
  }

  res.render('users/edit', { title: 'Edit Profile', profileUser: user, errors: [] });
});

// ── POST /users/:id/edit — Process profile edit ──
router.post('/:id/edit', requireAuth, requireOwnerOrAdmin('user'), (req, res, next) => {
  avatarUpload.single('avatar')(req, res, (err) => {
    if (err) {
      const user = db.prepare('SELECT id, username, email, avatar, bio, role, created_at FROM users WHERE id = ?').get(parseInt(req.params.id, 10));
      return res.render('users/edit', {
        title: 'Edit Profile',
        profileUser: user,
        errors: [{ msg: err.message }],
      });
    }

    const userId = parseInt(req.params.id, 10);
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);

    if (!user) {
      return res.status(404).render('error', { title: '404', message: 'User not found.', code: 404 });
    }

    const { username, bio } = req.body;

    if (!username || username.trim().length < 3) {
      return res.render('users/edit', {
        title: 'Edit Profile',
        profileUser: user,
        errors: [{ msg: 'Username must be at least 3 characters.' }],
      });
    }

    // Check if username is taken by another user
    const existingUser = db.prepare('SELECT id FROM users WHERE username = ? AND id != ?').get(username.trim(), userId);
    if (existingUser) {
      return res.render('users/edit', {
        title: 'Edit Profile',
        profileUser: user,
        errors: [{ msg: 'Username is already taken.' }],
      });
    }

    let avatarPath = user.avatar;

    // Handle avatar upload
    if (req.file) {
      // Delete old avatar if it exists
      if (user.avatar) {
        const oldPath = path.join(__dirname, '..', 'uploads', 'avatars', user.avatar);
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }
      avatarPath = req.file.filename;
    }

    db.prepare(`
      UPDATE users SET username = ?, bio = ?, avatar = ? WHERE id = ?
    `).run(username.trim(), bio ? bio.trim() : null, avatarPath, userId);

    req.session.successMessage = 'Profile updated successfully!';
    res.redirect(`/users/${userId}`);
  });
});

module.exports = router;
