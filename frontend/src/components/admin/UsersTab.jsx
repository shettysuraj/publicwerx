import { useState, useEffect, useCallback } from 'react';
import { authFetch, AUTH_BASE } from '../../lib/adminAuth';

const ADMIN = `${AUTH_BASE}/admin`;
const TIER_SYNC = '/api/subscriptions/sync-tier';
const SUB_APPS = ['aapta', 'samanu', 'gopbnj', 'wordhop', 'memewhatyasay', 'gamefilm'];

function fmtDate(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}.${mm}.${dd}`;
}

function fmtDateTime(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${yyyy}.${mm}.${dd} ${hh}:${mi}`;
}

function fmtRelative(ts) {
  if (!ts) return 'never';
  const ms = Date.now() - ts;
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export default function UsersTab() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('created_desc');
  const [expanded, setExpanded] = useState(null);
  const [detail, setDetail] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [bannedIps, setBannedIps] = useState([]);
  const [showIps, setShowIps] = useState(false);
  const [newIp, setNewIp] = useState('');
  const [newIpReason, setNewIpReason] = useState('');
  const [subBusy, setSubBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await authFetch(`${ADMIN}/users`);
      if (!r.ok) throw new Error(`Users: HTTP ${r.status}`);
      const d = await r.json();
      setUsers(d.users || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadIps = useCallback(async () => {
    try {
      const r = await authFetch(`${ADMIN}/ips`);
      if (!r.ok) return;
      const d = await r.json();
      setBannedIps(d.ips || []);
    } catch {}
  }, []);

  useEffect(() => { load(); loadIps(); }, [load, loadIps]);

  const loadDetail = useCallback(async (id) => {
    setDetail(null);
    try {
      const r = await authFetch(`${ADMIN}/users/${id}`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setDetail(await r.json());
    } catch (e) {
      setError(e.message);
    }
  }, []);

  const toggleExpand = (id) => {
    if (expanded === id) {
      setExpanded(null);
      setDetail(null);
    } else {
      setExpanded(id);
      loadDetail(id);
    }
  };

  const action = async (path, method = 'POST', body = null) => {
    setBusy(true);
    setError(null);
    try {
      const r = await authFetch(`${ADMIN}${path}`, {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw new Error(d.error || `HTTP ${r.status}`);
      }
      return true;
    } catch (e) {
      setError(e.message);
      return false;
    } finally {
      setBusy(false);
    }
  };

  const onDisable = async (u) => {
    if (!confirm(`Disable ${u.email || u.id}? They'll be signed out everywhere and unable to log back in.`)) return;
    if (await action(`/users/${u.id}/disable`)) { await load(); if (expanded === u.id) loadDetail(u.id); }
  };
  const onEnable = async (u) => {
    if (await action(`/users/${u.id}/enable`)) { await load(); if (expanded === u.id) loadDetail(u.id); }
  };
  const onDelete = async (u) => {
    if (!confirm(`DELETE ${u.email || u.id} permanently? This cannot be undone.`)) return;
    if (await action(`/users/${u.id}`, 'DELETE')) {
      setExpanded(null); setDetail(null); await load();
    }
  };
  const onRevokeSessions = async (u) => {
    if (!confirm(`Revoke all sessions for ${u.email || u.id}?`)) return;
    if (await action(`/users/${u.id}/revoke-sessions`)) loadDetail(u.id);
  };
  const onClearLockout = async (u) => {
    if (await action(`/users/${u.id}/clear-lockout`)) { await load(); loadDetail(u.id); }
  };
  const onForceReset = async (u) => {
    if (!u.email) { alert('User has no email — cannot send reset link.'); return; }
    if (!confirm(`Email a password reset link to ${u.email}?`)) return;
    if (await action(`/users/${u.id}/force-password-reset`)) alert('Reset link sent.');
  };
  const onResendVerify = async (u) => {
    if (await action(`/users/${u.id}/resend-verification`)) alert('Verification email sent.');
  };
  const onBanIp = async (u, ip) => {
    if (!ip) { alert('No IP to ban — user has no recent sessions.'); return; }
    const reason = prompt(`Ban IP ${ip}? Optional reason:`, `via user ${u.email || u.id}`);
    if (reason === null) return;
    if (await action('/ips', 'POST', { ip, reason })) { alert(`IP ${ip} banned.`); loadIps(); }
  };

  const onAddIp = async () => {
    const ip = newIp.trim();
    if (!ip) return;
    if (await action('/ips', 'POST', { ip, reason: newIpReason.trim() || null })) {
      setNewIp(''); setNewIpReason(''); loadIps();
    }
  };

  const onUnbanIp = async (ip) => {
    if (!confirm(`Unban ${ip}?`)) return;
    if (await action(`/ips/${encodeURIComponent(ip)}`, 'DELETE')) loadIps();
  };

  function getUserSubLabel(user) {
    const subs = user.subscriptions || [];
    if (subs.some(s => s.app_id === '*')) return 'PWX';
    if (subs.length > 0) return subs.map(s => s.app_id).join(', ');
    return null;
  }

  async function syncTier(appId, authUserId, tier) {
    try {
      await authFetch(TIER_SYNC, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appId, authUserId, tier }),
      });
    } catch {}
  }

  const activateSub = async (userId, appId) => {
    setSubBusy(true);
    setError(null);
    try {
      const r = await authFetch(`${ADMIN}/users/${userId}/subscriptions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appId }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw new Error(d.error || `HTTP ${r.status}`);
      }
      if (appId === '*') {
        await Promise.all(SUB_APPS.map(a => syncTier(a, userId, 'paid')));
      } else {
        await syncTier(appId, userId, 'paid');
      }
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setSubBusy(false);
    }
  };

  const deactivateSub = async (subId, userId, appId) => {
    setSubBusy(true);
    setError(null);
    try {
      const r = await authFetch(`${ADMIN}/subscriptions/${subId}`, { method: 'DELETE' });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw new Error(d.error || `HTTP ${r.status}`);
      }
      if (appId === '*') {
        await Promise.all(SUB_APPS.map(a => syncTier(a, userId, 'free')));
      } else {
        await syncTier(appId, userId, 'free');
      }
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setSubBusy(false);
    }
  };

  const ts = (v) => {
    if (v == null) return 0;
    if (typeof v === 'number') return v;
    const t = new Date(v).getTime();
    return Number.isFinite(t) ? t : 0;
  };

  const visible = users
    .filter(u => !search || (u.email && u.email.toLowerCase().includes(search.toLowerCase())))
    .sort((a, b) => {
      switch (sort) {
        case 'created_asc': return ts(a.created_at) - ts(b.created_at);
        case 'created_desc': return ts(b.created_at) - ts(a.created_at);
        case 'last_seen': return ts(b.last_seen_at) - ts(a.last_seen_at);
        case 'locked_first': return (b.locked_at ? 1 : 0) - (a.locked_at ? 1 : 0);
        case 'banned_first': return (b.banned_at ? 1 : 0) - (a.banned_at ? 1 : 0);
        default: return 0;
      }
    });

  return (
    <div className="space-y-3">
      <div className="flex gap-2 flex-wrap">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search email..."
          className="flex-1 min-w-[140px] px-2 py-1.5 bg-zinc-800 border border-zinc-700 rounded-lg text-xs text-white"
        />
        <select
          value={sort}
          onChange={e => setSort(e.target.value)}
          className="px-2 py-1.5 bg-zinc-800 border border-zinc-700 rounded-lg text-xs text-white"
        >
          <option value="created_desc">Newest first</option>
          <option value="created_asc">Oldest first</option>
          <option value="last_seen">Recently active</option>
          <option value="locked_first">Locked first</option>
          <option value="banned_first">Banned first</option>
        </select>
        <button
          onClick={load}
          className="px-3 py-1.5 bg-zinc-800 border border-zinc-700 rounded-lg text-xs hover:bg-zinc-700"
        >Refresh</button>
      </div>

      <div className="flex items-center justify-between">
        <div className="text-[10px] text-zinc-500">
          {visible.length} of {users.length} users
        </div>
        <button
          onClick={() => setShowIps(s => !s)}
          className="text-[10px] text-zinc-400 hover:text-zinc-200"
        >
          {showIps ? '- Hide' : '+ Show'} banned IPs ({bannedIps.length})
        </button>
      </div>

      {showIps && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 space-y-2">
          <div className="flex gap-1.5">
            <input
              type="text"
              value={newIp}
              onChange={e => setNewIp(e.target.value)}
              placeholder="IP address"
              className="flex-1 min-w-0 px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-[11px] text-white font-mono"
            />
            <input
              type="text"
              value={newIpReason}
              onChange={e => setNewIpReason(e.target.value)}
              placeholder="Reason (optional)"
              className="flex-1 min-w-0 px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-[11px] text-white"
            />
            <button
              onClick={onAddIp}
              disabled={busy || !newIp.trim()}
              className="px-2 py-1 bg-red-500/20 border border-red-500/40 text-red-300 rounded text-[10px] hover:bg-red-500/30 disabled:opacity-40 shrink-0"
            >Ban</button>
          </div>
          {bannedIps.length === 0 ? (
            <div className="text-[11px] text-zinc-600 italic">No IPs currently banned</div>
          ) : (
            <div className="space-y-1">
              {bannedIps.map(b => (
                <div key={b.ip_address} className="flex items-center justify-between gap-2 py-1 border-b border-zinc-800/50 last:border-0">
                  <div className="min-w-0">
                    <div className="text-[11px] text-zinc-200 font-mono">{b.ip_address}</div>
                    <div className="text-[10px] text-zinc-500 truncate">
                      {fmtDate(b.banned_at)} {b.banned_by_email ? `· ${b.banned_by_email}` : ''} {b.reason ? `· ${b.reason}` : ''}
                    </div>
                  </div>
                  <button
                    onClick={() => onUnbanIp(b.ip_address)}
                    disabled={busy}
                    className="px-2 py-1 bg-zinc-800 border border-zinc-700 text-zinc-300 rounded text-[10px] hover:bg-zinc-700 disabled:opacity-40 shrink-0"
                  >Unban</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="px-3 py-2 bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg text-xs">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-zinc-500 text-sm">Loading...</div>
      ) : visible.length === 0 ? (
        <div className="text-center py-12 text-zinc-500 text-sm">No users found</div>
      ) : (
        <div className="space-y-2">
          {visible.map(u => {
            const isExpanded = expanded === u.id;
            const isBanned = !!u.banned_at;
            const isLocked = !!u.locked_at;
            const isUnverified = !u.email_verified_at;
            return (
              <div key={u.id} className={`bg-zinc-900 border rounded-lg overflow-hidden ${isBanned ? 'border-red-900/60' : 'border-zinc-800'}`}>
                <button
                  onClick={() => toggleExpand(u.id)}
                  className="w-full text-left px-3 py-2.5 hover:bg-zinc-800/40 transition"
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-sm text-white font-medium truncate">{u.email || 'No email'}</span>
                    <div className="flex gap-1 shrink-0">
                      {isBanned && <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-red-500/20 text-red-400 border border-red-500/30">BANNED</span>}
                      {isLocked && !isBanned && <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-orange-500/20 text-orange-400 border border-orange-500/30">LOCKED</span>}
                      {isUnverified && !isBanned && <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">UNVERIFIED</span>}
                      {u.active_sessions > 0 && <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-green-500/20 text-green-400 border border-green-500/30">{u.active_sessions} live</span>}
                      {getUserSubLabel(u) && <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-violet-500/20 text-violet-400 border border-violet-500/30">{getUserSubLabel(u)}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-[10px] text-zinc-500">
                    <span>created {fmtDate(u.created_at)}</span>
                    <span>seen {fmtRelative(u.last_seen_at)}</span>
                    {u.failed_login_attempts > 0 && <span className="text-orange-400">{u.failed_login_attempts} fails</span>}
                  </div>
                  {u.apps && u.apps.length > 0 && (
                    <div className="flex gap-1 flex-wrap mt-1">
                      {u.apps.map(app => (
                        <span key={app} className="px-1.5 py-0.5 text-[9px] rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">{app}</span>
                      ))}
                    </div>
                  )}
                </button>

                {isExpanded && (
                  <div className="border-t border-zinc-800 bg-zinc-950/50 p-3 space-y-3">
                    {!detail ? (
                      <div className="text-xs text-zinc-500">Loading detail...</div>
                    ) : (
                      <>
                        <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
                          <div className="text-zinc-500">id</div>
                          <div className="text-zinc-300 font-mono truncate">{detail.user.id}</div>
                          <div className="text-zinc-500">created</div>
                          <div className="text-zinc-300">{fmtDateTime(detail.user.created_at)}</div>
                          <div className="text-zinc-500">updated</div>
                          <div className="text-zinc-300">{fmtDateTime(detail.user.updated_at)}</div>
                          <div className="text-zinc-500">verified</div>
                          <div className="text-zinc-300">{fmtDateTime(detail.user.email_verified_at)}</div>
                          <div className="text-zinc-500">banned</div>
                          <div className="text-zinc-300">{detail.user.banned_at ? fmtDateTime(detail.user.banned_at) : '—'}</div>
                          <div className="text-zinc-500">locked</div>
                          <div className="text-zinc-300">{detail.user.locked_at ? fmtDateTime(detail.user.locked_at) : '—'}</div>
                          <div className="text-zinc-500">fails</div>
                          <div className="text-zinc-300">{detail.user.failed_login_attempts}</div>
                          <div className="text-zinc-500">ref code</div>
                          <div className="text-zinc-300 font-mono">{detail.user.referral_code || '—'}</div>
                          <div className="text-zinc-500">referred by</div>
                          <div className="text-zinc-300 font-mono">{detail.user.referred_by_code || '—'}</div>
                          <div className="text-zinc-500">apps</div>
                          <div className="flex gap-1 flex-wrap">
                            {u.apps && u.apps.length > 0 ? u.apps.map(app => (
                              <span key={app} className="px-1.5 py-0.5 text-[9px] rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">{app}</span>
                            )) : <span className="text-zinc-600">—</span>}
                          </div>
                        </div>

                        {(() => {
                          const activeSubs = u.subscriptions || [];
                          const hasPwx = activeSubs.some(s => s.app_id === '*');
                          const activeAppIds = new Set(activeSubs.filter(s => s.app_id !== '*').map(s => s.app_id));

                          return (
                            <div>
                              <div className="text-[10px] text-zinc-500 uppercase tracking-wide mb-1.5">Subscriptions</div>

                              {activeSubs.length === 0 && (
                                <div className="text-[11px] text-zinc-600 italic mb-2">No active subscriptions</div>
                              )}

                              {activeSubs.length > 0 && (
                                <div className="space-y-1 mb-2">
                                  {activeSubs.map(s => (
                                    <div key={s.id} className="flex items-center justify-between gap-2 py-1 px-2 bg-green-500/5 border border-green-500/20 rounded">
                                      <div className="text-[11px]">
                                        <span className="text-green-400 font-medium">
                                          {s.app_id === '*' ? 'PublicWerx (all apps)' : s.app_id}
                                        </span>
                                        <span className="text-zinc-500 ml-2">expires {fmtDate(s.expires_at)}</span>
                                      </div>
                                      <button
                                        onClick={() => {
                                          if (!confirm(`Remove ${s.app_id === '*' ? 'PublicWerx' : s.app_id} subscription?`)) return;
                                          deactivateSub(s.id, u.id, s.app_id);
                                        }}
                                        disabled={subBusy}
                                        className="px-1.5 py-0.5 text-[9px] text-red-400 border border-red-500/30 rounded hover:bg-red-500/10 disabled:opacity-40"
                                      >Remove</button>
                                    </div>
                                  ))}
                                </div>
                              )}

                              <div className="flex gap-1.5 flex-wrap">
                                {!hasPwx && (
                                  <button
                                    onClick={() => activateSub(u.id, '*')}
                                    disabled={subBusy}
                                    className="px-2 py-1 bg-violet-500/10 border border-violet-500/30 text-violet-400 rounded text-[10px] hover:bg-violet-500/20 disabled:opacity-40"
                                  >+ PublicWerx ($60/yr)</button>
                                )}
                                {!hasPwx && SUB_APPS.map(appId => (
                                  !activeAppIds.has(appId) && (
                                    <button
                                      key={appId}
                                      onClick={() => activateSub(u.id, appId)}
                                      disabled={subBusy}
                                      className="px-2 py-1 bg-blue-500/10 border border-blue-500/30 text-blue-400 rounded text-[10px] hover:bg-blue-500/20 disabled:opacity-40"
                                    >+ {appId} ($36/yr)</button>
                                  )
                                ))}
                              </div>
                            </div>
                          );
                        })()}

                        <div>
                          <div className="text-[10px] text-zinc-500 uppercase tracking-wide mb-1">Active sessions ({detail.sessions.length})</div>
                          {detail.sessions.length === 0 ? (
                            <div className="text-[11px] text-zinc-600 italic">No live sessions</div>
                          ) : (
                            <div className="space-y-1">
                              {detail.sessions.map(s => (
                                <div key={s.id} className="text-[10px] text-zinc-400 flex items-center justify-between gap-2 py-1 border-b border-zinc-800/50">
                                  <div className="min-w-0">
                                    <div className="text-zinc-300 font-mono">{s.ip_address || '—'}</div>
                                    <div className="text-zinc-600 truncate max-w-[200px]">{s.user_agent || '—'}</div>
                                  </div>
                                  <div className="text-right shrink-0">
                                    <div>{fmtRelative(s.last_seen_at)}</div>
                                    {s.ip_address && (
                                      <button
                                        onClick={() => onBanIp(u, s.ip_address)}
                                        disabled={busy}
                                        className="text-[9px] text-red-400 hover:text-red-300 disabled:opacity-40"
                                      >ban IP</button>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        <div>
                          <div className="text-[10px] text-zinc-500 uppercase tracking-wide mb-1">Recent activity ({detail.audit.length})</div>
                          {detail.audit.length === 0 ? (
                            <div className="text-[11px] text-zinc-600 italic">No audit events</div>
                          ) : (
                            <div className="max-h-48 overflow-y-auto space-y-0.5 pr-1">
                              {detail.audit.map(a => (
                                <div key={a.id} className="text-[10px] text-zinc-500 flex items-center gap-2 py-0.5">
                                  <span className="text-zinc-600 shrink-0 w-[110px]">{fmtDateTime(a.created_at)}</span>
                                  <span className={`shrink-0 ${a.event_type.includes('failed') || a.event_type.includes('locked') || a.event_type.includes('banned') ? 'text-red-400' : a.event_type.includes('admin') ? 'text-violet-400' : 'text-zinc-400'}`}>
                                    {a.event_type}
                                  </span>
                                  <span className="text-zinc-600 truncate font-mono">{a.ip_address || ''}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="flex gap-1.5 flex-wrap pt-1 border-t border-zinc-800">
                          {!isBanned ? (
                            <button onClick={() => onDisable(u)} disabled={busy} className="px-2 py-1 bg-red-500/10 border border-red-500/30 text-red-400 rounded text-[10px] hover:bg-red-500/20 disabled:opacity-40">Disable</button>
                          ) : (
                            <button onClick={() => onEnable(u)} disabled={busy} className="px-2 py-1 bg-green-500/10 border border-green-500/30 text-green-400 rounded text-[10px] hover:bg-green-500/20 disabled:opacity-40">Enable</button>
                          )}
                          <button onClick={() => onRevokeSessions(u)} disabled={busy} className="px-2 py-1 bg-zinc-800 border border-zinc-700 text-zinc-300 rounded text-[10px] hover:bg-zinc-700 disabled:opacity-40">Revoke sessions</button>
                          {isLocked && (
                            <button onClick={() => onClearLockout(u)} disabled={busy} className="px-2 py-1 bg-zinc-800 border border-zinc-700 text-zinc-300 rounded text-[10px] hover:bg-zinc-700 disabled:opacity-40">Clear lockout</button>
                          )}
                          <button onClick={() => onForceReset(u)} disabled={busy} className="px-2 py-1 bg-zinc-800 border border-zinc-700 text-zinc-300 rounded text-[10px] hover:bg-zinc-700 disabled:opacity-40">Force reset</button>
                          {isUnverified && (
                            <button onClick={() => onResendVerify(u)} disabled={busy} className="px-2 py-1 bg-zinc-800 border border-zinc-700 text-zinc-300 rounded text-[10px] hover:bg-zinc-700 disabled:opacity-40">Resend verify</button>
                          )}
                          <button onClick={() => onDelete(u)} disabled={busy} className="ml-auto px-2 py-1 bg-red-500/20 border border-red-500/40 text-red-300 rounded text-[10px] hover:bg-red-500/30 disabled:opacity-40 font-bold">DELETE</button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
