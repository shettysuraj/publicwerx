import { useState, useEffect, useCallback } from 'react';
import { authFetch, AUTH_BASE } from '../../lib/adminAuth';

const ADMIN = `${AUTH_BASE}/admin`;

const REQUIRED_COLOR_KEYS = [
  'bg', 'surface', 'border', 'primary',
  'primaryText', 'text', 'muted', 'focus',
];

const DEFAULT_COLORS = {
  bg: '#0a0b10',
  surface: '#14161e',
  border: '#27272a',
  primary: '#ffffff',
  primaryText: '#0a0b10',
  text: '#e8eaf0',
  muted: '#8b8fa8',
  focus: 'rgba(255, 255, 255, 0.12)',
};

const DEFAULT_PASSWORD_RULES = {
  minLength: 8,
  requireLower: false,
  requireUpper: false,
  requireDigit: false,
  requireSymbol: false,
};

function emptyForm() {
  return {
    id: '',
    name: '',
    tagline: '',
    returnUrl: '',
    colors: { ...DEFAULT_COLORS },
    passwordRules: { ...DEFAULT_PASSWORD_RULES },
    originsInput: '',
  };
}

export default function AppsTab() {
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState(null);
  const [editing, setEditing] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState(emptyForm());
  const [newOrigin, setNewOrigin] = useState({});

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const r = await authFetch(`${ADMIN}/apps`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = await r.json();
      setApps(d.apps || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const action = async (path, method, body) => {
    setBusy(true); setError(null);
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

  const startEdit = (app) => {
    setEditing(app.id);
    setEditForm({
      id: app.id,
      name: app.name || '',
      tagline: app.tagline || '',
      returnUrl: app.returnUrl || '',
      colors: { ...DEFAULT_COLORS, ...(app.colors || {}) },
      passwordRules: { ...DEFAULT_PASSWORD_RULES, ...(app.passwordRules || {}) },
    });
  };

  const cancelEdit = () => { setEditing(null); setEditForm(null); };

  const saveEdit = async () => {
    if (!editForm) return;
    const ok = await action(`/apps/${editForm.id}`, 'PATCH', {
      name: editForm.name,
      tagline: editForm.tagline || null,
      returnUrl: editForm.returnUrl || null,
      colors: editForm.colors,
      passwordRules: editForm.passwordRules,
    });
    if (ok) { cancelEdit(); await load(); }
  };

  const onCreate = async () => {
    const origins = createForm.originsInput
      .split(/[\n,]/)
      .map(s => s.trim())
      .filter(Boolean);
    const ok = await action('/apps', 'POST', {
      id: createForm.id,
      name: createForm.name,
      tagline: createForm.tagline || null,
      returnUrl: createForm.returnUrl || null,
      colors: createForm.colors,
      passwordRules: createForm.passwordRules,
      origins,
    });
    if (ok) {
      setCreating(false);
      setCreateForm(emptyForm());
      await load();
    }
  };

  const onDelete = async (app) => {
    if (!confirm(`Delete app "${app.id}"? Consumer projects using this id will lose their branding and CORS access.`)) return;
    if (await action(`/apps/${app.id}`, 'DELETE')) {
      if (expanded === app.id) setExpanded(null);
      await load();
    }
  };

  const onAddOrigin = async (appId) => {
    const origin = (newOrigin[appId] || '').trim();
    if (!origin) return;
    if (await action(`/apps/${appId}/origins`, 'POST', { origin })) {
      setNewOrigin(o => ({ ...o, [appId]: '' }));
      await load();
    }
  };

  const onRemoveOrigin = async (appId, originId) => {
    if (!confirm('Remove this origin? CORS preflights from this domain will be blocked.')) return;
    if (await action(`/apps/${appId}/origins/${originId}`, 'DELETE')) await load();
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="text-[10px] text-zinc-500">{apps.length} registered apps</div>
        <div className="flex gap-2">
          <button onClick={load} className="px-3 py-1.5 bg-zinc-800 border border-zinc-700 rounded-lg text-xs hover:bg-zinc-700">Refresh</button>
          <button onClick={() => setCreating(c => !c)} className="px-3 py-1.5 bg-violet-500/20 border border-violet-500/40 text-violet-300 rounded-lg text-xs hover:bg-violet-500/30">
            {creating ? 'Cancel' : '+ New app'}
          </button>
        </div>
      </div>

      {error && (
        <div className="px-3 py-2 bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg text-xs">{error}</div>
      )}

      {creating && (
        <div className="bg-zinc-900 border border-violet-500/30 rounded-lg p-3 space-y-2">
          <div className="text-xs text-violet-300 font-bold mb-1">Create new app</div>
          <AppForm
            form={createForm}
            setForm={setCreateForm}
            isCreate
          />
          <div className="flex gap-1.5 pt-2 border-t border-zinc-800">
            <button onClick={onCreate} disabled={busy || !createForm.id || !createForm.name}
              className="px-3 py-1.5 bg-violet-500/20 border border-violet-500/40 text-violet-300 rounded text-xs hover:bg-violet-500/30 disabled:opacity-40">
              Create
            </button>
            <button onClick={() => { setCreating(false); setCreateForm(emptyForm()); }}
              className="px-3 py-1.5 bg-zinc-800 border border-zinc-700 text-zinc-300 rounded text-xs hover:bg-zinc-700">
              Cancel
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-zinc-500 text-sm">Loading...</div>
      ) : apps.length === 0 ? (
        <div className="text-center py-12 text-zinc-500 text-sm">No apps registered</div>
      ) : (
        <div className="space-y-2">
          {apps.map(app => {
            const isExpanded = expanded === app.id;
            const isEditing = editing === app.id;
            return (
              <div key={app.id} className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
                <button
                  onClick={() => setExpanded(isExpanded ? null : app.id)}
                  className="w-full text-left px-3 py-2.5 hover:bg-zinc-800/40 transition"
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="w-3 h-3 rounded-full shrink-0 border border-zinc-700"
                        style={{ backgroundColor: app.colors?.primary || '#fff' }}
                      />
                      <span className="text-sm text-white font-medium truncate">{app.name}</span>
                      <span className="text-[10px] text-zinc-500 font-mono shrink-0">{app.id}</span>
                    </div>
                    <span className="text-[10px] text-zinc-500 shrink-0">{app.origins?.length || 0} origins</span>
                  </div>
                  {app.tagline && <div className="text-[10px] text-zinc-500 truncate">{app.tagline}</div>}
                </button>

                {isExpanded && (
                  <div className="border-t border-zinc-800 bg-zinc-950/50 p-3 space-y-3">
                    {isEditing ? (
                      <>
                        <AppForm form={editForm} setForm={setEditForm} />
                        <div className="flex gap-1.5 pt-2 border-t border-zinc-800">
                          <button onClick={saveEdit} disabled={busy}
                            className="px-3 py-1.5 bg-green-500/20 border border-green-500/40 text-green-300 rounded text-xs hover:bg-green-500/30 disabled:opacity-40">
                            Save
                          </button>
                          <button onClick={cancelEdit}
                            className="px-3 py-1.5 bg-zinc-800 border border-zinc-700 text-zinc-300 rounded text-xs hover:bg-zinc-700">
                            Cancel
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
                          <div className="text-zinc-500">return url</div>
                          <div className="text-zinc-300 truncate">{app.returnUrl || '—'}</div>
                          <div className="text-zinc-500">min length</div>
                          <div className="text-zinc-300">{app.passwordRules?.minLength || 8}</div>
                          <div className="text-zinc-500">password</div>
                          <div className="text-zinc-300 text-[10px]">
                            {[
                              app.passwordRules?.requireLower && 'lower',
                              app.passwordRules?.requireUpper && 'upper',
                              app.passwordRules?.requireDigit && 'digit',
                              app.passwordRules?.requireSymbol && 'symbol',
                            ].filter(Boolean).join(', ') || 'none required'}
                          </div>
                        </div>

                        <div>
                          <div className="text-[10px] text-zinc-500 uppercase tracking-wide mb-1">Branding</div>
                          <div className="flex gap-1 flex-wrap">
                            {REQUIRED_COLOR_KEYS.map(k => (
                              <div key={k} className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 rounded px-1.5 py-0.5">
                                <span className="w-3 h-3 rounded-sm border border-zinc-700" style={{ backgroundColor: app.colors?.[k] }} />
                                <span className="text-[9px] text-zinc-500">{k}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div>
                          <div className="text-[10px] text-zinc-500 uppercase tracking-wide mb-1">Allowed origins</div>
                          {(app.origins || []).length === 0 ? (
                            <div className="text-[11px] text-zinc-600 italic mb-1">No origins (CORS will reject this app)</div>
                          ) : (
                            <div className="space-y-1 mb-2">
                              {app.origins.map(o => (
                                <div key={o.id} className="flex items-center justify-between gap-2 py-0.5">
                                  <span className="text-[11px] text-zinc-300 font-mono truncate">{o.origin}</span>
                                  <button
                                    onClick={() => onRemoveOrigin(app.id, o.id)}
                                    disabled={busy}
                                    className="text-[9px] text-red-400 hover:text-red-300 disabled:opacity-40 shrink-0"
                                  >remove</button>
                                </div>
                              ))}
                            </div>
                          )}
                          <div className="flex gap-1.5">
                            <input
                              type="text"
                              value={newOrigin[app.id] || ''}
                              onChange={e => setNewOrigin(o => ({ ...o, [app.id]: e.target.value }))}
                              placeholder="https://example.com"
                              className="flex-1 min-w-0 px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-[11px] text-white font-mono"
                            />
                            <button
                              onClick={() => onAddOrigin(app.id)}
                              disabled={busy || !(newOrigin[app.id] || '').trim()}
                              className="px-2 py-1 bg-zinc-800 border border-zinc-700 text-zinc-300 rounded text-[10px] hover:bg-zinc-700 disabled:opacity-40 shrink-0"
                            >Add</button>
                          </div>
                        </div>

                        <div className="flex gap-1.5 pt-2 border-t border-zinc-800">
                          {app.id !== 'default' && (
                            <button onClick={() => startEdit(app)}
                              className="px-2 py-1 bg-zinc-800 border border-zinc-700 text-zinc-300 rounded text-[10px] hover:bg-zinc-700">
                              Edit
                            </button>
                          )}
                          {app.id !== 'default' && (
                            <button onClick={() => onDelete(app)} disabled={busy}
                              className="ml-auto px-2 py-1 bg-red-500/20 border border-red-500/40 text-red-300 rounded text-[10px] hover:bg-red-500/30 disabled:opacity-40 font-bold">
                              DELETE
                            </button>
                          )}
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

function AppForm({ form, setForm, isCreate = false }) {
  const update = (patch) => setForm(f => ({ ...f, ...patch }));
  const updateColor = (k, v) => setForm(f => ({ ...f, colors: { ...f.colors, [k]: v } }));
  const updateRule = (k, v) => setForm(f => ({ ...f, passwordRules: { ...f.passwordRules, [k]: v } }));

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[10px] text-zinc-500 block mb-0.5">id {!isCreate && '(locked)'}</label>
          <input
            type="text"
            value={form.id}
            onChange={e => update({ id: e.target.value })}
            disabled={!isCreate}
            placeholder="lowercase-dashes"
            className="w-full px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-[11px] text-white font-mono disabled:opacity-60"
          />
        </div>
        <div>
          <label className="text-[10px] text-zinc-500 block mb-0.5">name</label>
          <input
            type="text"
            value={form.name}
            onChange={e => update({ name: e.target.value })}
            placeholder="Display name"
            className="w-full px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-[11px] text-white"
          />
        </div>
      </div>

      <div>
        <label className="text-[10px] text-zinc-500 block mb-0.5">tagline</label>
        <input
          type="text"
          value={form.tagline}
          onChange={e => update({ tagline: e.target.value })}
          className="w-full px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-[11px] text-white"
        />
      </div>

      <div>
        <label className="text-[10px] text-zinc-500 block mb-0.5">return url</label>
        <input
          type="text"
          value={form.returnUrl}
          onChange={e => update({ returnUrl: e.target.value })}
          placeholder="https://app.example.com/"
          className="w-full px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-[11px] text-white font-mono"
        />
      </div>

      {isCreate && (
        <div>
          <label className="text-[10px] text-zinc-500 block mb-0.5">origins (one per line or comma-separated)</label>
          <textarea
            value={form.originsInput}
            onChange={e => update({ originsInput: e.target.value })}
            placeholder={'https://app.example.com\nhttps://www.example.com'}
            rows={2}
            className="w-full px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-[11px] text-white font-mono"
          />
        </div>
      )}

      <details className="bg-zinc-900 border border-zinc-800 rounded">
        <summary className="text-[10px] text-zinc-400 px-2 py-1 cursor-pointer">Branding colors</summary>
        <div className="p-2 grid grid-cols-2 gap-2">
          {REQUIRED_COLOR_KEYS.map(k => (
            <div key={k}>
              <label className="text-[9px] text-zinc-500 block mb-0.5">{k}</label>
              <div className="flex gap-1">
                <input
                  type="color"
                  value={form.colors[k]?.startsWith('#') ? form.colors[k] : '#000000'}
                  onChange={e => updateColor(k, e.target.value)}
                  className="w-6 h-6 bg-zinc-800 border border-zinc-700 rounded shrink-0"
                />
                <input
                  type="text"
                  value={form.colors[k]}
                  onChange={e => updateColor(k, e.target.value)}
                  className="flex-1 min-w-0 px-1.5 py-0.5 bg-zinc-800 border border-zinc-700 rounded text-[10px] text-white font-mono"
                />
              </div>
            </div>
          ))}
        </div>
      </details>

      <details className="bg-zinc-900 border border-zinc-800 rounded">
        <summary className="text-[10px] text-zinc-400 px-2 py-1 cursor-pointer">Password rules</summary>
        <div className="p-2 space-y-1">
          <div className="flex items-center gap-2">
            <label className="text-[10px] text-zinc-500 w-20">min length</label>
            <input
              type="number"
              min={8}
              max={72}
              value={form.passwordRules.minLength}
              onChange={e => updateRule('minLength', parseInt(e.target.value, 10) || 8)}
              className="w-16 px-1.5 py-0.5 bg-zinc-800 border border-zinc-700 rounded text-[11px] text-white"
            />
            <span className="text-[9px] text-zinc-600">8 floor, 72 ceiling</span>
          </div>
          {['requireLower', 'requireUpper', 'requireDigit', 'requireSymbol'].map(k => (
            <label key={k} className="flex items-center gap-2 text-[11px] text-zinc-400">
              <input
                type="checkbox"
                checked={!!form.passwordRules[k]}
                onChange={e => updateRule(k, e.target.checked)}
                className="accent-violet-500"
              />
              {k.replace('require', '').toLowerCase()}
            </label>
          ))}
        </div>
      </details>
    </div>
  );
}
