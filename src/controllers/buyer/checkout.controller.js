import { getBuyerCheckoutData } from "../../db/buyer/checkout.db.js";

export async function getCheckoutData(req, res) {
  const { buyerId } = req.body;
  if (!buyerId) {
    return res.status(400).json({ error: "buyerId is required" });
  }
  try {
    const data = await getBuyerCheckoutData(buyerId);
    return res.json(data);
  } catch (error) {
    console.error("Error fetching checkout data:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
