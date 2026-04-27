const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '../../data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, 'publicwerx.db'));

db.exec(`PRAGMA journal_mode = WAL`);
db.exec(`PRAGMA busy_timeout = 5000`);
db.exec(`PRAGMA synchronous = NORMAL`);
db.exec(`PRAGMA foreign_keys = ON`);

db.exec(`
  CREATE TABLE IF NOT EXISTS bug_reports (
    id          TEXT PRIMARY KEY,
    project     TEXT NOT NULL,
    type        TEXT DEFAULT 'bug' CHECK(type IN ('bug','feature')),
    description TEXT NOT NULL,
    extra_fields TEXT,
    page        TEXT,
    debug_log   TEXT,
    user_agent  TEXT,
    ip_hash     TEXT,
    status      TEXT DEFAULT 'open' CHECK(status IN ('open','acknowledged','resolved','wontfix')),
    admin_note  TEXT,
    reporter_email     TEXT,
    notify_on_update   INTEGER DEFAULT 0,
    app_version TEXT,
    dedup_hash  TEXT,
    created_at  TEXT DEFAULT (datetime('now')),
    resolved_at TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_bug_reports_status ON bug_reports(status, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_bug_reports_project ON bug_reports(project, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_bug_reports_dedup ON bug_reports(dedup_hash);

  CREATE TABLE IF NOT EXISTS bug_form_config (
    project     TEXT PRIMARY KEY,
    config      TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS bug_comments (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    bug_id      TEXT NOT NULL REFERENCES bug_reports(id) ON DELETE CASCADE,
    author_email TEXT NOT NULL,
    body        TEXT NOT NULL,
    emailed     INTEGER DEFAULT 0,
    created_at  TEXT DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_bug_comments_bug ON bug_comments(bug_id, created_at);
`);

function computeDedupHash(project, description) {
  const norm = String(description || '').toLowerCase().replace(/\s+/g, ' ').trim().slice(0, 200);
  return crypto.createHash('sha256').update(`${project}:${norm}`).digest('hex').slice(0, 16);
}

const KNOWN_PROJECTS = ['surajshetty', 'gopbnj', 'srj1cc', 'wordhop', 'memewhatyasay', 'gottapickone', 'njordfellfutures', 'peerlinq', 'publicwerx', 'gamefilm', 'aapta'];

const TYPE_FIELD = { name: 'type', type: 'toggle', options: ['bug', 'feature'], default: 'bug' };
const DESCRIPTION_FIELD = { name: 'description', type: 'textarea', label: "What's on your mind?", placeholder: 'Describe the bug or your idea...', maxLength: 2000, required: true };
const EMAIL_FIELD = { name: 'reporter_email', type: 'text', label: 'Email (optional)', placeholder: 'so we can let you know when this is fixed', maxLength: 200 };
const NOTIFY_FIELD = { name: 'notify_on_update', type: 'checkbox', label: 'Notify me when this bug is updated' };

const defaultFormConfig = JSON.stringify({
  title: 'Bug or Feature Request',
  fields: [TYPE_FIELD, DESCRIPTION_FIELD, EMAIL_FIELD, NOTIFY_FIELD],
  showDebugInfo: true,
});

const projectOverrides = {
  memewhatyasay: JSON.stringify({
    title: 'Bug or Feature Request',
    fields: [
      TYPE_FIELD, DESCRIPTION_FIELD,
      { name: 'gameCode', type: 'text', label: 'Game Code (if applicable)', placeholder: 'e.g. ABCD', maxLength: 10 },
      EMAIL_FIELD, NOTIFY_FIELD,
    ],
    showDebugInfo: true,
  }),
  gottapickone: JSON.stringify({
    title: 'Bug or Feature Request',
    fields: [
      TYPE_FIELD, DESCRIPTION_FIELD,
      { name: 'roundId', type: 'text', label: 'Round # (if applicable)', placeholder: 'e.g. 42', maxLength: 20 },
      EMAIL_FIELD, NOTIFY_FIELD,
    ],
    showDebugInfo: true,
  }),
  aapta: JSON.stringify({
    title: 'Bug or Feature Request',
    fields: [TYPE_FIELD, DESCRIPTION_FIELD],
    showDebugInfo: true,
  }),
};

const insertFormConfig = db.prepare('INSERT OR IGNORE INTO bug_form_config (project, config) VALUES (?, ?)');
const upsertFormConfig = db.prepare('INSERT OR REPLACE INTO bug_form_config (project, config) VALUES (?, ?)');
for (const project of KNOWN_PROJECTS) {
  const config = projectOverrides[project] || defaultFormConfig;
  if (projectOverrides[project]) upsertFormConfig.run(project, config);
  else insertFormConfig.run(project, config);
}

{
  const updateStmt = db.prepare('UPDATE bug_form_config SET config = ? WHERE project = ?');
  for (const project of KNOWN_PROJECTS) {
    if (projectOverrides[project]) continue;
    const existing = db.prepare('SELECT config FROM bug_form_config WHERE project = ?').get(project);
    if (!existing) continue;
    if (existing.config.includes('reporter_email') && existing.config.includes('notify_on_update')) continue;
    updateStmt.run(defaultFormConfig, project);
  }
}

function addColumnIfMissing(table, column, definition) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!cols.some(c => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

module.exports = db;
module.exports.addColumnIfMissing = addColumnIfMissing;
module.exports.KNOWN_PROJECTS = KNOWN_PROJECTS;
module.exports.computeDedupHash = computeDedupHash;
