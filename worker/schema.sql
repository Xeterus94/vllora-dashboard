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
CREATE TABLE media (id TEXT PRIMARY KEY, site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
 object_key TEXT NOT NULL UNIQUE, name TEXT NOT NULL, content_type TEXT NOT NULL, size INTEGER NOT NULL,
 width INTEGER, height INTEGER, created_at INTEGER NOT NULL, ready INTEGER NOT NULL DEFAULT 0);
CREATE INDEX media_site ON media(site_id);
ALTER TABLE sites ADD COLUMN logo_media_id TEXT REFERENCES media(id) ON DELETE SET NULL;
ALTER TABLE sites ADD COLUMN portal_host TEXT COLLATE NOCASE;
ALTER TABLE sites ADD COLUMN route_id TEXT;
ALTER TABLE sites ADD COLUMN route_zone TEXT;
ALTER TABLE sites ADD COLUMN route_status TEXT NOT NULL DEFAULT 'manual';
CREATE TABLE site_hosts (host TEXT PRIMARY KEY COLLATE NOCASE, site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE);
INSERT INTO site_hosts SELECT domain,id FROM sites;
CREATE INDEX site_hosts_site ON site_hosts(site_id);
ALTER TABLE users ADD COLUMN email TEXT COLLATE NOCASE;
ALTER TABLE users ADD COLUMN permissions TEXT;
CREATE INDEX users_email ON users(email,client_id);
CREATE TABLE password_resets (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 host TEXT NOT NULL, email TEXT NOT NULL, password_version INTEGER NOT NULL, expires_at INTEGER NOT NULL, used_at INTEGER);
CREATE INDEX resets_user ON password_resets(user_id);
CREATE TABLE rate_limits (key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires_at INTEGER NOT NULL);
CREATE TABLE site_metric_settings (site_id TEXT PRIMARY KEY REFERENCES sites(id) ON DELETE CASCADE,
 config TEXT NOT NULL, server_key_hash TEXT);
CREATE TABLE metric_events (id INTEGER PRIMARY KEY AUTOINCREMENT, site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
 event_id TEXT, event TEXT NOT NULL, source TEXT NOT NULL CHECK(source IN ('browser','server')),
 amount_cents INTEGER NOT NULL DEFAULT 0, currency TEXT, created_at INTEGER NOT NULL, UNIQUE(site_id,event_id));
CREATE INDEX events_report ON metric_events(site_id,event,created_at);
ALTER TABLE sites ADD COLUMN favicon_media_id TEXT REFERENCES media(id) ON DELETE SET NULL;
CREATE TRIGGER site_brand_media BEFORE UPDATE OF logo_media_id, favicon_media_id ON sites
WHEN (NEW.logo_media_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM media WHERE id=NEW.logo_media_id AND site_id=NEW.id AND ready=1))
  OR (NEW.favicon_media_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM media WHERE id=NEW.favicon_media_id AND site_id=NEW.id AND ready=1))
BEGIN SELECT RAISE(ABORT, 'site_brand_media_mismatch'); END;
CREATE TRIGGER site_metric_currency BEFORE UPDATE OF config ON site_metric_settings
WHEN json_extract(NEW.config,'$.currency')!=json_extract(OLD.config,'$.currency')
 AND EXISTS(SELECT 1 FROM metric_events WHERE site_id=OLD.site_id AND event='order_paid')
BEGIN SELECT RAISE(ABORT, 'metric_currency_locked'); END;
ALTER TABLE sites ADD COLUMN suspended_at INTEGER;
UPDATE sites SET suspended_at=(SELECT MAX(at) FROM audit_log WHERE site_id=sites.id AND action='site_suspended')
WHERE status='suspended';
CREATE TABLE portfolio_details (
  site_id TEXT PRIMARY KEY REFERENCES sites(id) ON DELETE CASCADE,
  industry TEXT NOT NULL,
  billing TEXT NOT NULL CHECK(billing IN ('Monthly','Annual')),
  monthly_cents INTEGER NOT NULL CHECK(monthly_cents>=0),
  annual_cents INTEGER NOT NULL CHECK(annual_cents>=0),
  next_renewal TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '{}'
);
