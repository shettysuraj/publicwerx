async function load() {
  try {
    const res = await fetch('/api/status/public');
    if (!res.ok) throw new Error();
    render(await res.json());
  } catch {
    document.getElementById('app').innerHTML = '<p class="loading">Failed to load status</p>';
  }
}

function dotGrid(history) {
  const slots = 48;
  const step = Math.max(1, Math.floor(history.length / slots));
  let html = '<div class="dot-grid">';
  for (let i = 0; i < slots; i++) {
    const idx = Math.min(i * step, history.length - 1);
    const s = history[idx] ? history[idx].status : 'unknown';
    html += `<div class="grid-dot ${s}"></div>`;
  }
  return html + '</div>';
}

function render({ services, checkedAt }) {
  const upCount = services.filter(s => s.status === 'up').length;
  const allUp = upCount === services.length;
  const summaryClass = allUp ? 'up' : 'down';

  let html = `<div class="summary">
    <div class="pulse ${summaryClass}"></div>
    <span class="summary-text ${summaryClass}">${allUp ? 'All systems operational' : `${services.length - upCount} service${services.length - upCount > 1 ? 's' : ''} experiencing issues`}</span>
  </div><div class="services">`;

  for (const svc of services) {
    html += `<div class="service">
      <div class="service-header">
        <div class="service-left">
          <div class="dot ${svc.status}"></div>
          <span class="service-name">${svc.label}</span>
        </div>
        <div class="service-right">
          ${svc.ms != null ? `<span class="service-ms${svc.ms > 2000 ? ' slow' : ''}">${svc.ms}ms</span>` : ''}
          <span class="service-status ${svc.status}">${svc.status}</span>
        </div>
      </div>
      ${svc.history.length > 0 ? dotGrid(svc.history) : ''}
      ${svc.checkedAt ? `<p class="checked-at">Last checked: ${new Date(svc.checkedAt + 'Z').toLocaleString()}</p>` : ''}
    </div>`;
  }
  html += '</div>';
  document.getElementById('app').innerHTML = html;
}

load();
setInterval(load, 60000);
