import { verifyBuyerToken } from "../../../sessions/buyer.auth.session.js";
import { getUserByEmail } from "../../../db/buyer/buyer.auth.db.js";

export async function verifyBuyer(req, res) {
   try {
      const payload = await verifyBuyerToken(req);

      if (!payload) {
         return res.status(401).json({ authenticated: false });
      }

      // Fetch fresh data from DB
      const user = await getUserByEmail(payload.email);
      if (!user) {
         return res.status(401).json({ authenticated: false });
      }

      return res.status(200).json({
         authenticated: true,
         buyerId: payload.buyer_id,
         name: user.name || payload.name,
         email: payload.email,
         phone: user.phone || "",
         companyName: user.company_name || "",
         registrationNumber: user.registration_number || "",
         taxId: user.tax_id || "",
         headquarters: user.headquarters || "",
         token: payload || null,
      });
   } catch {
      return res.status(401).json({ authenticated: false });
   }
}
