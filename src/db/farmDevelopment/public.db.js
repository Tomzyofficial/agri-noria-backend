/* import pool from "../../lib/connect.js";

const mapService = (row) => ({
  id: row.id,
  title: row.title,
  description: row.description || "",
  category_name: row.category_name,
  category_slug: row.category_slug,
  provider_name: row.provider_name,
  provider_slug: row.provider_slug || row.company_id,
  min_acreage: row.metadata?.minAcreage || null,
  turnaround_days: row.metadata?.duration?.value || null,
  price_min: row.metadata?.pricing?.minimumBudget || null,
  price_max: row.metadata?.pricing?.maximumBudget || null,
  price_unit: row.metadata?.pricing?.unit || "",
  currency: row.metadata?.pricing?.currency || "NGN",
});

const mapProvider = (row) => ({
  id: row.id,
  slug: row.slug || row.id,
  name: row.name,
  tagline: row.metadata?.tagline || row.description || "",
  description: row.description || "",
  location: [row.city, row.state, row.country].filter(Boolean).join(", "),
  email: row.email,
  phone: row.phone,
  founded_year: row.year_founded,
  team_size: row.metadata?.teamSize || "",
  response_time: row.metadata?.responseTime || "48 hours",
  rating: row.metadata?.rating || 0,
  review_count: row.metadata?.reviewCount || 0,
  is_verified: Boolean(row.metadata?.isVerified),
  is_featured: Boolean(row.metadata?.isFeatured),
  service_count: Number(row.service_count || 0),
  portfolio_count: Number(row.portfolio_count || 0),
  cert_count: row.metadata?.certifications?.length || 0,
  certifications: row.metadata?.certifications || [],
});

export async function getPublicStats() {
  const { rows } = await pool.query(
    `SELECT
      (SELECT COUNT(*) FROM companies)::int AS verified_providers,
      (SELECT COUNT(*) FROM service_listings WHERE status IN ('published', 'active'))::int AS active_services,
      (SELECT COUNT(*) FROM portfolio_projects)::int AS portfolio_projects,
      (SELECT COUNT(*) FROM leads)::int AS quote_requests`,
  );
  return rows[0];
}

export async function getPublicCategories() {
  const { rows } = await pool.query(
    `SELECT fdsl.id, fdsl.title, fdsl.slug, fdsl.category, fdsl.description, fdsl.location, fdsl.scope, 
      COUNT(fdsl.category)::int AS category_count
     FROM farm_dev_service_listings fdsl
     GROUP BY fdsl.category
     ORDER BY fdsl.category`,
  );
  return rows;
}

export async function getPublicProviders({
  featured,
  state,
  search,
  page = 1,
  limit = 9,
}) {
  const params = [];
  const where = [];

  if (featured === "true") {
    where.push(`COALESCE((c.metadata->>'isFeatured')::boolean, false) = true`);
  }

  if (state) {
    params.push(state);
    where.push(`c.state ILIKE $${params.length}`);
  }

  if (search) {
    params.push(`%${search}%`);
    where.push(
      `(c.name ILIKE $${params.length} OR c.description ILIKE $${params.length})`,
    );
  }

  const count = await pool.query(
    `SELECT COUNT(*)::int AS total
     FROM companies c
     ${where.length ? `WHERE ${where.join(" AND ")}` : ""}`,
    params,
  );

  params.push(Number(limit));
  const limitParam = params.length;
  params.push((Math.max(Number(page), 1) - 1) * Number(limit));
  const offsetParam = params.length;

  const { rows } = await pool.query(
    `SELECT c.*,
      COUNT(DISTINCT sl.id)::int AS service_count,
      COUNT(DISTINCT pp.id)::int AS portfolio_count
     FROM companies c
     LEFT JOIN service_listings sl
      ON sl.company_id = c.id AND sl.status IN ('published', 'active')
     LEFT JOIN portfolio_projects pp ON pp.company_id = c.id
     ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
     GROUP BY c.id
     ORDER BY COALESCE((c.metadata->>'isFeatured')::boolean, false) DESC, c.created_at DESC
     LIMIT $${limitParam} OFFSET $${offsetParam}`,
    params,
  );

  return {
    providers: rows.map(mapProvider),
    total: count.rows[0]?.total || 0,
    page: Number(page),
    limit: Number(limit),
  };
}

export async function getPublicServices({
  categorySlug,
  search,
  page = 1,
  limit = 12,
}) {
  const params = [];
  const where = [`sl.status IN ('published', 'active')`];

  if (categorySlug) {
    params.push(categorySlug);
    where.push(`sc.slug = $${params.length}`);
  }

  if (search) {
    params.push(`%${search}%`);
    where.push(
      `(sl.title ILIKE $${params.length} OR sl.description ILIKE $${params.length})`,
    );
  }

  params.push(Number(limit));
  const limitParam = params.length;
  params.push((Math.max(Number(page), 1) - 1) * Number(limit));
  const offsetParam = params.length;

  const { rows } = await pool.query(
    `SELECT sl.*, sc.name AS category_name, sc.slug AS category_slug,
      c.id AS company_id, c.name AS provider_name, c.slug AS provider_slug
     FROM service_listings sl
     JOIN companies c ON c.id = sl.company_id
     LEFT JOIN service_categories sc ON sc.id = sl.category_id
     WHERE ${where.join(" AND ")}
     ORDER BY sl.featured DESC, sl.created_at DESC
     LIMIT $${limitParam} OFFSET $${offsetParam}`,
    params,
  );

  return {
    services: rows.map(mapService),
    page: Number(page),
    limit: Number(limit),
  };
}

export async function getPublicProvider(slugOrId) {
  const { rows } = await pool.query(
    `SELECT c.*,
      COUNT(DISTINCT sl.id)::int AS service_count,
      COUNT(DISTINCT pp.id)::int AS portfolio_count
     FROM companies c
     LEFT JOIN service_listings sl
      ON sl.company_id = c.id AND sl.status IN ('published', 'active')
     LEFT JOIN portfolio_projects pp ON pp.company_id = c.id
     WHERE c.id::text = $1 OR c.slug = $1
     GROUP BY c.id`,
    [slugOrId],
  );

  const provider = rows[0];
  if (!provider) return null;

  const [{ rows: serviceRows }, { rows: portfolioRows }] = await Promise.all([
    pool.query(
      `SELECT sl.*, sc.name AS category_name, sc.slug AS category_slug,
        c.name AS provider_name, c.slug AS provider_slug
       FROM service_listings sl
       JOIN companies c ON c.id = sl.company_id
       LEFT JOIN service_categories sc ON sc.id = sl.category_id
       WHERE sl.company_id = $1 AND sl.status IN ('published', 'active')
       ORDER BY sl.featured DESC, sl.created_at DESC`,
      [provider.id],
    ),
    pool.query(
      `SELECT *
       FROM portfolio_projects
       WHERE company_id = $1
       ORDER BY completion_date DESC NULLS LAST, created_at DESC`,
      [provider.id],
    ),
  ]);

  return {
    ...mapProvider(provider),
    services: serviceRows.map(mapService),
    portfolio: portfolioRows.map((project) => ({
      ...project,
      location: project.project_location,
      project_year: project.completion_date
        ? new Date(project.completion_date).getFullYear()
        : null,
      projectCostRange: project.metadata?.projectCostRange || "",
      clientType: project.metadata?.clientType || "",
      beforeImages: project.metadata?.beforeImages || [],
      afterImages: project.metadata?.afterImages || [],
    })),
  };
}
 */

