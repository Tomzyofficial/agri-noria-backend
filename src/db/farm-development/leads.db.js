import pool from "../../lib/connect.js";

export async function getLeads(companyId, status = null) {
  try {
    let query = `SELECT * FROM leads WHERE company_id = $1`;
    const params = [parseInt(companyId)];

    if (status) {
      query += ` AND status = $2`;
      params.push(status);
    }

    query += ` ORDER BY created_at DESC`;

    const { rows } = await pool.query(query, params);
    return rows;
  } catch (error) {
    console.error("Database error in getLeads:", error);
    return null;
  }
}

export async function createLead(
  listingId,
  companyId,
  customerName,
  customerEmail,
  customerPhone,
  message,
  budget,
) {
  try {
    const { rows } = await pool.query(
      `INSERT INTO leads (listing_id, company_id, customer_name, customer_email, customer_phone, message, budget, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        listingId || null,
        companyId,
        customerName,
        customerEmail,
        customerPhone || "",
        message || "",
        budget || "",
        "new",
      ],
    );
    return rows[0] || null;
  } catch (error) {
    console.error("Database error in createLead:", error);
    return null;
  }
}

export async function getLeadById(leadId) {
  try {
    const { rows } = await pool.query("SELECT * FROM leads WHERE id = $1", [
      parseInt(leadId),
    ]);
    return rows[0] || null;
  } catch (error) {
    console.error("Database error in getLeadById:", error);
    return null;
  }
}

export async function getLeadStatusHistory(leadId) {
  try {
    const { rows } = await pool.query(
      "SELECT * FROM lead_status_history WHERE lead_id = $1 ORDER BY changed_at DESC",
      [parseInt(leadId)],
    );
    return rows;
  } catch (error) {
    console.error("Database error in getLeadStatusHistory:", error);
    return [];
  }
}

export async function updateLeadStatus(leadId, newStatus) {
  try {
    // Get current status
    const lead = await getLeadById(leadId);
    if (!lead) return null;

    // Update lead
    const { rows } = await pool.query(
      `UPDATE leads SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *`,
      [newStatus || lead.status, parseInt(leadId)],
    );

    // Record status change if status changed
    if (newStatus && newStatus !== lead.status) {
      await pool.query(
        "INSERT INTO lead_status_history (lead_id, old_status, new_status) VALUES ($1, $2, $3)",
        [parseInt(leadId), lead.status, newStatus],
      );
    }

    return rows[0] || null;
  } catch (error) {
    console.error("Database error in updateLeadStatus:", error);
    return null;
  }
}

export async function deleteLead(leadId) {
  try {
    // Delete status history first
    await pool.query("DELETE FROM lead_status_history WHERE lead_id = $1", [
      parseInt(leadId),
    ]);
    // Delete lead
    const { rows } = await pool.query(
      "DELETE FROM leads WHERE id = $1 RETURNING id",
      [parseInt(leadId)],
    );
    return rows[0] || null;
  } catch (error) {
    console.error("Database error in deleteLead:", error);
    return null;
  }
}
