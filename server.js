require('dotenv').config();

const express = require('express');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const helmet = require('helmet');
const path = require('path');
const fs = require('fs');

const {
  initDatabase,
  testConnection,
} = require('./config/database');

const { attachUser } = require('./middleware/auth');
const helpers = require('./utils/helpers');

const app = express();

// ─────────────────────────────────────────────
// Render runs behind a proxy
// ─────────────────────────────────────────────

app.set('trust proxy', 1);

const PORT = process.env.PORT || 3000;

// ─────────────────────────────────────────────
// Ensure directories exist
// ─────────────────────────────────────────────

const dirs = [
  'uploads/videos',
  'uploads/thumbnails',
  'uploads/avatars',
  'data',
];

dirs.forEach((dir) => {
  const fullPath = path.join(__dirname, dir);

  if (!fs.existsSync(fullPath)) {
    fs.mkdirSync(fullPath, {
      recursive: true,
    });
  }
});

// ─────────────────────────────────────────────
// Security headers
// ─────────────────────────────────────────────

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],

        scriptSrc: [
          "'self'",
          "'unsafe-inline'",
        ],

        styleSrc: [
          "'self'",
          "'unsafe-inline'",
          'https://fonts.googleapis.com',
        ],

        fontSrc: [
          "'self'",
          'https://fonts.gstatic.com',
        ],

        imgSrc: [
          "'self'",
          'data:',
          'blob:',
        ],

        mediaSrc: [
          "'self'",
          'blob:',
        ],

        connectSrc: [
          "'self'",
        ],
      },
    },

    crossOriginEmbedderPolicy: false,
  })
);

// ─────────────────────────────────────────────
// Body parsing
// ─────────────────────────────────────────────

app.use(
  express.urlencoded({
    extended: true,
    limit: '10mb',
  })
);

app.use(
  express.json({
    limit: '10mb',
  })
);

// ─────────────────────────────────────────────
// Sessions
// ─────────────────────────────────────────────

app.use(
  session({
    store: new SQLiteStore({
      db: 'sessions.db',
      dir: path.join(__dirname, 'data'),
      concurrentDB: true,
    }),

    secret:
      process.env.SESSION_SECRET ||
      'fallback-secret-change-me',

    resave: false,

    saveUninitialized: false,

    cookie: {
      httpOnly: true,

      sameSite: 'lax',

      secure:
        process.env.NODE_ENV === 'production',

      maxAge:
        7 * 24 * 60 * 60 * 1000,
    },
  })
);

// ─────────────────────────────────────────────
// Static files
// ─────────────────────────────────────────────

app.use(
  express.static(
    path.join(__dirname, 'public')
  )
);

app.use(
  '/uploads',
  express.static(
    path.join(__dirname, 'uploads')
  )
);

// ─────────────────────────────────────────────
// View engine
// ─────────────────────────────────────────────

app.set(
  'view engine',
  'ejs'
);

app.set(
  'views',
  path.join(__dirname, 'views')
);

// ─────────────────────────────────────────────
// Global middleware
// ─────────────────────────────────────────────

app.use(attachUser);

// ─────────────────────────────────────────────
// Template globals + flash messages
// ─────────────────────────────────────────────

app.use((req, res, next) => {
  res.locals.helpers = helpers;

  res.locals.siteName =
    process.env.SITE_NAME || 'JoyBoy';

  res.locals.currentPath =
    req.path;

  // Flash messages
  res.locals.successMessage =
    req.session.successMessage;

  res.locals.errorMessage =
    req.session.errorMessage;

  delete req.session.successMessage;
  delete req.session.errorMessage;

  next();
});

// ─────────────────────────────────────────────
// Routes
// ─────────────────────────────────────────────

const authRoutes =
  require('./routes/auth');

const videoRoutes =
  require('./routes/videos');

const userRoutes =
  require('./routes/users');

const adminRoutes =
  require('./routes/admin');

app.use(
  '/auth',
  authRoutes
);

app.use(
  '/videos',
  videoRoutes
);

app.use(
  '/users',
  userRoutes
);

app.use(
  '/admin',
  adminRoutes
);

// ─────────────────────────────────────────────
// STORAGE DIAGNOSTIC
// ─────────────────────────────────────────────
//
// Open:
// https://joyboyhack.onrender.com/debug/storage
//
// This tells us whether uploaded files actually
// exist on the current Render instance.
// ─────────────────────────────────────────────

app.get('/debug/storage', (req, res) => {
  function scanDirectory(directory) {
    const fullPath = path.join(__dirname, directory);

    if (!fs.existsSync(fullPath)) {
      return {
        exists: false,
        path: fullPath,
        files: [],
      };
    }

    try {
      const entries = fs.readdirSync(
        fullPath,
        { withFileTypes: true }
      );

      return {
        exists: true,
        path: fullPath,
        count: entries.length,
        files: entries.map((entry) => ({
          name: entry.name,
          type: entry.isDirectory()
            ? 'directory'
            : 'file',
        })),
      };
    } catch (error) {
      return {
        exists: true,
        path: fullPath,
        error: error.message,
        files: [],
      };
    }
  }

  res.json({
    ok: true,

    timestamp:
      new Date().toISOString(),

    hostname:
      require('os').hostname(),

    cwd:
      process.cwd(),

    directories: {
      uploads:
        scanDirectory('uploads'),

      videos:
        scanDirectory('uploads/videos'),

      thumbnails:
        scanDirectory('uploads/thumbnails'),

      avatars:
        scanDirectory('uploads/avatars'),

      data:
        scanDirectory('data'),
    },
  });
});

// ─────────────────────────────────────────────
// Homepage
// ─────────────────────────────────────────────

app.get('/', (req, res) => {
  if (!req.session.userId) {
    return res.redirect('/auth/login');
  }

  res.redirect('/videos');
});

// ─────────────────────────────────────────────
// 404 handler
// ─────────────────────────────────────────────

app.use((req, res) => {
  res.status(404).render('error', {
    title: '404 — Not Found',

    message:
      "The page you're looking for doesn't exist.",

    code: 404,
  });
});

// ─────────────────────────────────────────────
// Error handler
// ─────────────────────────────────────────────

app.use(
  (err, req, res, next) => {
    console.error(
      'Server error:',
      err
    );

    res.status(500).render('error', {
      title: '500 — Server Error',

      message:
        process.env.NODE_ENV === 'development'
          ? err.message
          : 'Something went wrong.',

      code: 500,
    });
  }
);

// ─────────────────────────────────────────────
// Start server
// ─────────────────────────────────────────────

async function startServer() {
  try {
    console.log(
      '🔌 Connecting to Neon PostgreSQL...'
    );

    await testConnection();

    console.log(
      '🗄️ Initializing Neon database...'
    );

    await initDatabase();

    console.log(
      '✅ Database initialization complete'
    );

    app.listen(
      PORT,
      '0.0.0.0',
      () => {
        console.log(
          `\n🎬 JoyBoy is running on port ${PORT}\n`
        );

        console.log(
          `📦 Storage debug: http://localhost:${PORT}/debug/storage`
        );
      }
    );

  } catch (error) {
    console.error(
      '❌ Failed to start server:',
      error
    );

    process.exit(1);
  }
}

startServer();

module.exports = app;