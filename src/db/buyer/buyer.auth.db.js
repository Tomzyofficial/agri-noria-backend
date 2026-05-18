import pool from "../../lib/connect.js";
// Get user by email
export async function getUserByEmail(email) {
   const { rows } = await pool.query("SELECT * FROM buyers WHERE email = $1", [email]);
   return rows[0] || null;
}

// Create user
export async function createUser(email, password_hash, name, auth_provider) {
   const { rows } = await pool.query(
      `INSERT INTO buyers (email, password_hash, name, auth_provider) 
     VALUES ($1, $2, $3, $4) RETURNING buyer_id, email, name`,
      [email, password_hash, name, auth_provider]
   );
   return rows[0] || null;
}

// Creat cart items. not in use yet
export async function createCartItem(buyer_id, description, listing_name, price, product_image, quantity) {
   const { rows } = await pool.query(
      `INSERT INTO customer_orders (buyer_id, description, listing_name, price, product_image, quantity) 
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [buyer_id, description, listing_name, price, product_image, quantity]
   );
   return rows[0] || null;
}

// Insert buyer cart items into the customer_orders table. not in use yet
export async function createBuyerOrder(buyer_id, total_amount, status, payment_method, delivery_address) {
   const { rows } = await pool.query(
      `INSERT INTO customer_orders (buyer_id, total_amount, status, payment_method, delivery_address) 
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [buyer_id, total_amount, status, payment_method, delivery_address]
   );
   return rows[0] || null;
}

export async function getCartItem(buyer_id) {
   const { rows } = await pool.query("SELECT * FROM cart_items WHERE buyer_id = $1", [buyer_id]);
   return rows[0] || null;
}
