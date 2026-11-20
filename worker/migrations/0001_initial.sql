CREATE TABLE sites (
 id TEXT PRIMARY KEY, domain TEXT NOT NULL UNIQUE COLLATE NOCASE, name TEXT NOT NULL,
 plan TEXT NOT NULL DEFAULT 'Standard', status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','suspended','deleting')),
 tracking_token TEXT NOT NULL UNIQUE, primary_color TEXT NOT NULL DEFAULT '#6b1c2e', secondary_color TEXT NOT NULL DEFAULT '#d6b46c', accent_color TEXT NOT NULL DEFAULT '#f6e6bc',
 scheme TEXT NOT NULL DEFAULT 'light' CHECK(scheme IN ('light','dark')), brand_source TEXT NOT NULL DEFAULT 'default',
 logo_data TEXT, notes TEXT NOT NULL DEFAULT '', created_at INTEGER NOT NULL
);
CREATE TABLE users (
 id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE COLLATE NOCASE, name TEXT NOT NULL,
 role TEXT NOT NULL CHECK(role IN ('super_admin','client_admin')), client_id TEXT REFERENCES sites(id) ON DELETE CASCADE,
 password_hash TEXT NOT NULL, password_version INTEGER NOT NULL DEFAULT 0,
 must_change_password INTEGER NOT NULL DEFAULT 1, created_at INTEGER NOT NULL,
 CHECK((role='super_admin' AND client_id IS NULL) OR (role='client_admin' AND client_id IS NOT NULL))
);
CREATE INDEX users_site ON users(client_id);
CREATE UNIQUE INDEX singleton_master ON users(role) WHERE role='super_admin';
CREATE TABLE sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 host TEXT NOT NULL, password_version INTEGER NOT NULL, expires_at INTEGER NOT NULL);
CREATE INDEX sessions_user ON sessions(user_id);
CREATE TABLE audit_log (id INTEGER PRIMARY KEY AUTOINCREMENT, actor_id TEXT, site_id TEXT, action TEXT NOT NULL, at INTEGER NOT NULL);
CREATE TABLE daily_stats (site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE, day TEXT NOT NULL,
 visitors INTEGER NOT NULL, pageviews INTEGER NOT NULL, sessions INTEGER NOT NULL, bounces INTEGER NOT NULL, PRIMARY KEY(site_id,day));
CREATE TABLE top_pages_daily (site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE, day TEXT NOT NULL,
 path TEXT NOT NULL, views INTEGER NOT NULL, PRIMARY KEY(site_id,day,path));
