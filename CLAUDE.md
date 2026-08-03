# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# publicwerx.org — Constitution Site + Fleet Admin

Central hub for the PublicWerx ecosystem. Serves the static constitution/charter landing page, hosts the shared bug report widget, and runs the admin panel (bug reports, deploy, backups, users, apps).

## Stack

| Layer | Choice |
|---|---|
| Backend | Express 4 + better-sqlite3 (WAL mode) |
| Frontend | React 18 + Vite + Tailwind CSS 3.4 + React Router 6 |
| Auth | RS256 JWT via auth.publicwerx.org (admin allowlist) |
| Fleet ops | publicwerx-core `createSystemRoutes()` |
| Deploy | PM2 + nginx + Certbot on hub box |

## Deployment

- **Box:** Hub box 32.193.86.183, key `~/.ssh/surajshetty.pem`
- **Server dir:** `~/projects/publicwerx/repo`
- **Domain:** publicwerx.org
- **Port:** 3016
- **PM2 process:** publicwerx
- **DB path:** ~/projects/publicwerx/repo/backend/data/publicwerx.db
- **Deploy:** `ssh -i ~/.ssh/surajshetty.pem ubuntu@32.193.86.183 "cd ~/projects/publicwerx/repo && bash deploy.sh"`

## Project Structure

```
repo/
├── backend/
│   ├── src/
│   │   ├── index.js              # Express app — dual-serve: landing + admin SPA + bug API
│   │   ├── db/database.js        # SQLite: bug_reports, bug_form_config, bug_comments
│   ��   ├── routes/
│   │   │   ├── bugs.js           # Bug CRUD, deploy panel, backup proxy, form config
│   │   │   ├── status.js         # Fleet health status (public + admin endpoints)
│   │   │   ├── subscriptions.js  # Subscription tier sync
│   │   │   └── system.js         # publicwerx-core system routes (health, deploy, backup)
│   │   └── lib/
│   │       ├── requireAdmin.js   # RS256 JWT verify via auth.publicwerx.org public key
│   │       ├── health.js         # Fleet uptime monitor (pings 12 services every 3min)
│   │       └── email.js          # Bug notification + reply emails (SES SMTP)
│   ├── data/                     # SQLite DB (gitignored)
│   ├── public/
│   │   ├── landing/              # Static site (tracked in git)
│   │   │   ├── index.html
│   │   │   ├── style.css
│   │   │   ├── theme.js          # Light/dark toggle (external, CSP 'self')
│   │   │   └── favicon.svg
│   │   ├── lib/
│   │   │   └── bug-report.v1.js  # Widget JS (tracked, served with CORP cross-origin)
│   │   ├── status/               # Public status page (static HTML+JS, no build)
│   │   └── admin/                # React build output (gitignored)
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── main.jsx              # Router with basename="/admin"
│   │   ├── pages/BugAdmin.jsx    # 7-tab admin panel (status, deploy, backups, requests, users, apps, reports)
│   │   ├── components/admin/
│   │   │   ├── RequestsTab.jsx   # Invite-only access-request review (approve/decline)
│   │   │   ├── UsersTab.jsx      # Auth user management + subscription management (add/remove subs per user)
│   │   │   └── AppsTab.jsx       # SSO app registry management
│   │   └── lib/adminAuth.js      # SSO client (APP_ID: publicwerx-admin)
│   ├── index.html
│   ├── vite.config.js            # base: '/admin/', outDir: ../backend/public/admin
│   └── package.json
├── deploy.sh                     # Production deploy script
├── CONSTITUTION.md               # The 8 Tenets
└── CLAUDE.md
```

## Routing (Express Priority Order)

1. `/lib/*` — static with CORP cross-origin header (widget JS)
2. `/admin` assets — `express.static('public/admin')`
3. `/api/bugs/*` — bug routes
4. `/api/subscriptions/*` — subscription sync
5. `/api/system/*` — publicwerx-core
6. `/status` — public status page (static HTML+JS, no auth)
7. `/api/status/public` — public status JSON (no auth, 24h history)
8. `/api/status/*` — admin status routes (auth required)
9. `/health` — health check
10. `/api/*` — 404 catch-all
11. `/admin*` — SPA fallback -> `public/admin/index.html`
12. `/` and landing assets — `express.static('public/landing')`

## Key Patterns

