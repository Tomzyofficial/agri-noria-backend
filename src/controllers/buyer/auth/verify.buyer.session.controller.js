import { verifyBuyerToken } from "../../../sessions/buyer.auth.session.js";
export async function verifyBuyer(req, res) {
   try {
      const payload = await verifyBuyerToken(req);

      if (!payload) {
         return res.status(401).json({ authenticated: false });
      }

      return res.status(200).json({
         authenticated: true,
         buyerId: payload.buyer_id,
         name: payload.name,
         email: payload.email,
         token: payload || null,
      });
   } catch {
      return res.status(401).json({ authenticated: false });
   }
}
