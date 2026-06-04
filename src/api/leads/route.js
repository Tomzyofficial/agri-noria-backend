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
    const status = searchParams.get('status');

    let query = `SELECT * FROM leads WHERE company_id = $1`;
    const params = [parseInt(companyId)];

    if (status) {
      query += ` AND status = $2`;
      params.push(status);
    }

    query += ` ORDER BY created_at DESC`;

    const leads = await queryMany(query, params);
    return Response.json(leads);
  } catch (error) {
    console.error('[v0] Leads GET error:', error);
    return Response.json({ error: 'Failed to fetch leads' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { listingId, companyId, customerName, customerEmail, customerPhone, message, budget } = body;

    if (!companyId || !customerName || !customerEmail) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const result = await queryOne(
      `INSERT INTO leads (listing_id, company_id, customer_name, customer_email, customer_phone, message, budget, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [listingId || null, companyId, customerName, customerEmail, customerPhone || '', message || '', budget || '', 'new']
    );

    return Response.json(result, { status: 201 });
  } catch (error) {
    console.error('[v0] Leads POST error:', error);
    return Response.json({ error: 'Failed to create lead' }, { status: 500 });
  }
}
