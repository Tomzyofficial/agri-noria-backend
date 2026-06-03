import { queryOne } from '@/lib/db';
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
    const companyId = searchParams.get('id');

    const company = await queryOne(
      'SELECT * FROM companies WHERE id = $1',
      [parseInt(companyId)]
    );

    if (!company) {
      return Response.json({ error: 'Company not found' }, { status: 404 });
    }

    return Response.json(company);
  } catch (error) {
    console.error('[v0] Company GET error:', error);
    return Response.json({ error: 'Failed to fetch company' }, { status: 500 });
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
    const { name, description, website, phone, email, address, city, state, zipCode, country } = body;

    if (!name) {
      return Response.json({ error: 'Company name is required' }, { status: 400 });
    }

    const result = await queryOne(
      `INSERT INTO companies (user_id, name, description, website, phone, email, address, city, state, zip_code, country)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [decoded.id, name, description || '', website || '', phone || '', email || '', address || '', city || '', state || '', zipCode || '', country || '']
    );

    return Response.json(result, { status: 201 });
  } catch (error) {
    console.error('[v0] Company POST error:', error);
    return Response.json({ error: 'Failed to create company' }, { status: 500 });
  }
}

export async function PATCH(request) {
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
    const { id, name, description, website, phone, email, address, city, state, zipCode, country } = body;

    const result = await queryOne(
      `UPDATE companies 
       SET name = COALESCE($1, name),
           description = COALESCE($2, description),
           website = COALESCE($3, website),
           phone = COALESCE($4, phone),
           email = COALESCE($5, email),
           address = COALESCE($6, address),
           city = COALESCE($7, city),
           state = COALESCE($8, state),
           zip_code = COALESCE($9, zip_code),
           country = COALESCE($10, country),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $11
       RETURNING *`,
      [name, description, website, phone, email, address, city, state, zipCode, country, parseInt(id)]
    );

    if (!result) {
      return Response.json({ error: 'Company not found' }, { status: 404 });
    }

    return Response.json(result);
  } catch (error) {
    console.error('[v0] Company PATCH error:', error);
    return Response.json({ error: 'Failed to update company' }, { status: 500 });
  }
}