import pool from "../../lib/connect.js";

// Get a single provider by ID with their services and portfolio
export async function getProviderById(businessName) {
  const providerQuery = `
    SELECT 
      v.id,
      v.fname,
      v.lname,
      v.email,
      v.phone,
      vd.business_name,
      vd.business_desc,
      vd.address,
      COUNT(DISTINCT fdsl.id)::int as service_count,
      COUNT(DISTINCT fdpp.id)::int as portfolio_count
    FROM vendors v
    LEFT JOIN vendor_documents vd ON vd.vendor_id = v.id
    LEFT JOIN farm_dev_service_listings fdsl ON fdsl.vendor_id = v.id AND fdsl.status = 'active'
    LEFT JOIN farm_dev_portfolio_projects fdpp ON fdpp.vendor_id = v.id
    WHERE vd.business_name = $1
    GROUP BY v.id, v.fname, v.lname, v.email, v.phone, vd.business_name, vd.business_desc, vd.address
  `;

  const providerResult = await pool.query(providerQuery, [businessName]);

  if (providerResult.rows.length === 0) {
    console.error("error with providers", providerResult);
    return null;
  }

  const provider = providerResult.rows[0];

  // Get services for this provider
  const servicesQuery = `
    SELECT 
      fdsl.*,
      vd.business_name,
      cu.currency, cu.country_code
    FROM farm_dev_service_listings fdsl
    LEFT JOIN vendor_documents vd ON vd.vendor_id = fdsl.vendor_id
    LEFT JOIN country_utils cu ON cu.vendor_id = fdsl.vendor_id
    WHERE vd.business_name = $1 AND fdsl.status = 'active'
    ORDER BY fdsl.created_at DESC
  `;

  const servicesResult = await pool.query(servicesQuery, [businessName]);

  // Get portfolio for this provider
  const portfolioQuery = `
    SELECT fdpp.*,
           vd.business_name
    FROM farm_dev_portfolio_projects fdpp
    LEFT JOIN vendor_documents vd ON vd.vendor_id = fdpp.vendor_id
    WHERE vd.business_name = $1
    ORDER BY fdpp.completion_date DESC NULLS LAST, fdpp.created_at DESC
  `;

  const portfolioResult = await pool.query(portfolioQuery, [businessName]);

  return {
    ...provider,
    services: servicesResult.rows,
    portfolio: portfolioResult.rows,
  };
}

