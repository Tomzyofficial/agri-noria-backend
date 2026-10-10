import pool from "../../../lib/connect.js";

// Common Nigerian Agricultural Hub coordinates for distance estimation
const NIGERIA_COORDS = {
  kano: { lat: 12.0022, lng: 8.5920 },
  kaduna: { lat: 10.5105, lng: 7.4165 },
  lagos: { lat: 6.5244, lng: 3.3792 },
  abuja: { lat: 9.0765, lng: 7.3986 },
  ibadan: { lat: 7.3775, lng: 3.9470 },
  benue: { lat: 7.7322, lng: 8.5391 },
  makurdi: { lat: 7.7322, lng: 8.5391 },
  minna: { lat: 9.6139, lng: 6.5569 },
  niger: { lat: 9.6139, lng: 6.5569 },
  jos: { lat: 9.8965, lng: 8.8583 },
  plateau: { lat: 9.8965, lng: 8.8583 },
  enugu: { lat: 6.4584, lng: 7.5464 },
  yola: { lat: 9.2094, lng: 12.4818 },
  adamawa: { lat: 9.2094, lng: 12.4818 },
  sokoto: { lat: 13.0059, lng: 5.2476 },
  kebbi: { lat: 12.4539, lng: 4.1975 },
  katsina: { lat: 12.9908, lng: 7.6018 },
  taraba: { lat: 8.8937, lng: 11.3596 },
  nasarawa: { lat: 8.5378, lng: 8.3242 },
  ilorin: { lat: 8.4966, lng: 4.5421 },
  kwara: { lat: 8.4966, lng: 4.5421 },
  ogun: { lat: 7.0000, lng: 3.5000 },
  abeokuta: { lat: 7.1557, lng: 3.3451 }
};

function resolveCoords(locationStr, lat, lng) {
  if (lat && lng && !isNaN(Number(lat)) && !isNaN(Number(lng))) {
    return { lat: Number(lat), lng: Number(lng) };
  }
  if (!locationStr || typeof locationStr !== "string") return null;
  const lower = locationStr.toLowerCase();
  for (const [key, coords] of Object.entries(NIGERIA_COORDS)) {
    if (lower.includes(key)) {
      return coords;
    }
  }
  return null;
}

