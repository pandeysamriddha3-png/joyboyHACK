const express = require('express');
const path = require('path');
const fs = require('fs');

const { pool } = require('../config/database');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// All admin routes require auth + admin role
router.use(requireAuth);
router.use(requireAdmin);


// ─────────────────────────────────────────────
// GET /admin — Dashboard
// ─────────────────────────────────────────────

router.get('/', async (req, res) => {
  try {

    const usersResult = await pool.query(`
      SELECT
        u.*,

        (
          SELECT COUNT(*)
          FROM videos
          WHERE user_id = u.id
        ) AS video_count,

        (
          SELECT COALESCE(SUM(views), 0)
          FROM videos
          WHERE user_id = u.id
        ) AS total_views

      FROM users u
      ORDER BY u.created_at DESC
    `);

    const statsResult = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM users) AS total_users,
        (SELECT COUNT(*) FROM videos) AS total_videos,
        (SELECT COALESCE(SUM(views), 0) FROM videos) AS total_views,
        (SELECT COALESCE(SUM(file_size), 0) FROM videos) AS total_storage
    `);

    const statsRow = statsResult.rows[0];

    const stats = {
      totalUsers: Number(statsRow.total_users),
      totalVideos: Number(statsRow.total_videos),
      totalViews: Number(statsRow.total_views),
      totalStorage: Number(statsRow.total_storage),
    };

    res.render('admin/dashboard', {
      title: 'Admin Dashboard',
      users: usersResult.rows,
      stats,
    });

  } catch (error) {

    console.error('Admin dashboard error:', error);

    res.status(500).render('error', {
      title: '500 — Server Error',
      message: 'Something went wrong while loading the admin dashboard.',
      code: 500,
    });
  }
});


// ─────────────────────────────────────────────
// POST /admin/users/:id/role
// Toggle user role
// ─────────────────────────────────────────────

router.post('/users/:id/role', async (req, res) => {

  const userId = parseInt(req.params.id, 10);
  const currentUser = res.locals.currentUser;

  // Cannot change own role
  if (userId === currentUser.id) {
    req.session.errorMessage =
      'You cannot change your own role.';

    return res.redirect('/admin');
  }

  try {

    const userResult = await pool.query(
      `
      SELECT *
      FROM users
      WHERE id = $1
      `,
      [userId]
    );

    const user = userResult.rows[0];

    if (!user) {
      req.session.errorMessage =
        'User not found.';

      return res.redirect('/admin');
    }

    const newRole =
      user.role === 'admin'
        ? 'user'
        : 'admin';

    await pool.query(
      `
      UPDATE users
      SET role = $1
      WHERE id = $2
      `,
      [newRole, userId]
    );

    req.session.successMessage =
      `${user.username} is now ${
        newRole === 'admin'
          ? 'an admin'
          : 'a regular user'
      }.`;

    res.redirect('/admin');

  } catch (error) {

    console.error('Change role error:', error);

    req.session.errorMessage =
      'Failed to change user role.';

    res.redirect('/admin');
  }
});


// ─────────────────────────────────────────────
// POST /admin/users/:id/delete
// Delete user
// ─────────────────────────────────────────────

router.post('/users/:id/delete', async (req, res) => {

  const userId = parseInt(req.params.id, 10);
  const currentUser = res.locals.currentUser;

  // Cannot delete self
  if (userId === currentUser.id) {
    req.session.errorMessage =
      'You cannot delete your own account.';

    return res.redirect('/admin');
  }

  try {

    // Get user
    const userResult = await pool.query(
      `
      SELECT *
      FROM users
      WHERE id = $1
      `,
      [userId]
    );

    const user = userResult.rows[0];

    if (!user) {
      req.session.errorMessage =
        'User not found.';

      return res.redirect('/admin');
    }


    // ─────────────────────────────────────────
    // Delete local video files
    // ─────────────────────────────────────────

    const videosResult = await pool.query(
      `
      SELECT filename, thumbnail
      FROM videos
      WHERE user_id = $1
      `,
      [userId]
    );

    for (const video of videosResult.rows) {

      if (video.filename) {

        const videoPath = path.join(
          __dirname,
          '..',
          'uploads',
          'videos',
          video.filename
        );

        if (fs.existsSync(videoPath)) {
          fs.unlinkSync(videoPath);
        }
      }


      if (video.thumbnail) {

        const thumbnailPath = path.join(
          __dirname,
          '..',
          'uploads',
          video.thumbnail
        );

        if (fs.existsSync(thumbnailPath)) {
          fs.unlinkSync(thumbnailPath);
        }
      }
    }


    // ─────────────────────────────────────────
    // Delete local avatar
    // ─────────────────────────────────────────

    if (user.avatar) {

      const avatarPath = path.join(
        __dirname,
        '..',
        'uploads',
        'avatars',
        user.avatar
      );

      if (fs.existsSync(avatarPath)) {
        fs.unlinkSync(avatarPath);
      }
    }


    // ─────────────────────────────────────────
    // Delete user from Neon
    //
    // Videos are automatically deleted because
    // the FK uses ON DELETE CASCADE.
    // ─────────────────────────────────────────

    await pool.query(
      `
      DELETE FROM users
      WHERE id = $1
      `,
      [userId]
    );


    req.session.successMessage =
      `User "${user.username}" and all their content have been deleted.`;

    res.redirect('/admin');

  } catch (error) {

    console.error('Delete user error:', error);

    req.session.errorMessage =
      'Failed to delete user.';

    res.redirect('/admin');
  }
});


module.exports = router;