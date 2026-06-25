import pool from './src/lib/connect.js';

(async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS pre_harvest_listings (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                cluster_id UUID REFERENCES clusters(id) ON DELETE CASCADE,
                supervisor_id UUID REFERENCES vendors(id) ON DELETE CASCADE,
                program_id UUID REFERENCES programs(id) ON DELETE CASCADE,
                commodity VARCHAR(100),
                estimated_yield_tons DECIMAL(10,2),
                offer_price_per_ton DECIMAL(15,2),
                expected_harvest_date DATE,
                status VARCHAR(50) DEFAULT 'active',
                created_at TIMESTAMP DEFAULT now()
            );

            CREATE TABLE IF NOT EXISTS forward_contracts (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                buyer_id UUID REFERENCES buyers(buyer_id) ON DELETE CASCADE,
                pre_harvest_listing_id UUID REFERENCES pre_harvest_listings(id) ON DELETE CASCADE,
                quantity_tons DECIMAL(10,2),
                total_price DECIMAL(15,2),
                escrow_status VARCHAR(50) DEFAULT 'pending_deposit',
                contract_status VARCHAR(50) DEFAULT 'pending_approval',
                created_at TIMESTAMP DEFAULT now()
            );
        `);
        console.log('Tables created successfully.');
        process.exit(0);
    } catch(e) {
        console.error(e);
        process.exit(1);
    }
})();
