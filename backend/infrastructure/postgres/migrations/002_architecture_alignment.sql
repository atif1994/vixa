-- Architecture alignment migration (run on existing databases)
-- psql -U vixa -d vixa_ciam -f infrastructure/postgres/migrations/002_architecture_alignment.sql

-- Org profile fields
ALTER TABLE org.organisations ADD COLUMN IF NOT EXISTS country VARCHAR(64);
ALTER TABLE org.organisations ADD COLUMN IF NOT EXISTS city VARCHAR(128);
ALTER TABLE org.organisations ADD COLUMN IF NOT EXISTS address VARCHAR(512);
ALTER TABLE org.organisations ADD COLUMN IF NOT EXISTS postcode VARCHAR(32);
ALTER TABLE org.organisations ADD COLUMN IF NOT EXISTS telephone VARCHAR(32);
ALTER TABLE org.organisations ADD COLUMN IF NOT EXISTS directors JSONB;

-- Site profile fields
ALTER TABLE org.sites ADD COLUMN IF NOT EXISTS location VARCHAR(512);
ALTER TABLE org.sites ADD COLUMN IF NOT EXISTS managers JSONB;

-- Product base flag
ALTER TABLE licensing.products ADD COLUMN IF NOT EXISTS is_base BOOLEAN NOT NULL DEFAULT FALSE;

-- Replace legacy catalog with canonical products
DELETE FROM licensing.entitlements;
DELETE FROM licensing.licences;
DELETE FROM licensing.products;

INSERT INTO licensing.products (name, slug, description, price_cents, ost_infinity_product_id, is_base) VALUES
    ('ViXa Platform', 'vixa-platform', 'Base CIAM platform — included for all customers', 0, 'ost-prod-vixa-platform', TRUE),
    ('ViXa XDR-XSIAM', 'vixa-xdr-xsiam', 'Extended detection and response subscription', 9900, 'ost-prod-vixa-xdr-xsiam', FALSE),
    ('ViXa AI', 'vixa-ai', 'AI-powered security analytics subscription', 7900, 'ost-prod-vixa-ai', FALSE),
    ('ViXa AutoArk', 'vixa-autoark', 'Automated compliance and remediation subscription', 6900, 'ost-prod-vixa-autoark', FALSE),
    ('ViXa Vault', 'vixa-vault', 'Secrets and credential vault subscription', 4900, 'ost-prod-vixa-vault', FALSE);

INSERT INTO licensing.entitlements (product_id, feature_key, feature_name)
SELECT id, 'ciam_core', 'CIAM Core Access' FROM licensing.products WHERE slug = 'vixa-platform';

INSERT INTO licensing.entitlements (product_id, feature_key, feature_name)
SELECT id, 'xdr_dashboard', 'XDR Dashboard' FROM licensing.products WHERE slug = 'vixa-xdr-xsiam';

INSERT INTO licensing.entitlements (product_id, feature_key, feature_name)
SELECT id, 'ai_analytics', 'AI Analytics' FROM licensing.products WHERE slug = 'vixa-ai';

INSERT INTO licensing.entitlements (product_id, feature_key, feature_name)
SELECT id, 'auto_remediation', 'Auto Remediation' FROM licensing.products WHERE slug = 'vixa-autoark';

INSERT INTO licensing.entitlements (product_id, feature_key, feature_name)
SELECT id, 'secrets_vault', 'Secrets Vault' FROM licensing.products WHERE slug = 'vixa-vault';

INSERT INTO licensing.entitlements (product_id, feature_key, feature_name)
SELECT id, 'ciam_core', 'CIAM Core Access' FROM licensing.products WHERE slug IN ('vixa-xdr-xsiam', 'vixa-ai', 'vixa-autoark', 'vixa-vault');
