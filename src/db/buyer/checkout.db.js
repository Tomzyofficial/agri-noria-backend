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
         ls.discount, ls.min_quantity, ls.id AS listing_id, ls.account_id AS listing_vendor_id, ls.location AS seller_pickup_address, ls.unit_measure,
         v.id AS seller_id, v.fname AS seller_fname, v.lname AS seller_lname, v.phone AS seller_phone, v.email AS seller_email
         FROM carts c LEFT JOIN buyers b ON c.buyer_id = b.buyer_id
         LEFT JOIN cart_items ci ON ci.cart_id = c.cart_id
         LEFT JOIN listings ls ON ls.id = ci.listing_id
         LEFT JOIN vendors v ON v.id = ls.account_id
         WHERE c.buyer_id = $1 AND ls.status = 'active' ORDER BY c.created_at`,
      [buyerId],
    );

    if (!rows || rows.length === 0) {
      return {
        hasItems: false,
      };
    }

    // Get buyer details from first row
    const { name, buyer_id, email } = rows[0];

    // Group items by vendor
    const sellersMap = new Map();

    rows.forEach((row) => {
      const sellerId = row.seller_id;
      if (!sellersMap.has(sellerId)) {
        sellersMap.set(sellerId, {
          seller_id: row.seller_id,
          seller_fname: row.seller_fname,
          seller_lname: row.seller_lname,
          seller_phone: row.seller_phone,
          seller_email: row.seller_email,
          items: [],
        });
      }
      sellersMap.get(sellerId).items.push({
        listing_id: row.listing_id,
        product_image: row.product_image,
        listing_name: row.listing_name,
        listing_location: row.seller_pickup_address,
        price: row.price,
        unit_measure: row.unit_measure,
        quantity: row.quantity,
        min_quantity: row.min_quantity,
        discount: row.discount,
        country_code: row.country_code,
        currency: row.currency,
      });
    });

    const vendors = Array.from(sellersMap.values());

    return {
      hasItems: true,
      buyer: {
        name,
        buyer_id,
        email,
      },
      vendors,
    };
  } catch {
    return { hasItems: false };
  }
}
