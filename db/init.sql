-- SEL Database Schema
-- PostgreSQL initialization script

-- ═══════════════════════════════════════════════════════════════════════════
-- WEBHOOKS
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS webhooks (
    id VARCHAR(64) PRIMARY KEY,
    site_id VARCHAR(128) NOT NULL,
    name VARCHAR(255) NOT NULL,
    url TEXT NOT NULL,
    enabled BOOLEAN DEFAULT true,
    auth_type VARCHAR(32) DEFAULT 'none',
    auth_token TEXT,
    events JSONB DEFAULT '["all"]',
    headers JSONB DEFAULT '{}',
    last_success BIGINT,
    last_error TEXT,
    failure_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_webhooks_site_id ON webhooks(site_id);
CREATE INDEX idx_webhooks_enabled ON webhooks(enabled);

-- ═══════════════════════════════════════════════════════════════════════════
-- WEBHOOK DELIVERIES (History)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS webhook_deliveries (
    id SERIAL PRIMARY KEY,
    webhook_id VARCHAR(64) REFERENCES webhooks(id) ON DELETE CASCADE,
    site_id VARCHAR(128) NOT NULL,
    timestamp BIGINT NOT NULL,
    url TEXT NOT NULL,
    request_body TEXT,
    response_status INTEGER,
    response_body TEXT,
    success BOOLEAN NOT NULL,
    error TEXT,
    duration_ms INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_deliveries_webhook_id ON webhook_deliveries(webhook_id);
CREATE INDEX idx_deliveries_site_id ON webhook_deliveries(site_id);
CREATE INDEX idx_deliveries_timestamp ON webhook_deliveries(timestamp DESC);

-- ═══════════════════════════════════════════════════════════════════════════
-- SEL PROGRAMS (Rules storage)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS sel_programs (
    id SERIAL PRIMARY KEY,
    site_id VARCHAR(128) UNIQUE NOT NULL,
    code TEXT NOT NULL,
    compiled_json JSONB,
    rules_count INTEGER DEFAULT 0,
    variables_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_programs_site_id ON sel_programs(site_id);

-- ═══════════════════════════════════════════════════════════════════════════
-- RULE TRIGGER HISTORY
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS rule_triggers (
    id SERIAL PRIMARY KEY,
    site_id VARCHAR(128) NOT NULL,
    rule_id VARCHAR(128) NOT NULL,
    trigger_type VARCHAR(32) NOT NULL, -- 'event' or 'schedule'
    timestamp BIGINT NOT NULL,
    metrics_snapshot JSONB,
    actions_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_triggers_site_id ON rule_triggers(site_id);
CREATE INDEX idx_triggers_rule_id ON rule_triggers(rule_id);
CREATE INDEX idx_triggers_timestamp ON rule_triggers(timestamp DESC);

-- ═══════════════════════════════════════════════════════════════════════════
-- COOLDOWN STATE
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS cooldown_state (
    site_id VARCHAR(128) NOT NULL,
    rule_id VARCHAR(128) NOT NULL,
    last_triggered BIGINT NOT NULL,
    PRIMARY KEY (site_id, rule_id)
);

-- ═══════════════════════════════════════════════════════════════════════════
-- HELPER FUNCTIONS
-- ═══════════════════════════════════════════════════════════════════════════

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER webhooks_updated_at
    BEFORE UPDATE ON webhooks
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER programs_updated_at
    BEFORE UPDATE ON sel_programs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- Clean old deliveries (keep last 1000 per site)
CREATE OR REPLACE FUNCTION cleanup_old_deliveries()
RETURNS void AS $$
BEGIN
    DELETE FROM webhook_deliveries
    WHERE id NOT IN (
        SELECT id FROM (
            SELECT id, ROW_NUMBER() OVER (
                PARTITION BY site_id 
                ORDER BY timestamp DESC
            ) as rn
            FROM webhook_deliveries
        ) ranked
        WHERE rn <= 1000
    );
END;
$$ LANGUAGE plpgsql;

-- ═══════════════════════════════════════════════════════════════════════════
-- INITIAL DATA
-- ═══════════════════════════════════════════════════════════════════════════

-- No initial data needed
