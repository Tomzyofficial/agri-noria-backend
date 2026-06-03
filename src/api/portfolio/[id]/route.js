import { queryOne, queryMany } from '@/lib/db';
import { verifyToken, getTokenFromRequest } from '@/lib/auth';

export async function GET(request, { params }) {
  try {
    const { id } = await params;

    const project = await queryOne(
      'SELECT * FROM portfolio_projects WHERE id = $1',
      [parseInt(id)]
    );

    if (!project) {
      return Response.json({ error: 'Project not found' }, { status: 404 });
    }

    const images = await queryMany(
      'SELECT id, image_url, alt_text, display_order FROM portfolio_images WHERE project_id = $1 ORDER BY display_order',
      [parseInt(id)]
    );

    project.images = images;

    return Response.json(project);
  } catch (error) {
    console.error('[v0] Portfolio GET error:', error);
    return Response.json({ error: 'Failed to fetch project' }, { status: 500 });
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
    const { title, description, clientName, category, completionDate, featured } = body;

    const result = await queryOne(
      `UPDATE portfolio_projects 
       SET title = COALESCE($1, title),
           description = COALESCE($2, description),
           client_name = COALESCE($3, client_name),
           category = COALESCE($4, category),
           completion_date = COALESCE($5, completion_date),
           featured = COALESCE($6, featured),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $7
       RETURNING *`,
      [title, description, clientName, category, completionDate, featured, parseInt(id)]
    );

    if (!result) {
      return Response.json({ error: 'Project not found' }, { status: 404 });
    }

    return Response.json(result);
  } catch (error) {
    console.error('[v0] Portfolio PATCH error:', error);
    return Response.json({ error: 'Failed to update project' }, { status: 500 });
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
      'DELETE FROM portfolio_projects WHERE id = $1',
      [parseInt(id)]
    );

    return Response.json({ message: 'Project deleted' });
  } catch (error) {
    console.error('[v0] Portfolio DELETE error:', error);
    return Response.json({ error: 'Failed to delete project' }, { status: 500 });
  }
}
