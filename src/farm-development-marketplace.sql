-- CREATE TABLE IF NOT EXISTS service_categories(
--    name TEXT NOT NULL,
--    slug TEXT NOT NULL,
--    description TEXT,
--    icon_name TEXT
-- );

CREATE TABLE IF NOT EXISTS farm_dev_service_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  category VARCHAR(100) NOT NULL,
  description TEXT NOT NULL,
  location TEXT NOT NULL,
  scope TEXT[] DEFAULT '{}',
  price_type TEXT NOT NULL DEFAULT 'custom' CHECK (price_type IN ('fixed', 'hourly', 'project', 'custom')),
   min_budget NUMERIC(10, 2),
   max_budget NUMERIC(10, 2),
   duration TEXT,
  featured_image TEXT,
  public_id TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  views_count INTEGER NOT NULL DEFAULT 0,
  inquiries_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_service_listings_vendor_id ON farm_dev_service_listings(vendor_id);
CREATE INDEX IF NOT EXISTS idx_service_listings_category_id ON farm_dev_service_listings(category);
CREATE INDEX IF NOT EXISTS idx_service_listings_status ON farm_dev_service_listings(status);
CREATE INDEX IF NOT EXISTS idx_service_listings_featured ON farm_dev_service_listings(featured);

CREATE TABLE farm_dev_portfolio_projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    slug TEXT,
    category VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    location TEXT DEFAULT '',
    completion_date DATE NOT NULL,
    featured_image TEXT NOT NULL,
    gallery_images TEXT[] DEFAULT '{}',
    budget_range TEXT DEFAULT '',
    client_type VARCHAR(50),
    project_duration TEXT DEFAULT '',
    is_featured BOOLEAN DEFAULT FALSE,
    views_count INTEGER DEFAULT 0,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_portfolio_projects_vendor_id ON farm_dev_portfolio_projects(vendor_id);

-- INSERT INTO service_categories (name, slug, description, icon_name)
-- VALUES
--   ('Farm Design & Planning', 'farm-design-planning', 'Farm layout, infrastructure planning, and production design.', 'ruler'),
--   ('Poultry Construction', 'poultry-construction', 'Poultry farm construction and housing systems.', 'warehouse'),
--   ('Fish Pond Construction', 'fish-pond-construction', 'Earthen, concrete, and tarpaulin fish pond development.', 'waves'),
--   ('Greenhouse Development', 'greenhouse-development', 'Greenhouse planning, construction, and setup.', 'sprout'),
--   ('Irrigation Systems', 'irrigation-systems', 'Drip, sprinkler, and solar-powered irrigation installation.', 'droplets'),
--   ('Farm Fencing', 'farm-fencing', 'Perimeter fencing and farm security infrastructure.', 'fence'),
--   ('Land Preparation', 'land-preparation', 'Clearing, grading, ploughing, and land preparation.', 'tractor'),
--   ('Solar Water Systems', 'solar-water-systems', 'Solar boreholes, pumps, and farm water systems.', 'sun'),
--   ('Livestock Housing', 'livestock-housing', 'Livestock sheds, pens, housing, and handling facilities.', 'home'),
--   ('Agricultural Infrastructure', 'agricultural-infrastructure', 'Roads, drainage, storage, and complete farm infrastructure.', 'building')
-- ON CONFLICT (slug) DO UPDATE
-- SET name = EXCLUDED.name,
--     description = EXCLUDED.description,
--     icon_name = EXCLUDED.icon_name;
