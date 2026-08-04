import pool from '../src/lib/connect.js';

async function run() {
    try {
        const tickets = await pool.query('SELECT * FROM storage_tickets ORDER BY created_at DESC LIMIT 5');
        console.log('STORAGE TICKETS:');
        console.log(JSON.stringify(tickets.rows, null, 2));

        if (tickets.rows.length > 0) {
            const ticket = tickets.rows[0];
            const hb = await pool.query('SELECT * FROM harvest_batches WHERE batch_id = $1', [ticket.batch_id]);
            console.log('HARVEST BATCH:');
            console.log(JSON.stringify(hb.rows, null, 2));

            if (hb.rows.length > 0) {
                const vendorId = hb.rows[0].vendor_id;
                const wallet = await pool.query('SELECT * FROM wallets WHERE owner_id = $1', [vendorId]);
                console.log('FARMER WALLET IN WALLETS TABLE:');
                console.log(JSON.stringify(wallet.rows, null, 2));

                const commWallet = await pool.query('SELECT * FROM commodity_operations_wallets WHERE batch_id = $1', [ticket.batch_id]);
                console.log('COMMODITY OPERATIONS WALLET:');
                console.log(JSON.stringify(commWallet.rows, null, 2));
            }
        }
        process.exit(0);
    } catch(e) {
        console.error(e);
        process.exit(1);
    }
}
run();
