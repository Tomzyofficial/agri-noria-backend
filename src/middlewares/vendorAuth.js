import { jwtVerify } from "jose";
const getSecretKey = () => {
   const secret = process.env.VENDOR_SESSION_SECRET_KEY;
   if (!secret) {
      throw new Error("VENDOR_SESSION_SECRET_KEY is required");
   }
   return new TextEncoder().encode(secret);
};

const encodedKey = getSecretKey();

export const requireVendorAuth = async (req, res, next) => {
   try {
      let token = req.cookies?.["vendor_session"];

      if (!token && req.headers.authorization?.startsWith("Bearer ")) {
         token = req.headers.authorization.split(" ")[1];
      }

      if (!token) return res.status(401).json({ message: "Authentication required" });

      const { payload } = await jwtVerify(token, encodedKey, {
         algorithms: ["HS256"],
      });
      // Attach payload to request
      req.user = payload;

      next();
   } catch {
      return res.status(401).json({ message: "Invalid token" });
   }
};
