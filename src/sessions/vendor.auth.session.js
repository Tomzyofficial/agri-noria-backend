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

  // Configure cookie for cross-origin support in production
  const cookieConfig = {
    httpOnly: true,
    secure: true,
    sameSite: "none",
    path: "/",
    maxAge: maxAgeMs,
  };

  // Set cookies for both workspaces and legacy vendor-session so the session is unified
  res.cookie("marketplace-session", token, cookieConfig);
  res.cookie("ecosystem-session", token, cookieConfig);
  res.cookie(COOKIE_NAME, token, cookieConfig);

  return token;
}

/**
 * Verify Vendor Token
 */
export async function verifyVendorToken(req) {
  try {
    // Check proxy injected header for active context
    const workspace = req.headers["x-active-workspace"] || "ecosystem";
    const activeCookieName =
      workspace === "marketplace" ? "marketplace-session" : "ecosystem-session";

    let token =
      req.cookies?.[activeCookieName] ||
      req.cookies?.["vendor-session"] ||
      req.cookies?.["marketplace-session"] ||
      req.cookies?.["ecosystem-session"];

    if (!token && req.headers?.cookie) {
      const parsedCookies = {};
      req.headers.cookie.split(";").forEach((cookieStr) => {
        const parts = cookieStr.split("=");
        if (parts.length >= 2) {
          const name = parts[0].trim();
          const val = parts.slice(1).join("=").trim();
          parsedCookies[name] = val;
        }
      });
      token =
        parsedCookies[activeCookieName] ||
        parsedCookies["vendor-session"] ||
        parsedCookies["marketplace-session"] ||
        parsedCookies["ecosystem-session"];
    }

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

  // Clear all workspace and legacy cookies
  res.clearCookie("marketplace-session", cookieConfig);
  res.clearCookie("ecosystem-session", cookieConfig);
  res.clearCookie(COOKIE_NAME, cookieConfig);
  return true;
}
