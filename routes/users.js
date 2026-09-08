const express = require('express');
const bcrypt = require('bcrypt');
const { body, validationResult } = require('express-validator');

const { pool } = require('../config/database');

const { requireAuth, requireOwnerOrAdmin } = require('../middleware/auth');
const { avatarUpload } = require('../middleware/upload');

const router = express.Router();

// ─────────────────────────────────────────────
// GET /users/:id — User profile
// ─────────────────────────────────────────────

router.get('/:id', requireAuth, async (req, res) => {
  const userId = parseInt(req.params.id, 10);

  if (Number.isNaN(userId)) {
    return res.status(404).render('error', {
      title: '404',
      message: 'User not found.',
      code: 404,
    });
  }

  try {
    const userResult = await pool.query(
      `
      SELECT
        id,
        username,
        email,
        avatar,
        bio,
        role,
        created_at
      FROM users
      WHERE id = $1
      `,
      [userId]
    );

    const user = userResult.rows[0];

    if (!user) {
      return res.status(404).render('error', {
        title: '404',
        message: 'User not found.',
        code: 404,
      });
    }

    const currentUser = res.locals.currentUser;

    const isOwner = currentUser.id === user.id;
    const isAdmin = currentUser.role === 'admin';

    // ───────────────────────────────────────
    // Get user's videos
    // ───────────────────────────────────────

    let videosResult;

    if (isOwner || isAdmin) {
      videosResult = await pool.query(
        `
        SELECT *
        FROM videos
        WHERE user_id = $1
        ORDER BY created_at DESC
        `,
        [userId]
      );
    } else {
      videosResult = await pool.query(
        `
        SELECT *
        FROM videos
        WHERE user_id = $1
          AND visibility = 'public'
        ORDER BY created_at DESC
        `,
        [userId]
      );
    }

    const videos = videosResult.rows;

    // ───────────────────────────────────────
    // Total views
    // ───────────────────────────────────────

    const viewsResult = await pool.query(
      `
      SELECT COALESCE(SUM(views), 0)::bigint AS total
      FROM videos
      WHERE user_id = $1
      `,
      [userId]
    );

    const totalViews = Number(viewsResult.rows[0].total);

    res.render('users/profile', {
      title: `${user.username}'s Profile`,
      profileUser: user,
      videos,
      totalViews,
      isOwner,
      isAdmin,
    });

  } catch (err) {
    console.error('Profile error:', err);

    return res.status(500).render('error', {
      title: '500 — Server Error',
      message: 'Something went wrong while loading the profile.',
      code: 500,
    });
  }
});

// ─────────────────────────────────────────────
// GET /users/:id/edit — Edit profile form
// ─────────────────────────────────────────────

router.get(
  '/:id/edit',
  requireAuth,
  requireOwnerOrAdmin('user'),
  async (req, res) => {
    const userId = parseInt(req.params.id, 10);

    try {
      const result = await pool.query(
        `
        SELECT
          id,
          username,
          email,
          avatar,
          bio,
          role,
          created_at
        FROM users
        WHERE id = $1
        `,
        [userId]
      );

      const user = result.rows[0];

      if (!user) {
        return res.status(404).render('error', {
          title: '404',
          message: 'User not found.',
          code: 404,
        });
      }

      res.render('users/edit', {
        title: 'Edit Profile',
        profileUser: user,
        errors: [],
      });

    } catch (err) {
      console.error('Edit profile error:', err);

      return res.status(500).render('error', {
        title: '500 — Server Error',
        message: 'Something went wrong.',
        code: 500,
      });
    }
  }
);

// ─────────────────────────────────────────────
// POST /users/:id/edit — Process profile edit
// ─────────────────────────────────────────────

router.post(
  '/:id/edit',
  requireAuth,
  requireOwnerOrAdmin('user'),
  (req, res) => {

    avatarUpload.single('avatar')(req, res, async (err) => {

      const userId = parseInt(req.params.id, 10);

      try {

        // ───────────────────────────────────
        // Multer error
        // ───────────────────────────────────

        if (err) {
          const result = await pool.query(
            `
            SELECT
              id,
              username,
              email,
              avatar,
              bio,
              role,
              created_at
            FROM users
            WHERE id = $1
            `,
            [userId]
          );

          return res.render('users/edit', {
            title: 'Edit Profile',
            profileUser: result.rows[0],
            errors: [{ msg: err.message }],
          });
        }

        // ───────────────────────────────────
        // Get current user
        // ───────────────────────────────────

        const userResult = await pool.query(
          'SELECT * FROM users WHERE id = $1',
          [userId]
        );

        const user = userResult.rows[0];

        if (!user) {
          return res.status(404).render('error', {
            title: '404',
            message: 'User not found.',
            code: 404,
          });
        }

        const { username, bio } = req.body;

        // ───────────────────────────────────
        // Validate username
        // ───────────────────────────────────

        if (!username || username.trim().length < 3) {
          return res.render('users/edit', {
            title: 'Edit Profile',
            profileUser: user,
            errors: [
              {
                msg: 'Username must be at least 3 characters.',
              },
            ],
          });
        }

        const cleanUsername = username.trim();

        // ───────────────────────────────────
        // Check username
        // ───────────────────────────────────

        const existingUserResult = await pool.query(
          `
          SELECT id
          FROM users
          WHERE LOWER(username) = LOWER($1)
            AND id != $2
          LIMIT 1
          `,
          [cleanUsername, userId]
        );

        if (existingUserResult.rows.length > 0) {
          return res.render('users/edit', {
            title: 'Edit Profile',
            profileUser: user,
            errors: [
              {
                msg: 'Username is already taken.',
              },
            ],
          });
        }

        // ───────────────────────────────────
        // Avatar
        // ───────────────────────────────────

        let avatarPath = user.avatar;

        if (req.file) {
          /*
           * For now the uploaded avatar remains in
           * the local uploads folder.
           *
           * We'll move avatars to Backblaze B2
           * in the next storage migration step.
           */

          avatarPath = req.file.filename;
        }

        // ───────────────────────────────────
        // Update user
        // ───────────────────────────────────

        await pool.query(
          `
          UPDATE users
          SET
            username = $1,
            bio = $2,
            avatar = $3
          WHERE id = $4
          `,
          [
            cleanUsername,
            bio ? bio.trim() : null,
            avatarPath,
            userId,
          ]
        );

        req.session.successMessage =
          'Profile updated successfully!';

        res.redirect(`/users/${userId}`);

      } catch (error) {

        console.error('Profile update error:', error);

        // PostgreSQL unique violation
        if (error.code === '23505') {
          return res.render('users/edit', {
            title: 'Edit Profile',
            profileUser: {
              ...req.body,
              id: userId,
            },
            errors: [
              {
                msg: 'Username is already taken.',
              },
            ],
          });
        }

        return res.status(500).render('error', {
          title: '500 — Server Error',
          message: 'Something went wrong while updating your profile.',
          code: 500,
        });
      }
    });
  }
);

module.exports = router;