'use strict';

const express = require('express');
const { requireAdmin } = require('../lib/requireAdmin');

const router = express.Router();
router.use(requireAdmin);

const APPS = {
  aapta: { url: 'http://127.0.0.1:3015', subsPath: '/api/admin/subscriptions', tierPath: '/api/admin/users', auth: 'jwt' },
  samanu: { url: 'http://127.0.0.1:3025', subsPath: '/api/admin/subscriptions', tierPath: '/api/admin/users', auth: 'jwt' },
  gopbnj: { url: 'http://127.0.0.1:3012', auth: 'system' },
  wordhop: { url: 'https://wordhop.org', auth: 'system' },
  memewhatyasay: { url: 'https://memewhatyasay.com', auth: 'system' },
  gamefilm: { url: 'https://gamefilm.org', auth: 'system' },
};

function systemKey() {
  return process.env.REMOTE_SYSTEM_KEY || process.env.SYSTEM_API_KEY || '';
}

async function syncViaJwt(app, authUserId, tier, token) {
  const r = await fetch(`${app.url}${app.subsPath}`, {
    headers: { Authorization: token },
    signal: AbortSignal.timeout(5000),
  });
  if (!r.ok) return { ok: false, reason: 'failed to list users' };
  const d = await r.json();
  const users = d.users || [];
  const u = users.find(u => u.auth_user_id === authUserId);
  if (!u) return { ok: true, synced: false, reason: 'user not registered on app' };

  await fetch(`${app.url}${app.tierPath}/${u.id}/tier`, {
    method: 'POST',
    headers: { Authorization: token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ tier }),
    signal: AbortSignal.timeout(5000),
  });
  return { ok: true, synced: true };
}

async function syncViaSystemKey(app, authUserId, tier) {
  const r = await fetch(`${app.url}/api/system/sync-tier`, {
    method: 'POST',
    headers: { 'x-system-key': systemKey(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ authUserId, tier }),
    signal: AbortSignal.timeout(5000),
  });
  if (!r.ok) return { ok: false, reason: `app returned ${r.status}` };
  return await r.json();
}

router.post('/sync-tier', async (req, res) => {
  const { appId, authUserId, tier } = req.body;
  if (!appId || !authUserId || !tier) return res.status(400).json({ error: 'appId, authUserId, tier required' });
  if (!APPS[appId]) return res.status(400).json({ error: `Unknown app: ${appId}` });
  if (!['free', 'paid'].includes(tier)) return res.status(400).json({ error: 'tier must be "free" or "paid"' });

  const app = APPS[appId];
  try {
    let result;
    if (app.auth === 'system') {
      result = await syncViaSystemKey(app, authUserId, tier);
    } else {
      result = await syncViaJwt(app, authUserId, tier, req.headers.authorization);
    }
    res.json(result);
  } catch (e) {
    res.json({ ok: true, synced: false, reason: e.message });
  }
});

module.exports = router;
