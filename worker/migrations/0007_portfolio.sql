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
