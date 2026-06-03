import { queryMany, queryOne } from '@/lib/db';
import { verifyToken, getTokenFromRequest } from '@/lib/auth';

export async function GET(request) {
  try {
    const token = getTokenFromRequest(request);
    if (!token) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return Response.json({ error: 'Invalid token' }, { status: 401 });
    }

    const searchParams = new URL(request.url).searchParams;
    const companyId = searchParams.get('companyId');

    // Get total listings
    const listings = await queryOne(
      'SELECT COUNT(*) as count FROM service_listings WHERE company_id = $1',
      [parseInt(companyId)]
    );

    // Get total leads
    const leads = await queryOne(
      'SELECT COUNT(*) as count FROM leads WHERE company_id = $1',
      [parseInt(companyId)]
    );

    // Get total views
    const views = await queryOne(
      `SELECT SUM(lv.views_count) as total
       FROM listing_views lv
       JOIN service_listings sl ON lv.listing_id = sl.id
       WHERE sl.company_id = $1`,
      [parseInt(companyId)]
    );

    // Get leads by status
    const leadsByStatus = await queryMany(
      'SELECT status, COUNT(*) as count FROM leads WHERE company_id = $1 GROUP BY status',
      [parseInt(companyId)]
    );

    // Get top performing listings
    const topListings = await queryMany(
      `SELECT id, title, views_count FROM service_listings 
       WHERE company_id = $1
       ORDER BY views_count DESC
       LIMIT 5`,
      [parseInt(companyId)]
    );

    return Response.json({
      totalListings: parseInt(listings.count),
      totalLeads: parseInt(leads.count),
      totalViews: parseInt(views.total || 0),
      leadsByStatus: leadsByStatus.map(r => ({ status: r.status, count: parseInt(r.count) })),
      topListings,
    });
  } catch (error) {
    console.error('[v0] Analytics GET error:', error);
    return Response.json({ error: 'Failed to fetch analytics' }, { status: 500 });
  }
}
