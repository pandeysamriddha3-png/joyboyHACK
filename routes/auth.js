const express = require('express');
const bcrypt = require('bcrypt');
const { body, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');
const db = require('../config/database');

const router = express.Router();

// ─────────────────────────────────────────────
// Rate limiting
// ─────────────────────────────────────────────

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many attempts. Please try again later.',
});

// ─────────────────────────────────────────────
// GET /auth/login
// ─────────────────────────────────────────────

router.get('/login', (req, res) => {
  if (req.session.userId) {
    return res.redirect('/videos');
  }

  res.render('auth/login', {
    title: 'Log In',
    errors: [],
  });
});

// ─────────────────────────────────────────────
// POST /auth/login
// ─────────────────────────────────────────────

router.post(
  '/login',
  authLimiter,

  [
    body('email')
      .trim()
      .isEmail()
      .withMessage('Please enter a valid email address.')
      .normalizeEmail(),

    body('password')
      .notEmpty()
      .withMessage('Password is required.'),
  ],

  (req, res) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      return res.render('auth/login', {
        title: 'Log In',
        errors: errors.array(),
      });
    }

    const { email, password } = req.body;

    try {
      const user = db
        .prepare('SELECT * FROM users WHERE email = ?')
        .get(email);

      if (!user) {
        return res.render('auth/login', {
          title: 'Log In',
          errors: [
            { msg: 'Invalid email or password.' }
          ],
        });
      }

      const passwordMatches = bcrypt.compareSync(
        password,
        user.password_hash
      );

      if (!passwordMatches) {
        return res.render('auth/login', {
          title: 'Log In',
          errors: [
            { msg: 'Invalid email or password.' }
          ],
        });
      }

      // Create login session
      req.session.userId = user.id;
      req.session.successMessage = `Welcome back, ${user.username}!`;

      return res.redirect('/videos');

    } catch (err) {
      console.error('Login error:', err);

      return res.status(500).render('error', {
        title: '500 — Server Error',
        message: 'Something went wrong while logging in.',
        code: 500,
      });
    }
  }
);

// ─────────────────────────────────────────────
// GET /auth/register
// ─────────────────────────────────────────────

router.get('/register', (req, res) => {
  if (req.session.userId) {
    return res.redirect('/videos');
  }

  res.render('auth/register', {
    title: 'Register',
    errors: [],
    formData: {},
  });
});

// ─────────────────────────────────────────────
// POST /auth/register
// ─────────────────────────────────────────────

router.post(
  '/register',
  authLimiter,

  [
    body('username')
      .trim()
      .isLength({ min: 3, max: 30 })
      .withMessage('Username must be 3–30 characters.')
      .matches(/^[a-zA-Z0-9_-]+$/)
      .withMessage(
        'Username can only contain letters, numbers, hyphens, and underscores.'
      ),

    body('email')
      .trim()
      .isEmail()
      .withMessage('Please enter a valid email address.')
      .normalizeEmail(),

    body('password')
      .isLength({ min: 6 })
      .withMessage('Password must be at least 6 characters.'),

    body('confirmPassword')
      .custom((value, { req }) => value === req.body.password)
      .withMessage('Passwords do not match.'),
  ],

  (req, res) => {
    const errors = validationResult(req);

    // Validation failed
    if (!errors.isEmpty()) {
      return res.render('auth/register', {
        title: 'Register',
        errors: errors.array(),
        formData: {
          username: req.body.username || '',
          email: req.body.email || '',
        },
      });
    }

    const username = req.body.username.trim();
    const email = req.body.email.trim().toLowerCase();
    const password = req.body.password;

    try {
      // ───────────────────────────────────────
      // Check username separately
      // ───────────────────────────────────────
      console.log('REGISTER ATTEMPT:', {
        username,
        email
      });

      console.log(
        'EXISTING USERS:',
        db.prepare('SELECT id, username, email FROM users').all()
      );

      const existingUsername = db
        .prepare(
          'SELECT id FROM users WHERE username = ? COLLATE NOCASE'
        )
        .get(username);

      if (existingUsername) {
        return res.render('auth/register', {
          title: 'Register',
          errors: [
            { msg: 'That username is already taken.' }
          ],
          formData: {
            username,
            email,
          },
        });
      }

      // ───────────────────────────────────────
      // Check email separately
      // ───────────────────────────────────────

      const existingEmail = db
        .prepare(
          'SELECT id FROM users WHERE email = ? COLLATE NOCASE'
        )
        .get(email);

      if (existingEmail) {
        return res.render('auth/register', {
          title: 'Register',
          errors: [
            { msg: 'That email is already registered.' }
          ],
          formData: {
            username,
            email,
          },
        });
      }

      // ───────────────────────────────────────
      // Hash password
      // ───────────────────────────────────────

      const passwordHash = bcrypt.hashSync(password, 12);

      // First registered account becomes admin
      const userCount = db
        .prepare('SELECT COUNT(*) AS count FROM users')
        .get().count;

      const role = userCount === 0 ? 'admin' : 'user';

      // ───────────────────────────────────────
      // Create user
      // ───────────────────────────────────────

      const result = db
        .prepare(`
          INSERT INTO users
            (username, email, password_hash, role)
          VALUES
            (?, ?, ?, ?)
        `)
        .run(
          username,
          email,
          passwordHash,
          role
        );

      // ───────────────────────────────────────
      // Auto-login
      // ───────────────────────────────────────

      req.session.userId = result.lastInsertRowid;

      req.session.successMessage =
        `Welcome to JoyBoy, ${username}!` +
        (role === 'admin'
          ? ' You are the site admin.'
          : '');

      return res.redirect('/videos');

    } catch (err) {

      console.error('Registration error:', err);

      // Handle SQLite UNIQUE errors
      if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        return res.render('auth/register', {
          title: 'Register',
          errors: [
            {
              msg: 'That username or email is already registered.'
            }
          ],
          formData: {
            username,
            email,
          },
        });
      }

      return res.status(500).render('error', {
        title: '500 — Server Error',
        message: 'Something went wrong while creating your account.',
        code: 500,
      });
    }
  }
);

// ─────────────────────────────────────────────
// POST /auth/logout
// ─────────────────────────────────────────────

router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Session destroy error:', err);
    }

    res.redirect('/auth/login');
  });
});

module.exports = router;