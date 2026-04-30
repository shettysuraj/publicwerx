require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
if (!process.env.SMTP_HOST) {
  require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
}
for (const k of Object.keys(process.env)) {
  if (typeof process.env[k] === 'string') process.env[k] = process.env[k].trim();
}

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const { rateLimit } = require('express-rate-limit');
const path = require('path');

const app = express();
const PORT = parseInt(process.env.PORT) || 3016;

app.set('trust proxy', 1);

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:"],
      connectSrc: ["'self'", "https://auth.publicwerx.org"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      frameAncestors: ["'none'"],
    },
  },
  crossOriginOpenerPolicy: false,
  crossOriginEmbedderPolicy: false,
}));

app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    const allowed = [
      'https://surajshetty.com', 'https://www.surajshetty.com',
      'https://gopbnj.com', 'https://www.gopbnj.com',
      'https://wordhop.org', 'https://www.wordhop.org',
      'https://memewhatyasay.com', 'https://www.memewhatyasay.com',
      'https://play.gottapickone.com',
      'https://njordfellfutures.com', 'https://www.njordfellfutures.com',
      'https://publicwerx.org', 'https://www.publicwerx.org',
      'https://gamefilm.org', 'https://www.gamefilm.org',
      'https://aapta.publicwerx.org',
    ];
    if (allowed.includes(origin)) return cb(null, true);
    try {
      const h = new URL(origin).hostname;
      if (h.endsWith('.gamefilm.org') || h.endsWith('.publicwerx.org')) return cb(null, true);
    } catch {}
    cb(null, false);
  },
  credentials: true,
}));

app.use(rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  standardHeaders: false,
  legacyHeaders: false,
}));

app.use('/api', rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: false,
  legacyHeaders: false,
}));

app.use(express.json({ limit: '100kb' }));

// Static: widget JS with cross-origin resource policy
app.use('/lib', express.static(path.join(__dirname, '../public/lib'), {
  setHeaders: (res) => {
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  },
}));

// Static: admin SPA assets
app.use('/admin', express.static(path.join(__dirname, '../public/admin')));

// Routes
app.use('/api/bugs', require('./routes/bugs'));
app.use('/api/subscriptions', require('./routes/subscriptions'));
app.use('/api/system', require('./routes/system'));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', ts: new Date().toISOString() });
});

// API 404 catch-all
app.all('/api/*', (req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Admin SPA fallback
app.get('/admin*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/admin/index.html'));
});

// Landing page
app.use(express.static(path.join(__dirname, '../public/landing')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/landing/index.html'));
});

// Error handler
app.use((err, req, res, _next) => {
  console.error('[error]', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, '127.0.0.1', () => {
  console.log(`[publicwerx] listening on 127.0.0.1:${PORT}`);
});
