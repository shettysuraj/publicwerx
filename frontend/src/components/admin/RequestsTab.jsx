import { useState, useEffect, useCallback } from 'react';
import { authFetch, AUTH_BASE } from '../../lib/adminAuth';

// Access-request review. Registration on auth.publicwerx.org is invite-only:
// an unapproved stranger can only write one row to a queue, and no email is
// sent to anyone until an operator approves here. Approving mints a single-use
// invite and sends exactly one message; declining sends nothing, ever.
const ADMIN = `${AUTH_BASE}/admin`;

function fmtRelative(ts) {
  if (!ts) return 'never';
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function RequestsTab() {
  const [status, setStatus] = useState('pending');
  const [requests, setRequests] = useState([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState(null);
  const [note, setNote] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch(`${ADMIN}/access-requests?status=${encodeURIComponent(status)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setRequests(data.requests || []);
      setPendingCount(data.pending || 0);
    } catch (e) {
      setError(`Could not load requests: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => { load(); }, [load]);

  async function decide(id, action, email) {
    if (action === 'approve' && !confirm(`Approve ${email}?\n\nThis emails them a single-use invite.`)) return;
    if (action === 'ignore' && !confirm(`Decline ${email}?\n\nNothing is sent to them.`)) return;
    setBusyId(id);
    setError(null);
    setNote(null);
    try {
      const res = await authFetch(`${ADMIN}/access-requests/${id}/${action}`, { method: 'POST' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
      setNote(action === 'approve' ? `Invite sent to ${email}.` : `Declined ${email}. Nothing was sent.`);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <div className="flex gap-2 mb-4 items-center flex-wrap">
        {['pending', 'approved', 'ignored'].map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition border ${
              status === s
                ? 'bg-zinc-700 text-white border-zinc-600'
                : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-zinc-200'
            }`}
          >
            {s[0].toUpperCase() + s.slice(1)}{s === 'pending' && pendingCount ? ` (${pendingCount})` : ''}
          </button>
        ))}
        <button
          onClick={load}
          className="px-3 py-1.5 bg-zinc-800 border border-zinc-700 rounded-lg text-xs hover:bg-zinc-700 transition ml-auto"
        >
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {error && <div className="mb-3 px-3 py-2 bg-red-950 border border-red-900 rounded-lg text-xs text-red-300">{error}</div>}
      {note && <div className="mb-3 px-3 py-2 bg-emerald-950 border border-emerald-900 rounded-lg text-xs text-emerald-300">{note}</div>}

      {loading && <div className="text-center py-12 text-zinc-500 text-sm">Loading...</div>}

      {!loading && requests.length === 0 && (
        <div className="text-center py-12 text-zinc-500 text-sm">
          {status === 'pending'
            ? 'Nothing waiting. New requests are emailed to you as they arrive.'
            : `No ${status} requests.`}
        </div>
      )}

      <div className="space-y-3">
        {requests.map((r) => (
          <div key={r.id} className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
            <div className="flex justify-between gap-3 items-start flex-wrap">
              <div className="min-w-0">
                <div className="text-sm font-medium text-white break-all">{r.email}</div>
                <div className="text-[11px] text-zinc-500 mt-0.5">
                  #{r.id} · {r.app || 'default'} · {r.ip || '—'} · {fmtRelative(r.createdAt)}
                </div>
              </div>
              {r.status === 'pending' && (
                <div className="flex gap-2 shrink-0">
                  <button
                    disabled={busyId === r.id}
                    onClick={() => decide(r.id, 'approve', r.email)}
                    className="px-3 py-1.5 bg-emerald-800 border border-emerald-700 rounded-lg text-xs hover:bg-emerald-700 transition disabled:opacity-50"
                  >
                    {busyId === r.id ? '...' : 'Approve'}
                  </button>
                  <button
                    disabled={busyId === r.id}
                    onClick={() => decide(r.id, 'ignore', r.email)}
                    className="px-3 py-1.5 bg-zinc-800 border border-zinc-700 rounded-lg text-xs hover:bg-zinc-700 transition disabled:opacity-50"
                  >
                    Decline
                  </button>
                </div>
              )}
            </div>

            <div className="mt-3 text-sm text-zinc-300 whitespace-pre-wrap break-words">{r.reason}</div>

            {/* A HINT for the reviewer's eyes, never a gate. Every known bot on
                this service sends a quoted User-Agent and no real browser does —
                but it is a rented signal that decays the moment they change
                tooling, so the judgement stays human. */}
            {r.scriptedUaHint && (
              <div className="mt-3 px-3 py-2 bg-amber-950/50 border border-amber-900/60 rounded text-[11px] text-amber-300">
                <strong>Bot hint:</strong> quoted User-Agent — every known bot here sends one, no real browser does. A hint, not a verdict.
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
