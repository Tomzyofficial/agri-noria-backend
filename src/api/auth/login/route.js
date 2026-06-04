import { queryOne } from '@/lib/db';
import { comparePassword, createToken } from '@/lib/auth';

export async function POST(request) {
  try {
    const body = await request.json();
    const { email, password } = body;

    // Validate input
    if (!email || !password) {
      return Response.json(
        { error: 'Email and password required' },
        { status: 400 }
      );
    }

    // Find user
    const user = await queryOne(
      'SELECT id, email, password_hash FROM users WHERE email = $1 AND deleted_at IS NULL',
      [email]
    );

    if (!user) {
      return Response.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // Verify password
    const validPassword = await comparePassword(password, user.password_hash);

    if (!validPassword) {
      return Response.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    const token = createToken(user.id, user.email);

    const response = Response.json({
      user: {
        id: user.id,
        email: user.email,
      },
      token,
    });

    // Set secure cookie
    response.headers.set(
      'Set-Cookie',
      `auth_token=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=604800`
    );

    return response;
  } catch (error) {
    console.error('[v0] Login error:', error);
    return Response.json(
      { error: 'Login failed' },
      { status: 500 }
    );
  }
}
