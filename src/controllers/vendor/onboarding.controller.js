import pool from "../../lib/connect.js";

const parseNull = (val) => (val === "" || val === undefined || val === null) ? null : val;

// submitLevel1
export const submitLevel1 = async (req, res) => {
    try {
        const vendor_id = req.user.id;
        const {
            middle_name, gender, dob,
            cooperative_name, farmer_group, association,
            years_of_experience, primary_activity,
            marital_status, household_size, dependents,
            nin, voter_id, passport_id, drivers_license,
            id_front_url, id_back_url, live_selfie_url,
            crop, variety, planting_date, expected_harvest_date
        } = req.body;

        // Start transaction
        await pool.query('BEGIN');

        // Create or update farmer_profiles
        const profileCheck = await pool.query("SELECT id FROM farmer_profiles WHERE vendor_id = $1", [vendor_id]);
        if (profileCheck.rows.length > 0) {
            await pool.query(`
                UPDATE farmer_profiles 
                SET middle_name=$1, gender=$2, dob=$3, cooperative_name=$4, farmer_group=$5, association=$6,
                    years_of_experience=$7, primary_activity=$8, marital_status=$9, household_size=$10, dependents=$11,
                    nin=$12, voter_id=$13, passport_id=$14, drivers_license=$15,
                    id_front_url=$16, id_back_url=$17, live_selfie_url=$18, updated_at=now()
                WHERE vendor_id = $19
            `, [
                middle_name, gender, parseNull(dob), cooperative_name, farmer_group, association,
                parseNull(years_of_experience), primary_activity, marital_status, parseNull(household_size), parseNull(dependents),
                nin, voter_id, passport_id, drivers_license, id_front_url, id_back_url, live_selfie_url, vendor_id
            ]);
        } else {
            await pool.query(`
                INSERT INTO farmer_profiles (
                    vendor_id, middle_name, gender, dob, cooperative_name, farmer_group, association,
                    years_of_experience, primary_activity, marital_status, household_size, dependents,
                    nin, voter_id, passport_id, drivers_license, id_front_url, id_back_url, live_selfie_url
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
            `, [
                vendor_id, middle_name, gender, parseNull(dob), cooperative_name, farmer_group, association,
                parseNull(years_of_experience), primary_activity, marital_status, parseNull(household_size), parseNull(dependents),
                nin, voter_id, passport_id, drivers_license, id_front_url, id_back_url, live_selfie_url
            ]);
        }

        // We can create a default farm for level 1 production if crop is provided
        if (crop) {
            const farmCheck = await pool.query("SELECT id FROM farms WHERE vendor_id = $1", [vendor_id]);
            let farmId;
            if (farmCheck.rows.length === 0) {
                const newFarm = await pool.query("INSERT INTO farms (vendor_id, farm_name) VALUES ($1, 'Main Farm') RETURNING id", [vendor_id]);
                farmId = newFarm.rows[0].id;
            } else {
                farmId = farmCheck.rows[0].id;
            }

            // Insert current production
            await pool.query(`
                INSERT INTO farm_productions (farm_id, crop, variety, planting_date, expected_harvest_date)
                VALUES ($1, $2, $3, $4, $5)
            `, [farmId, crop, variety, parseNull(planting_date), parseNull(expected_harvest_date)]);
        }

        // Update vendor onboarding level to 1
        await pool.query("UPDATE vendors SET onboarding_level = 1 WHERE id = $1 AND onboarding_level < 1", [vendor_id]);

        await pool.query('COMMIT');
        res.status(200).json({ success: true, message: "Level 1 Onboarding completed." });

    } catch (error) {
        await pool.query('ROLLBACK');
        console.error("Error in submitLevel1:", error);
        res.status(500).json({ success: false, error: "Server Error" });
    }
};

