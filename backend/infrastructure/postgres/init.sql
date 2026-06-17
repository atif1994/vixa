-- ViXa Platform CIAM - PostgreSQL Schema
-- All services share one database with schema separation for MVP simplicity

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- AUTH SCHEMA
-- ============================================================
CREATE SCHEMA IF NOT EXISTS auth;

CREATE TABLE auth.users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    phone VARCHAR(32),
    first_name VARCHAR(128) NOT NULL,
    last_name VARCHAR(128) NOT NULL,
    digital_identity_id UUID UNIQUE,
    status VARCHAR(32) NOT NULL DEFAULT 'pending_verification',
    mfa_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    email_verified BOOLEAN NOT NULL DEFAULT FALSE,
    phone_verified BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_email ON auth.users(email);
CREATE INDEX idx_users_status ON auth.users(status);

CREATE TABLE auth.refresh_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    token_hash VARCHAR(64) NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_refresh_tokens_user ON auth.refresh_tokens(user_id);

-- ============================================================
-- ORG & SITE SCHEMA
-- ============================================================
CREATE SCHEMA IF NOT EXISTS org;

CREATE TABLE org.organisations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(128) NOT NULL UNIQUE,
    owner_user_id UUID NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'active',
    ost_infinity_org_id VARCHAR(128),
    country VARCHAR(64),
    city VARCHAR(128),
    address VARCHAR(512),
    postcode VARCHAR(32),
    telephone VARCHAR(32),
    directors JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE org.sites (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organisation_id UUID NOT NULL REFERENCES org.organisations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(128) NOT NULL,
    domain VARCHAR(255),
    status VARCHAR(32) NOT NULL DEFAULT 'active',
    ost_infinity_site_id VARCHAR(128),
    location VARCHAR(512),
    managers JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(organisation_id, slug)
);

CREATE INDEX idx_sites_org ON org.sites(organisation_id);

-- ============================================================
-- VERIFICATION SCHEMA
-- ============================================================
CREATE SCHEMA IF NOT EXISTS verification;

CREATE TABLE verification.otp_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID,
    channel VARCHAR(16) NOT NULL,
    target VARCHAR(255) NOT NULL,
    code_hash VARCHAR(64) NOT NULL,
    verified BOOLEAN NOT NULL DEFAULT FALSE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_otp_target ON verification.otp_records(channel, target);

-- ============================================================
-- PAYMENTS SCHEMA
-- ============================================================
CREATE SCHEMA IF NOT EXISTS payments;

CREATE TABLE payments.customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL UNIQUE,
    stripe_customer_id VARCHAR(128) UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE payments.payment_methods (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID NOT NULL REFERENCES payments.customers(id) ON DELETE CASCADE,
    stripe_payment_method_id VARCHAR(128) NOT NULL,
    card_last4 VARCHAR(4),
    card_brand VARCHAR(32),
    verified BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE payments.transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID NOT NULL REFERENCES payments.customers(id),
    stripe_payment_intent_id VARCHAR(128) UNIQUE,
    amount_cents INTEGER NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'EUR',
    status VARCHAR(32) NOT NULL DEFAULT 'pending',
    type VARCHAR(32) NOT NULL,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE payments.subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID NOT NULL REFERENCES payments.customers(id),
    product_id UUID NOT NULL,
    stripe_subscription_id VARCHAR(128) UNIQUE,
    status VARCHAR(32) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- LICENSING SCHEMA
-- ============================================================
CREATE SCHEMA IF NOT EXISTS licensing;

CREATE TABLE licensing.products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(128) NOT NULL UNIQUE,
    description TEXT,
    price_cents INTEGER NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'EUR',
    ost_infinity_product_id VARCHAR(128),
    is_base BOOLEAN NOT NULL DEFAULT FALSE,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE licensing.licences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    organisation_id UUID,
    product_id UUID NOT NULL REFERENCES licensing.products(id),
    status VARCHAR(32) NOT NULL DEFAULT 'active',
    ost_infinity_licence_id VARCHAR(128),
    valid_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    valid_until TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_licences_user ON licensing.licences(user_id);
CREATE INDEX idx_licences_product ON licensing.licences(product_id);

CREATE TABLE licensing.roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(64) NOT NULL UNIQUE,
    description TEXT
);

