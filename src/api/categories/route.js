import { queryMany } from '@/lib/db';

export async function GET(request) {
  try {
    const categories = await queryMany(
      'SELECT id, name, description, icon_name FROM service_categories ORDER BY name'
    );

    return Response.json(categories);
  } catch (error) {
    console.error('[v0] Categories GET error:', error);
    return Response.json({ error: 'Failed to fetch categories' }, { status: 500 });
  }
}
