const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { v4: uuid } = require('uuid');
const { rateLimit } = require('express-rate-limit');
const db = require('../db/database');
const { KNOWN_PROJECTS, computeDedupHash } = require('../db/database');
const { sendBugNotificationEmail, sendBugReplyEmail } = require('../lib/email');
const { requireAdmin: requireBugAdmin } = require('../lib/requireAdmin');

const ALLOWED_ORIGINS = [
  'https://surajshetty.com', 'https://www.surajshetty.com',
  'https://gopbnj.com', 'https://www.gopbnj.com',
  'https://wordhop.org', 'https://www.wordhop.org',
  'https://memewhatyasay.com', 'https://www.memewhatyasay.com',
  'https://play.gottapickone.com',
  'https://njordfellfutures.com', 'https://www.njordfellfutures.com',
  'https://publicwerx.org', 'https://www.publicwerx.org',
  'https://gamefilm.org', 'https://www.gamefilm.org',
  'https://aapta.publicwerx.org',
  'https://samanu.publicwerx.org',
];

let formConfigCache = null;

function loadFormConfigs() {
  const rows = db.prepare('SELECT project, config FROM bug_form_config').all();
  const cache = {};
  for (const row of rows) {
    try { cache[row.project] = JSON.parse(row.config); } catch {}
  }
  formConfigCache = cache;
}
loadFormConfigs();

function getFormConfig(project) {
  if (!formConfigCache) loadFormConfigs();
  return formConfigCache[project] || formConfigCache['publicwerx'] || null;
}

const submitLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 3,
  standardHeaders: false,
  legacyHeaders: false,
  message: { error: 'Too many reports. Please try again later.' },
});

const formLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: false,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again later.' },
});

function isAllowedOrigin(req) {
  const origin = req.get('origin');
  if (!origin) return true;
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  if (origin.startsWith('http://localhost')) return true;
  try {
    const h = new URL(origin).hostname;
    if (h.endsWith('.gamefilm.org') || h.endsWith('.publicwerx.org')) return true;
  } catch {}
  return false;
}

// ═══════════════════════════════════════════════════════════════════════════
// PUBLIC ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════════

router.get('/form', formLimiter, (req, res) => {
  const { project } = req.query;
  if (!project || !KNOWN_PROJECTS.includes(project)) {
    return res.status(400).json({ error: 'Invalid project' });
  }
  const config = getFormConfig(project);
  if (!config) return res.status(404).json({ error: 'No form config found' });
  res.json({ project, ...config });
});

