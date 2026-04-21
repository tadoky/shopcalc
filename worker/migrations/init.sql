CREATE TABLE IF NOT EXISTS prices (
  id INTEGER PRIMARY KEY,
  data TEXT NOT NULL,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  admin TEXT,
  before_data TEXT,
  after_data TEXT,
  created_at TEXT
);
