ALTER TABLE sites ADD COLUMN portal_host TEXT COLLATE NOCASE;
ALTER TABLE sites ADD COLUMN route_id TEXT;
ALTER TABLE sites ADD COLUMN route_zone TEXT;
ALTER TABLE sites ADD COLUMN route_status TEXT NOT NULL DEFAULT 'manual';
CREATE TABLE site_hosts (host TEXT PRIMARY KEY COLLATE NOCASE, site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE);
INSERT INTO site_hosts SELECT domain,id FROM sites;
CREATE INDEX site_hosts_site ON site_hosts(site_id);
