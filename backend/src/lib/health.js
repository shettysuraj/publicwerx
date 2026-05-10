const https = require('https');
const http = require('http');
const db = require('../db/database');

const SERVICES = {
  surajshetty:      { url: 'http://localhost:3010/health', label: 'surajshetty.com' },
  sahaya:           { url: 'http://localhost:3012/health', label: 'Sahaya' },
  aapta:            { url: 'http://localhost:3015/health', label: 'Aapta' },
  publicwerx:       { url: 'http://localhost:3016/health', label: 'PublicWerx' },
  samanu:           { url: 'http://localhost:3025/health', label: 'Samanu' },
  wordhop:          { url: 'https://wordhop.org/health', label: 'WordHop' },
  njordfellfutures: { url: 'https://njordfellfutures.com/health', label: 'Njordfell Futures' },
  'meme-backend':   { url: 'https://memewhatyasay.com/health', label: 'MemeWhatYaSay' },
  gamefilm:         { url: 'https://gamefilm.org/health', label: 'GameFilm' },
  peerlinq:         { url: 'https://peerlinq.org/health', label: 'PeerLinq' },
  srj1cc:           { url: 'https://srj1.cc/health', label: 'srj1.cc' },
  'auth-service':   { url: 'https://auth.publicwerx.org/health', label: 'Auth Service' },
};

const TIMEOUT = 8000;

const insertCheck = db.prepare(`
  INSERT INTO health_checks (service, status, response_ms, status_code, error)
  VALUES (?, ?, ?, ?, ?)
`);

function ping(url) {
  const mod = url.startsWith('https') ? https : http;
  return new Promise((resolve) => {
    const start = Date.now();
    const req = mod.get(url, { timeout: TIMEOUT }, (res) => {
      res.resume();
      res.on('end', () => {
        const ms = Date.now() - start;
        const code = res.statusCode;
        let status = 'up';
        if (code >= 500) status = 'down';
        else if (code !== 200) status = 'degraded';
        else if (ms > 3000) status = 'degraded';
        resolve({ status, ms, code, error: null });
      });
    });
    req.on('timeout', () => { req.destroy(); resolve({ status: 'down', ms: TIMEOUT, code: null, error: 'timeout' }); });
    req.on('error', (err) => { resolve({ status: 'down', ms: Date.now() - start, code: null, error: err.message }); });
  });
}

async function runHealthChecks() {
  const results = [];
  for (const [service, config] of Object.entries(SERVICES)) {
    const { status, ms, code, error } = await ping(config.url);
    insertCheck.run(service, status, ms, code, error);
    results.push({ service, label: config.label, status, ms, code, error });
  }
  return results;
}

function getLatestChecks() {
  return db.prepare(`
    SELECT h.* FROM health_checks h
    INNER JOIN (
      SELECT service, MAX(id) AS max_id FROM health_checks GROUP BY service
    ) latest ON h.service = latest.service AND h.id = latest.max_id
    ORDER BY h.service
  `).all();
}

function getHistory(service, hours = 24) {
  return db.prepare(`
    SELECT status, response_ms, status_code, error, checked_at
    FROM health_checks
    WHERE service = ? AND checked_at >= datetime('now', '-' || ? || ' hours')
    ORDER BY checked_at ASC
  `).all(service, hours);
}

function getAllHistory(hours = 24) {
  return db.prepare(`
    SELECT service, status, response_ms, checked_at
    FROM health_checks
    WHERE checked_at >= datetime('now', '-' || ? || ' hours')
    ORDER BY checked_at ASC
  `).all(hours);
}

function getServiceList() {
  return Object.entries(SERVICES).map(([id, config]) => ({ id, label: config.label }));
}

module.exports = { SERVICES, runHealthChecks, getLatestChecks, getHistory, getAllHistory, getServiceList };