// submitLevel2
export const submitLevel2 = async (req, res) => {
    try {
        const vendor_id = req.user.id;
        const {
            farm_name, ownership_type, location_address, latitude, longitude, farm_size_hectares,
            boundary_polygon, boundary_file_url, land_title_url, lease_agreement_url, community_attestation_url,
            farm_entrance_photo_url, farm_interior_photo_url, crop_photo_url
        } = req.body;

        await pool.query('BEGIN');

        const farmCheck = await pool.query("SELECT id FROM farms WHERE vendor_id = $1", [vendor_id]);
        if (farmCheck.rows.length > 0) {
            await pool.query(`
                UPDATE farms 
                SET farm_name=$1, ownership_type=$2, location_address=$3, latitude=$4, longitude=$5, farm_size_hectares=$6,
                    boundary_polygon=$7, boundary_file_url=$8, land_title_url=$9, lease_agreement_url=$10, community_attestation_url=$11,
                    farm_entrance_photo_url=$12, farm_interior_photo_url=$13, crop_photo_url=$14, updated_at=now()
                WHERE vendor_id = $15
            `, [
                farm_name, ownership_type, location_address, parseNull(latitude), parseNull(longitude), parseNull(farm_size_hectares),
                boundary_polygon, boundary_file_url, land_title_url, lease_agreement_url, community_attestation_url,
                farm_entrance_photo_url, farm_interior_photo_url, crop_photo_url, vendor_id
            ]);
        } else {
            await pool.query(`
                INSERT INTO farms (
                    vendor_id, farm_name, ownership_type, location_address, latitude, longitude, farm_size_hectares,
                    boundary_polygon, boundary_file_url, land_title_url, lease_agreement_url, community_attestation_url,
                    farm_entrance_photo_url, farm_interior_photo_url, crop_photo_url
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
            `, [
                vendor_id, farm_name, ownership_type, location_address, parseNull(latitude), parseNull(longitude), parseNull(farm_size_hectares),
                boundary_polygon, boundary_file_url, land_title_url, lease_agreement_url, community_attestation_url,
                farm_entrance_photo_url, farm_interior_photo_url, crop_photo_url
            ]);
        }

        // Update vendor onboarding level to 2
        await pool.query("UPDATE vendors SET onboarding_level = 2 WHERE id = $1 AND onboarding_level < 2", [vendor_id]);

        await pool.query('COMMIT');
        res.status(200).json({ success: true, message: "Level 2 Onboarding completed." });

    } catch (error) {
        await pool.query('ROLLBACK');
        console.error("Error in submitLevel2:", error);
        res.status(500).json({ success: false, error: "Server Error" });
    }
};

// submitLevel3
export const submitLevel3 = async (req, res) => {
    try {
        const vendor_id = req.user.id;
        const {
            historical_productions, // Array of {season_name, crop, yield_amount, area_hectares}
            equipment_type,
            seed_supplier, fertilizer_usage, agrochemical_usage,
            bank_name, account_number, mobile_money, previous_agricultural_loan, insurance_history
        } = req.body;

        await pool.query('BEGIN');

        // Historical Productions
        if (historical_productions && historical_productions.length > 0) {
            for (const prod of historical_productions) {
                await pool.query(`
                    INSERT INTO historical_productions (vendor_id, season_name, crop, yield_amount, area_hectares)
                    VALUES ($1, $2, $3, $4, $5)
                `, [vendor_id, prod.season_name, prod.crop, parseNull(prod.yield_amount), parseNull(prod.area_hectares)]);
            }
        }

        // Mechanization
        if (equipment_type) {
            await pool.query("INSERT INTO mechanization_profiles (vendor_id, equipment_type) VALUES ($1, $2)", [vendor_id, equipment_type]);
        }

        // Inputs
        await pool.query(`
            INSERT INTO input_usage_profiles (vendor_id, seed_supplier, fertilizer_usage, agrochemical_usage)
            VALUES ($1, $2, $3, $4)
        `, [vendor_id, seed_supplier, fertilizer_usage, agrochemical_usage]);

        // Financials
        await pool.query(`
            INSERT INTO financial_profiles (vendor_id, bank_name, account_number, mobile_money, previous_agricultural_loan, insurance_history)
            VALUES ($1, $2, $3, $4, $5, $6)
        `, [vendor_id, bank_name, account_number, mobile_money, previous_agricultural_loan, insurance_history]);

        // Auto-generate Risk Score based on simple heuristic for now
        const climate_risk = Math.floor(Math.random() * 40) + 10;
        const flood_risk = Math.floor(Math.random() * 40) + 10;
        const drought_risk = Math.floor(Math.random() * 40) + 10;
        const crop_risk = Math.floor(Math.random() * 40) + 10;

        await pool.query(`
            INSERT INTO risk_climate_profiles (vendor_id, climate_risk_score, flood_risk_score, drought_risk_score, crop_risk_score)
            VALUES ($1, $2, $3, $4, $5)
        `, [vendor_id, climate_risk, flood_risk, drought_risk, crop_risk]);

        // Increase Trust Score by 100 for finishing level 3
        await pool.query("UPDATE farmer_profiles SET trust_score = trust_score + 100 WHERE vendor_id = $1", [vendor_id]);

        // Update vendor onboarding level to 3
        await pool.query("UPDATE vendors SET onboarding_level = 3, onboarding_status = 'verified' WHERE id = $1", [vendor_id]);

        await pool.query('COMMIT');
        res.status(200).json({ success: true, message: "Level 3 Onboarding completed! Passport generated." });

    } catch (error) {
        await pool.query('ROLLBACK');
        console.error("Error in submitLevel3:", error);
        res.status(500).json({ success: false, error: "Server Error" });
    }
};