// Get services with optional category and search filters
export async function getServices(category = null, search = null) {
  const serviceCategoryCard = await pool.query(
    "SELECT DISTINCT category, COUNT(*)::int as service_count FROM farm_dev_service_listings WHERE status = 'active' GROUP BY category",
  );

  let query = `
    SELECT 
      fdsl.*,
      vd.business_name,
      cu.currency, cu.country_code,
      v.fname,
      v.lname
    FROM farm_dev_service_listings fdsl
    LEFT JOIN vendor_documents vd ON vd.vendor_id = fdsl.vendor_id
    LEFT JOIN vendors v ON v.id = fdsl.vendor_id
    LEFT JOIN country_utils cu ON cu.vendor_id = fdsl.vendor_id
    WHERE fdsl.status = 'active'
  `;

  const params = [];
  let paramCount = 0;

  if (category) {
    paramCount++;
    query += ` AND fdsl.category = $${paramCount}`;
    params.push(category);
  }

  if (search) {
    paramCount++;
    query += ` AND (fdsl.title ILIKE $${paramCount} OR fdsl.description ILIKE $${paramCount} OR fdsl.category ILIKE $${paramCount})`;
    params.push(`%${search}%`);
  }

  query += ` ORDER BY fdsl.created_at DESC`;

  const result = await pool.query(query, params);
  return {
    serviceCategoryCard: serviceCategoryCard.rows,
    services: result.rows,
  };
}

export async function submitBookingRequest({ data }) {
  const { target_id, quote_type, full_name, phone, metadata, additional_info } =
    data;
  const result = await pool.query(
    `INSERT INTO quote_requests (target_id, quote_type, full_name, phone, metadata, additional_info) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [target_id, quote_type, full_name, phone, metadata, additional_info],
  );

  return result.rows[0];
}

// Get all categories with service counts
// export async function getCategories() {
//   const query = `
//     SELECT
//       DISTINCT category,
//       slug,
//       COUNT(*)::int as service_count
//     FROM farm_dev_service_listings
//     WHERE status = 'active'
//     GROUP BY category, slug
//     ORDER BY category ASC
//   `;

//   const result = await pool.query(query);
//   return result.rows;
// }

// export async function categoriesCard() {
//   const categoriesQuery =
//     "SELECT category, slug, COUNT(*)::int as category_count FROM farm_dev_service_listings WHERE status = 'active' GROUP BY category, slug";

//   const providersQuery =
//     "SELECT fdsl.slug, v.fname, v.lname, vd.business_name, vd.address, COUNT(fdsl.id)::int as service_count, COUNT(fdpp.id)::int as portfolio_count FROM vendors v LEFT JOIN farm_dev_service_listings fdsl ON fdsl.vendor_id = v.id LEFT JOIN farm_dev_portfolio_projects fdpp ON fdpp.vendor_id = v.id LEFT JOIN vendor_documents vd ON vd.vendor_id = v.id WHERE fdsl.status = 'active' GROUP BY v.fname, v.lname, vd.business_name, vd.address, fdsl.slug";
//   const [categoriesResult, providersResult] = await Promise.all([
//     pool.query(categoriesQuery),
//     pool.query(providersQuery),
//   ]);

//   console.log(providersResult.rows);
//   return {
//     categories: categoriesResult.rows,
//     providers: providersResult.rows,
//   };
// }
