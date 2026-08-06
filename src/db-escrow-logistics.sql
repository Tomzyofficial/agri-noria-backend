-- ============================================
-- ESCROW + LOGISTICS COORDINATION SCHEMA
-- Agricultural Marketplace Transaction System
-- ============================================

-- Enums for order status
DO $$
BEGIN
   IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'order_status_type') THEN
      CREATE TYPE order_status_type AS ENUM (
          'pending',
          'paid',
          'processing',
          'shipped',
          'in_transit',
          'delivered',
          'completed',
          'cancelled',
          'refunded'
      );
   END IF;
END$$;

-- Enums for fulfillment type
DO $$
BEGIN
   IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'fulfillment_type') THEN
      CREATE TYPE fulfillment_type AS ENUM ('delivery', 'pickup');
   END IF;
END$$;

-- Enums for payment status
DO $$
BEGIN
   IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_status_type') THEN
      CREATE TYPE payment_status_type AS ENUM (
          'pending',
          'processing',
          'completed',
          'failed',
          'refunded'
      );
   END IF;
END$$;

-- Enums for escrow status
DO $$
BEGIN
   IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'escrow_status_type') THEN
      CREATE TYPE escrow_status_type AS ENUM (
          'held',
          'released',
          'refunded',
          'disputed'
      );
   END IF;
END$$;

-- Enums for shipment status
DO $$
BEGIN
   IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'shipment_status_type') THEN
      CREATE TYPE shipment_status_type AS ENUM (
          'pending',
          'assigned',
          'picked_up',
          'in_transit',
          'delivered',
          'cancelled'
      );
   END IF;
END$$;

-- Enums for escrow release trigger type
DO $$
BEGIN
   IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'escrow_trigger_type') THEN
      CREATE TYPE escrow_trigger_type AS ENUM (
          'buyer_confirmed',
          'auto_release',
          'admin_override',
          'dispute_resolved'
      );
   END IF;
END$$;

-- ============================================
-- ORDERS TABLE (Main transaction record)
-- ============================================
CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    buyer_id UUID NOT NULL REFERENCES buyers(buyer_id) ON DELETE SET NULL,
   --  seller_id UUID NOT NULL REFERENCES vendors(id) ON DELETE SET NULL,
    
    total_amount NUMERIC(12,2) NOT NULL CHECK (total_amount >= 0),
    currency VARCHAR(10) DEFAULT 'NGN',
    country_code VARCHAR(10) DEFAULT 'NG',
    status order_status_type DEFAULT 'pending',
    fulfillment_type fulfillment_type DEFAULT 'delivery',
    
    -- Delivery information
    delivery_address TEXT,
   --  delivery_fee NUMERIC(12,2) DEFAULT 0 CHECK (delivery_fee >= 0),
    estimated_delivery_time TIMESTAMP,
    
    -- Order metadata
    notes TEXT,
    metadata JSONB DEFAULT '{}',
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL,
    listing_id UUID NOT NULL,
    seller_id UUID NOT NULL,
    logistics_id UUID NOT NULL,
    listing_name VARCHAR(255) NOT NULL,
    product_image TEXT,
    unit VARCHAR(50),
    quantity DECIMAL(12,2) NOT NULL,
    unit_price DECIMAL(15,2) NOT NULL,
   --  subtotal DECIMAL(15,2) NOT NULL,
    discount DECIMAL(15,2) DEFAULT 0,
    seller_amount DECIMAL(15,2) NOT NULL,
   --  platform_fee DECIMAL(15,2) DEFAULT 0,
    delivered_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    refunded_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    escrow_status TEXT DEFAULT 'pending', 
    min_quantity INTEGER,
    CONSTRAINT fk_order_items_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    CONSTRAINT fk_order_items_listing FOREIGN KEY (listing_id) REFERENCES listings(id),
    CONSTRAINT fk_order_items_seller FOREIGN KEY (seller_id) REFERENCES vendors(id),
    CONSTRAINT fk_order_logistics FOREIGN KEY (logistics_id) REFERENCES vendors(id)
);

