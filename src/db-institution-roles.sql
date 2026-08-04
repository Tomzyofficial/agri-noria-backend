-- SQL to create new tables for Producer Associations, Cooperatives, and Research Institutions

-- Research Publications Table
CREATE TABLE IF NOT EXISTS research_publications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    publication_type TEXT NOT NULL,
    content_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_research_publications_vendor_id ON research_publications(vendor_id);

-- Trial Plots Table
CREATE TABLE IF NOT EXISTS trial_plots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    plot_name TEXT NOT NULL,
    location TEXT NOT NULL,
    crop TEXT NOT NULL,
    size_hectares NUMERIC(10,2),
    status TEXT DEFAULT 'active',
    start_date DATE,
    end_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_trial_plots_vendor_id ON trial_plots(vendor_id);

DROP TRIGGER IF EXISTS update_trial_plots_updated_at ON trial_plots;
CREATE TRIGGER update_trial_plots_updated_at
BEFORE UPDATE ON trial_plots
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_research_publications_updated_at ON research_publications;
CREATE TRIGGER update_research_publications_updated_at
BEFORE UPDATE ON research_publications
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
