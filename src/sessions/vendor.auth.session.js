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
      account_type: user.account_type,
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
   res.cookie(COOKIE_NAME, token, cookieConfig);
   return token;
}

/**
 * Verify Vendor Token
 */
export async function verifyVendorToken(req) {
   try {
      let token = req.cookies?.[COOKIE_NAME];

      if (!token && req.headers.authorization?.startsWith("Bearer ")) {
         token = req.headers.authorization.split(" ")[1];
      }

      if (!token) return null;

      const { payload } = await jwtVerify(token, encodedKey, {
         algorithms: ["HS256"],
      });
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

   res.clearCookie(COOKIE_NAME, cookieConfig);
   return true;
}
