import pool from "../../lib/connect.js";

export async function getBuyerCheckoutData(buyerId) {
   try {
      if (!buyerId) {
         throw new Error("Missing buyer_id");
      }

      // Retrieve cart items with buyer's info and also retrieve the vendors who owns the product
      const { rows } = await pool.query(
         `SELECT ci.cart_id AS cart_item_id, ci.quantity, ci.listing_id, ci.product_image, ci.listing_name, ci.country_code, ci.currency, ci.price, c.cart_id,
         b.buyer_id, b.name, b.email,
         ls.discount, ls.min_quantity, ls.id AS listing_id, ls.account_id AS vendor_id,
         v.fname, v.lname, v.phone, v.email AS vendor_email
         FROM carts c JOIN buyers b ON c.buyer_id = b.buyer_id
          JOIN cart_items ci ON ci.cart_id = c.cart_id
          JOIN listings ls ON ls.id = ci.listing_id
          JOIN vendors v ON v.id = ls.account_id
         WHERE c.buyer_id = $1 AND ls.product_status = 'active' ORDER BY c.created_at`,
         [buyerId],
      );

      if (!rows || rows.length === 0) {
         return {
            hasItems: false,
         };
      }

      // Get buyer details from first row
      const { name, email } = rows[0];

      // Group items by vendor
      const vendorsMap = new Map();

      rows.forEach((row) => {
         const vendorId = row.vendor_id;
         if (!vendorsMap.has(vendorId)) {
            vendorsMap.set(vendorId, {
               fname: row.fname,
               lname: row.lname,
               phone: row.phone,
               email: row.vendor_email,
               items: [],
            });
         }
         vendorsMap.get(vendorId).items.push({
            listing_id: row.listing_id,
            product_image: row.product_image,
            listing_name: row.listing_name,
            price: row.price,
            quantity: row.quantity,
            min_quantity: row.min_quantity,
            discount: row.discount,
            country_code: row.country_code,
            currency: row.currency,
         });
      });

      const vendors = Array.from(vendorsMap.values());

      return {
         hasItems: true,
         buyer: {
            name,
            email,
         },
         vendors,
         items: vendors.flatMap((vendor) => vendor.items),
      };
   } catch {
      return { hasItems: false };
   }
}
