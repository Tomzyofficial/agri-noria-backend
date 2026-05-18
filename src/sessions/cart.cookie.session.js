import { SignJWT, jwtVerify } from "jose";

const CART_COOKIE_NAME = "cart-session";
const isProduction = process.env.NODE_ENV === "production";

const CART_JWT_SECRET = process.env.CART_JWT_SECRET;
if (!CART_JWT_SECRET) {
   throw new Error("Missing CART_JWT_SECRET");
}

const encodedKey = new TextEncoder().encode(CART_JWT_SECRET);

async function setCartCookie(res, cart) {
   const sessionToken = await new SignJWT({ cart: cart })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("7d")
      .sign(encodedKey);

   // Configure cookie for cross-origin support in production
   const cookieConfig = {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: "/",
   };

   // Add domain for production cross-origin cookies
   /*  if (isProduction) {
      cookieConfig.domain = process.env.COOKIE_DOMAIN || ".vercel.app";
   } */

   res.cookie(CART_COOKIE_NAME, sessionToken, cookieConfig);
   return sessionToken;
}

async function verifyCartToken(req) {
   let token = req.cookies?.[CART_COOKIE_NAME];

   if (!token && req.headers.authorization?.startsWith("Bearer ")) {
      token = req.headers.authorization.split(" ")[1];
   }

   if (!token) {
      return { cart: [] };
   }

   try {
      const { payload } = await jwtVerify(token, encodedKey, {
         algorithms: ["HS256"],
      });
      return payload;
   } catch (error) {
      console.log(error.message || "Failed to verify cart token coming from the cart cookie session.js file");
      return { cart: [] };
   }
}

/**
 * Clear cart cookie
 */
function deleteCartCookie(res) {
   // Configure cookie deletion to match creation settings
   const cookieConfig = {
      httpOnly: true,
      secure: isProduction,
      sameSite: "none",
      path: "/",
   };

   // Add domain for production cross-origin cookies
   if (isProduction) {
      cookieConfig.domain = process.env.COOKIE_DOMAIN || ".vercel.app";
   }

   res.clearCookie(CART_COOKIE_NAME, cookieConfig);
   return true;
}

export { verifyCartToken, setCartCookie, deleteCartCookie };
