import { useState, useEffect, useCallback } from 'react'
import { authFetch } from '../../lib/adminAuth'

const STATUS_COLORS = {
  up: 'bg-green-500',
  degraded: 'bg-yellow-500',
  down: 'bg-red-500',
  unknown: 'bg-zinc-600',
}

const STATUS_TEXT = {
  up: 'text-green-400',
  degraded: 'text-yellow-400',
  down: 'text-red-400',
  unknown: 'text-zinc-500',
}

function DotGrid({ history }) {
  const slots = 48
  const step = Math.max(1, Math.floor(history.length / slots))
  const dots = []
  for (let i = 0; i < slots; i++) {
    const idx = Math.min(i * step, history.length - 1)
    const h = history[idx]
    dots.push(h ? h.status : 'unknown')
  }
  return (
    <div className="flex gap-px items-center">
      {dots.map((s, i) => (
        <div key={i} className={`w-1.5 h-3 rounded-sm ${STATUS_COLORS[s]} opacity-80`} />
      ))}
    </div>
  )
}

export default function StatusTab() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await authFetch('/api/status?hours=24')
      if (r.ok) setData(await r.json())
    } catch {}
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const runCheck = async () => {
    setChecking(true)
    try {
      await authFetch('/api/status/check', { method: 'POST' })
      await load()
    } catch {}
    setChecking(false)
  }

  if (!data && loading) return <div className="text-center py-12 text-zinc-500 text-sm">Loading...</div>
  if (!data) return <div className="text-center py-12 text-zinc-500 text-sm">Failed to load</div>

  const upCount = data.services.filter(s => s.status === 'up').length
  const total = data.services.length
  const allUp = upCount === total

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className={`w-2.5 h-2.5 rounded-full ${allUp ? 'bg-green-500' : 'bg-red-500'} animate-pulse`} />
          <span className={`text-sm font-medium ${allUp ? 'text-green-400' : 'text-red-400'}`}>
            {allUp ? 'All systems operational' : `${total - upCount} service${total - upCount > 1 ? 's' : ''} degraded or down`}
          </span>
        </div>
        <button
          onClick={runCheck}
          disabled={checking}
          className="px-3 py-1.5 bg-zinc-800 border border-zinc-700 rounded-lg text-xs hover:bg-zinc-700 transition disabled:opacity-50"
        >
          {checking ? 'Checking...' : 'Run Check'}
        </button>
      </div>

      <div className="space-y-2">
        {data.services.map(svc => (
          <div key={svc.id} className="bg-zinc-900 border border-zinc-800 rounded-lg p-3">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${STATUS_COLORS[svc.status]}`} />
                <span className="text-sm font-medium text-zinc-200">{svc.label}</span>
                <span className="text-[10px] text-zinc-600 font-mono">{svc.id}</span>
              </div>
              <div className="flex items-center gap-3">
                {svc.ms != null && (
                  <span className={`text-xs font-mono ${svc.ms > 2000 ? 'text-yellow-400' : 'text-zinc-500'}`}>
                    {svc.ms}ms
                  </span>
                )}
                <span className={`text-xs font-medium uppercase ${STATUS_TEXT[svc.status]}`}>
                  {svc.status}
                </span>
              </div>
            </div>
            {svc.error && (
              <p className="text-[11px] text-red-400/80 font-mono mb-1.5 truncate">{svc.error}</p>
            )}
            {svc.history.length > 0 && <DotGrid history={svc.history} />}
            {svc.checkedAt && (
              <p className="text-[10px] text-zinc-600 mt-1">
                Last checked: {new Date(svc.checkedAt + 'Z').toLocaleString()}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
