CREATE TABLE IF NOT EXISTS ad_references (
  request_id TEXT PRIMARY KEY,
  reference TEXT NOT NULL UNIQUE,
  gclid TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS ad_references_expiry ON ad_references(expires_at);
