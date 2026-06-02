-- ==========================================
-- DYNAMIC WAREHOUSE STOCK SYSTEM SCHEMA
-- ==========================================

DROP TABLE IF EXISTS warehouse_stocks CASCADE;

CREATE TABLE IF NOT EXISTS warehouse_stocks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    commodity VARCHAR(255) NOT NULL,
    quantity DECIMAL(15,2) NOT NULL,
    measuring_scale VARCHAR(50) DEFAULT 'Tons',
    price_per_unit DECIMAL(15,2) NOT NULL,
    warehouse_name VARCHAR(255) NOT NULL,
    status VARCHAR(50) DEFAULT 'available', -- available, reserved, dispatched
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Index for fast commodity searches
CREATE INDEX IF NOT EXISTS idx_warehouse_stocks_commodity ON warehouse_stocks(commodity);

-- Seed initial records if empty to ensure the dashboard starts with realistic live values
INSERT INTO warehouse_stocks (commodity, quantity, measuring_scale, price_per_unit, warehouse_name, status)
SELECT 'Maize', 180.50, 'Tons', 450000.00, 'Noria Northern Hub (Kano)', 'available'
WHERE NOT EXISTS (SELECT 1 FROM warehouse_stocks);

INSERT INTO warehouse_stocks (commodity, quantity, measuring_scale, price_per_unit, warehouse_name, status)
SELECT 'Rice', 145.20, 'Tons', 750000.00, 'Noria Western Depot (Ibadan)', 'available'
WHERE NOT EXISTS (SELECT 1 FROM warehouse_stocks WHERE commodity = 'Rice');

INSERT INTO warehouse_stocks (commodity, quantity, measuring_scale, price_per_unit, warehouse_name, status)
SELECT 'Soybean', 124.30, 'Tons', 600000.00, 'Noria Central Silo (Abuja)', 'available'
WHERE NOT EXISTS (SELECT 1 FROM warehouse_stocks WHERE commodity = 'Soybean');
