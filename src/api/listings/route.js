import { queryMany, queryOne } from '@/lib/db';
import { verifyToken, getTokenFromRequest } from '@/lib/auth';

export async function GET(request) {
  try {
    const searchParams = new URL(request.url).searchParams;
    const companyId = searchParams.get('companyId');
    const category = searchParams.get('category');
    const status = searchParams.get('status') || 'active';

    let query = `
      SELECT 
        sl.id, sl.company_id, sl.category_id, sl.title, sl.description,
        sl.price, sl.price_type, sl.location, sl.status, sl.featured,
        sl.views_count, sl.created_at, sl.updated_at,
        sc.name as category_name,
        array_agg(li.image_url) as images
      FROM service_listings sl
      LEFT JOIN service_categories sc ON sl.category_id = sc.id
      LEFT JOIN listing_images li ON sl.id = li.listing_id
      WHERE sl.status = $1
    `;
    const params = [status];
    let paramCount = 1;

    if (companyId) {
      paramCount++;
      query += ` AND sl.company_id = $${paramCount}`;
      params.push(parseInt(companyId));
    }

    if (category) {
      paramCount++;
      query += ` AND sc.name = $${paramCount}`;
      params.push(category);
    }

    query += ` GROUP BY sl.id, sc.name ORDER BY sl.created_at DESC`;

    const listings = await queryMany(query, params);
    return Response.json(listings);
  } catch (error) {
    console.error('[v0] Listings GET error:', error);
    return Response.json({ error: 'Failed to fetch listings' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const token = getTokenFromRequest(request);
    if (!token) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return Response.json({ error: 'Invalid token' }, { status: 401 });
    }

    const body = await request.json();
    const { companyId, categoryId, title, description, price, priceType, location } = body;

    if (!companyId || !categoryId || !title) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const result = await queryOne(
      `INSERT INTO service_listings (company_id, category_id, title, description, price, price_type, location, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [companyId, categoryId, title, description || '', price || null, priceType || 'fixed', location || '', 'active']
    );

    return Response.json(result, { status: 201 });
  } catch (error) {
    console.error('[v0] Listings POST error:', error);
    return Response.json({ error: 'Failed to create listing' }, { status: 500 });
  }
}
