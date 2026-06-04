export async function POST(request) {
  try {
    const response = Response.json({
      message: 'Logged out successfully',
    });

    // Clear auth cookie
    response.headers.set(
      'Set-Cookie',
      'auth_token=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0'
    );

    return response;
  } catch (error) {
    console.error('[v0] Logout error:', error);
    return Response.json(
      { error: 'Logout failed' },
      { status: 500 }
    );
  }
}
