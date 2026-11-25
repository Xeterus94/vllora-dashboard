-- What a client user may do in their own site. NULL keeps the previous behaviour
-- (everything allowed), so existing accounts are unchanged after the migration.
ALTER TABLE users ADD COLUMN permissions TEXT;
