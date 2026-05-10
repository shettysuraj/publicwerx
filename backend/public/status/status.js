async function load() {
  try {
    const res = await fetch('/api/status/public');
    if (!res.ok) throw new Error();
    const data = await res.json();
    render(data);
  } catch {
    document.getElementById('app').innerHTML = '<p class="loading">Failed to load status</p>';
  }
}
function render({ services, checkedAt }) {
  const upCount = services.filter(s => s.status === 'up').length;
  const allUp = upCount === services.length;
  let html = `<div class="summary ${allUp ? 'all-up' : 'has-issues'}">
    <div class="dot ${allUp ? 'up' : 'down'}"></div>
    <span class="summary-text">${allUp ? 'All systems operational' : `${services.length - upCount} service${services.length - upCount > 1 ? 's' : ''} experiencing issues`}</span>
  </div><div class="services">`;
  for (const svc of services) {
    html += `<div class="service">
      <div class="service-left">
        <div class="dot ${svc.status}"></div>
        <span class="service-name">${svc.label}</span>
      </div>
      <div class="service-right">
        ${svc.ms != null ? `<span class="service-ms">${svc.ms}ms</span>` : ''}
        <span class="service-status ${svc.status}">${svc.status}</span>
      </div>
    </div>`;
  }
  html += '</div>';
  if (checkedAt) {
    html += `<p class="checked-at">Last checked: ${new Date(checkedAt + 'Z').toLocaleString()}</p>`;
  }
  document.getElementById('app').innerHTML = html;
}
load();
setInterval(load, 60000);
