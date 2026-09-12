-- Schema Extensions for Polymorphic Groups, Organization Memberships, Network Affiliations, and Research Projects

-- 1. Ensure columns exist on clusters table for polymorphic group support
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'clusters' AND column_name = 'group_type') THEN
        ALTER TABLE clusters ADD COLUMN group_type VARCHAR(50) DEFAULT 'SUPPLY_CLUSTER';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'clusters' AND column_name = 'owner_id') THEN
        ALTER TABLE clusters ADD COLUMN owner_id UUID REFERENCES vendors(id) ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'clusters' AND column_name = 'project_id') THEN
        ALTER TABLE clusters ADD COLUMN project_id UUID;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'clusters' AND column_name = 'metadata') THEN
        ALTER TABLE clusters ADD COLUMN metadata JSONB DEFAULT '{}'::jsonb;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cluster_members' AND column_name = 'cohort_label') THEN
        ALTER TABLE cluster_members ADD COLUMN cohort_label VARCHAR(100);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cluster_members' AND column_name = 'consent_granted') THEN
        ALTER TABLE cluster_members ADD COLUMN consent_granted BOOLEAN DEFAULT true;
    END IF;
END $$;

-- 2. Farmer Organization Memberships (linking master farmer identity to Cooperatives & Associations)
CREATE TABLE IF NOT EXISTS farmer_organization_memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    farmer_id UUID NOT NULL REFERENCES farmer_profiles(id) ON DELETE CASCADE,
    membership_number VARCHAR(100),
    verification_status VARCHAR(50) DEFAULT 'verified', -- verified, pending, inactive
    joined_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(organization_id, farmer_id)
);

CREATE INDEX IF NOT EXISTS idx_farmer_org_org ON farmer_organization_memberships(organization_id);
CREATE INDEX IF NOT EXISTS idx_farmer_org_farmer ON farmer_organization_memberships(farmer_id);

-- 3. Producer Association Network Affiliations (Association -> Cooperative)
CREATE TABLE IF NOT EXISTS organization_affiliations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_org_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE, -- Producer Association
    member_org_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE, -- Cooperative
    status VARCHAR(50) DEFAULT 'active', -- pending, active, revoked
    affiliation_date DATE DEFAULT CURRENT_DATE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(parent_org_id, member_org_id)
);

CREATE INDEX IF NOT EXISTS idx_org_affiliations_parent ON organization_affiliations(parent_org_id);
CREATE INDEX IF NOT EXISTS idx_org_affiliations_member ON organization_affiliations(member_org_id);

-- 4. Research Projects
CREATE TABLE IF NOT EXISTS research_projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    institution_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    objectives TEXT,
    commodity VARCHAR(100) NOT NULL,
    region VARCHAR(255),
    principal_investigator VARCHAR(255),
    team_members TEXT[],
    sample_size INT DEFAULT 50,
    start_date DATE,
    end_date DATE,
    status VARCHAR(50) DEFAULT 'active', -- draft, active, in_review, completed
    funding_requested DECIMAL(15,2) DEFAULT 0.00,
    funding_status VARCHAR(50) DEFAULT 'none', -- none, requested, approved, rejected
    funding_funder_id UUID REFERENCES vendors(id) ON DELETE SET NULL,
    funding_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_research_projects_inst ON research_projects(institution_id);

-- 5. Research Trial Observations & Scientific Data Points
CREATE TABLE IF NOT EXISTS research_observations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES research_projects(id) ON DELETE CASCADE,
    cohort_id UUID REFERENCES clusters(id) ON DELETE SET NULL,
    farmer_id UUID REFERENCES farmer_profiles(id) ON DELETE SET NULL,
    trial_plot_id UUID REFERENCES trial_plots(id) ON DELETE SET NULL,
    observation_type VARCHAR(100) NOT NULL, -- Yield, Disease Incidence, Soil Health, Growth Rate, Weather, Phenotype
    metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
    notes TEXT,
    recorded_by UUID REFERENCES vendors(id) ON DELETE SET NULL,
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_research_obs_proj ON research_observations(project_id);
CREATE INDEX IF NOT EXISTS idx_research_obs_cohort ON research_observations(cohort_id);
