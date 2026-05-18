-- =============================================================================
-- Agri-Connect: Phase 1 Ads / Promotion System (PostgreSQL)
-- Run after core marketplace tables (vendors, listings, trainings) exist.
-- Uses gen_random_uuid() — ensure pgcrypto is available, or use uuid-ossp.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- -----------------------------------------------------------------------------
-- ENUM types
-- -----------------------------------------------------------------------------
DO $$
BEGIN
   IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ad_target_type') THEN
      CREATE TYPE ad_target_type AS ENUM ('PRODUCT', 'VENDOR', 'TRAINING');
   END IF;
END$$;

DO $$
BEGIN
   IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ad_status') THEN
      CREATE TYPE ad_status AS ENUM (
         'DRAFT',
         'PENDING_PAYMENT',
         'ACTIVE',
         'PAUSED',
         'ENDED',
         'CANCELLED'
      );
   END IF;
END$$;

DO $$
BEGIN
   IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ad_placement') THEN
      CREATE TYPE ad_placement AS ENUM (
         'SPONSORED_PRODUCT',
         'FEATURED_VENDOR',
         'PROMOTED_TRAINING',
         'SEARCH_BOOST',
         'HOMEPAGE_FEATURED'
      );
   END IF;
END$$;

-- -----------------------------------------------------------------------------
-- ad_campaigns: core campaign entity (vendor-owned, Paystack-activated)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ad_campaigns (
   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
   vendor_id UUID NOT NULL REFERENCES vendors (id) ON DELETE CASCADE,
   target_type ad_target_type NOT NULL,
   target_id UUID NOT NULL,
   placement ad_placement NOT NULL,
   status ad_status NOT NULL DEFAULT 'DRAFT',
   budget NUMERIC(14, 2) NOT NULL CHECK (budget > 0),
   amount_paid NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (amount_paid >= 0),
   impressions_count BIGINT NOT NULL DEFAULT 0 CHECK (impressions_count >= 0),
   clicks_count BIGINT NOT NULL DEFAULT 0 CHECK (clicks_count >= 0),
   paystack_reference TEXT UNIQUE,
   start_at TIMESTAMPTZ NOT NULL,
   end_at TIMESTAMPTZ NOT NULL,
   created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
   updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
   CONSTRAINT ad_campaigns_date_range CHECK (end_at > start_at)
);

CREATE INDEX IF NOT EXISTS idx_ad_campaigns_vendor_status
   ON ad_campaigns (vendor_id, status);

CREATE INDEX IF NOT EXISTS idx_ad_campaigns_placement_status
   ON ad_campaigns (placement, status);

CREATE INDEX IF NOT EXISTS idx_ad_campaigns_target
   ON ad_campaigns (target_type, target_id);

CREATE INDEX IF NOT EXISTS idx_ad_campaigns_active_window
   ON ad_campaigns (placement, target_type, status, start_at, end_at);

COMMENT ON TABLE ad_campaigns IS 'Vendor advertising campaigns: placements, budgets, Paystack reference, aggregate counters.';

-- -----------------------------------------------------------------------------
-- ad_impressions: append-only impression log (scalable analytics source)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ad_impressions (
   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
   campaign_id UUID NOT NULL REFERENCES ad_campaigns (id) ON DELETE CASCADE,
   viewer_user_id UUID NULL,
   ip_address INET NULL,
   user_agent TEXT NULL,
   created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ad_impressions_campaign_created
   ON ad_impressions (campaign_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ad_impressions_created_brin ON ad_impressions USING BRIN (created_at);

COMMENT ON TABLE ad_impressions IS 'Per-impression events; campaign.impressions_count updated in same transaction.';

-- -----------------------------------------------------------------------------
-- ad_clicks: append-only click log
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ad_clicks (
   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
   campaign_id UUID NOT NULL REFERENCES ad_campaigns (id) ON DELETE CASCADE,
   viewer_user_id UUID NULL,
   ip_address INET NULL,
   user_agent TEXT NULL,
   created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ad_clicks_campaign_created ON ad_clicks (campaign_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ad_clicks_created_brin ON ad_clicks USING BRIN (created_at);

COMMENT ON TABLE ad_clicks IS 'Per-click events; campaign.clicks_count updated in same transaction.';

-- -----------------------------------------------------------------------------
-- Idempotent Paystack settlement (prevents double-activation on webhook retry)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ad_paystack_settlements (
   paystack_reference TEXT PRIMARY KEY,
   campaign_id UUID NOT NULL REFERENCES ad_campaigns (id) ON DELETE CASCADE,
   vendor_id UUID NOT NULL REFERENCES vendors (id) ON DELETE CASCADE,
   amount_kobo BIGINT NOT NULL,
   settled_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ad_paystack_settlements_campaign ON ad_paystack_settlements (campaign_id);

COMMENT ON TABLE ad_paystack_settlements IS 'One row per successful Paystack reference for ad campaigns (idempotency).';

-- -----------------------------------------------------------------------------
-- updated_at maintenance trigger (optional but production-friendly)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION touch_ad_campaigns_updated_at()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at := NOW();
   RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ad_campaigns_touch_updated ON ad_campaigns;
CREATE TRIGGER trg_ad_campaigns_touch_updated
   BEFORE UPDATE ON ad_campaigns
   FOR EACH ROW
   EXECUTE PROCEDURE touch_ad_campaigns_updated_at();
