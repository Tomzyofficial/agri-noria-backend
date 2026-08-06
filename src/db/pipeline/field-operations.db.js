import pool from "../../lib/connect.js";

// Inspections
export const getInspections = async () => {
   const query = `
      SELECT 
         fv.id,
         fv.status,
         fv.timestamp_recorded as date,
         fv.notes,
         fp.commodity as "cropType",
         fp.farm_size_hectares as "areaSize",
         v.fname || ' ' || v.lname as "farmerName",
         COALESCE(c.region, 'Unknown') as "farmLocation"
      FROM field_verifications fv
      LEFT JOIN farmer_profiles fp ON fv.farmer_id = fp.id
      LEFT JOIN vendors v ON fp.vendor_id = v.id
      LEFT JOIN clusters c ON fv.cluster_id = c.id
      ORDER BY fv.created_at DESC
   `;
   const { rows } = await pool.query(query);
   return rows.map(r => ({
      ...r,
      result: r.status === 'verified' ? 'PASS' : (r.status === 'failed' ? 'FAIL' : 'PENDING'),
      areaSize: r.areaSize ? `${r.areaSize} Ha` : 'N/A',
      date: r.date || new Date().toISOString()
   }));
};

export const createInspection = async (data) => {
   const { farmer_id, officer_id, cluster_id, status, notes } = data;
   const query = `
      INSERT INTO field_verifications (farmer_id, officer_id, cluster_id, status, notes, timestamp_recorded)
      VALUES ($1, $2, $3, $4, $5, NOW())
      RETURNING *
   `;
   const { rows } = await pool.query(query, [farmer_id, officer_id || null, cluster_id || null, status, notes]);
   return rows[0];
};

// Farmers list for the dropdown
export const getFarmersForDropdown = async () => {
    const query = `
       SELECT fp.id as farmer_id, v.fname, v.lname, v.phone, fp.nin, f.boundary_polygon, f.farm_size_hectares
       FROM farmer_profiles fp
       JOIN vendors v ON fp.vendor_id = v.id
       LEFT JOIN farms f ON v.id = f.vendor_id
    `;
    const { rows } = await pool.query(query);
    return rows;
}

// Schedules
export const getSchedules = async () => {
   const query = `
      SELECT 
         vs.id,
         vs.visit_type as "visitType",
         vs.scheduled_date as "scheduledDate",
         vs.status,
         fp.commodity as "farmName",
         v.fname || ' ' || v.lname as "farmerName",
         COALESCE(cu.state_name, 'Unknown') as "location",
         ov.fname || ' ' || ov.lname as "officer"
      FROM visit_schedules vs
      LEFT JOIN farmer_profiles fp ON vs.farm_id = fp.id
      LEFT JOIN vendors v ON fp.vendor_id = v.id
      LEFT JOIN country_utils cu ON v.id = cu.vendor_id
      LEFT JOIN vendors ov ON vs.officer_id = ov.id
      ORDER BY vs.scheduled_date ASC
   `;
   const { rows } = await pool.query(query);
   return rows;
};

export const createSchedule = async (data) => {
   const { farm_id, visit_type, scheduled_date, officer_id } = data;
   const query = `
      INSERT INTO visit_schedules (farm_id, visit_type, scheduled_date, officer_id, status)
      VALUES ($1, $2, $3, $4, 'SCHEDULED')
      RETURNING *
   `;
   const { rows } = await pool.query(query, [farm_id, visit_type, scheduled_date, officer_id || null]);
   return rows[0];
};

export const deleteSchedule = async (id) => {
   const query = `
      DELETE FROM visit_schedules WHERE id = $1 RETURNING *
   `;
   const { rows } = await pool.query(query, [id]);
   return rows[0];
};

// Settings
export const getSettings = async (vendor_id) => {
    const query = `
        SELECT 
            v.fname,
            v.lname,
            v.email,
            v.phone,
            v.fname || ' ' || v.lname as "displayName",
            COALESCE(vs.preferences, '{}'::jsonb) as preferences
        FROM vendors v
        LEFT JOIN vendor_settings vs ON v.id = vs.vendor_id
        WHERE v.id = $1
    `;
    const { rows } = await pool.query(query, [vendor_id]);
    if (rows.length === 0) return null;
    
    return {
        firstName: rows[0].fname,
        lastName: rows[0].lname,
        email: rows[0].email,
        phone: rows[0].phone,
        displayName: rows[0].displayName,
        ...(rows[0].preferences)
    };
};

export const updateSettings = async (vendor_id, { firstName, lastName, email, phone, ...preferences }) => {
    // 1. Update vendors table with personal info
    await pool.query(
        `UPDATE vendors SET 
            fname = COALESCE(NULLIF($1, ''), fname), 
            lname = COALESCE(NULLIF($2, ''), lname), 
            email = COALESCE(NULLIF($3, ''), email), 
            phone = COALESCE(NULLIF($4, ''), phone) 
         WHERE id = $5`,
        [firstName, lastName, email, phone, vendor_id]
    );

    // 2. Upsert vendor_settings table
    const query = `
        INSERT INTO vendor_settings (vendor_id, preferences)
        VALUES ($1, $2)
        ON CONFLICT (vendor_id) DO UPDATE 
        SET preferences = $2, updated_at = NOW()
        RETURNING *
    `;
    const { rows } = await pool.query(query, [vendor_id, preferences]);
    
    return {
        firstName,
        lastName,
        email,
        phone,
        displayName: `${firstName || ''} ${lastName || ''}`.trim(),
        ...(rows[0]?.preferences || preferences)
    };
};