router.post('/', submitLimiter, (req, res) => {
  if (!isAllowedOrigin(req)) {
    return res.status(403).json({ error: 'Origin not allowed' });
  }

  const { project, type, description, page, debugLog, extraFields, appVersion, _hp } = req.body;

  if (_hp) return res.json({ ok: true });

  if (!project || !KNOWN_PROJECTS.includes(project)) {
    return res.status(400).json({ error: 'Invalid project' });
  }

  const reportType = type === 'feature' ? 'feature' : 'bug';

  if (!description || typeof description !== 'string') {
    return res.status(400).json({ error: 'Description is required' });
  }
  const desc = description.trim();
  if (desc.length < 1 || desc.length > 2000) {
    return res.status(400).json({ error: 'Description must be 1-2000 characters' });
  }

  const formConfig = getFormConfig(project);
  let validatedExtra = null;
  let reporterEmail = null;
  let notifyOnUpdate = 0;
  if (extraFields && typeof extraFields === 'object' && formConfig) {
    validatedExtra = {};
    for (const field of formConfig.fields) {
      if (field.name === 'type' || field.name === 'description') continue;
      const val = extraFields[field.name];
      if (val === undefined || val === null || val === '') continue;

      if (field.name === 'reporter_email') {
        const e = String(val).trim().slice(0, 200);
        if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) reporterEmail = e;
        continue;
      }
      if (field.name === 'notify_on_update') {
        notifyOnUpdate = (val === true || val === 'true' || val === 1 || val === '1') ? 1 : 0;
        continue;
      }

      const str = String(val).trim();
      if (field.maxLength && str.length > field.maxLength) continue;
      validatedExtra[field.name] = str;
    }
    if (Object.keys(validatedExtra).length === 0) validatedExtra = null;
  }
  if (!reporterEmail && debugLog) {
    try {
      const log = typeof debugLog === 'string' ? JSON.parse(debugLog) : debugLog;
      const ui = log && (log.user || log.userInfo);
      if (ui && ui.email) {
        const e = String(ui.email).trim().slice(0, 200);
        if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) {
          reporterEmail = e;
          notifyOnUpdate = 1;
        }
      }
    } catch {}
  }
  if (!reporterEmail) notifyOnUpdate = 0;

  const ip = req.ip || req.connection.remoteAddress || '';
  const ipHash = crypto.createHash('sha256').update(ip).digest('hex').slice(0, 16);

  const id = uuid();
  const debugStr = debugLog ? (typeof debugLog === 'string' ? debugLog : JSON.stringify(debugLog)).slice(0, 50000) : null;
  const userAgent = (req.get('user-agent') || '').slice(0, 500);
  const pagePath = page ? String(page).slice(0, 200) : null;
  const appVer = appVersion ? String(appVersion).slice(0, 64) : null;
  const dedupHash = computeDedupHash(project, desc);

  db.prepare(`
    INSERT INTO bug_reports (id, project, type, description, extra_fields, page, debug_log, user_agent, ip_hash, reporter_email, notify_on_update, app_version, dedup_hash)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, project, reportType, desc, validatedExtra ? JSON.stringify(validatedExtra) : null, pagePath, debugStr, userAgent, ipHash, reporterEmail, notifyOnUpdate, appVer, dedupHash);

  sendBugNotificationEmail({ id, project, type: reportType, description: desc, page: pagePath, extraFields: validatedExtra });

  res.json({ ok: true, id });
});

// ═══════════════════════════════════════════════════════════════════════════
// AUTH
// ═══════════════════════════════════════════════════════════════════════════

router.get('/auth/me', requireBugAdmin, (req, res) => {
  res.json({ authenticated: true, email: req.admin.email });
});

// ═══════════════════════════════════════════════════════════════════════════
// ADMIN ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════════

router.get('/', requireBugAdmin, (req, res) => {
  const { status, project, limit = '50', offset = '0' } = req.query;
  const lim = Math.min(parseInt(limit) || 50, 200);
  const off = parseInt(offset) || 0;

  let where = [];
  let params = [];
  if (status && ['open', 'acknowledged', 'resolved', 'wontfix'].includes(status)) {
    where.push('status = ?');
    params.push(status);
  }
  if (project && KNOWN_PROJECTS.includes(project)) {
    where.push('project = ?');
    params.push(project);
  }

  const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const reports = db.prepare(`SELECT * FROM bug_reports ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`).all(...params, lim, off);
  const total = db.prepare(`SELECT COUNT(*) as count FROM bug_reports ${whereClause}`).get(...params);

  for (const r of reports) {
    if (r.extra_fields) try { r.extra_fields = JSON.parse(r.extra_fields); } catch {}
  }

  res.json({ reports, total: total.count, limit: lim, offset: off });
});

router.patch('/:id', requireBugAdmin, (req, res) => {
  const { id } = req.params;
  const { status, admin_note } = req.body;

  const report = db.prepare('SELECT * FROM bug_reports WHERE id = ?').get(id);
  if (!report) return res.status(404).json({ error: 'Not found' });

  const updates = [];
  const params = [];

  if (status && ['open', 'acknowledged', 'resolved', 'wontfix'].includes(status)) {
    updates.push('status = ?');
    params.push(status);
    if (status === 'resolved' || status === 'wontfix') {
      updates.push("resolved_at = datetime('now')");
    } else {
      updates.push('resolved_at = NULL');
    }
  }
  if (admin_note !== undefined) {
    updates.push('admin_note = ?');
    params.push(String(admin_note).slice(0, 5000));
  }

  if (updates.length === 0) return res.status(400).json({ error: 'Nothing to update' });

  params.push(id);
  db.prepare(`UPDATE bug_reports SET ${updates.join(', ')} WHERE id = ?`).run(...params);

  const updated = db.prepare('SELECT * FROM bug_reports WHERE id = ?').get(id);
  if (updated.extra_fields) try { updated.extra_fields = JSON.parse(updated.extra_fields); } catch {}
  res.json(updated);
});

router.delete('/:id', requireBugAdmin, (req, res) => {
  const { changes } = db.prepare('DELETE FROM bug_reports WHERE id = ?').run(req.params.id);
  if (changes === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
});

router.get('/:id/comments', requireBugAdmin, (req, res) => {
  const report = db.prepare('SELECT id FROM bug_reports WHERE id = ?').get(req.params.id);
  if (!report) return res.status(404).json({ error: 'Not found' });
  const comments = db.prepare('SELECT id, author_email, body, emailed, created_at FROM bug_comments WHERE bug_id = ? ORDER BY created_at ASC').all(req.params.id);
  res.json({ comments });
});

router.post('/:id/comments', requireBugAdmin, async (req, res) => {
  const { body } = req.body;
  if (!body || typeof body !== 'string') return res.status(400).json({ error: 'Body required' });
  const trimmed = body.trim();
  if (trimmed.length < 1 || trimmed.length > 5000) return res.status(400).json({ error: 'Body must be 1-5000 characters' });

  const report = db.prepare('SELECT id, project, description, reporter_email, notify_on_update FROM bug_reports WHERE id = ?').get(req.params.id);
  if (!report) return res.status(404).json({ error: 'Not found' });

  let emailed = 0;
  if (report.reporter_email && report.notify_on_update) {
    try {
      await sendBugReplyEmail({
        to: report.reporter_email,
        project: report.project,
        bugId: report.id,
        body: trimmed,
        originalDescription: report.description,
      });
      emailed = 1;
    } catch (err) {
      console.error('[bugs] reply email failed:', err.message);
    }
  }

  const result = db.prepare(
    'INSERT INTO bug_comments (bug_id, author_email, body, emailed) VALUES (?, ?, ?, ?)'
  ).run(report.id, req.admin.email, trimmed, emailed);

  const comment = db.prepare('SELECT id, author_email, body, emailed, created_at FROM bug_comments WHERE id = ?').get(result.lastInsertRowid);
  res.json({ comment });
});

router.get('/forms', requireBugAdmin, (req, res) => {
  const rows = db.prepare('SELECT project, config FROM bug_form_config').all();
  const configs = {};
  for (const row of rows) {
    try { configs[row.project] = JSON.parse(row.config); } catch { configs[row.project] = row.config; }
  }
  res.json(configs);
});

router.put('/forms/:project', requireBugAdmin, (req, res) => {
  const { project } = req.params;
  if (!KNOWN_PROJECTS.includes(project)) return res.status(400).json({ error: 'Unknown project' });

  const { config } = req.body;
  if (!config || !config.fields || !Array.isArray(config.fields)) {
    return res.status(400).json({ error: 'Invalid config: must have fields array' });
  }

  db.prepare('INSERT OR REPLACE INTO bug_form_config (project, config) VALUES (?, ?)').run(project, JSON.stringify(config));
  formConfigCache = null;
  res.json({ ok: true });
});

// ── Remote server config ─────────────────────────────────────────────────────
const REMOTE_PROJECTS = {
  wordhop:          { url: 'https://wordhop.org/api/system', server: 'game', backup: true },
  njordfellfutures: { url: 'https://njordfellfutures.com/api/system', server: 'game', backup: true },
  'meme-backend':   { url: 'https://memewhatyasay.com/api/system', server: 'game', backup: true },
  gamefilm:         { url: 'https://gamefilm.org/api/system', server: 'game', backup: true },
  peerlinq:         { url: 'https://peerlinq.org/api/system', server: 'tools', backup: true },
  srj1cc:           { url: 'https://srj1.cc/api/system', server: 'tools', backup: true },
  'auth-service':   { url: 'https://auth.publicwerx.org/api/system', server: 'auth', backup: true },
  gopbnj:           { url: 'http://localhost:3012/api/system', server: 'hub', backup: true },
  surajshetty:      { url: 'http://localhost:3010/api/system', server: 'hub', backup: true },
  aapta:            { url: 'http://localhost:3015/api/system', server: 'hub', backup: true },
  samanu:           { url: 'http://localhost:3025/api/system', server: 'hub', backup: true },
};
const REMOTE_SYSTEM_KEY = () => process.env.REMOTE_SYSTEM_KEY || '';

async function remoteDeployProject(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 300000);
  try {
    const r = await fetch(`${url}/deploy`, { method: 'POST', headers: { 'x-system-key': REMOTE_SYSTEM_KEY() }, signal: controller.signal });
    return await r.json();
  } catch (err) { return { ok: false, output: err.message }; }
  finally { clearTimeout(timeout); }
}

router.get('/system', requireBugAdmin, (req, res) => {
  const byServer = (s) => Object.keys(REMOTE_PROJECTS).filter(k => REMOTE_PROJECTS[k].server === s);
  const backupable = (s) => Object.keys(REMOTE_PROJECTS).filter(k => REMOTE_PROJECTS[k].server === s && REMOTE_PROJECTS[k].backup);
  res.json({
    servers: [
      { name: 'Auth', deployable: byServer('auth'), backupable: backupable('auth') },
      { name: 'Hub', deployable: byServer('hub'), backupable: backupable('hub') },
      { name: 'Tools', deployable: byServer('tools'), backupable: backupable('tools') },
      { name: 'Games', deployable: byServer('game'), backupable: backupable('game') },
    ],
  });
});

const LOCAL_DEPLOY_COMMANDS = {
  surajshetty: 'cd /home/ubuntu/surajshetty && ./infra/deploy.sh main',
  gopbnj: 'cd /home/ubuntu/projects/gopbnj && ./deploy.sh',
  aapta: 'cd /home/ubuntu/aapta && ./deploy.sh',
  publicwerx: 'cd /home/ubuntu/projects/publicwerx/repo && ./deploy.sh',
};

const DEPLOY_TIMEOUT_MS = 120_000;
const inFlightDeploys = new Map();

router.post('/system/deploy/:name', requireBugAdmin, async (req, res) => {
  const { name } = req.params;

  const remote = REMOTE_PROJECTS[name];
  if (remote) {
    const result = await remoteDeployProject(remote.url);
    return res.json(result);
  }

  const cmd = LOCAL_DEPLOY_COMMANDS[name];
  if (!cmd) return res.status(400).json({ error: 'Unknown project' });

  if (inFlightDeploys.has(name)) {
    return res.status(409).json({ error: 'Deploy already in progress for this project' });
  }
  inFlightDeploys.set(name, Date.now());

  const { spawn } = require('child_process');
  const child = spawn('bash', ['-c', cmd], { env: { ...process.env, PATH: process.env.PATH } });

  let responded = false;
  const respond = (status, body) => {
    if (responded) return;
    responded = true;
    inFlightDeploys.delete(name);
    clearTimeout(killTimer);
    clearTimeout(forceKillTimer);
    res.status(status).json(body);
  };

  let output = '';
  let killTimer;
  let forceKillTimer;

  killTimer = setTimeout(() => {
    output += `\n[deploy timed out after ${DEPLOY_TIMEOUT_MS}ms — sending SIGTERM]\n`;
    child.kill('SIGTERM');
    forceKillTimer = setTimeout(() => {
      output += `[child still alive — sending SIGKILL]\n`;
      child.kill('SIGKILL');
    }, 5_000);
  }, DEPLOY_TIMEOUT_MS);

  child.stdout.on('data', d => { output += d.toString(); });
  child.stderr.on('data', d => { output += d.toString(); });
  const sanitize = (s) => s.replace(/(?:^|\n)\s*\w*(?:KEY|SECRET|PASS|TOKEN|CREDENTIAL)\w*=.*/gi, '\n[REDACTED]');
  child.on('close', code => {
    respond(200, { ok: code === 0, exitCode: code, output: sanitize(output) });
  });
  child.on('error', err => {
    respond(500, { error: 'Deploy failed', output: sanitize(output) });
  });
});

// ── Backup/Restore proxy ────────────────────────────────────────────────────
async function remoteBackupCall(url, method, body) {
  const opts = { method, headers: { 'x-system-key': REMOTE_SYSTEM_KEY() } };
  if (body) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000);
  opts.signal = controller.signal;
  try {
    const r = await fetch(url, opts);
    return { status: r.status, data: await r.json() };
  } catch (err) { return { status: 502, data: { ok: false, error: err.message } }; }
  finally { clearTimeout(timeout); }
}

router.get('/system/backups/:name', requireBugAdmin, async (req, res) => {
  const remote = REMOTE_PROJECTS[req.params.name];
  if (!remote) return res.status(400).json({ error: 'Unknown project' });
  const { status, data } = await remoteBackupCall(`${remote.url}/backups`, 'GET');
  res.status(status).json(data);
});

router.post('/system/backups/:name', requireBugAdmin, async (req, res) => {
  const remote = REMOTE_PROJECTS[req.params.name];
  if (!remote) return res.status(400).json({ error: 'Unknown project' });
  const { status, data } = await remoteBackupCall(`${remote.url}/backups`, 'POST');
  res.status(status).json(data);
});

const SAFE_BACKUP_FILENAME = /^[\w.\-]+\.db\.gz$/;

router.post('/system/backups/:name/restore', requireBugAdmin, async (req, res) => {
  const remote = REMOTE_PROJECTS[req.params.name];
  if (!remote) return res.status(400).json({ error: 'Unknown project' });
  const { filename } = req.body;
  if (!filename || !SAFE_BACKUP_FILENAME.test(filename)) return res.status(400).json({ error: 'Invalid filename' });
  const { status, data } = await remoteBackupCall(`${remote.url}/backups/restore`, 'POST', { filename });
  res.status(status).json(data);
});

router.delete('/system/backups/:name/:filename', requireBugAdmin, async (req, res) => {
  const remote = REMOTE_PROJECTS[req.params.name];
  if (!remote) return res.status(400).json({ error: 'Unknown project' });
  if (!SAFE_BACKUP_FILENAME.test(req.params.filename)) return res.status(400).json({ error: 'Invalid filename' });
  const { status, data } = await remoteBackupCall(`${remote.url}/backups/${encodeURIComponent(req.params.filename)}`, 'DELETE');
  res.status(status).json(data);
});

module.exports = router;
