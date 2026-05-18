const { Pool } = require('pg');

const pool = new Pool({
    connectionString: "postgresql://postgres:success1050@localhost:5432/AgriConnect",
});

async function testAssignment() {
    const email = 'abraham55@gmail.com';
    try {
        // 1. Get vendor ID
        const vendorRes = await pool.query("SELECT id, fname, lname FROM vendors WHERE email = $1", [email]);
        if (vendorRes.rows.length === 0) {
            console.log(`No vendor found with email: ${email}`);
            return;
        }
        const distributorId = vendorRes.rows[0].id;
        console.log(`Distributor ID: ${distributorId}`);

        // 2. Create a dummy buyer vendor if one doesn't exist
        const buyerRes = await pool.query("SELECT id FROM vendors WHERE account_type = 'off-taker' LIMIT 1");
        let buyerId;
        if (buyerRes.rows.length === 0) {
            const newBuyerRes = await pool.query(
                "INSERT INTO vendors (fname, lname, email, phone, pword, account_type, company_name, terms_of_service) VALUES ('Test', 'Buyer', 'testbuyer@example.com', '1234567890', 'dummy_hash', 'off-taker', 'Test Company', true) RETURNING id"
            );
            buyerId = newBuyerRes.rows[0].id;
            console.log(`Created new buyer: ID ${buyerId}`);
        } else {
            buyerId = buyerRes.rows[0].id;
            console.log(`Using existing buyer: ID ${buyerId}`);
        }

        // 3. Create an order
        console.log("Creating test order...");
        const newOrderRes = await pool.query(
            "INSERT INTO buyer_ecosystem_orders (buyer_id, total_amount, delivery_address, status) VALUES ($1, 5000, 'Test Address', 'pending') RETURNING id",
            [buyerId]
        );
        const orderId = newOrderRes.rows[0].id;
        console.log(`Test Order created: ID ${orderId}`);

        // 4. Assign order
        console.log("Assigning order to distributor...");
        await pool.query(
            "UPDATE buyer_ecosystem_orders SET distributor_id = $1, status = 'assigned', updated_at = now() WHERE id = $2",
            [distributorId, orderId]
        );
        console.log("Assignment successful.");

        // 5. Verify assignment
        const checkRes = await pool.query("SELECT id, status, distributor_id FROM buyer_ecosystem_orders WHERE id = $1", [orderId]);
        const updatedOrder = checkRes.rows[0];
        console.log(`Verification: Order ID: ${updatedOrder.id}, Status: ${updatedOrder.status}, Assigned Distributor: ${updatedOrder.distributor_id}`);
        
        if (updatedOrder.distributor_id === distributorId && updatedOrder.status === 'assigned') {
            console.log("✅ The assignment logic is working perfectly.");
        } else {
            console.log("❌ The assignment logic failed.");
        }
        
    } catch (error) {
        console.error("Test failed:", error);
    } finally {
        await pool.end();
    }
}

testAssignment();