CREATE TABLE licensing.user_roles (
    user_id UUID NOT NULL,
    role_id UUID NOT NULL REFERENCES licensing.roles(id),
    organisation_id UUID,
    PRIMARY KEY (user_id, role_id, organisation_id)
);

CREATE TABLE licensing.entitlements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL REFERENCES licensing.products(id),
    feature_key VARCHAR(128) NOT NULL,
    feature_name VARCHAR(255) NOT NULL,
    UNIQUE(product_id, feature_key)
);

-- ============================================================
-- ONBOARDING SCHEMA
-- ============================================================
CREATE SCHEMA IF NOT EXISTS onboarding;

CREATE TABLE onboarding.sagas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    correlation_id UUID NOT NULL UNIQUE,
    status VARCHAR(32) NOT NULL DEFAULT 'started',
    current_step VARCHAR(64) NOT NULL DEFAULT 'registration',
    steps_completed JSONB NOT NULL DEFAULT '[]',
    compensation_log JSONB NOT NULL DEFAULT '[]',
    payload JSONB,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sagas_user ON onboarding.sagas(user_id);
CREATE INDEX idx_sagas_correlation ON onboarding.sagas(correlation_id);

-- ============================================================
-- AUDIT SCHEMA (immutable)
-- ============================================================
CREATE SCHEMA IF NOT EXISTS audit;

CREATE TABLE audit.audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_type VARCHAR(64) NOT NULL,
    actor_id VARCHAR(128),
    resource_type VARCHAR(64),
    resource_id VARCHAR(128),
    ip_address VARCHAR(45),
    user_agent VARCHAR(512),
    metadata JSONB,
    checksum VARCHAR(64) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_event_type ON audit.audit_logs(event_type);
CREATE INDEX idx_audit_actor ON audit.audit_logs(actor_id);
CREATE INDEX idx_audit_created ON audit.audit_logs(created_at);

CREATE OR REPLACE FUNCTION audit.prevent_audit_modification()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Audit logs are immutable and cannot be modified or deleted';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_immutable_update
    BEFORE UPDATE ON audit.audit_logs
    FOR EACH ROW EXECUTE FUNCTION audit.prevent_audit_modification();

CREATE TRIGGER audit_immutable_delete
    BEFORE DELETE ON audit.audit_logs
    FOR EACH ROW EXECUTE FUNCTION audit.prevent_audit_modification();

-- ============================================================
-- ACL SCHEMA (Ost Infinity sync state)
-- ============================================================
CREATE SCHEMA IF NOT EXISTS acl;

CREATE TABLE acl.sync_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entity_type VARCHAR(64) NOT NULL,
    local_id UUID NOT NULL,
    remote_id VARCHAR(128),
    idempotency_key VARCHAR(128) NOT NULL UNIQUE,
    status VARCHAR(32) NOT NULL DEFAULT 'pending',
    request_payload JSONB,
    response_payload JSONB,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sync_entity ON acl.sync_records(entity_type, local_id);

-- ============================================================
-- SEED DATA
-- ============================================================
INSERT INTO licensing.products (name, slug, description, price_cents, ost_infinity_product_id, is_base) VALUES
    ('ViXa Platform', 'vixa-platform', 'Base CIAM platform — included for all customers', 0, 'ost-prod-vixa-platform', TRUE),
    ('ViXa XDR-XSIAM', 'vixa-xdr-xsiam', 'Extended detection and response subscription', 9900, 'ost-prod-vixa-xdr-xsiam', FALSE),
    ('ViXa AI', 'vixa-ai', 'AI-powered security analytics subscription', 7900, 'ost-prod-vixa-ai', FALSE),
    ('ViXa AutoArk', 'vixa-autoark', 'Automated compliance and remediation subscription', 6900, 'ost-prod-vixa-autoark', FALSE),
    ('ViXa Vault', 'vixa-vault', 'Secrets and credential vault subscription', 4900, 'ost-prod-vixa-vault', FALSE);

INSERT INTO licensing.roles (name, description) VALUES
    ('owner', 'Organisation owner with full access'),
    ('admin', 'Administrator with management access'),
    ('member', 'Standard member access');

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

CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_type VARCHAR(64) NOT NULL,
    actor_id VARCHAR(128),
    resource_type VARCHAR(64),
    resource_id VARCHAR(128),
    ip_address VARCHAR(45),
    user_agent VARCHAR(512),
    metadata JSONB,
    checksum VARCHAR(64) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
