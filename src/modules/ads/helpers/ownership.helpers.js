import pool from "../../../lib/connect.js";

const verifyOwnership = {
  product: async (vendorId, listingId) => {
    const { rowCount } = await pool.query(
      `SELECT 1 FROM listings WHERE id = $1 AND account_id = $2 AND status = 'active' LIMIT 1`,
      [listingId, vendorId],
    );
    return rowCount > 0;
  },
  storage: async (vendorId, listingId) => {
    const { rowCount } = await pool.query(
      `SELECT 1 FROM storage_facility WHERE id = $1 AND account_id = $2 AND status = 'active' LIMIT 1`,
      [listingId, vendorId],
    );
    return rowCount > 0;
  },
  logistics: async (vendorId, listingId) => {
    const { rowCount } = await pool.query(
      `SELECT 1 FROM vehicles WHERE id = $1 AND vendor_id = $2 AND status = 'available' LIMIT 1`,
      [listingId, vendorId],
    );
    return rowCount > 0;
  },
  farmService: async (vendorId, listingId) => {
    const { rowCount } = await pool.query(
      `SELECT 1 FROM farm_dev_service_listings WHERE id = $1 AND vendor_id = $2 AND status = 'active' LIMIT 1`,
      [listingId, vendorId],
    );
    return rowCount > 0;
  },
  training: async (vendorId, trainingId) => {
    const { rowCount } = await pool.query(
      `SELECT 1 FROM trainings WHERE id = $1 AND trainer_id = $2 LIMIT 1`,
      [trainingId, vendorId],
    );
    return rowCount > 0;
  },
  job: async (vendorId, jobId) => {
    const { rowCount } = await pool.query(
      `SELECT 1 FROM jobs WHERE id = $1 AND vendor_id = $2 LIMIT 1`,
      [jobId, vendorId],
    );
    return rowCount > 0;
  },
  vendor: async (vendorId) => {
    const { rowCount } = await pool.query(
      `SELECT 1 FROM vendors WHERE id = $1 LIMIT 1`,
      [vendorId],
    );
    return rowCount > 0;
  },
};
// export async function verifyProductOwnership(vendorId, listingId) {
//   const { rowCount } = await pool.query(
//     `SELECT 1 FROM listings WHERE id = $1 AND account_id = $2 AND status = 'active' LIMIT 1`,
//     [listingId, vendorId],
//   );
//   return rowCount > 0;
// }

// export async function verifyStorageOwnership(vendorId, listingId) {
//   const { rowCount } = await pool.query(
//     `SELECT 1 FROM storage_facility WHERE id = $1 AND account_id = $2 AND status = 'active' LIMIT 1`,
//     [listingId, vendorId],
//   );
//   return rowCount > 0;
// }

// export async function verifyLogisticsOwnership(vendorId, listingId) {
//   const { rowCount } = await pool.query(
//     `SELECT 1 FROM vehicles WHERE id = $1 AND vendor_id = $2 AND status = 'available' LIMIT 1`,
//     [listingId, vendorId],
//   );
//   return rowCount > 0;
// }

// export async function verifyFarmServiceOwnership(vendorId, listingId) {
//   const { rowCount } = await pool.query(
//     `SELECT 1 FROM farm_dev_service_listings WHERE id = $1 AND vendor_id = $2 AND status = 'active' LIMIT 1`,
//     [listingId, vendorId],
//   );
//   return rowCount > 0;
// }

// export async function verifyTrainingOwnership(vendorId, trainingId) {
//   const { rowCount } = await pool.query(
//     `SELECT 1 FROM trainings WHERE id = $1 AND trainer_id = $2 LIMIT 1`,
//     [trainingId, vendorId],
//   );
//   return rowCount > 0;
// }

// export async function verifyJobOwnership(vendorId, jobId) {
//   const { rowCount } = await pool.query(
//     `SELECT 1 FROM jobs WHERE id = $1 AND vendor_id = $2 LIMIT 1`,
//     [jobId, vendorId],
//   );
//   return rowCount > 0;
// }

// export async function verifyVendorExists(vendorId) {
//   const { rowCount } = await pool.query(
//     `SELECT 1 FROM vendors WHERE id = $1 LIMIT 1`,
//     [vendorId],
//   );
//   return rowCount > 0;
// }

export default verifyOwnership;
