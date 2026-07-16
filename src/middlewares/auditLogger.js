import pool from "../lib/connect.js";

/**
 * Middleware to track actions and log them to action_audit_logs.
 * It expects the frontend to send GPS data in headers (x-gps-latitude, x-gps-longitude)
 * and device info in User-Agent or x-device-info.
 */
export const auditLogger = (actionType, getResource = (req) => req.originalUrl) => {
  return async (req, res, next) => {
    // We override res.send / res.json to capture the "new_value" if we want,
    // or just let the route handlers log the specific data changes.
    // For a generic middleware, we'll log the request body as previous/new value placeholder
    // but in a real scenario, the controller should log exact data changes.
    
    // We will attach a function to req so controllers can log specific changes manually
    req.logAudit = async ({ resource, previousValue, newValue, specificActionType }) => {
      try {
        const userId = req.user?.id || req.vendor?.id || null; // fallback depending on auth
        const type = specificActionType || actionType;
        const resName = resource || getResource(req);
        
        const lat = req.headers['x-gps-latitude'] ? parseFloat(req.headers['x-gps-latitude']) : null;
        const lng = req.headers['x-gps-longitude'] ? parseFloat(req.headers['x-gps-longitude']) : null;
        const deviceInfo = req.headers['x-device-info'] || req.headers['user-agent'];

        await pool.query(
          `INSERT INTO action_audit_logs 
           (user_id, action_type, resource, previous_value, new_value, gps_latitude, gps_longitude, device_info)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [userId, type, resName, previousValue ? JSON.stringify(previousValue) : null, newValue ? JSON.stringify(newValue) : null, lat, lng, deviceInfo]
        );
      } catch (err) {
        console.error("Audit log error:", err);
      }
    };

    next();
  };
};
