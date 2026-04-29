import { useState, useEffect, useCallback } from 'react'
import {
  AUTH_BASE,
  REFRESH_KEY,
  SSO_BOUNCED_KEY,
  setAccessToken,
  setCachedUser,
  clearCachedUser,
  consumeSsoFragment,
  redirectToAuthorize,
  tryRefresh,
  authFetch,
} from '../lib/adminAuth'
import UsersTab from '../components/admin/UsersTab'
import AppsTab from '../components/admin/AppsTab'
import SubscriptionsTab from '../components/admin/SubscriptionsTab'

const API = '/api/bugs'

export default function BugAdmin() {
  const [auth, setAuth] = useState(null)
  const [tab, _setTab] = useState(() => sessionStorage.getItem('admin:tab') || 'deploy')
  const setTab = (t) => { sessionStorage.setItem('admin:tab', t); _setTab(t) }
  const [reports, setReports] = useState([])
  const [total, setTotal] = useState(0)
  const [filter, setFilter] = useState({ status: 'open', project: '' })
  const [expandedDebug, setExpandedDebug] = useState({})
  const [editingNote, setEditingNote] = useState({})
  const [commentsByBug, setCommentsByBug] = useState({})
  const [commentDrafts, setCommentDrafts] = useState({})
  const [commentBusy, setCommentBusy] = useState({})
  const [expandedComments, setExpandedComments] = useState({})
  const [system, setSystem] = useState(null)
  const [systemLoading, setSystemLoading] = useState(false)

  useEffect(() => { document.title = 'PublicWerx Admin' }, [])

  useEffect(() => {
    (async () => {
      const fromFragment = consumeSsoFragment()
      const refreshed = fromFragment || (await tryRefresh())
      if (!refreshed) {
        if (sessionStorage.getItem(SSO_BOUNCED_KEY)) {
          setAuth(false)
          return
        }
        sessionStorage.setItem(SSO_BOUNCED_KEY, '1')
        redirectToAuthorize()
        return
      }
      try {
        const r = await authFetch(`${API}/auth/me`)
        if (r.ok) {
          const d = await r.json()
          setAuth({ email: d.email })
          sessionStorage.removeItem(SSO_BOUNCED_KEY)
          setCachedUser({ email: d.email })
          if (window.sjsBugWidget) {
            window.sjsBugWidget.setUser({ email: d.email })
            window.sjsBugWidget.setContext({ route: '/admin', authenticated: true })
          }
        } else {
          setAccessToken(null)
          localStorage.removeItem(REFRESH_KEY)
          clearCachedUser()
          setAuth(false)
        }
      } catch {
        setAuth(false)
      }
    })()
  }, [])

  const loadReports = useCallback(() => {
    if (!auth) return
    const params = new URLSearchParams()
    if (filter.status) params.set('status', filter.status)
    if (filter.project) params.set('project', filter.project)
    params.set('limit', '100')
    authFetch(`${API}?${params}`)
      .then(r => r.json())
      .then(d => { setReports(d.reports || []); setTotal(d.total || 0) })
      .catch(() => {})
  }, [auth, filter])

  useEffect(() => { loadReports() }, [loadReports])

  const loadSystem = useCallback(() => {
    if (!auth) return
    setSystemLoading(true)
    authFetch(`${API}/system`)
      .then(r => r.json())
      .then(d => setSystem(d))
      .catch(() => {})
      .finally(() => setSystemLoading(false))
  }, [auth])

  useEffect(() => { if (tab === 'deploy' || tab === 'backups') loadSystem() }, [tab, loadSystem])

  const handleLogout = async () => {
    const refreshToken = localStorage.getItem(REFRESH_KEY)
    if (refreshToken) {
      fetch(`${AUTH_BASE}/auth/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      }).catch(() => {})
    }
    setAccessToken(null)
    localStorage.removeItem(REFRESH_KEY)
    clearCachedUser()
    setAuth(false)
  }

  const updateReport = async (id, updates) => {
    await authFetch(`${API}/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    })
    loadReports()
  }

  const deleteReport = async (id) => {
    if (!confirm('Delete this report?')) return
    await authFetch(`${API}/${id}`, { method: 'DELETE' })
    loadReports()
  }

  const loadComments = async (bugId) => {
    try {
      const r = await authFetch(`${API}/${bugId}/comments`)
      if (!r.ok) return
      const d = await r.json()
      setCommentsByBug(c => ({ ...c, [bugId]: d.comments || [] }))
    } catch {}
  }

  const toggleComments = (bugId) => {
    setExpandedComments(e => {
      const next = { ...e, [bugId]: !e[bugId] }
      if (next[bugId] && !commentsByBug[bugId]) loadComments(bugId)
      return next
    })
  }

  const postComment = async (bugId) => {
    const body = (commentDrafts[bugId] || '').trim()
    if (!body) return
    setCommentBusy(b => ({ ...b, [bugId]: true }))
    try {
      const r = await authFetch(`${API}/${bugId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body }),
      })
      if (r.ok) {
        const d = await r.json()
        setCommentsByBug(c => ({ ...c, [bugId]: [...(c[bugId] || []), d.comment] }))
        setCommentDrafts(d => ({ ...d, [bugId]: '' }))
      }
    } finally {
      setCommentBusy(b => ({ ...b, [bugId]: false }))
    }
  }

  const PROJECTS = ['', 'surajshetty', 'gopbnj', 'wordhop', 'memewhatyasay', 'njordfellfutures', 'peerlinq', 'publicwerx', 'gamefilm', 'aapta', 'srj1cc']
  const STATUSES = ['', 'open', 'acknowledged', 'resolved', 'wontfix']
  const statusColors = { open: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30', acknowledged: 'bg-blue-500/20 text-blue-400 border-blue-500/30', resolved: 'bg-green-500/20 text-green-400 border-green-500/30', wontfix: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30' }
  const typeColors = { bug: 'bg-red-500/20 text-red-400 border-red-500/30', feature: 'bg-purple-500/20 text-purple-400 border-purple-500/30' }

  if (auth === null) return <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-zinc-400 text-sm">Loading...</div>

  if (!auth) return (
    <div className="min-h-screen bg-zinc-950 text-zinc-300 flex items-center justify-center p-4">
      <div className="w-full max-w-xs p-6 bg-zinc-900 rounded-xl border border-zinc-800 text-center">
        <h1 className="text-lg font-bold text-white mb-1">Admin</h1>
        <p className="text-[11px] text-zinc-500 mb-6">Identity by auth.publicwerx.org</p>
        <button
          type="button"
          onClick={() => { sessionStorage.removeItem(SSO_BOUNCED_KEY); redirectToAuthorize() }}
          className="w-full py-2 bg-white text-black text-sm font-semibold rounded-lg hover:bg-zinc-200 transition"
        >
          Sign in
        </button>
        <p className="text-[10px] text-zinc-600 mt-4">
          You'll be redirected to{' '}
          <a
            href="https://auth.publicwerx.org"
            className="text-zinc-500 hover:text-zinc-300 underline"
            target="_blank"
            rel="noopener"
          >
            auth.publicwerx.org
          </a>
          {' '}&mdash; the same identity unlocks every app in the ecosystem.
        </p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-300">
      <div className="max-w-2xl mx-auto px-3 py-4 sm:px-4 sm:py-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-lg font-bold text-white">Admin</h1>
          <div className="flex gap-2">
            <button onClick={() => tab === 'reports' ? loadReports() : (tab === 'deploy' || tab === 'backups') ? loadSystem() : null} className="px-3 py-1.5 bg-zinc-800 border border-zinc-700 rounded-lg text-xs hover:bg-zinc-700 transition">{systemLoading ? 'Loading...' : 'Refresh'}</button>
            <button onClick={handleLogout} className="px-3 py-1.5 bg-zinc-800 border border-zinc-700 rounded-lg text-xs hover:bg-zinc-700 transition">Logout</button>
          </div>
        </div>

        <div className="flex gap-1 mb-4 bg-zinc-900 rounded-lg p-0.5 overflow-x-auto">
          {[['deploy', 'Deploy'], ['backups', 'Backups'], ['users', 'Users'], ['apps', 'Apps'], ['subs', 'Subs'], ['reports', `Reports (${total})`]].map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition shrink-0 ${tab === key ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-zinc-200'}`}
            >{label}</button>
          ))}
          <a href="https://peerlinq.org/security" target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 rounded-md text-xs font-medium transition shrink-0 text-zinc-400 hover:text-zinc-200">Security &rarr;</a>
        </div>

        {tab === 'deploy' && system && <DeployPanel system={system} />}
        {tab === 'deploy' && !system && <div className="text-center py-12 text-zinc-500 text-sm">{systemLoading ? 'Loading...' : 'Failed to load'}</div>}

        {tab === 'backups' && system && <BackupsPanel system={system} />}
        {tab === 'backups' && !system && <div className="text-center py-12 text-zinc-500 text-sm">{systemLoading ? 'Loading...' : 'Failed to load'}</div>}

        {tab === 'users' && <UsersTab />}
        {tab === 'apps' && <AppsTab />}
        {tab === 'subs' && <SubscriptionsTab />}

        {tab === 'reports' && <>
          <div className="flex gap-2 mb-4 flex-wrap">
            <select value={filter.project} onChange={e => setFilter(f => ({ ...f, project: e.target.value }))}
              className="px-2 py-1.5 bg-zinc-800 border border-zinc-700 rounded-lg text-xs text-white">
              <option value="">All Projects</option>
              {PROJECTS.filter(Boolean).map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            <select value={filter.status} onChange={e => setFilter(f => ({ ...f, status: e.target.value }))}
              className="px-2 py-1.5 bg-zinc-800 border border-zinc-700 rounded-lg text-xs text-white">
              <option value="">All Statuses</option>
              {STATUSES.filter(Boolean).map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {reports.length === 0 ? (
            <div className="text-center py-12 text-zinc-500 text-sm">No reports found</div>
          ) : (
            <div className="space-y-3">
              {reports.map(r => (
                <div key={r.id} className="bg-zinc-900 border border-zinc-800 rounded-lg p-3">
                  <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                    <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded border ${typeColors[r.type] || ''}`}>{r.type}</span>
                    <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded border ${statusColors[r.status] || ''}`}>{r.status}</span>
                    <span className="px-1.5 py-0.5 text-[10px] font-medium rounded border border-zinc-600 text-zinc-400 bg-zinc-800">{r.project}</span>
                    {r.page && <span className="text-[10px] text-zinc-500 hidden sm:inline">{r.page}</span>}
                    <span className="text-[10px] text-zinc-600 ml-auto">{new Date(r.created_at + 'Z').toLocaleDateString()}</span>
                  </div>

                  <p className="text-sm text-white whitespace-pre-wrap mb-2">{r.description}</p>

                  <div className="flex items-center gap-1.5 mb-2 text-[11px]">
                    {r.reporter_email ? (
                      <>
                        <span className="text-zinc-400">{r.reporter_email}</span>
                        {r.notify_on_update ? (
                          <span className="text-green-500">&middot; reply will email</span>
                        ) : (
                          <span className="text-zinc-600">&middot; won't email</span>
                        )}
                      </>
                    ) : (
                      <span className="text-zinc-600 italic">no email &mdash; reply won't reach them</span>
                    )}
                  </div>

                  {r.extra_fields && typeof r.extra_fields === 'object' && Object.keys(r.extra_fields).length > 0 && (
                    <div className="flex gap-2 mb-2 flex-wrap">
                      {Object.entries(r.extra_fields).map(([k, v]) => (
                        <span key={k} className="text-[10px] text-zinc-400"><span className="text-zinc-500">{k}:</span> {v}</span>
                      ))}
                    </div>
                  )}

                  {r.debug_log && (
                    <div className="mb-2">
                      <button onClick={() => setExpandedDebug(d => ({ ...d, [r.id]: !d[r.id] }))} className="text-[10px] text-zinc-500 hover:text-zinc-300">
                        {expandedDebug[r.id] ? '- Hide' : '+ Show'} debug
                      </button>
                      {expandedDebug[r.id] && (
                        <pre className="mt-1 p-2 bg-zinc-950 border border-zinc-800 rounded text-[10px] text-zinc-400 overflow-x-auto max-h-40">
                          {(() => { try { return JSON.stringify(JSON.parse(r.debug_log), null, 2) } catch { return r.debug_log } })()}
                        </pre>
                      )}
                    </div>
                  )}

                  <div className="mb-2">
                    {editingNote[r.id] !== undefined ? (
                      <div className="flex gap-1.5">
                        <input value={editingNote[r.id]} onChange={e => setEditingNote(n => ({ ...n, [r.id]: e.target.value }))} placeholder="Note..."
                          className="flex-1 px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-xs text-white min-w-0" />
                        <button onClick={() => { updateReport(r.id, { admin_note: editingNote[r.id] }); setEditingNote(n => { const c = { ...n }; delete c[r.id]; return c }) }}
                          className="px-2 py-1 bg-zinc-700 rounded text-[10px] hover:bg-zinc-600 shrink-0">Save</button>
                        <button onClick={() => setEditingNote(n => { const c = { ...n }; delete c[r.id]; return c })}
                          className="px-2 py-1 bg-zinc-800 rounded text-[10px] hover:bg-zinc-700 shrink-0">X</button>
                      </div>
                    ) : (
                      <button onClick={() => setEditingNote(n => ({ ...n, [r.id]: r.admin_note || '' }))} className="text-[10px] text-zinc-500 hover:text-zinc-300">
                        {r.admin_note ? `Note: ${r.admin_note}` : '+ Note'}
                      </button>
                    )}
                  </div>

                  <div className="mb-2">
                    <button
                      onClick={() => toggleComments(r.id)}
                      className="text-[10px] text-zinc-500 hover:text-zinc-300"
                    >
                      {expandedComments[r.id] ? '- Hide' : '+ Show'} thread
                    </button>
                    {expandedComments[r.id] && (
                      <div className="mt-2 p-2 bg-zinc-950 border border-zinc-800 rounded space-y-2">
                        {(commentsByBug[r.id] || []).length === 0 && (
                          <p className="text-[10px] text-zinc-600 italic">No replies yet.</p>
                        )}
                        {(commentsByBug[r.id] || []).map(c => (
                          <div key={c.id} className="text-[11px]">
                            <div className="flex items-center gap-2 text-zinc-500 mb-0.5">
                              <span className="text-zinc-400">{c.author_email}</span>
                              <span>{new Date(c.created_at + 'Z').toLocaleString()}</span>
                              {c.emailed ? <span className="text-green-500">emailed</span> : <span className="text-zinc-600">not emailed</span>}
                            </div>
                            <p className="text-zinc-200 whitespace-pre-wrap">{c.body}</p>
                          </div>
                        ))}
                        <div className="flex gap-1.5 pt-1">
                          <input
                            value={commentDrafts[r.id] || ''}
                            onChange={e => setCommentDrafts(d => ({ ...d, [r.id]: e.target.value }))}
                            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); postComment(r.id) } }}
                            placeholder={r.reporter_email && r.notify_on_update ? 'Reply (will email reporter)...' : 'Add note (internal only)...'}
                            className="flex-1 px-2 py-1 bg-zinc-900 border border-zinc-700 rounded text-[11px] text-white min-w-0"
                          />
                          <button
                            onClick={() => postComment(r.id)}
                            disabled={commentBusy[r.id] || !(commentDrafts[r.id] || '').trim()}
                            className="px-2 py-1 bg-zinc-700 rounded text-[10px] hover:bg-zinc-600 shrink-0 disabled:opacity-40"
                          >
                            {commentBusy[r.id] ? '...' : r.reporter_email && r.notify_on_update ? 'Send' : 'Note'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-1.5 flex-wrap">
                    {r.status !== 'acknowledged' && <button onClick={() => updateReport(r.id, { status: 'acknowledged' })} className="px-2 py-1 bg-blue-500/10 border border-blue-500/30 text-blue-400 rounded text-[10px] hover:bg-blue-500/20">Ack</button>}
                    {r.status !== 'resolved' && <button onClick={() => updateReport(r.id, { status: 'resolved' })} className="px-2 py-1 bg-green-500/10 border border-green-500/30 text-green-400 rounded text-[10px] hover:bg-green-500/20">Resolve</button>}
                    {r.status !== 'wontfix' && <button onClick={() => updateReport(r.id, { status: 'wontfix' })} className="px-2 py-1 bg-zinc-500/10 border border-zinc-500/30 text-zinc-400 rounded text-[10px] hover:bg-zinc-500/20">Won't Fix</button>}
                    {r.status !== 'open' && <button onClick={() => updateReport(r.id, { status: 'open' })} className="px-2 py-1 bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 rounded text-[10px] hover:bg-yellow-500/20">Reopen</button>}
                    <button onClick={() => deleteReport(r.id)} className="px-2 py-1 bg-red-500/10 border border-red-500/30 text-red-400 rounded text-[10px] hover:bg-red-500/20 ml-auto">Del</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>}
      </div>
    </div>
  )
}

function BackupsPanel({ system: s }) {
  const [selected, setSelected] = useState(null)
  const [backups, setBackups] = useState([])
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [restoring, setRestoring] = useState(null)
  const [message, setMessage] = useState(null)

  const allProjects = s.servers?.flatMap(sv => (sv.backupable || []).map(name => ({ name, server: sv.name }))) || []

  const loadBackups = async (name) => {
    setSelected(name)
    setLoading(true)
    setMessage(null)
    try {
      const r = await authFetch(`/api/bugs/system/backups/${name}`)
      if (r.ok) setBackups(await r.json())
      else setBackups([])
    } catch { setBackups([]) }
    setLoading(false)
  }

  const createBackup = async () => {
    if (!confirm(`Create backup for ${selected}?`)) return
    setCreating(true)
    setMessage(null)
    try {
      const r = await authFetch(`/api/bugs/system/backups/${selected}`, { method: 'POST' })
      const d = await r.json()
      setMessage(d.ok ? `Backed up: ${d.filename}` : `Failed: ${d.error || 'unknown'}`)
      if (d.ok) loadBackups(selected)
    } catch { setMessage('Network error') }
    setCreating(false)
  }

  const restore = async (filename) => {
    if (!confirm(`Restore ${selected} from ${filename}?\n\nA pre-restore backup will be created automatically. The app will restart.`)) return
    setRestoring(filename)
    setMessage(null)
    try {
      const r = await authFetch(`/api/bugs/system/backups/${selected}/restore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename }),
      })
      const d = await r.json()
      setMessage(d.ok ? `Restored from ${d.restored}. Pre-restore backup: ${d.preRestoreBackup}` : `Failed: ${d.error || 'unknown'}`)
      if (d.ok) setTimeout(() => loadBackups(selected), 2000)
    } catch { setMessage('Network error') }
    setRestoring(null)
  }

  const deleteBackup = async (filename) => {
    if (!confirm(`Delete backup ${filename}?`)) return
    try {
      await authFetch(`/api/bugs/system/backups/${selected}/${encodeURIComponent(filename)}`, { method: 'DELETE' })
      loadBackups(selected)
    } catch {}
  }

  const formatSize = (bytes) => {
    if (!bytes) return '—'
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / 1048576).toFixed(1)} MB`
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-1.5 flex-wrap">
        {allProjects.map(p => (
          <button key={p.name} onClick={() => loadBackups(p.name)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${selected === p.name ? 'bg-zinc-700 text-white border border-zinc-600' : 'bg-zinc-800 border border-zinc-700 text-zinc-400 hover:text-zinc-200'}`}
          >{p.name}</button>
        ))}
      </div>

      {selected && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3">
          <div className="flex items-center justify-between mb-3">
            <div className="text-xs font-bold text-white">{selected}</div>
            <button onClick={createBackup} disabled={creating}
              className="px-3 py-1.5 bg-zinc-800 border border-zinc-700 rounded-lg text-xs text-zinc-300 hover:bg-zinc-700 disabled:opacity-50 transition">
              {creating ? 'Backing up...' : 'Create Backup'}
            </button>
          </div>

          {message && <div className="text-[11px] text-zinc-300 bg-zinc-950 border border-zinc-800 rounded p-2 mb-3 whitespace-pre-wrap">{message}</div>}

          {loading ? (
            <div className="text-center py-6 text-zinc-500 text-sm">Loading...</div>
          ) : backups.length === 0 ? (
            <div className="text-center py-6 text-zinc-500 text-sm">No backups yet</div>
          ) : (
            <div className="space-y-1.5">
              {backups.map(b => (
                <div key={b.filename} className="flex items-center gap-2 p-2 bg-zinc-950 border border-zinc-800 rounded text-[11px]">
                  <span className="text-zinc-300 flex-1 min-w-0 truncate">{b.filename}</span>
                  <span className="text-zinc-500 shrink-0">{b.created ? new Date(b.created).toLocaleString() : '—'}</span>
                  <span className="text-zinc-500 shrink-0">{formatSize(b.size)}</span>
                  <button onClick={() => restore(b.filename)} disabled={restoring === b.filename}
                    className="px-2 py-0.5 bg-blue-500/10 border border-blue-500/30 text-blue-400 rounded text-[10px] hover:bg-blue-500/20 shrink-0 disabled:opacity-50">
                    {restoring === b.filename ? '...' : 'Restore'}
                  </button>
                  <button onClick={() => deleteBackup(b.filename)}
                    className="px-2 py-0.5 bg-red-500/10 border border-red-500/30 text-red-400 rounded text-[10px] hover:bg-red-500/20 shrink-0">
                    Del
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function DeployPanel({ system: s }) {
  const [deploying, setDeploying] = useState({})
  const [deployResult, setDeployResult] = useState({})

  const deploy = async (name) => {
    if (!confirm(`Deploy ${name}? This will pull, build, and restart.`)) return
    setDeploying(r => ({ ...r, [name]: true }))
    setDeployResult(r => ({ ...r, [name]: null }))
    try {
      const res = await authFetch(`${API}/system/deploy/${name}`, { method: 'POST' })
      const data = await res.json()
      setDeployResult(r => ({ ...r, [name]: data }))
    } catch { setDeployResult(r => ({ ...r, [name]: { ok: false, output: 'Network error' } })) }
    setDeploying(r => ({ ...r, [name]: false }))
  }

  const dismiss = (name) => setDeployResult(d => { const c = { ...d }; delete c[name]; return c })

  return (
    <div className="space-y-3">
      <div className="text-[10px] text-zinc-500">Metrics, backups, and monitoring live on <a href="https://peerlinq.org/security" target="_blank" rel="noopener noreferrer" className="text-violet-400 hover:text-violet-300">PeerLinq Security</a>.</div>
      {s.servers?.map(server => (
        <div key={server.name} className="bg-zinc-900 border border-zinc-800 rounded-lg p-3">
          <div className="text-xs font-bold text-white mb-2">{server.name}</div>
          <div className="flex gap-1.5 flex-wrap">
            {server.deployable?.map(name => {
              const result = deployResult[name]
              return (
                <div key={name} className="flex flex-col gap-1">
                  <button onClick={() => deploy(name)} disabled={deploying[name]}
                    className="px-3 py-1.5 bg-zinc-800 border border-zinc-700 rounded-lg text-xs text-zinc-300 hover:bg-zinc-700 disabled:opacity-50 transition">
                    {deploying[name] ? `Deploying ${name}...` : name}
                  </button>
                  {result && (
                    <div className={`text-[10px] ${result.ok ? 'text-green-400' : 'text-red-400'}`}>
                      {result.ok ? 'deployed' : `failed (exit ${result.exitCode})`}
                      <button onClick={() => dismiss(name)} className="ml-1.5 text-zinc-500 hover:text-zinc-300">dismiss</button>
                      {result.output && (
                        <pre className="mt-1 text-[9px] text-zinc-500 overflow-x-auto max-h-32 whitespace-pre-wrap">{result.output}</pre>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
