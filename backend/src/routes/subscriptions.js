'use strict';

const express = require('express');
const { requireAdmin } = require('../lib/requireAdmin');
const db = require('../db/database');

const router = express.Router();
router.use(requireAdmin);

const APPS = {
  aapta: { url: 'http://127.0.0.1:3015', subsPath: '/api/admin/subscriptions', tierPath: '/api/admin/users' },
  samanu: { url: 'http://127.0.0.1:3025', subsPath: '/api/admin/subscriptions', tierPath: '/api/admin/users' },
};

const APP_IDS = Object.keys(APPS);
const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

async function setAppTier(appId, localUserId, tier, token) {
  const app = APPS[appId];
  if (!app) return;
  try {
    await fetch(`${app.url}${app.tierPath}/${localUserId}/tier`, {
      method: 'POST',
      headers: { Authorization: token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ tier }),
      signal: AbortSignal.timeout(5000),
    });
  } catch {}
}

async function fetchAppUsers(appId, token) {
  const app = APPS[appId];
  if (!app) return [];
  try {
    const r = await fetch(`${app.url}${app.subsPath}`, {
      headers: { Authorization: token },
      signal: AbortSignal.timeout(5000),
    });
    if (r.ok) {
      const d = await r.json();
      return d.users || [];
    }
  } catch {}
  return [];
}

function getActiveSubs(authUserId) {
  const now = Date.now();
  return db.prepare(
    'SELECT * FROM subscriptions WHERE auth_user_id = ? AND starts_at <= ? AND expires_at > ?'
  ).all(authUserId, now, now);
}

function getAllSubs(authUserId) {
  return db.prepare('SELECT * FROM subscriptions WHERE auth_user_id = ? ORDER BY created_at DESC').all(authUserId);
}

function isUserSubscribed(authUserId, appId) {
  const active = getActiveSubs(authUserId);
  if (active.some(s => s.type === 'publicwerx')) return true;
  if (active.some(s => s.type === 'app' && s.app_id === appId)) return true;
  return false;
}

// GET /api/subscriptions — subscription records + app tier data
router.get('/', async (req, res) => {
  const token = req.headers.authorization;
  const appResults = {};

  await Promise.all(Object.entries(APPS).map(async ([appId, { url, subsPath }]) => {
    try {
      const r = await fetch(`${url}${subsPath}`, {
        headers: { Authorization: token },
        signal: AbortSignal.timeout(5000),
      });
      if (r.ok) {
        const d = await r.json();
        appResults[appId] = d.users || [];
      } else {
        appResults[appId] = { error: `HTTP ${r.status}` };
      }
    } catch (e) {
      appResults[appId] = { error: e.message };
    }
  }));

  const subs = db.prepare('SELECT * FROM subscriptions ORDER BY created_at DESC').all();

  res.json({ apps: appResults, subscriptions: subs });
});

// POST /api/subscriptions/activate — create a subscription (annual)
router.post('/activate', async (req, res) => {
  const { authUserId, type, appId } = req.body;
  if (!authUserId || !type) return res.status(400).json({ error: 'authUserId and type required' });
  if (!['app', 'publicwerx'].includes(type)) return res.status(400).json({ error: 'type must be "app" or "publicwerx"' });
  if (type === 'app' && (!appId || !APPS[appId])) return res.status(400).json({ error: `Invalid appId: ${appId}` });

  const token = req.headers.authorization;
  const now = Date.now();
  const expiresAt = now + ONE_YEAR_MS;

  if (type === 'publicwerx') {
    const existing = getActiveSubs(authUserId).find(s => s.type === 'publicwerx');
    if (existing) return res.status(400).json({ error: 'Active PublicWerx subscription already exists' });

    db.prepare('INSERT INTO subscriptions (auth_user_id, type, app_id, starts_at, expires_at) VALUES (?, ?, NULL, ?, ?)')
      .run(authUserId, 'publicwerx', now, expiresAt);

    for (const id of APP_IDS) {
      const users = await fetchAppUsers(id, token);
      if (Array.isArray(users)) {
        const u = users.find(u => u.auth_user_id === authUserId);
        if (u) await setAppTier(id, u.id, 'paid', token);
      }
    }
  } else {
    if (isUserSubscribed(authUserId, appId)) {
      return res.status(400).json({ error: `User already has active access to ${appId}` });
    }

    db.prepare('INSERT INTO subscriptions (auth_user_id, type, app_id, starts_at, expires_at) VALUES (?, ?, ?, ?, ?)')
      .run(authUserId, 'app', appId, now, expiresAt);

    const users = await fetchAppUsers(appId, token);
    if (Array.isArray(users)) {
      const u = users.find(u => u.auth_user_id === authUserId);
      if (u) await setAppTier(appId, u.id, 'paid', token);
    }
  }

  res.json({ ok: true, expiresAt });
});

// POST /api/subscriptions/:id/sync — sync tier state after expiry (admin action)
router.post('/:id/sync', async (req, res) => {
  const sub = db.prepare('SELECT * FROM subscriptions WHERE id = ?').get(req.params.id);
  if (!sub) return res.status(404).json({ error: 'Subscription not found' });

  const token = req.headers.authorization;
  const expired = sub.expires_at <= Date.now();

  if (sub.type === 'publicwerx') {
    for (const id of APP_IDS) {
      if (!expired && isUserSubscribed(sub.auth_user_id, id)) continue;
      const tier = isUserSubscribed(sub.auth_user_id, id) ? 'paid' : 'free';
      const users = await fetchAppUsers(id, token);
      if (Array.isArray(users)) {
        const u = users.find(u => u.auth_user_id === sub.auth_user_id);
        if (u) await setAppTier(id, u.id, tier, token);
      }
    }
  } else if (sub.app_id) {
    const tier = isUserSubscribed(sub.auth_user_id, sub.app_id) ? 'paid' : 'free';
    const users = await fetchAppUsers(sub.app_id, token);
    if (Array.isArray(users)) {
      const u = users.find(u => u.auth_user_id === sub.auth_user_id);
      if (u) await setAppTier(sub.app_id, u.id, tier, token);
    }
  }

  res.json({ ok: true });
});

module.exports = router;
