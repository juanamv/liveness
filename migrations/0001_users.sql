-- D1 migration: create users table
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  created_at TEXT NOT NULL
);

-- Helpful index for lookups by email
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

