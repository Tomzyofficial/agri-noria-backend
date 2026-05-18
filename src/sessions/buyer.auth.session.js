import { SignJWT, jwtVerify } from "jose";
const secureKey = process.env.BUYER_SESSION_SECRET_KEY;
if (!secureKey) throw new Error("Missing session secret key");
const encodedKey = new TextEncoder().encode(secureKey);

/* Create a JWT session and set as HTTP-only cookie */
export async function createBuyerSession(res, { buyer_id, email, name }) {
   const expiresAt = new Date(Date.now() + 1 * 24 * 60 * 60 * 1000); // 24 hours

   // Create JWT
   const sessionToken = await new SignJWT({ buyer_id, email, name })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime(expiresAt)
      .sign(encodedKey);

   // Set HTTP-only cookie
   res.cookie("buyer-session", sessionToken, {
      httpOnly: true,
      secure: true,
      expires: expiresAt,
      sameSite: "none",
      path: "/",
   });
   return sessionToken;
}

/* Verify session from request cookies  */
export async function verifyBuyerToken(req) {
   let token = req.cookies?.["buyer-session"];

   if (!token && req.headers.authorization?.startsWith("Bearer ")) {
      token = req.headers.authorization.split(" ")[1];
   }

   if (!token) return null;

   const { payload } = await jwtVerify(token, encodedKey, {
      algorithms: ["HS256"],
   });

   return payload;
}

/* Delete session by clearing cookie */
export function deleteBuyerSession(res) {
   res.clearCookie("buyer-session", { path: "/" });
   res.clearCookie("cart-session", { path: "/" });
   return true;
}
