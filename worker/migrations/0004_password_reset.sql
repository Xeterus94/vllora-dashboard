ALTER TABLE users ADD COLUMN email TEXT COLLATE NOCASE;
CREATE INDEX users_email ON users(email,client_id);
CREATE TABLE password_resets (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 host TEXT NOT NULL, email TEXT NOT NULL, password_version INTEGER NOT NULL, expires_at INTEGER NOT NULL, used_at INTEGER);
CREATE INDEX resets_user ON password_resets(user_id);
CREATE TABLE rate_limits (key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires_at INTEGER NOT NULL);
