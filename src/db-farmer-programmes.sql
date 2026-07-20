CREATE TABLE IF NOT EXISTS farmer_programmes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    farmer_id UUID REFERENCES farmer_profiles(id) ON DELETE CASCADE,
    program_id UUID REFERENCES programs(id) ON DELETE CASCADE,
    status VARCHAR(50) DEFAULT 'active', -- active, completed, dropped
    enrollment_date DATE DEFAULT CURRENT_DATE,
    enrolled_by UUID REFERENCES vendors(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(farmer_id, program_id)
);
