import { queryMany, queryOne } from '@/lib/db';
import { verifyToken, getTokenFromRequest } from '@/lib/auth';

export async function GET(request) {
  try {
    const searchParams = new URL(request.url).searchParams;
    const companyId = searchParams.get('companyId');

    let query = `
      SELECT 
        p.id, p.company_id, p.title, p.description, p.client_name,
        p.category, p.completion_date, p.featured, p.created_at, p.updated_at,
        array_agg(pi.image_url) as images
      FROM portfolio_projects p
      LEFT JOIN portfolio_images pi ON p.id = pi.project_id
      WHERE p.company_id = $1
      GROUP BY p.id
      ORDER BY p.created_at DESC
    `;
    const params = [parseInt(companyId)];

    const projects = await queryMany(query, params);
    return Response.json(projects);
  } catch (error) {
    console.error('[v0] Portfolio GET error:', error);
    return Response.json({ error: 'Failed to fetch portfolio' }, { status: 500 });
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
    const { companyId, title, description, clientName, category, completionDate } = body;

    if (!companyId || !title) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const result = await queryOne(
      `INSERT INTO portfolio_projects (company_id, title, description, client_name, category, completion_date)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [companyId, title, description || '', clientName || '', category || '', completionDate || null]
    );

    return Response.json(result, { status: 201 });
  } catch (error) {
    console.error('[v0] Portfolio POST error:', error);
    return Response.json({ error: 'Failed to create portfolio' }, { status: 500 });
  }
}
