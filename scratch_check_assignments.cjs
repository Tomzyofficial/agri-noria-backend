const { Pool } = require('pg');

const pool = new Pool({
    connectionString: "postgresql://postgres:success1050@localhost:5432/AgriConnect",
});

async function checkDistributorAssignments() {
    const email = 'abraham55@gmail.com';
    try {
        // 1. Get vendor ID
        const vendorRes = await pool.query("SELECT id, fname, lname, account_type FROM vendors WHERE email = $1", [email]);
        if (vendorRes.rows.length === 0) {
            console.log(`No vendor found with email: ${email}`);
            return;
        }
        const vendor = vendorRes.rows[0];
        console.log(`Found vendor: ${vendor.fname} ${vendor.lname} (ID: ${vendor.id}, Role: ${vendor.account_type})`);

        // 2. Check assignments
        const orderRes = await pool.query("SELECT id, status, total_amount FROM buyer_ecosystem_orders WHERE distributor_id = $1", [vendor.id]);
        if (orderRes.rows.length === 0) {
            console.log(`No products/orders currently assigned to this distributor.`);
        } else {
            console.log(`Found ${orderRes.rows.length} assignment(s):`);
            orderRes.rows.forEach(order => {
                console.log(`- Order ID: ${order.id}, Status: ${order.status}, Amount: ${order.total_amount}`);
            });
        }
    } catch (error) {
        console.error("Database query failed:", error);
    } finally {
        await pool.end();
    }
}

checkDistributorAssignments();