// --- New Features: Approvals, Assignments, Mapbox ---

export const getPendingApprovals = async () => {
    const query = `
        SELECT v.id, v.fname, v.lname, v.email, v.phone, v.role, f.appointment_letter_url, f.id_card_url, f.optional_document_url
        FROM vendors v
        LEFT JOIN field_operations_documents f ON v.id = f.vendor_id
        WHERE v.approval_status = 'pending_approval' 
          AND v.role IN ('field officer', 'agronomist', 'inspector', 'enumerator', 'field operations supervisor')
    `;
    const { rows } = await pool.query(query);
    return rows;
};

export const approveFieldOfficer = async (vendorId, status) => {
    const query = `
        UPDATE vendors SET approval_status = $1 WHERE id = $2 RETURNING *
    `;
    const { rows } = await pool.query(query, [status, vendorId]);
    return rows[0];
};

export const createWorkAssignment = async (supervisorId, officerId, community, ward, lga, zone, target) => {
    const query = `
        INSERT INTO work_assignments (supervisor_id, officer_id, community, ward, lga, enumeration_zone, target_farmers)
        VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *
    `;
    const { rows } = await pool.query(query, [supervisorId, officerId, community, ward, lga, zone, target]);
    return rows[0];
};

export const getWorkAssignments = async (vendorId, role) => {
    // If program director/supervisor, maybe get all they assigned. If officer, get their assignments.
    let query = `
        SELECT w.*, v.fname || ' ' || v.lname as officer_name
        FROM work_assignments w
        JOIN vendors v ON w.officer_id = v.id
    `;
    const params = [];
    if (role !== 'Program Director' && role !== 'Regional Manager') {
        query += ` WHERE w.officer_id = $1`;
        params.push(vendorId);
    }
    query += ` ORDER BY w.created_at DESC`;
    
    const { rows } = await pool.query(query, params);
    return rows;
};

export const captureFarmBoundary = async (farmerId, polygon, hectares, lat, lng) => {
    // Update farm boundary and update certification status
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        // 1. Update or Insert farms
        const { rows: farmRows } = await client.query(`SELECT id FROM farms WHERE vendor_id = (SELECT vendor_id FROM farmer_profiles WHERE id = $1 LIMIT 1)`, [farmerId]);
        
        if (farmRows.length > 0) {
            await client.query(`
                UPDATE farms 
                SET boundary_polygon = $1, farm_size_hectares = $2, latitude = $3, longitude = $4
                WHERE vendor_id = (SELECT vendor_id FROM farmer_profiles WHERE id = $5 LIMIT 1)
            `, [JSON.stringify(polygon), hectares, lat, lng, farmerId]);
        } else {
            await client.query(`
                INSERT INTO farms (vendor_id, boundary_polygon, farm_size_hectares, latitude, longitude)
                VALUES ((SELECT vendor_id FROM farmer_profiles WHERE id = $5 LIMIT 1), $1, $2, $3, $4)
            `, [JSON.stringify(polygon), hectares, lat, lng, farmerId]);
        }

        // 2. Update certification status in farmer_profiles
        const { rows } = await client.query(`
            UPDATE farmer_profiles 
            SET certification_status = 'certified'
            WHERE id = $1 RETURNING *
        `, [farmerId]);

        // 3. Approve vendor account
        await client.query(`
            UPDATE vendors 
            SET approval_status = 'approved'
            WHERE id = (SELECT vendor_id FROM farmer_profiles WHERE id = $1 LIMIT 1)
        `, [farmerId]);
        
        await client.query('COMMIT');
        return rows[0];
    } catch (e) {
        await client.query('ROLLBACK');
        throw e;
    } finally {
        client.release();
    }
};

export const getAllFieldOfficers = async () => {
    const query = `
        SELECT v.id, v.fname, v.lname, v.email, v.phone, v.role, v.is_suspended, v.approval_status
        FROM vendors v
        WHERE v.role IN ('field officer', 'agronomist', 'inspector', 'enumerator', 'field operations supervisor')
          AND v.approval_status != 'pending_approval'
        ORDER BY v.created_at DESC
    `;
    const { rows } = await pool.query(query);
    return rows;
};

export const suspendFieldOfficer = async (vendorId, suspendStatus) => {
    const query = `
        UPDATE vendors 
        SET is_suspended = $1 
        WHERE id = $2 
        RETURNING *
    `;
    const { rows } = await pool.query(query, [suspendStatus, vendorId]);
    return rows[0];
};

export const enrollFarmerInProgram = async (farmerId, programId, enrolledBy) => {
    const query = `
        INSERT INTO farmer_programmes (farmer_id, program_id, enrolled_by)
        VALUES ($1, $2, $3)
        ON CONFLICT (farmer_id, program_id) DO UPDATE SET status = 'active'
        RETURNING *
    `;
    const { rows } = await pool.query(query, [farmerId, programId, enrolledBy]);
    return rows[0];
};
