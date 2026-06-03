import { queryOne, queryMany } from '@/lib/db';
import { verifyToken, getTokenFromRequest } from '@/lib/auth';

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    
    const listing = await queryOne(
      `SELECT 
        sl.id, sl.company_id, sl.category_id, sl.title, sl.description,
        sl.price, sl.price_type, sl.location, sl.status, sl.featured,
        sl.views_count, sl.created_at, sl.updated_at,
        sc.name as category_name,
        c.name as company_name
      FROM service_listings sl
      LEFT JOIN service_categories sc ON sl.category_id = sc.id
      LEFT JOIN companies c ON sl.company_id = c.id
      WHERE sl.id = $1`,
      [parseInt(id)]
    );

    if (!listing) {
      return Response.json({ error: 'Listing not found' }, { status: 404 });
    }

    const images = await queryMany(
      'SELECT id, image_url, alt_text, display_order FROM listing_images WHERE listing_id = $1 ORDER BY display_order',
      [parseInt(id)]
    );

    listing.images = images;

    // Record view
    await queryOne(
      'INSERT INTO listing_views (listing_id, ip_address, user_agent) VALUES ($1, $2, $3)',
      [
        parseInt(id),
        request.headers.get('x-forwarded-for') || 'unknown',
        request.headers.get('user-agent') || 'unknown'
      ]
    );

    // Increment view count
    await queryOne(
      'UPDATE service_listings SET views_count = views_count + 1 WHERE id = $1',
      [parseInt(id)]
    );

    return Response.json(listing);
  } catch (error) {
    console.error('[v0] Listing GET error:', error);
    return Response.json({ error: 'Failed to fetch listing' }, { status: 500 });
  }
}

export async function PATCH(request, { params }) {
  try {
    const token = getTokenFromRequest(request);
    if (!token) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return Response.json({ error: 'Invalid token' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { title, description, price, priceType, location, status, featured } = body;

    const result = await queryOne(
      `UPDATE service_listings 
       SET title = COALESCE($1, title),
           description = COALESCE($2, description),
           price = COALESCE($3, price),
           price_type = COALESCE($4, price_type),
           location = COALESCE($5, location),
           status = COALESCE($6, status),
           featured = COALESCE($7, featured),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $8
       RETURNING *`,
      [title, description, price, priceType, location, status, featured, parseInt(id)]
    );

    if (!result) {
      return Response.json({ error: 'Listing not found' }, { status: 404 });
    }

    return Response.json(result);
  } catch (error) {
    console.error('[v0] Listing PATCH error:', error);
    return Response.json({ error: 'Failed to update listing' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const token = getTokenFromRequest(request);
    if (!token) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return Response.json({ error: 'Invalid token' }, { status: 401 });
    }

    const { id } = await params;

    await queryOne(
      'DELETE FROM service_listings WHERE id = $1',
      [parseInt(id)]
    );

    return Response.json({ message: 'Listing deleted' });
  } catch (error) {
    console.error('[v0] Listing DELETE error:', error);
    return Response.json({ error: 'Failed to delete listing' }, { status: 500 });
  }
}