- **Dual-serve architecture.** Static landing page at `/` and React SPA at `/admin` from the same Express process. No collision because admin assets are prefixed and the SPA fallback only matches `/admin*`.
- **Bug widget (Stripe.js pattern).** `bug-report.v1.js` is a standalone JS file served with CORP cross-origin. All portfolio apps load it via `<script src="https://publicwerx.org/lib/bug-report.v1.js" data-project="wordhop" defer></script>`. Filename is version-pinned; breaking changes ship as v2.js.
- **Landing page lazy-loads widget.** The beetle button is inline HTML; the widget JS is only fetched on first click so the charter page has zero third-party network activity until the user acts.
- **Landing theme toggle.** Light/dark via `landing/theme.js` — an *external* file because CSP is `script-src 'self'` (no inline JS, no inline handlers). Defaults to the visitor's OS (`prefers-color-scheme`); an explicit toggle is stored in `localStorage` and applied before first paint to avoid FOUC. Colors are CSS custom properties with light overrides under both `@media (prefers-color-scheme: light) :root:not([data-theme="dark"])` and `:root[data-theme="light"]`. Toggle button lives in `.header-right` (outside `nav`) so it survives the mobile `nav { display: none }`.
- **Projects list is hand-curated, public-facing only.** The "Projects Under the Charter" cards are maintained by hand in `landing/index.html` — listing = a claim of charter adoption. Public-facing products only; infra (auth, peerlinq) and personal sites are excluded. Real domains come from nginx `server_name` / the fleet status monitor, never guessed.
- **Admin auth via SSO.** APP_ID is `publicwerx-admin`. Boot flow: consumeSsoFragment -> tryRefresh -> auto-bounce once -> manual sign-in. Admin allowlist in requireAdmin.js.
- **Access request review (Requests tab).** Registration on auth.publicwerx.org is invite-only as of 2026.08.02: an unapproved stranger can only write one row to a queue there, and nothing is emailed to anyone until an operator approves *here*. The tab calls the auth service's `/admin/access-requests` endpoints with the Bearer token this panel already holds from SSO — no new auth. **Approve** mints a single-use invite and sends exactly one email; **Decline** sends nothing. Auth deliberately hosts no review UI of its own.
  - The scripted-User-Agent marker is shown as a **hint for the reviewer's eyes, never a gate** — every known bot on the service sends a quoted UA and no real browser does, but it is a rented signal that decays the moment they change tooling.
  - Approving an address that **already has an account** closes the request and sends nothing (there is nothing to approve). That refusal carries `closed: true` so the UI presents it as an outcome rather than a failure — and the list resyncs after *every* decision, success or not, because the server may have resolved a request behind what looks like an error.
- **Deploy panel.** LOCAL_DEPLOY_COMMANDS for hub-box projects (surajshetty, gopbnj, aapta, publicwerx). Remote projects reached via HTTPS to their /api/system endpoints.
- **Form config per project.** `bug_form_config` table with project-specific overrides (memewhatyasay: gameCode, gottapickone: roundId, aapta: no email fields). Cached in memory, invalidated on admin PUT.
- **Rate limiting.** Global 200/min, API 60/min, bug submit 3/15min, form config 10/min.
- **Fleet health monitoring.** Pings 12 services every 3 minutes, stores results in `health_checks` table (7-day retention). Public status page at `/status` (static HTML+JS, no React). Admin Status tab shows same data plus errors, slugs, and manual re-check button. PeerLinq no longer does health checks — only SSL/headers/admin security scans remain there.
- **Subscription management.** Auth service `subscriptions` table tracks annual subs ($36/yr per app or $60/yr all). Admin manages from Users tab — expand user → add/remove subs. Group A apps (aapta, samanu) enforce via JWT `sub_apps` claim directly — no local tier sync needed. Group B apps (gopbnj, wordhop, memewhatyasay, gamefilm) sync local tier via `POST /api/subscriptions/sync-tier` using system-key auth (gopbnj:3012 via localhost, others via public HTTPS). SUB_APPS in frontend: `['aapta', 'samanu', 'gopbnj', 'wordhop', 'memewhatyasay', 'gamefilm']`.

## Environment Variables

**Required for email:** `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`
**Optional:** `PORT` (3016), `SMTP_PORT` (587), `SYSTEM_API_KEY`, `REMOTE_SYSTEM_KEY`, `AUTH_SERVICE_URL`, `DATA_DIR`
