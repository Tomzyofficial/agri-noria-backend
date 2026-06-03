import { queryOne, queryMany } from '@/lib/db';
import { verifyToken, getTokenFromRequest } from '@/lib/auth';

export async function GET(request, { params }) {
  try {
    const { id } = await params;

    const lead = await queryOne(
      'SELECT * FROM leads WHERE id = $1',
      [parseInt(id)]
    );

    if (!lead) {
      return Response.json({ error: 'Lead not found' }, { status: 404 });
    }

    const history = await queryMany(
      'SELECT * FROM lead_status_history WHERE lead_id = $1 ORDER BY changed_at DESC',
      [parseInt(id)]
    );

    lead.status_history = history;

    return Response.json(lead);
  } catch (error) {
    console.error('[v0] Lead GET error:', error);
    return Response.json({ error: 'Failed to fetch lead' }, { status: 500 });
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
    const { status, message } = body;

    // Get current lead status
    const lead = await queryOne('SELECT status FROM leads WHERE id = $1', [parseInt(id)]);

    if (!lead) {
      return Response.json({ error: 'Lead not found' }, { status: 404 });
    }

    // Update lead
    const result = await queryOne(
      `UPDATE leads SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *`,
      [status || lead.status, parseInt(id)]
    );

    // Record status change if status changed
    if (status && status !== lead.status) {
      await queryOne(
        'INSERT INTO lead_status_history (lead_id, old_status, new_status) VALUES ($1, $2, $3)',
        [parseInt(id), lead.status, status]
      );
    }

    return Response.json(result);
  } catch (error) {
    console.error('[v0] Lead PATCH error:', error);
    return Response.json({ error: 'Failed to update lead' }, { status: 500 });
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

    await queryOne('DELETE FROM leads WHERE id = $1', [parseInt(id)]);

    return Response.json({ message: 'Lead deleted' });
  } catch (error) {
    console.error('[v0] Lead DELETE error:', error);
    return Response.json({ error: 'Failed to delete lead' }, { status: 500 });
  }
}
