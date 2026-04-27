const jwt = require('jsonwebtoken');

const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'https://auth.publicwerx.org';
const AUTH_SERVICE_ISSUER = process.env.AUTH_SERVICE_ISSUER || 'auth.publicwerx.org';

const ADMIN_ALLOWLIST = new Set(['shettysuraj74@gmail.com']);

const PUBLIC_KEY_TTL_MS = 60 * 60 * 1000;

let cachedKey = null;
let cachedAt = 0;
let inFlight = null;

async function getAuthPublicKey() {
  const now = Date.now();
  if (cachedKey && now - cachedAt < PUBLIC_KEY_TTL_MS) return cachedKey;
  if (inFlight) return inFlight;

  inFlight = (async () => {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 5000);
    try {
      const r = await fetch(`${AUTH_SERVICE_URL}/auth/public-key`, { signal: ctrl.signal });
      if (!r.ok) throw new Error(`public-key fetch ${r.status}`);
      const { publicKey } = await r.json();
      if (!publicKey) throw new Error('public-key missing from response');
      cachedKey = publicKey;
      cachedAt = Date.now();
      return publicKey;
    } finally {
      clearTimeout(t);
    }
  })().catch(err => {
    inFlight = null;
    throw err;
  }).finally(() => {
    inFlight = null;
  });

  return inFlight;
}

async function requireAdmin(req, res, next) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Not authenticated' });

  let publicKey;
  try {
    publicKey = await getAuthPublicKey();
  } catch (err) {
    console.error('[requireAdmin] failed to fetch auth public key:', err.message);
    return res.status(503).json({ error: 'Auth service unavailable' });
  }

  let payload;
  try {
    payload = jwt.verify(token, publicKey, {
      algorithms: ['RS256'],
      issuer: AUTH_SERVICE_ISSUER,
    });
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  const email = (payload.email || '').toLowerCase();
  if (!email || !ADMIN_ALLOWLIST.has(email)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  req.admin = { email, sub: payload.sub };
  next();
}

module.exports = {
  requireAdmin,
  getAuthPublicKey,
  ADMIN_ALLOWLIST,
  AUTH_SERVICE_URL,
  AUTH_SERVICE_ISSUER,
};
