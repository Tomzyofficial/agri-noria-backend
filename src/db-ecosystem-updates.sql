-- DB Ecosystem Updates for Field Operations, Farmers AIN, and Audit

-- 1. Update farmer_profiles for AIN and certification
ALTER TABLE farmer_profiles ADD COLUMN IF NOT EXISTS agricultural_identity_number VARCHAR(100) UNIQUE;
ALTER TABLE farmer_profiles ADD COLUMN IF NOT EXISTS certification_status VARCHAR(50) DEFAULT 'draft'; -- draft, pending_verification, certified

-- 2. Update vendors for Field Operations approval
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS approval_status VARCHAR(50) DEFAULT 'approved'; -- default to approved for non-field ops, but we handle it in auth controller

-- 3. Field Operations Documents
CREATE TABLE IF NOT EXISTS field_operations_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    appointment_letter_url TEXT,
    id_card_url TEXT,
    optional_document_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 4. Work Assignments for Field Operations
CREATE TABLE IF NOT EXISTS work_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    supervisor_id UUID REFERENCES vendors(id) ON DELETE SET NULL,
    officer_id UUID REFERENCES vendors(id) ON DELETE CASCADE,
    community VARCHAR(255),
    ward VARCHAR(255),
    lga VARCHAR(255),
    enumeration_zone VARCHAR(255),
    target_farmers INTEGER DEFAULT 0,
    status VARCHAR(50) DEFAULT 'active', -- active, completed, cancelled
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 5. Action Audit Logs
CREATE TABLE IF NOT EXISTS action_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES vendors(id) ON DELETE SET NULL,
    action_type VARCHAR(100) NOT NULL,
    resource VARCHAR(255),
    previous_value JSONB,
    new_value JSONB,
    gps_latitude DECIMAL(10,7),
    gps_longitude DECIMAL(10,7),
    device_info TEXT,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT now()
);
