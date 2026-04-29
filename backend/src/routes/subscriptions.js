'use strict';

const express = require('express');
const { requireAdmin } = require('../lib/requireAdmin');

const router = express.Router();
router.use(requireAdmin);

// Group A apps (aapta, samanu) enforce via JWT sub_apps claim directly — no local tier sync needed.
const APPS = {
  gopbnj: { url: 'http://127.0.0.1:3012' },
  wordhop: { url: 'https://wordhop.org' },
  memewhatyasay: { url: 'https://memewhatyasay.com' },
  gamefilm: { url: 'https://gamefilm.org' },
};

function systemKey() {
  return process.env.REMOTE_SYSTEM_KEY || process.env.SYSTEM_API_KEY || '';
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
    const result = await syncViaSystemKey(app, authUserId, tier);
    res.json(result);
  } catch (e) {
    res.json({ ok: true, synced: false, reason: e.message });
  }
});

module.exports = router;