-- Indexes for orders
CREATE INDEX IF NOT EXISTS idx_orders_buyer_id ON orders(buyer_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_metadata_gin ON orders USING GIN (metadata)

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_orders_updated_at ON orders;
CREATE TRIGGER update_orders_updated_at
BEFORE UPDATE ON orders
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- PAYMENTS TABLE (ESCROW CORE)
-- ============================================
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    
    payer_id UUID NOT NULL REFERENCES buyers(buyer_id) ON DELETE CASCADE,
    
    amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
    currency VARCHAR(10) DEFAULT 'NGN',
    
    payment_provider VARCHAR(50), -- paystack, flutterwave, etc.
    provider_reference VARCHAR(100) UNIQUE,
    provider_payment_code VARCHAR(100),
    
    status payment_status_type DEFAULT 'pending',
    escrow_status escrow_status_type DEFAULT 'held',
    
    -- Escrow release information
    released_at TIMESTAMP WITH TIME ZONE,
   --  release_reason TEXT,
    
    -- Payment metadata
    payment_method VARCHAR(50),
    metadata JSONB DEFAULT '{}',
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for payments
CREATE INDEX IF NOT EXISTS idx_payments_order_id ON payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_payer_id ON payments(payer_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_escrow_status ON payments(escrow_status);
CREATE INDEX IF NOT EXISTS idx_payments_provider_reference ON payments(provider_reference);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_payments_updated_at ON payments;
CREATE TRIGGER update_payments_updated_at
BEFORE UPDATE ON payments
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- LOGISTICS SHIPMENTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS logistics_shipments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    
    logistics_company_id UUID REFERENCES vendors(id) ON DELETE SET NULL,
   --  vehicle_id UUID REFERENCES vehicles(id) ON DELETE SET NULL,
   --  driver_id UUID REFERENCES vendors(id) ON DELETE SET NULL,
    
    status shipment_status_type DEFAULT 'pending',
    
    -- Location information
    pickup_location TEXT NOT NULL,
   --  pickup_coordinates JSONB, -- {lat, lng}
   --  pickup_scheduled_time TIMESTAMP WITH TIME ZONE,
   --  pickup_completed_at TIMESTAMP WITH TIME ZONE,
    
    delivery_location TEXT NOT NULL,
   --  delivery_coordinates JSONB, -- {lat, lng}
    estimated_delivery_time TIMESTAMP WITH TIME ZONE,
   --  actual_delivery_time TIMESTAMP WITH TIME ZONE,
    
    -- Tracking information
   --  current_location TEXT,
   --  current_coordinates JSONB, -- {lat, lng}
    tracking_number VARCHAR(100) UNIQUE,
    
    -- Driver and vehicle information
    assigned_driver_name VARCHAR(255),
    assigned_driver_phone VARCHAR(50),
    vehicle_plate_number VARCHAR(50),
    
    -- Pickup confirmation
    pickup_confirmation BOOLEAN DEFAULT false,
    pickup_photo_url TEXT,
    
    -- Delivery OTP
    delivery_otp VARCHAR(255), -- hashed OTP
    delivery_otp_expires_at TIMESTAMP WITH TIME ZONE,
    delivery_otp_verified BOOLEAN DEFAULT false,
    delivery_otp_verified_at TIMESTAMP WITH TIME ZONE,
    
    -- Buyer satisfaction
    buyer_satisfied BOOLEAN DEFAULT false,
    buyer_satisfied_at TIMESTAMP WITH TIME ZONE,
    
    -- Dispatch information
    dispatch_notes TEXT,
    shipment_started_at TIMESTAMP WITH TIME ZONE,
    delivered_at TIMESTAMP WITH TIME ZONE,
    
    -- Shipment metadata
   --  notes TEXT,
   --  metadata JSONB DEFAULT '{}',
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for logistics_shipments
CREATE INDEX IF NOT EXISTS idx_logistics_shipments_order_id ON logistics_shipments(order_id);
CREATE INDEX IF NOT EXISTS idx_logistics_shipments_company_id ON logistics_shipments(logistics_company_id);
-- CREATE INDEX IF NOT EXISTS idx_logistics_shipments_vehicle_id ON logistics_shipments(vehicle_id);
-- CREATE INDEX IF NOT EXISTS idx_logistics_shipments_driver_id ON logistics_shipments(driver_id);
CREATE INDEX IF NOT EXISTS idx_logistics_shipments_status ON logistics_shipments(status);
CREATE INDEX IF NOT EXISTS idx_logistics_shipments_tracking_number ON logistics_shipments(tracking_number);
CREATE INDEX IF NOT EXISTS idx_logistics_shipments_delivery_otp ON logistics_shipments(delivery_otp);
CREATE INDEX IF NOT EXISTS idx_logistics_shipments_shipment_started_at ON logistics_shipments(shipment_started_at);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_logistics_shipments_updated_at ON logistics_shipments;
CREATE TRIGGER update_logistics_shipments_updated_at
BEFORE UPDATE ON logistics_shipments
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- DELIVERY CONFIRMATIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS delivery_confirmations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    shipment_id UUID REFERENCES logistics_shipments(id) ON DELETE SET NULL,
    
    buyer_id UUID NOT NULL REFERENCES buyers(buyer_id) ON DELETE CASCADE,
    
    confirmed BOOLEAN DEFAULT false,
    confirmation_method VARCHAR(30), -- otp, photo, auto, manual
    
    -- OTP confirmation
    otp_code VARCHAR(10),
    otp_expires_at TIMESTAMP WITH TIME ZONE,
    otp_verified_at TIMESTAMP WITH TIME ZONE,
    
    -- Photo confirmation
    proof_image TEXT,
    proof_image_uploaded_at TIMESTAMP WITH TIME ZONE,
    
    -- Confirmation details
    confirmed_at TIMESTAMP WITH TIME ZONE,
    confirmation_notes TEXT,
    condition_rating INTEGER CHECK (condition_rating >= 1 AND condition_rating <= 5),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for delivery_confirmations
CREATE INDEX IF NOT EXISTS idx_delivery_confirmations_order_id ON delivery_confirmations(order_id);
CREATE INDEX IF NOT EXISTS idx_delivery_confirmations_shipment_id ON delivery_confirmations(shipment_id);
CREATE INDEX IF NOT EXISTS idx_delivery_confirmations_buyer_id ON delivery_confirmations(buyer_id);
CREATE INDEX IF NOT EXISTS idx_delivery_confirmations_otp_code ON delivery_confirmations(otp_code);

-- ============================================
-- ESCROW RELEASES TABLE (Audit trail for releases)
-- ============================================
CREATE TABLE IF NOT EXISTS escrow_releases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
   --  payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    
    status VARCHAR(30) DEFAULT 'held', -- held, completed, failed
    
    trigger_type escrow_trigger_type,
    
    -- Release details
    released_at TIMESTAMP WITH TIME ZONE,
    released_by UUID, -- admin or system
    
    -- Reason and notes
    reason TEXT,
    notes TEXT,
    metadata JSONB DEFAULT '{}',
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for escrow_releases
CREATE INDEX IF NOT EXISTS idx_escrow_releases_payment_id ON escrow_releases(payment_id);
CREATE INDEX IF NOT EXISTS idx_escrow_releases_order_id ON escrow_releases(order_id);
CREATE INDEX IF NOT EXISTS idx_escrow_releases_status ON escrow_releases(status);
CREATE INDEX IF NOT EXISTS idx_escrow_releases_trigger_type ON escrow_releases(trigger_type);

-- ============================================
-- DRIVERS TABLE (For logistics companies)
-- ============================================
/* CREATE TABLE IF NOT EXISTS drivers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    vehicle_id UUID REFERENCES vehicles(id) ON DELETE SET NULL,
    
    driver_name VARCHAR(255) NOT NULL,
    driver_phone VARCHAR(50) NOT NULL,
    driver_license VARCHAR(100),
    
    status VARCHAR(30) DEFAULT 'available', -- available, on_duty, offline
    current_location TEXT,
    current_coordinates JSONB, -- {lat, lng}
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
); */

-- Indexes for drivers
/* CREATE INDEX IF NOT EXISTS idx_drivers_vendor_id ON drivers(vendor_id);
CREATE INDEX IF NOT EXISTS idx_drivers_vehicle_id ON drivers(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_drivers_status ON drivers(status); */

-- Trigger for updated_at
/* DROP TRIGGER IF EXISTS update_drivers_updated_at ON drivers;
CREATE TRIGGER update_drivers_updated_at
BEFORE UPDATE ON drivers
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column(); */

-- ============================================
-- SHIPMENT TRACKING EVENTS TABLE (Real-time tracking)
-- ============================================
CREATE TABLE IF NOT EXISTS shipment_tracking_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    shipment_id UUID NOT NULL REFERENCES logistics_shipments(id) ON DELETE CASCADE,
    
    event_type VARCHAR(50) NOT NULL, -- pickup, in_transit, delay, delivery_attempt, etc.
    event_status VARCHAR(50) NOT NULL,
    
    location TEXT,
   --  coordinates JSONB, -- {lat, lng}
    
    event_notes TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for shipment_tracking_events
CREATE INDEX IF NOT EXISTS idx_shipment_tracking_events_shipment_id ON shipment_tracking_events(shipment_id);
CREATE INDEX IF NOT EXISTS idx_shipment_tracking_events_created_at ON shipment_tracking_events(created_at DESC);

-- ============================================
-- FUNCTIONS FOR ESCROW LOGIC
-- ============================================

-- Function to release escrow funds
CREATE OR REPLACE FUNCTION release_escrow_funds(
    p_payment_id UUID,
    p_trigger_type escrow_trigger_type,
    p_released_by UUID,
    p_reason TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
    v_payment RECORD;
    v_order RECORD;
BEGIN
    -- Lock the payment row
    SELECT * INTO v_payment
    FROM payments
    WHERE id = p_payment_id
    AND escrow_status = 'held'
    FOR UPDATE;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Payment not found or escrow already released';
    END IF;
    
    -- Get order information
    SELECT * INTO v_order
    FROM orders
    WHERE id = v_payment.order_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Order not found';
    END IF;
    
    -- Update payment escrow status
    UPDATE payments
    SET 
        escrow_status = 'released',
        released_at = NOW(),
        release_reason = p_reason
    WHERE id = p_payment_id;
    
    -- Create escrow release record
    INSERT INTO escrow_releases (
        payment_id,
        order_id,
        status,
        trigger_type,
        released_at,
        released_by,
        release_amount,
        reason
    ) VALUES (
        p_payment_id,
        v_payment.order_id,
        'completed',
        p_trigger_type,
        NOW(),
        p_released_by,
        v_payment.amount,
        p_reason
    );
    
    -- Update order status to completed
    UPDATE orders
    SET status = 'completed'
    WHERE id = v_payment.order_id;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Function to auto-release escrow after timeout (e.g., 7 days after delivery)
CREATE OR REPLACE FUNCTION auto_release_escrow()
RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER;
BEGIN
    -- Find payments where:
    -- - Escrow is still held
    -- - Order is delivered
    -- - Delivery was more than 7 days ago
    -- - No delivery confirmation exists
    
    WITH eligible_payments AS (
        SELECT p.id
        FROM payments p
        INNER JOIN orders o ON o.id = p.order_id
        LEFT JOIN delivery_confirmations dc ON dc.order_id = o.id
        WHERE p.escrow_status = 'held'
        AND o.status = 'delivered'
        AND o.updated_at < NOW() - INTERVAL '7 days'
        AND dc.id IS NULL
    )
    UPDATE payments
    SET 
        escrow_status = 'released',
        released_at = NOW(),
        release_reason = 'Auto-released after 7-day delivery confirmation timeout'
    WHERE id IN (SELECT id FROM eligible_payments);
    
    GET DIAGNOSTICS v_count = ROW_COUNT;
    
    RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- Function to generate OTP for delivery confirmation
CREATE OR REPLACE FUNCTION generate_delivery_otp(p_order_id UUID)
RETURNS VARCHAR(10) AS $$
DECLARE
    v_otp VARCHAR(10);
    v_confirmation_id UUID;
BEGIN
    -- Generate 6-digit OTP
    v_otp := LPAD(FLOOR(RANDOM() * 1000000)::TEXT, 6, '0');
    
    -- Create or update delivery confirmation
    INSERT INTO delivery_confirmations (
        order_id,
        buyer_id,
        otp_code,
        otp_expires_at
    )
    SELECT 
        p_order_id,
        o.buyer_id,
        v_otp,
        NOW() + INTERVAL '24 hours'
    FROM orders o
    WHERE o.id = p_order_id
    ON CONFLICT (order_id) 
    DO UPDATE SET
        otp_code = EXCLUDED.otp_code,
        otp_expires_at = EXCLUDED.otp_expires_at;
    
    RETURN v_otp;
END;
$$ LANGUAGE plpgsql;


CREATE TABLE IF NOT EXISTS payouts (

    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

   --  payment_id UUID NOT NULL
   --      REFERENCES payments(id) ON DELETE CASCADE,

    order_id UUID NOT NULL
        REFERENCES orders(id) ON DELETE CASCADE,

    recipient_vendor_id UUID NOT NULL
        REFERENCES vendors(id),
   --  logistics_vendor_id UUID NOT NULL
   --      REFERENCES vendors(id),

    recipient_type VARCHAR(30) NOT NULL,

    payout_type VARCHAR(30) NOT NULL,

    gross_amount NUMERIC(12,2) NOT NULL, -- overall amount

    commission_amount NUMERIC(12,2) DEFAULT 0, -- platform commission

    net_amount NUMERIC(12,2) NOT NULL, -- actual amount to be paid out

    currency VARCHAR(10) DEFAULT 'NGN',

    status VARCHAR(30) DEFAULT 'pending',

    transfer_reference VARCHAR(255),

    transfer_response JSONB DEFAULT '{}',

    failure_reason TEXT,

    released_at TIMESTAMP,

    created_at TIMESTAMP DEFAULT NOW(),

    updated_at TIMESTAMP DEFAULT NOW()
);