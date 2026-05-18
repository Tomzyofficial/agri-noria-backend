import { verifyCartToken } from "../../sessions/cart.cookie.session.js";
export async function verifyCartCookie(req, res) {
   try {
      const payload = await verifyCartToken(req);

      if (!payload) {
         return res.status(401).json({ cart: [] });
      }
      return res.status(200).json({
         success: true,
         cart: payload.cart || [],
      });
   } catch (error) {
      console.error("Error in verifyCartCookie:", error);
      return res.status(200).json({
         success: true,
         cart: [],
      });
   }
}
