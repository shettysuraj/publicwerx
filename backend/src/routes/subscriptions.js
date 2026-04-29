'use strict';

const express = require('express');
const { requireAdmin } = require('../lib/requireAdmin');

const router = express.Router();
router.use(requireAdmin);

const APPS = {
  aapta: { url: 'http://127.0.0.1:3015', subsPath: '/api/admin/subscriptions', tierPath: '/api/admin/users' },
  samanu: { url: 'http://127.0.0.1:3025', subsPath: '/api/admin/subscriptions', tierPath: '/api/admin/users' },
};

// GET /api/subscriptions — fetch tier data from all apps
router.get('/', async (req, res) => {
  const token = req.headers.authorization;
  const results = {};

  await Promise.all(Object.entries(APPS).map(async ([appId, { url, subsPath }]) => {
    try {
      const r = await fetch(`${url}${subsPath}`, {
        headers: { Authorization: token },
        signal: AbortSignal.timeout(5000),
      });
      if (r.ok) {
        const d = await r.json();
        results[appId] = d.users || [];
      } else {
        results[appId] = { error: `HTTP ${r.status}` };
      }
    } catch (e) {
      results[appId] = { error: e.message };
    }
  }));

  res.json({ apps: results });
});

// POST /api/subscriptions/:appId/users/:userId/tier — proxy tier toggle
router.post('/:appId/users/:userId/tier', async (req, res) => {
  const { appId, userId } = req.params;
  const app = APPS[appId];
  if (!app) return res.status(400).json({ error: `Unknown app: ${appId}` });

  const { tier } = req.body;
  if (!tier || !['free', 'paid'].includes(tier)) {
    return res.status(400).json({ error: 'tier must be "free" or "paid"' });
  }

  try {
    const r = await fetch(`${app.url}${app.tierPath}/${userId}/tier`, {
      method: 'POST',
      headers: {
        Authorization: req.headers.authorization,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ tier }),
      signal: AbortSignal.timeout(5000),
    });
    const d = await r.json();
    if (!r.ok) return res.status(r.status).json(d);
    res.json(d);
  } catch (e) {
    res.status(502).json({ error: `Failed to reach ${appId}: ${e.message}` });
  }
});

module.exports = router;
