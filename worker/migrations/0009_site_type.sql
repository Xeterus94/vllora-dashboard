-- The portal is shaped by the kind of site it administers: a barbershop and a
-- shop must not share the same editor. Existing sites keep the old behaviour
-- (presentation), so nothing changes until the type is chosen explicitly.
ALTER TABLE sites ADD COLUMN site_type TEXT NOT NULL DEFAULT 'presentation';
UPDATE sites SET site_type='ecommerce' WHERE id IN (
  SELECT site_id FROM site_metric_settings WHERE json_extract(config,'$.profile')='ecommerce'
);
UPDATE sites SET site_type='appointments' WHERE id IN (
  SELECT site_id FROM site_metric_settings WHERE json_extract(config,'$.profile')='appointments'
);
