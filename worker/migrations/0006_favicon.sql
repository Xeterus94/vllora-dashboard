ALTER TABLE sites ADD COLUMN favicon_media_id TEXT REFERENCES media(id) ON DELETE SET NULL;
CREATE TRIGGER site_brand_media BEFORE UPDATE OF logo_media_id, favicon_media_id ON sites
WHEN (NEW.logo_media_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM media WHERE id=NEW.logo_media_id AND site_id=NEW.id AND ready=1))
  OR (NEW.favicon_media_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM media WHERE id=NEW.favicon_media_id AND site_id=NEW.id AND ready=1))
BEGIN SELECT RAISE(ABORT, 'site_brand_media_mismatch'); END;
CREATE TRIGGER site_metric_currency BEFORE UPDATE OF config ON site_metric_settings
WHEN json_extract(NEW.config,'$.currency')!=json_extract(OLD.config,'$.currency')
 AND EXISTS(SELECT 1 FROM metric_events WHERE site_id=OLD.site_id AND event='order_paid')
BEGIN SELECT RAISE(ABORT, 'metric_currency_locked'); END;
