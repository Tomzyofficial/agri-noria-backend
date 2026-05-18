import pool from "../../lib/connect.js";
import { setCartCookie, verifyCartToken } from "../../sessions/cart.cookie.session.js";

const buyerCartController = {};

// Merge cookie cart into DB for a buyer - this is called when user logs in
buyerCartController.cartMerge = async (req, res) => {
   try {
      const { buyerId } = await req.body;
      if (!buyerId) {
         return res.status(400).json({ error: "Missing buyerId" });
      }

      // Get cart from secure cookie instead of localStorage
      const payload = await verifyCartToken(req);
      const cookieCart = payload.cart;

      // Ensure the user’s cart exists or create one
      const { rows: existingCart } = await pool.query("SELECT cart_id FROM carts WHERE buyer_id = $1", [buyerId]);

      let cartId = existingCart.length
         ? existingCart[0].cart_id
         : (await pool.query("INSERT INTO carts (buyer_id) VALUES ($1) RETURNING cart_id", [buyerId])).rows[0].cart_id;

      // Fetch all current DB cart items
      const { rows: dbItems } = await pool.query(
         `SELECT listing_name, description, price, product_image, quantity, listing_id, country_code, currency, min_quantity, discount FROM cart_items WHERE cart_id = $1`,
         [cartId],
      );

      // --- Merge Logic ---
      const mergedMap = new Map();

      // Step 1: start with DB items
      for (const item of dbItems) {
         mergedMap.set(item.listing_id, { ...item });
      }

      // Step 2: merge cookie items
      for (const item of cookieCart || []) {
         if (!item?.listing_id) continue;
         const existing = mergedMap.get(item.listing_id);

         if (existing) {
            // If same item exists between item in db and item in cart cookie, sum quantities;
            mergedMap.set(item.listing_id, {
               ...existing,
               ...item,
               quantity: (parseInt(existing.quantity, 10) || 0) + (parseInt(item.quantity, 10) || 1),
            });
         } else {
            // Else if there is existing, merge both db item and cart cookie
            mergedMap.set(item.listing_id, {
               ...item,
               quantity: item.quantity || 1,
            });
         }
      }

      // Array.from used to convert an iterable object back to array
      const mergedCart = Array.from(mergedMap.values());

      // --- Save merged results to DB ---
      // We delete and re-insert cleanly to avoid duplication
      await pool.query("DELETE FROM cart_items WHERE cart_id = $1", [cartId]);
      for (const item of mergedCart) {
         await pool.query(
            `INSERT INTO cart_items (cart_id, description, listing_name, price, product_image, quantity, listing_id, country_code, currency, min_quantity, discount)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
            [
               cartId,
               item.description,
               item.listing_name,
               item.price,
               item.product_image,
               item.quantity,
               item.listing_id,
               item.country_code,
               item.currency,
               item.min_quantity,
               item.discount,
            ],
         );
      }

      // Update cookie with merged cart to keep them in sync
      await setCartCookie(res, mergedCart);

      // Return merged cart
      return res.json({
         success: true,
         message: "Cart merged successfully",
         mergedCart,
         cartId,
      });
   } catch (err) {
      console.error("Error merging cart:", err);
      return res.status(500).json({ success: false, error: err.message });
   }
};

// Sync full cart: get DB cart for buyer (used to load cart when user is authenticated)
buyerCartController.sync = async (req, res) => {
   const { buyerId } = await req.body;

   if (!buyerId) {
      return res.status(400).json({ success: false, error: "Missing required body" });
   }

   try {
      const { rows: items } = await pool.query(
         `SELECT ci.listing_name, ci.description, ci.price, ci.product_image, ci.quantity, ci.listing_id, ci.country_code, ci.currency, ci.min_quantity, ci.discount
         FROM carts c JOIN cart_items ci ON ci.cart_id = c.cart_id WHERE c.buyer_id = $1`,
         [buyerId],
      );

      // Update cookie with DB cart to keep them in sync
      await setCartCookie(res, items);

      return res.json({ success: true, cart: items });
   } catch (err) {
      console.error("Error syncing cart:", err);
      return res.status(500).json({ success: false, error: err.message });
   }
};

// Operations: add/remove/update_quantity
buyerCartController.operations = async (req, res) => {
   try {
      const { buyerId, operation, item } = await req.body;

      if (!buyerId) {
         return res.status(400).json({ error: "Missing buyerId" });
      }

      if (!operation || !item) {
         return res.status(400).json({ error: "Missing operation or item data" });
      }

      // Ensure the user's cart exists
      const { rows: existingCart } = await pool.query("SELECT cart_id FROM carts WHERE buyer_id = $1", [buyerId]);
      let cartId = existingCart.length
         ? existingCart[0].cart_id
         : (await pool.query("INSERT INTO carts (buyer_id) VALUES ($1) RETURNING cart_id", [buyerId])).rows[0].cart_id;

      switch (operation) {
         case "add": {
            // Check if item already exists in cart
            const { rows: existingItem } = await pool.query(
               "SELECT quantity FROM cart_items WHERE cart_id = $1 AND listing_id = $2",
               [cartId, item.listing_id],
            );

            if (existingItem.length > 0) {
               // Update quantity if item exists
               await pool.query(
                  "UPDATE cart_items SET quantity = quantity + $1, price = $2, listing_name = $3, description = $4, product_image = $5, country_code = $6, currency = $7 WHERE cart_id = $8 AND listing_id = $9",
                  [
                     item.quantity || 1,
                     item.price,
                     item.listing_name,
                     item.description,
                     item.product_image,
                     item.country_code,
                     item.currency,
                     item.min_quantity,
                     item.discount,
                     cartId,
                     item.listing_id,
                  ],
               );
            } else {
               // Insert new item
               await pool.query(
                  `INSERT INTO cart_items 
                   (cart_id, description, listing_name, price, product_image, quantity, listing_id, country_code, currency, min_quantity, discount)
                   VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
                  [
                     cartId,
                     item.description,
                     item.listing_name,
                     item.price,
                     item.product_image,
                     item.quantity || 1,
                     item.listing_id,
                     item.country_code,
                     item.currency,
                     item.min_quantity,
                     item.discount,
                  ],
               );
            }
            break;
         }
         case "remove": {
            await pool.query("DELETE FROM cart_items WHERE cart_id = $1 AND listing_id = $2", [
               cartId,
               item.listing_id,
            ]);
            break;
         }
         case "update_quantity": {
            if (item.quantity <= 0) {
               // Remove item if quantity is 0 or negative
               await pool.query("DELETE FROM cart_items WHERE cart_id = $1 AND listing_id = $2", [
                  cartId,
                  item.listing_id,
               ]);
            } else {
               // Update quantity
               await pool.query("UPDATE cart_items SET quantity = $1 WHERE cart_id = $2 AND listing_id = $3", [
                  item.quantity,
                  cartId,
                  item.listing_id,
               ]);
            }
            break;
         }
         default:
            return res.status(400).json({ error: "Invalid operation" });
      }

      // Fetch updated cart
      const { rows: updatedCart } = await pool.query(
         `SELECT listing_name, description, price, product_image, quantity, listing_id, country_code, currency, min_quantity, discount
          FROM cart_items WHERE cart_id = $1`,
         [cartId],
      );

      // Update cookie with updated cart to keep them in sync
      await setCartCookie(res, updatedCart);

      return res.json({
         success: true,
         message: `Item ${operation} successful`,
         cart: updatedCart,
      });
   } catch (err) {
      console.error("Error in cart operations:", err);
      return res.status(500).json({ success: false, error: err.message || "Internal server error" });
   }
};

// Set the cart cookie
buyerCartController.set = async (req, res) => {
   try {
      const { cart } = await req.body;

      if (!Array.isArray(cart)) {
         return res.status(400).json({ success: false, error: "Cart must be an array" });
      }

      const sessionToken = await setCartCookie(res, cart);

      return res.json(sessionToken);
   } catch (error) {
      console.error("Error setting cart cookie:", error);
      return res.status(500).json({ success: false, error: error.message });
   }
};

// Get the cart cookie from the cookie session
buyerCartController.get = async (req, res) => {
   try {
      try {
         const payload = await verifyCartToken(req);
         return res.json({ success: true, cart: Array.isArray(payload?.cart) ? payload.cart : [] });
      } catch {
         return res.json({ success: true, cart: [] });
      }
   } catch (error) {
      console.error("Error getting cart:", error);
      return res.status(500).json({ success: false, error: "Failed to get cart" });
   }
};

export default buyerCartController;
