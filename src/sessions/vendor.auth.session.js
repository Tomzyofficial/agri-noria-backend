import { SignJWT, jwtVerify } from "jose";

const COOKIE_NAME = "vendor-session";

const getSecretKey = () => {
  const secret = process.env.VENDOR_SESSION_SECRET_KEY;
  if (!secret) {
    throw new Error("VENDOR_SESSION_SECRET_KEY is required");
  }
  return new TextEncoder().encode(secret);
};

const encodedKey = getSecretKey();

/**
 * Create Vendor Session
 */
export async function createVendorSession(res, { user, rememberMe = false }) {
  const expiresIn = rememberMe ? "30d" : "1d";
  const maxAgeMs = rememberMe ? 30 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;

  const token = await new SignJWT({
    id: user.id,
    workspace: user.workspace,
    role: user.role,
    fname: user.fname,
    lname: user.lname,
    email: user.email,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(encodedKey);

  // Dynamically assign cookie name based on workspace
  const activeCookieName = user.workspace === 'marketplace' ? 'marketplace-session' : 'ecosystem-session';

  // Configure cookie for cross-origin support in production
  const cookieConfig = {
    httpOnly: true,
    secure: true,
    sameSite: "none",
    path: "/",
    maxAge: maxAgeMs,
  };
  res.cookie(activeCookieName, token, cookieConfig);
  return token;
}

/**
 * Verify Vendor Token
 */
export async function verifyVendorToken(req) {
  try {
    // Check proxy injected header for active context
    const workspace = req.headers['x-active-workspace'] || 'ecosystem';
    const activeCookieName = workspace === 'marketplace' ? 'marketplace-session' : 'ecosystem-session';

    let token = req.cookies?.[activeCookieName];
    
    // Fallback for old cookie structure
    if (!token) token = req.cookies?.[COOKIE_NAME];

    if (!token && req.headers.authorization?.startsWith("Bearer ")) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) return null;

    const { payload } = await jwtVerify(token, encodedKey, {
      algorithms: ["HS256"],
    });
    
    // Restore backward compatibility for old tokens
    if (!payload.id && payload.vendor_id) {
       payload.id = payload.vendor_id;
    }
    
    return payload;
  } catch {
    return null;
  }
}

/**
 * Delete Vendor Session
 */
export function deleteVendorSession(res) {
  // Configure cookie deletion to match creation settings
  const cookieConfig = {
    httpOnly: true,
    secure: true,
    sameSite: "none",
    path: "/",
  };

  // Get active workspace context to clear correct cookie
  // Note: we'll default to clearing both if workspace is unknown, but preferably we clear the targeted one
  res.clearCookie('marketplace-session', cookieConfig);
  res.clearCookie('ecosystem-session', cookieConfig);
  res.clearCookie(COOKIE_NAME, cookieConfig); // clear legacy cookie just in case
  return true;
}
