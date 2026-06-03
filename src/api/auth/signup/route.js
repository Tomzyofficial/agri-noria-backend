import { queryOne } from '@/lib/db';
import { hashPassword, createToken } from '@/lib/auth';

export async function POST(request) {
  try {
    const body = await request.json();
    const { email, password, firstName, lastName } = body;

    // Validate input
    if (!email || !password || password.length < 6) {
      return Response.json(
        { error: 'Invalid email or password (min 6 chars)' },
        { status: 400 }
      );
    }

    // Check if user exists
    const existingUser = await queryOne(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );

    if (existingUser) {
      return Response.json(
        { error: 'Email already registered' },
        { status: 409 }
      );
    }

    // Hash password and create user
    const passwordHash = await hashPassword(password);
    
    const result = await queryOne(
      `INSERT INTO users (email, password_hash, first_name, last_name)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email`,
      [email, passwordHash, firstName || '', lastName || '']
    );

    const token = createToken(result.id, result.email);

    const response = Response.json({
      user: {
        id: result.id,
        email: result.email,
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
    console.error('[v0] Signup error:', error);
    return Response.json(
      { error: 'Signup failed' },
      { status: 500 }
    );
  }
}
