const { pool } = require('../config/database');

/**
 * Attach the current user to res.locals for all templates.
 * Runs on every request.
 */
async function attachUser(req, res, next) {
  res.locals.currentUser = null;

  if (req.session && req.session.userId) {
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
        [req.session.userId]
      );

      const user = result.rows[0];

      if (user) {
        res.locals.currentUser = user;
      } else {
        // User was deleted — destroy stale session
        delete req.session.userId;
      }
    } catch (err) {
      console.error('Error attaching user:', err);
    }
  }

  next();
}

/**
 * Require authentication.
 * Redirects to login if not authenticated.
 */
function requireAuth(req, res, next) {
  if (!req.session || !req.session.userId) {
    req.session.errorMessage = 'Please log in to continue.';
    return res.redirect('/auth/login');
  }

  next();
}

/**
 * Require admin role.
 */
function requireAdmin(req, res, next) {
  if (
    !res.locals.currentUser ||
    res.locals.currentUser.role !== 'admin'
  ) {
    return res.status(403).render('error', {
      title: '403 — Forbidden',
      message: "You don't have permission to access this page.",
      code: 403,
    });
  }

  next();
}

/**
 * Factory:
 * Require that the current user is the owner of a resource
 * OR is an admin.
 *
 * @param {string} resourceType - 'video' or 'user'
 */
function requireOwnerOrAdmin(resourceType) {
  return async (req, res, next) => {
    const currentUser = res.locals.currentUser;

    if (!currentUser) {
      req.session.errorMessage = 'Please log in to continue.';
      return res.redirect('/auth/login');
    }

    // Admins can do anything
    if (currentUser.role === 'admin') {
      return next();
    }

    const resourceId = parseInt(req.params.id, 10);

    if (Number.isNaN(resourceId)) {
      return res.status(404).render('error', {
        title: '404 — Not Found',
        message: 'Resource not found.',
        code: 404,
      });
    }

    try {
      if (resourceType === 'video') {
        const result = await pool.query(
          `
          SELECT user_id
          FROM videos
          WHERE id = $1
          `,
          [resourceId]
        );

        const video = result.rows[0];

        if (!video) {
          return res.status(404).render('error', {
            title: '404 — Not Found',
            message: 'Video not found.',
            code: 404,
          });
        }

        if (video.user_id !== currentUser.id) {
          return res.status(403).render('error', {
            title: '403 — Forbidden',
            message: 'You can only manage your own videos.',
            code: 403,
          });
        }
      } else if (resourceType === 'user') {
        if (resourceId !== currentUser.id) {
          return res.status(403).render('error', {
            title: '403 — Forbidden',
            message: 'You can only edit your own profile.',
            code: 403,
          });
        }
      }

      next();
    } catch (err) {
      console.error('Error checking resource ownership:', err);

      return res.status(500).render('error', {
        title: '500 — Server Error',
        message: 'Something went wrong.',
        code: 500,
      });
    }
  };
}

module.exports = {
  attachUser,
  requireAuth,
  requireAdmin,
  requireOwnerOrAdmin,
};