-- Narrator ledger, projects, and jobs. Amounts are integers.
-- Credits are millicredits (1000 = 1 credit). Provider money is micro-USD (1e6 = $1).

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  email_verified_at INTEGER,
  created_at INTEGER NOT NULL,
  stripe_customer_id TEXT,
  plan TEXT NOT NULL DEFAULT 'free',
  plan_status TEXT NOT NULL DEFAULT 'none',
  plan_period_end INTEGER,
  auto_spend INTEGER NOT NULL DEFAULT 0,
  chargeback_frozen INTEGER NOT NULL DEFAULT 0,
  free_grant_issued INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE email_tokens (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purpose TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE outbox (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  to_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  brief TEXT NOT NULL,
  aspect TEXT NOT NULL,
  look_json TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE scenes (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  heading TEXT NOT NULL,
  summary TEXT NOT NULL
);

CREATE TABLE shots (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  scene_id TEXT NOT NULL REFERENCES scenes(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  action TEXT NOT NULL,
  size TEXT NOT NULL,
  angle TEXT NOT NULL,
  movement TEXT NOT NULL,
  lens TEXT NOT NULL,
  focus TEXT NOT NULL,
  lighting TEXT NOT NULL,
  mood TEXT NOT NULL,
  duration_sec INTEGER NOT NULL,
  sound_note TEXT NOT NULL DEFAULT '',
  updated_at INTEGER NOT NULL
);

CREATE TABLE elements (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  name TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);

CREATE TABLE assets (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id TEXT,
  kind TEXT NOT NULL,
  storage_name TEXT NOT NULL,
  mime TEXT NOT NULL,
  bytes INTEGER NOT NULL,
  width INTEGER,
  height INTEGER,
  created_at INTEGER NOT NULL
);

CREATE TABLE element_assets (
  element_id TEXT NOT NULL REFERENCES elements(id) ON DELETE CASCADE,
  asset_id TEXT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  PRIMARY KEY (element_id, asset_id)
);

CREATE TABLE shot_elements (
  shot_id TEXT NOT NULL REFERENCES shots(id) ON DELETE CASCADE,
  element_id TEXT NOT NULL REFERENCES elements(id) ON DELETE CASCADE,
  PRIMARY KEY (shot_id, element_id)
);

CREATE TABLE credit_buckets (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('plan', 'pack', 'promo')),
  granted INTEGER NOT NULL CHECK (granted > 0),
  remaining INTEGER NOT NULL CHECK (remaining >= 0 AND remaining <= granted),
  expires_at INTEGER,
  source_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  UNIQUE (user_id, source_id)
);

CREATE TABLE credit_allocations (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL,
  bucket_id TEXT NOT NULL REFERENCES credit_buckets(id),
  millicredits INTEGER NOT NULL CHECK (millicredits > 0),
  state TEXT NOT NULL CHECK (state IN ('held', 'captured', 'released')),
  created_at INTEGER NOT NULL
);

CREATE TABLE credit_ledger (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  job_id TEXT,
  bucket_id TEXT,
  kind TEXT NOT NULL CHECK (kind IN ('grant', 'reserve', 'capture', 'refund', 'expire', 'clawback')),
  millicredits INTEGER NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL,
  meta_json TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE jobs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL,
  shot_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('still', 'video')),
  status TEXT NOT NULL CHECK (status IN ('queued', 'running', 'succeeded', 'failed')),
  resolution TEXT NOT NULL,
  duration_sec INTEGER NOT NULL,
  quote_millicredits INTEGER NOT NULL,
  captured_millicredits INTEGER,
  provider TEXT NOT NULL,
  provider_microusd INTEGER NOT NULL,
  settled_microusd INTEGER,
  provider_ref TEXT,
  idempotency_key TEXT NOT NULL UNIQUE,
  error TEXT,
  output_asset_id TEXT,
  created_at INTEGER NOT NULL,
  started_at INTEGER,
  finished_at INTEGER
);

CREATE TABLE stripe_events (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  processed_at INTEGER NOT NULL
);

CREATE TABLE rate_buckets (
  bucket_key TEXT PRIMARY KEY,
  window_start INTEGER NOT NULL,
  count INTEGER NOT NULL
);

CREATE TABLE daily_provider (
  user_id TEXT NOT NULL,
  day TEXT NOT NULL,
  microusd INTEGER NOT NULL,
  PRIMARY KEY (user_id, day)
);

CREATE TABLE server_daily_provider (
  day TEXT PRIMARY KEY,
  microusd INTEGER NOT NULL
);

CREATE TABLE planner_usage (
  user_id TEXT NOT NULL,
  period_key TEXT NOT NULL,
  turns INTEGER NOT NULL,
  PRIMARY KEY (user_id, period_key)
);

CREATE INDEX idx_sessions_user ON sessions(user_id);
CREATE INDEX idx_projects_user ON projects(user_id, updated_at DESC);
CREATE INDEX idx_shots_project ON shots(project_id, position);
CREATE INDEX idx_jobs_user_status ON jobs(user_id, status);
CREATE INDEX idx_jobs_shot ON jobs(shot_id, created_at DESC);
CREATE INDEX idx_buckets_user ON credit_buckets(user_id);
CREATE INDEX idx_alloc_job ON credit_allocations(job_id, state);
CREATE INDEX idx_ledger_user ON credit_ledger(user_id, created_at);
