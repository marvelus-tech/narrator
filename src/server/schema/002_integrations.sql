ALTER TABLE users ADD COLUMN google_sub TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_sub ON users(google_sub) WHERE google_sub IS NOT NULL;

CREATE TABLE IF NOT EXISTS user_integrations (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  toolkit TEXT NOT NULL,
  connection_id TEXT,
  status TEXT NOT NULL,
  connected_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, toolkit)
);
