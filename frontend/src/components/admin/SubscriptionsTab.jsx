import { useState, useEffect, useCallback } from 'react';
import { authFetch, AUTH_BASE } from '../../lib/adminAuth';

const ADMIN = `${AUTH_BASE}/admin`;
const SUBS_API = '/api/subscriptions';
const APPS = ['aapta', 'samanu'];

function fmtDate(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

export default function SubscriptionsTab() {
  const [authUsers, setAuthUsers] = useState([]);
  const [appData, setAppData] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState({});
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [usersRes, subsRes] = await Promise.all([
        authFetch(`${ADMIN}/users`),
        authFetch(`${SUBS_API}`),
      ]);
      if (!usersRes.ok) throw new Error(`Users: HTTP ${usersRes.status}`);
      if (!subsRes.ok) throw new Error(`Subs: HTTP ${subsRes.status}`);

      const usersData = await usersRes.json();
      const subsData = await subsRes.json();

      setAuthUsers(usersData.users || []);
      setAppData(subsData.apps || {});
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const tierMaps = {};
  for (const appId of APPS) {
    tierMaps[appId] = {};
    const users = appData[appId];
    if (Array.isArray(users)) {
      for (const u of users) {
        tierMaps[appId][u.auth_user_id] = { localId: u.id, tier: u.subscription_tier || 'free' };
      }
    }
  }

  const toggleTier = async (appId, localUserId, currentTier) => {
    const newTier = currentTier === 'paid' ? 'free' : 'paid';
    const key = `${appId}:${localUserId}`;
    setBusy(b => ({ ...b, [key]: true }));
    try {
      const r = await authFetch(`${SUBS_API}/${appId}/users/${localUserId}/tier`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier: newTier }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw new Error(d.error || `HTTP ${r.status}`);
      }
      setAppData(prev => {
        const updated = { ...prev };
        if (Array.isArray(updated[appId])) {
          updated[appId] = updated[appId].map(u =>
            u.id === localUserId ? { ...u, subscription_tier: newTier } : u
          );
        }
        return updated;
      });
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(b => ({ ...b, [key]: false }));
    }
  };

  const visible = authUsers
    .filter(u => !search || (u.email && u.email.toLowerCase().includes(search.toLowerCase())))
    .filter(u => !u.banned_at)
    .sort((a, b) => (b.last_seen_at || 0) - (a.last_seen_at || 0));

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search email..."
          className="flex-1 min-w-[140px] px-2 py-1.5 bg-zinc-800 border border-zinc-700 rounded-lg text-xs text-white"
        />
        <button
          onClick={load}
          className="px-3 py-1.5 bg-zinc-800 border border-zinc-700 rounded-lg text-xs hover:bg-zinc-700"
        >Refresh</button>
      </div>

      {error && (
        <div className="px-3 py-2 bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg text-xs">
          {error}
          <button onClick={() => setError(null)} className="ml-2 text-zinc-400 hover:text-zinc-200">dismiss</button>
        </div>
      )}

      <div className="text-[10px] text-zinc-500">{visible.length} users</div>

      {loading ? (
        <div className="text-center py-12 text-zinc-500 text-sm">Loading...</div>
      ) : visible.length === 0 ? (
        <div className="text-center py-12 text-zinc-500 text-sm">No users found</div>
      ) : (
        <div className="space-y-2">
          {visible.map(u => {
            const hasAnyApp = APPS.some(a => tierMaps[a][u.id]);
            return (
              <div key={u.id} className="bg-zinc-900 border border-zinc-800 rounded-lg p-3">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-sm text-white font-medium truncate">{u.email || 'No email'}</span>
                  <span className="text-[10px] text-zinc-500 shrink-0">{fmtDate(u.created_at)}</span>
                </div>

                {!hasAnyApp ? (
                  <div className="text-[11px] text-zinc-600 italic">Not registered on any app yet</div>
                ) : (
                  <div className="flex gap-2 flex-wrap">
                    {APPS.map(appId => {
                      const info = tierMaps[appId][u.id];
                      if (!info) return (
                        <div key={appId} className="flex items-center gap-1.5">
                          <span className="text-[11px] text-zinc-500">{appId}</span>
                          <span className="text-[10px] text-zinc-600">—</span>
                        </div>
                      );

                      const isPaid = info.tier === 'paid';
                      const key = `${appId}:${info.localId}`;
                      return (
                        <div key={appId} className="flex items-center gap-1.5">
                          <span className="text-[11px] text-zinc-400">{appId}</span>
                          <button
                            onClick={() => toggleTier(appId, info.localId, info.tier)}
                            disabled={busy[key]}
                            className={`px-2 py-0.5 text-[10px] font-medium rounded border transition ${
                              isPaid
                                ? 'bg-green-500/20 text-green-400 border-green-500/30 hover:bg-green-500/30'
                                : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:bg-zinc-700'
                            } disabled:opacity-40`}
                          >
                            {busy[key] ? '...' : isPaid ? 'PAID' : 'FREE'}
                          </button>
                        </div>
                      );
                    })}
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
