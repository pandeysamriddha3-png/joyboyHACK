const express = require('express');
const bcrypt = require('bcrypt');
const { body, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');
const db = require('../config/database');

const router = express.Router();

// Rate limit auth routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  message: 'Too many attempts. Please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// ── GET /auth/login ──
router.get('/login', (req, res) => {
  if (req.session.userId) return res.redirect('/videos');
  res.render('auth/login', { title: 'Log In', errors: [] });
});

// ── POST /auth/login ──
router.post('/login', authLimiter, [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required.'),
  body('password').notEmpty().withMessage('Password is required.'),
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.render('auth/login', {
      title: 'Log In',
      errors: errors.array(),
    });
  }

  const { email, password } = req.body;

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user) {
    return res.render('auth/login', {
      title: 'Log In',
      errors: [{ msg: 'Invalid email or password.' }],
    });
  }

  const match = bcrypt.compareSync(password, user.password_hash);
  if (!match) {
    return res.render('auth/login', {
      title: 'Log In',
      errors: [{ msg: 'Invalid email or password.' }],
    });
  }

  // Create session
  req.session.userId = user.id;
  req.session.successMessage = `Welcome back, ${user.username}!`;
  res.redirect('/videos');
});

// ── GET /auth/register ──
router.get('/register', (req, res) => {
  if (req.session.userId) return res.redirect('/videos');
  res.render('auth/register', { title: 'Register', errors: [], formData: {} });
});

// ── POST /auth/register ──
router.post('/register', authLimiter, [
  body('username')
    .trim()
    .isLength({ min: 3, max: 30 }).withMessage('Username must be 3–30 characters.')
    .matches(/^[a-zA-Z0-9_-]+$/).withMessage('Username can only contain letters, numbers, hyphens, and underscores.'),
  body('email')
    .isEmail().normalizeEmail().withMessage('Valid email is required.'),
  body('password')
    .isLength({ min: 6 }).withMessage('Password must be at least 6 characters.'),
  body('confirmPassword')
    .custom((value, { req }) => value === req.body.password).withMessage('Passwords do not match.'),
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.render('auth/register', {
      title: 'Register',
      errors: errors.array(),
      formData: { username: req.body.username, email: req.body.email },
    });
  }

  const { username, email, password } = req.body;

  // Check for existing user
  const existing = db.prepare('SELECT id FROM users WHERE email = ? OR username = ?').get(email, username);
  if (existing) {
    return res.render('auth/register', {
      title: 'Register',
      errors: [{ msg: 'Username or email already taken.' }],
      formData: { username, email },
    });
  }

  // Hash password
  const passwordHash = bcrypt.hashSync(password, 12);

  // First user becomes admin
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
  const role = userCount === 0 ? 'admin' : 'user';

  const result = db.prepare(
    'INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)'
  ).run(username, email, passwordHash, role);

  // Auto-login
  req.session.userId = result.lastInsertRowid;
  req.session.successMessage = `Welcome to JoyBoy, ${username}!${role === 'admin' ? ' You are the site admin.' : ''}`;
  res.redirect('/videos');
});

// ── POST /auth/logout ──
router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) console.error('Session destroy error:', err);
    res.redirect('/auth/login');
  });
});

module.exports = router;
