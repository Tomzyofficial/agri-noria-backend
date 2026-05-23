import { pool } from '../db/connection.js';

// Create a new shipment
export async function createShipment(shipmentData) {
  const {
    order_id,
    logistics_company_id,
    vehicle_id,
    driver_id,
    status = 'pending',
    pickup_location,
    pickup_coordinates,
    pickup_scheduled_time,
    delivery_location,
    delivery_coordinates,
    estimated_delivery_time,
    notes,
    metadata = {}
  } = shipmentData;

  const query = `
    INSERT INTO logistics_shipments (
      order_id, logistics_company_id, vehicle_id, driver_id,
      status, pickup_location, pickup_coordinates, pickup_scheduled_time,
      delivery_location, delivery_coordinates, estimated_delivery_time,
      notes, metadata
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
    RETURNING *
  `;

  const values = [
    order_id,
    logistics_company_id,
    vehicle_id,
    driver_id,
    status,
    pickup_location,
    pickup_coordinates ? JSON.stringify(pickup_coordinates) : null,
    pickup_scheduled_time,
    delivery_location,
    delivery_coordinates ? JSON.stringify(delivery_coordinates) : null,
    estimated_delivery_time,
    notes,
    JSON.stringify(metadata)
  ];

  const result = await pool.query(query, values);
  return result.rows[0];
}

// Get shipment by ID
export async function getShipmentById(shipmentId) {
  const query = `
    SELECT 
      ls.*,
      o.buyer_id,
      o.seller_id,
      o.total_amount as order_amount,
      o.status as order_status,
      v.fname as seller_fname,
      v.lname as seller_lname,
      lc.fname as logistics_company_name,
      lc.email as logistics_company_email,
      veh.title as vehicle_title,
      veh.license_plate as vehicle_plate,
      d.driver_name,
      d.driver_phone
    FROM logistics_shipments ls
    LEFT JOIN orders o ON ls.order_id = o.id
    LEFT JOIN vendors v ON o.seller_id = v.id
    LEFT JOIN vendors lc ON ls.logistics_company_id = lc.id
    LEFT JOIN vehicles veh ON ls.vehicle_id = veh.id
    LEFT JOIN drivers d ON ls.driver_id = d.id
    WHERE ls.id = $1
  `;

  const result = await pool.query(query, [shipmentId]);
  return result.rows[0];
}

// Get shipment by order ID
export async function getShipmentByOrderId(orderId) {
  const query = `
    SELECT * FROM logistics_shipments
    WHERE order_id = $1
    ORDER BY created_at DESC
    LIMIT 1
  `;

  const result = await pool.query(query, [orderId]);
  return result.rows[0];
}

// Get shipments by logistics company ID
export async function getShipmentsByCompanyId(companyId, status = null, limit = 50, offset = 0) {
  let query = `
    SELECT 
      ls.*,
      o.buyer_id,
      o.total_amount as order_amount,
      o.status as order_status,
      b.email as buyer_email,
      b.name as buyer_name,
      o.delivery_address
    FROM logistics_shipments ls
    LEFT JOIN orders o ON ls.order_id = o.id
    LEFT JOIN buyers b ON o.buyer_id = b.buyer_id
    WHERE ls.logistics_company_id = $1
  `;
  
  const values = [companyId];

  if (status) {
    query += ` AND ls.status = $2`;
    values.push(status);
  }

  query += ` ORDER BY ls.created_at DESC LIMIT $${values.length + 1} OFFSET $${values.length + 2}`;
  values.push(limit, offset);

  const result = await pool.query(query, values);
  return result.rows;
}

// Get shipments by driver ID
export async function getShipmentsByDriverId(driverId, status = null, limit = 50, offset = 0) {
  let query = `
    SELECT 
      ls.*,
      o.buyer_id,
      o.total_amount as order_amount,
      o.status as order_status,
      b.email as buyer_email,
      b.name as buyer_name,
      o.delivery_address
    FROM logistics_shipments ls
    LEFT JOIN orders o ON ls.order_id = o.id
    LEFT JOIN buyers b ON o.buyer_id = b.buyer_id
    WHERE ls.driver_id = $1
  `;
  
  const values = [driverId];

  if (status) {
    query += ` AND ls.status = $2`;
    values.push(status);
  }

  query += ` ORDER BY ls.created_at DESC LIMIT $${values.length + 1} OFFSET $${values.length + 2}`;
  values.push(limit, offset);

  const result = await pool.query(query, values);
  return result.rows;
}

