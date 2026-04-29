'use strict';

const express = require('express');
const { requireAdmin } = require('../lib/requireAdmin');

const router = express.Router();
router.use(requireAdmin);

const APPS = {
  aapta: { url: 'http://127.0.0.1:3015', subsPath: '/api/admin/subscriptions', tierPath: '/api/admin/users' },
  samanu: { url: 'http://127.0.0.1:3025', subsPath: '/api/admin/subscriptions', tierPath: '/api/admin/users' },
};

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

// POST /api/subscriptions/sync-tier — sync a user's tier on an app
router.post('/sync-tier', async (req, res) => {
  const { appId, authUserId, tier } = req.body;
  if (!appId || !authUserId || !tier) return res.status(400).json({ error: 'appId, authUserId, tier required' });
  if (!APPS[appId]) return res.status(400).json({ error: `Unknown app: ${appId}` });
  if (!['free', 'paid'].includes(tier)) return res.status(400).json({ error: 'tier must be "free" or "paid"' });

  const token = req.headers.authorization;
  const users = await fetchAppUsers(appId, token);
  if (!Array.isArray(users)) return res.status(502).json({ error: `Failed to reach ${appId}` });

  const u = users.find(u => u.auth_user_id === authUserId);
  if (!u) return res.status(404).json({ error: `User not registered on ${appId}` });

  await setAppTier(appId, u.id, tier, token);
  res.json({ ok: true });
});

module.exports = router;