function calculateDistanceKm(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return null;
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

// Get providers by role with full rich details (fleet, availability calendar, geolocation distance)
export const getProvidersByRole = async (req, res) => {
  const { role } = req.params;
  const searchRole = (role || "").toLowerCase();
  const { lat, lng, origin_location, batch_quantity, batch_crop } = req.query;

  const originCoords = resolveCoords(origin_location, lat, lng);

  try {
    if (searchRole === 'storage') {
      // 1. Fetch storage vendors
      const vendorsRes = await pool.query(`
        SELECT id, fname, lname, company_name, email, phone, workspace, total_capacity_mt, location, role 
        FROM vendors 
        WHERE LOWER(role) LIKE '%storage%' OR LOWER(role) LIKE '%warehouse%'
      `);

      // 2. Fetch all registered storage facilities
      const facilitiesRes = await pool.query(`
        SELECT sf.*, v.company_name as vendor_company_name, v.fname, v.lname, v.email, v.phone
        FROM storage_facility sf
        JOIN vendors v ON sf.account_id = v.id
      `);

      // 3. Fetch active availability schedules
      const schedulesRes = await pool.query(`
        SELECT * FROM storage_availability_schedules
        WHERE status IN ('available', 'partially_booked')
        ORDER BY start_date ASC
      `);

      const facilityMap = new Map();

      // Index facilities from storage_facility table
      for (const fac of facilitiesRes.rows) {
        const facCoords = resolveCoords(fac.location, fac.latitude, fac.longitude);
        const distance = originCoords && facCoords
          ? calculateDistanceKm(originCoords.lat, originCoords.lng, facCoords.lat, facCoords.lng)
          : null;

        const facSchedules = schedulesRes.rows.filter(s => 
          (s.facility_id && Number(s.facility_id) === Number(fac.id)) || 
          (s.vendor_id === fac.account_id)
        );

        facilityMap.set(`fac_${fac.id}`, {
          id: fac.id,
          facility_id: fac.id,
          warehouse_id: fac.account_id,
          vendor_id: fac.account_id,
          company_name: fac.vendor_company_name || `${fac.fname || ''} ${fac.lname || ''}`.trim() || 'Warehouse Provider',
          facility_name: fac.listing_name || 'Agri Storage Facility',
          storage_type: fac.storage_type || 'Dry Grain Warehouse',
          total_capacity_mt: parseFloat(fac.capacity) || 5000,
          available_capacity_mt: parseFloat(fac.available) || parseFloat(fac.capacity) || 3500,
          price_per_mt_month: parseFloat(fac.price_per_mt_month) || parseFloat(fac.price) || 1200,
          operating_days: fac.operating_days || 'Mon - Sat (08:00 - 18:00)',
          location: fac.location || 'Hub Location',
          temperature: fac.temperature || 'Ambient Controlled',
          features: Array.isArray(fac.features) && fac.features.length > 0 
            ? fac.features 
            : ['Moisture Testing', 'Pest Control', 'Electronic NWR', 'Certified Insurance'],
          image: fac.image || null,
          latitude: fac.latitude || (facCoords ? facCoords.lat : null),
          longitude: fac.longitude || (facCoords ? facCoords.lng : null),
          distance_km: distance,
          schedules: facSchedules
        });
      }

      // If a vendor doesn't have a storage_facility row, create a virtual provider entry so they appear
      for (const v of vendorsRes.rows) {
        const hasFac = Array.from(facilityMap.values()).some(f => f.warehouse_id === v.id);
        if (!hasFac) {
          const vCoords = resolveCoords(v.location, null, null);
          const distance = originCoords && vCoords
            ? calculateDistanceKm(originCoords.lat, originCoords.lng, vCoords.lat, vCoords.lng)
            : null;

          const vSchedules = schedulesRes.rows.filter(s => s.vendor_id === v.id);

          facilityMap.set(`vendor_${v.id}`, {
            id: v.id,
            facility_id: null,
            warehouse_id: v.id,
            vendor_id: v.id,
            company_name: v.company_name || `${v.fname || ''} ${v.lname || ''}`.trim() || 'Storage Warehouse',
            facility_name: `${v.company_name || v.fname + "'s"} Grain Silos & Warehouse`,
            storage_type: 'Grain Silo & Bulk Warehouse',
            total_capacity_mt: parseFloat(v.total_capacity_mt) || 5000,
            available_capacity_mt: parseFloat(v.total_capacity_mt) || 3500,
            price_per_mt_month: 1200,
            operating_days: 'Mon - Sat (08:00 - 18:00)',
            location: v.location || 'Regional Grain Hub',
            temperature: 'Ambient / Temperature Monitored',
            features: ['Moisture Testing', 'Pest Control', 'Electronic NWR', 'Certified Insurance'],
            image: null,
            latitude: vCoords ? vCoords.lat : null,
            longitude: vCoords ? vCoords.lng : null,
            distance_km: distance,
            schedules: vSchedules
          });
        }
      }

      const storageList = Array.from(facilityMap.values());
      // Sort: facilities with known distance first, nearest to farthest
      storageList.sort((a, b) => {
        if (a.distance_km !== null && b.distance_km !== null) return a.distance_km - b.distance_km;
        if (a.distance_km !== null) return -1;
        if (b.distance_km !== null) return 1;
        return 0;
      });

      return res.status(200).json({ success: true, data: storageList });

    } else if (searchRole === 'logistics') {
      // 1. Fetch logistics vendors
      const vendorsRes = await pool.query(`
        SELECT id, fname, lname, company_name, email, phone, workspace, total_capacity_mt, location, role 
        FROM vendors 
        WHERE LOWER(role) LIKE '%logistics%' OR LOWER(role) LIKE '%transport%' OR LOWER(role) LIKE '%courier%'
      `);

      // 2. Fetch all vehicles belonging to these vendors
      const vehiclesRes = await pool.query(`
        SELECT v.*, cu.currency
        FROM vehicles v
        LEFT JOIN country_utils cu ON cu.vendor_id = v.vendor_id
        ORDER BY v.id DESC
      `);

      const logisticsProviders = [];

      for (const v of vendorsRes.rows) {
        const vCoords = resolveCoords(v.location, null, null);
        const distance = originCoords && vCoords
          ? calculateDistanceKm(originCoords.lat, originCoords.lng, vCoords.lat, vCoords.lng)
          : null;

        // Filter vehicles for this vendor
        const providerVehicles = vehiclesRes.rows.filter(veh => veh.vendor_id === v.id);

        let formattedVehicles = [];
        if (providerVehicles.length > 0) {
          formattedVehicles = providerVehicles.map(veh => {
            const vehCoords = resolveCoords(veh.base_location || v.location, veh.latitude, veh.longitude);
            const vehDist = originCoords && vehCoords
              ? calculateDistanceKm(originCoords.lat, originCoords.lng, vehCoords.lat, vehCoords.lng)
              : distance;

            const maxTons = parseFloat(veh.max_tons) || (veh.max_weight_kg ? parseFloat(veh.max_weight_kg) / 1000 : 15);
            const baseAmount = parseFloat(veh.base_amount) || parseFloat(veh.rate_amount) || 35000;

            return {
              id: veh.id,
              vehicle_id: veh.id,
              title: veh.title || 'Haulage Vehicle',
              vehicle_type: veh.vehicle_type || 'enclosed_box',
              cargo_type: veh.cargo_type || 'agricultural_produce',
              license_plate: veh.license_plate || 'LOG-1234',
              max_weight_kg: parseFloat(veh.max_weight_kg) || (maxTons * 1000),
              max_tons: maxTons,
              base_amount: baseAmount,
              rate_amount: parseFloat(veh.rate_amount) || 120,
              pricing_model: veh.pricing_model || 'flat_rate',
              base_location: veh.base_location || v.location || 'Depot',
              operating_regions: Array.isArray(veh.operating_regions) && veh.operating_regions.length > 0 
                ? veh.operating_regions 
                : ['Nationwide', 'Northern Corridor'],
              status: veh.status || 'available',
              image: veh.image || null,
              distance_km: vehDist
            };
          });
        } else {
          // Provide virtual fleet vehicle based on vendor profile
          const defaultMaxTons = parseFloat(v.total_capacity_mt) > 0 ? parseFloat(v.total_capacity_mt) : 15;
          formattedVehicles = [
            {
              id: `def_${v.id}_1`,
              vehicle_id: null,
              title: `${v.company_name || 'Fleet'} Standard Haulage Truck`,
              vehicle_type: 'flatbed',
              cargo_type: 'bagged_grains',
              license_plate: 'LOG-FLEET',
              max_weight_kg: defaultMaxTons * 1000,
              max_tons: defaultMaxTons,
              base_amount: 35000,
              rate_amount: 120,
              pricing_model: 'flat_rate',
              base_location: v.location || 'Main Transit Hub',
              operating_regions: ['Nationwide'],
              status: 'available',
              image: null,
              distance_km: distance
            }
          ];
        }

        logisticsProviders.push({
          id: v.id,
          provider_id: v.id,
          company_name: v.company_name || `${v.fname || ''} ${v.lname || ''}`.trim() || 'Logistics Provider',
          email: v.email,
          phone: v.phone,
          location: v.location || 'Transit Hub',
          distance_km: distance,
          vehicles: formattedVehicles
        });
      }

      // Sort providers by distance
      logisticsProviders.sort((a, b) => {
        if (a.distance_km !== null && b.distance_km !== null) return a.distance_km - b.distance_km;
        if (a.distance_km !== null) return -1;
        if (b.distance_km !== null) return 1;
        return 0;
      });

      return res.status(200).json({ success: true, data: logisticsProviders });

    } else {
      const providers = await pool.query(`
        SELECT id, fname, lname, company_name, email, phone, workspace, total_capacity_mt, location, role 
        FROM vendors 
        WHERE LOWER(role) LIKE $1
      `, [`%${searchRole}%`]);
      return res.status(200).json({ success: true, data: providers.rows });
    }
  } catch (error) {
    console.error("Error fetching providers:", error);
    res.status(500).json({ success: false, error: "Server Error" });
  }
};
import crypto from "crypto";

// Create a new harvest batch (individual or cluster aggregation)
export const declareHarvest = async (req, res) => {
  let produces = req.body.produces;
  const { cluster_id, source_type = 'individual', farmer_count = 1 } = req.body;
  
  // Fallback for single crop submission
  if (!produces) {
    const { crop, quantity_mt, location, harvest_date } = req.body;
    if (crop) {
      produces = [{ crop, quantity_mt, location, harvest_date }];
    } else {
      return res.status(400).json({ success: false, error: "No produces provided" });
    }
  }

  const vendor_id = req.user.id;
  const createdBatches = [];

  const client = await pool.connect();
  try {
    await client.query(`
      ALTER TABLE harvest_batches ADD COLUMN IF NOT EXISTS cluster_id UUID REFERENCES clusters(id);
      ALTER TABLE harvest_batches ADD COLUMN IF NOT EXISTS source_type VARCHAR(50) DEFAULT 'individual';
      ALTER TABLE harvest_batches ADD COLUMN IF NOT EXISTS farmer_count INT DEFAULT 1;
    `);

    await client.query('BEGIN');
    
    for (const item of produces) {
      const { crop, quantity_mt, location, harvest_date } = item;
      const batch_number = `HB-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
      
      const query = `
        INSERT INTO harvest_batches (
          batch_number, vendor_id, crop, quantity_mt, location, harvest_date, status, cluster_id, source_type, farmer_count
        ) VALUES (
          $1, $2, $3, $4, $5, $6, 'harvest_declared', $7, $8, $9
        ) RETURNING *
      `;
      const values = [
        batch_number, 
        vendor_id, 
        crop, 
        quantity_mt, 
        location || 'Unknown', 
        harvest_date || new Date(),
        cluster_id || null,
        source_type || 'individual',
        parseInt(farmer_count) || 1
      ];
      const result = await client.query(query, values);
      
      const newBatch = result.rows[0];

      // Ensure a commodity operations wallet is created for this batch
      const walletQuery = `
        INSERT INTO commodity_operations_wallets (batch_id, balance)
        VALUES ($1, 0)
        ON CONFLICT (batch_id) DO NOTHING
        RETURNING *
      `;
      await client.query(walletQuery, [newBatch.batch_id]);
      
      createdBatches.push(newBatch);
    }

    await client.query('COMMIT');
    res.status(201).json({ success: true, data: createdBatches });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error("Error declaring harvest:", error);
    res.status(500).json({ success: false, error: "Server Error" });
  } finally {
    client.release();
  }
};

// Fetch batches for the farmer / aggregator
export const getMyBatches = async (req, res) => {
  const vendor_id = req.user.id;

  try {
    await pool.query(`
      ALTER TABLE harvest_batches ADD COLUMN IF NOT EXISTS cluster_id UUID REFERENCES clusters(id);
      ALTER TABLE harvest_batches ADD COLUMN IF NOT EXISTS source_type VARCHAR(50) DEFAULT 'individual';
      ALTER TABLE harvest_batches ADD COLUMN IF NOT EXISTS farmer_count INT DEFAULT 1;
    `);

    const query = `
      SELECT 
        hb.*, 
        cow.balance as wallet_balance, 
        ip.status as insurance_status, 
        ip.policy_id,
        c.name as cluster_name
      FROM harvest_batches hb
      LEFT JOIN commodity_operations_wallets cow ON hb.batch_id = cow.batch_id
      LEFT JOIN insurance_policies ip ON hb.batch_id = ip.batch_id
      LEFT JOIN clusters c ON hb.cluster_id = c.id
      WHERE hb.vendor_id = $1
      ORDER BY hb.created_at DESC
    `;
    const result = await pool.query(query, [vendor_id]);
    res.status(200).json({ success: true, data: result.rows });
  } catch (error) {
    console.error("Error fetching batches:", error);
    res.status(500).json({ success: false, error: "Server Error" });
  }
};

// Request storage (triggers insurance risk request and binds availability schedule)
export const requestStorage = async (req, res) => {
  const { 
    batch_id, 
    warehouse_id, 
    facility_id, 
    storage_duration_days = 30, 
    storage_fee = 50000,
    start_date,
    end_date
  } = req.body;
  const vendor_id = req.user.id; // Verify ownership

  try {
    // 1. Verify batch ownership
    const batchCheck = await pool.query("SELECT * FROM harvest_batches WHERE batch_id = $1 AND vendor_id = $2", [batch_id, vendor_id]);
    if (batchCheck.rows.length === 0) {
      return res.status(404).json({ success: false, error: "Batch not found or unauthorized" });
    }

    const batch = batchCheck.rows[0];

    // 2. Create Storage Ticket
    const ticket_number = `ST-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
    const storageQuery = `
      INSERT INTO storage_tickets (
        ticket_number, batch_id, warehouse_id, reserved_volume_mt, 
        storage_duration_days, storage_fee, insurance_enabled, start_date, end_date, status
      ) VALUES (
        $1, $2, $3, $4, $5, $6, true, $7, $8, 'reserved'
      ) RETURNING *
    `;
    let targetWarehouse = warehouse_id;
    if (!targetWarehouse) {
      const storageVendor = await pool.query("SELECT id FROM vendors WHERE LOWER(role) LIKE '%storage%' OR LOWER(role) LIKE '%warehouse%' LIMIT 1");
      if (storageVendor.rows.length > 0) {
        targetWarehouse = storageVendor.rows[0].id;
      } else {
        targetWarehouse = vendor_id;
      }
    }
    
    await pool.query(storageQuery, [
      ticket_number, 
      batch_id, 
      targetWarehouse, 
      batch.quantity_mt, 
      storage_duration_days || 30, 
      storage_fee || 50000,
      start_date || null,
      end_date || null
    ]);

    // 3. Update Batch Status
    await pool.query("UPDATE harvest_batches SET status = 'storage_reserved' WHERE batch_id = $1", [batch_id]);

    res.status(200).json({ success: true, message: "Storage requested and Risk Request broadcasted." });
  } catch (error) {
    console.error("Error requesting storage:", error);
    res.status(500).json({ success: false, error: "Server Error" });
  }
};

// Request logistics
export const requestLogistics = async (req, res) => {
  const { 
    batch_id, 
    logistics_provider_id, 
    vehicle_id,
    vehicle_title,
    pickup_location,
    destination, 
    logistics_fee,
    estimated_distance_km
  } = req.body;
  const vendor_id = req.user.id;

  try {
    // 1. Verify batch ownership
    const batchCheck = await pool.query("SELECT * FROM harvest_batches WHERE batch_id = $1 AND vendor_id = $2", [batch_id, vendor_id]);
    if (batchCheck.rows.length === 0) {
      return res.status(404).json({ success: false, error: "Batch not found or unauthorized" });
    }

    const batch = batchCheck.rows[0];

    // 2. Determine Logistics Provider
    let targetProvider = logistics_provider_id;
    if (!targetProvider) {
      const logisticsVendor = await pool.query("SELECT id FROM vendors WHERE role IN ('logistics', 'logistics partner') LIMIT 1");
      if (logisticsVendor.rows.length > 0) {
        targetProvider = logisticsVendor.rows[0].id;
      } else {
        targetProvider = vendor_id;
      }
    }

    // 3. Create Logistics Ticket
    const ticket_number = `LT-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
    const logisticsQuery = `
      INSERT INTO logistics_tickets (
        ticket_number, batch_id, logistics_provider_id, destination, logistics_fee, 
        vehicle_id, vehicle_title, pickup_location, estimated_distance_km, status
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending'
      ) RETURNING *
    `;
    await pool.query(logisticsQuery, [
      ticket_number, 
      batch_id, 
      targetProvider, 
      destination || 'Designated Warehouse/Buyer', 
      logistics_fee || 15000,
      vehicle_id ? parseInt(vehicle_id) : null,
      vehicle_title || null,
      pickup_location || batch.location || null,
      estimated_distance_km ? parseFloat(estimated_distance_km) : null
    ]);

    res.status(200).json({ success: true, message: "Logistics requested successfully." });
  } catch (error) {
    console.error("Error requesting logistics:", error);
    res.status(500).json({ success: false, error: "Server Error" });
  }
};
