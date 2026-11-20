CREATE TABLE site_metric_settings (site_id TEXT PRIMARY KEY REFERENCES sites(id) ON DELETE CASCADE,
 config TEXT NOT NULL, server_key_hash TEXT);
CREATE TABLE metric_events (id INTEGER PRIMARY KEY AUTOINCREMENT, site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
 event_id TEXT, event TEXT NOT NULL, source TEXT NOT NULL CHECK(source IN ('browser','server')),
 amount_cents INTEGER NOT NULL DEFAULT 0, currency TEXT, created_at INTEGER NOT NULL, UNIQUE(site_id,event_id));
CREATE INDEX events_report ON metric_events(site_id,event,created_at);
