const express = require('express');
const router = express.Router();
const { requireAdmin } = require('../lib/requireAdmin');
const { getLatestChecks, getAllHistory, getHistory, getServiceList, runHealthChecks } = require('../lib/health');

router.get('/public', (req, res) => {
  const latest = getLatestChecks();
  const services = getServiceList();

  const result = services.map(s => {
    const check = latest.find(c => c.service === s.id);
    return {
      id: s.id,
      label: s.label,
      status: check?.status || 'unknown',
      ms: check?.response_ms || null,
      checkedAt: check?.checked_at || null,
    };
  });

  res.json({ services: result, checkedAt: result[0]?.checkedAt || null });
});

router.get('/', requireAdmin, (req, res) => {
  const latest = getLatestChecks();
  const services = getServiceList();
  const hours = parseInt(req.query.hours) || 24;
  const history = getAllHistory(hours);

  const serviceMap = {};
  for (const s of services) {
    serviceMap[s.id] = { ...s, status: 'unknown', ms: null, checkedAt: null, history: [] };
  }
  for (const check of latest) {
    if (serviceMap[check.service]) {
      serviceMap[check.service].status = check.status;
      serviceMap[check.service].ms = check.response_ms;
      serviceMap[check.service].code = check.status_code;
      serviceMap[check.service].error = check.error;
      serviceMap[check.service].checkedAt = check.checked_at;
    }
  }
  for (const h of history) {
    if (serviceMap[h.service]) {
      serviceMap[h.service].history.push({ status: h.status, ms: h.response_ms, ts: h.checked_at });
    }
  }

  res.json({ services: Object.values(serviceMap) });
});

router.get('/:service', requireAdmin, (req, res) => {
  const hours = parseInt(req.query.hours) || 24;
  const history = getHistory(req.params.service, hours);
  res.json({ service: req.params.service, history });
});

router.post('/check', requireAdmin, async (req, res) => {
  try {
    const results = await runHealthChecks();
    res.json({ ok: true, results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