// Update shipment status
export async function updateShipmentStatus(shipmentId, status, updateData = {}) {
  const {
    pickup_completed_at,
    actual_delivery_time,
    current_location,
    current_coordinates,
    notes
  } = updateData;

  const query = `
    UPDATE logistics_shipments
    SET 
      status = $1,
      pickup_completed_at = COALESCE($2, pickup_completed_at),
      actual_delivery_time = COALESCE($3, actual_delivery_time),
      current_location = COALESCE($4, current_location),
      current_coordinates = COALESCE($5, current_coordinates)::jsonb,
      notes = COALESCE($6, notes),
      updated_at = NOW()
    WHERE id = $7
    RETURNING *
  `;

  const result = await pool.query(query, [
    status,
    pickup_completed_at,
    actual_delivery_time,
    current_location,
    current_coordinates ? JSON.stringify(current_coordinates) : null,
    notes,
    shipmentId
  ]);
  return result.rows[0];
}

// Assign logistics to shipment
export async function assignLogisticsToShipment(shipmentId, companyId, vehicleId, driverId) {
  const query = `
    UPDATE logistics_shipments
    SET 
      logistics_company_id = $1,
      vehicle_id = $2,
      driver_id = $3,
      status = 'assigned',
      updated_at = NOW()
    WHERE id = $4
    RETURNING *
  `;

  const result = await pool.query(query, [companyId, vehicleId, driverId, shipmentId]);
  return result.rows[0];
}

// Update shipment tracking location
export async function updateShipmentLocation(shipmentId, location, coordinates) {
  const query = `
    UPDATE logistics_shipments
    SET 
      current_location = $1,
      current_coordinates = $2::jsonb,
      updated_at = NOW()
    WHERE id = $3
    RETURNING *
  `;

  const result = await pool.query(query, [
    location,
    JSON.stringify(coordinates),
    shipmentId
  ]);
  return result.rows[0];
}

// Generate tracking number
export async function generateTrackingNumber(shipmentId) {
  const trackingNumber = `AGR-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
  
  const query = `
    UPDATE logistics_shipments
    SET tracking_number = $1, updated_at = NOW()
    WHERE id = $2
    RETURNING *
  `;

  const result = await pool.query(query, [trackingNumber, shipmentId]);
  return result.rows[0];
}

// Get shipment by tracking number
export async function getShipmentByTrackingNumber(trackingNumber) {
  const query = `
    SELECT 
      ls.*,
      o.buyer_id,
      o.seller_id,
      o.total_amount as order_amount,
      o.status as order_status,
      b.email as buyer_email,
      b.name as buyer_name
    FROM logistics_shipments ls
    LEFT JOIN orders o ON ls.order_id = o.id
    LEFT JOIN buyers b ON o.buyer_id = b.buyer_id
    WHERE ls.tracking_number = $1
  `;

  const result = await pool.query(query, [trackingNumber]);
  return result.rows[0];
}

// Create shipment tracking event
export async function createTrackingEvent(eventData) {
  const {
    shipment_id,
    event_type,
    event_status,
    location,
    coordinates,
    event_notes,
    metadata = {}
  } = eventData;

  const query = `
    INSERT INTO shipment_tracking_events (
      shipment_id, event_type, event_status, location,
      coordinates, event_notes, metadata
    ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *
  `;

  const values = [
    shipment_id,
    event_type,
    event_status,
    location,
    coordinates ? JSON.stringify(coordinates) : null,
    event_notes,
    JSON.stringify(metadata)
  ];

  const result = await pool.query(query, values);
  return result.rows[0];
}

// Get tracking events for shipment
export async function getTrackingEvents(shipmentId, limit = 100) {
  const query = `
    SELECT * FROM shipment_tracking_events
    WHERE shipment_id = $1
    ORDER BY created_at DESC
    LIMIT $2
  `;

  const result = await pool.query(query, [shipmentId, limit]);
  return result.rows;
}

// Get shipment statistics for logistics company
export async function getCompanyShipmentStats(companyId) {
  const query = `
    SELECT 
      COUNT(*) as total_shipments,
      COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_shipments,
      COUNT(CASE WHEN status = 'assigned' THEN 1 END) as assigned_shipments,
      COUNT(CASE WHEN status = 'picked_up' THEN 1 END) as picked_up_shipments,
      COUNT(CASE WHEN status = 'in_transit' THEN 1 END) as in_transit_shipments,
      COUNT(CASE WHEN status = 'delivered' THEN 1 END) as delivered_shipments,
      COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_shipments
    FROM logistics_shipments
    WHERE logistics_company_id = $1
  `;

  const result = await pool.query(query, [companyId]);
  return result.rows[0];
}

// Get shipment statistics for driver
export async function getDriverShipmentStats(driverId) {
  const query = `
    SELECT 
      COUNT(*) as total_shipments,
      COUNT(CASE WHEN status = 'assigned' THEN 1 END) as assigned_shipments,
      COUNT(CASE WHEN status = 'picked_up' THEN 1 END) as picked_up_shipments,
      COUNT(CASE WHEN status = 'in_transit' THEN 1 END) as in_transit_shipments,
      COUNT(CASE WHEN status = 'delivered' THEN 1 END) as delivered_shipments
    FROM logistics_shipments
    WHERE driver_id = $1
  `;

  const result = await pool.query(query, [driverId]);
  return result.rows[0];
}
