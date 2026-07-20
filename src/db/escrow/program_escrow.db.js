import pool from "../../lib/connect.js";

// === PROGRAMME WALLET ===
export async function createProgramWallet(programId, institutionId) {
    const { rows } = await pool.query(
        `INSERT INTO program_wallets (program_id, institution_id, balance)
         VALUES ($1, $2, 0.00)
         ON CONFLICT DO NOTHING
         RETURNING *`,
        [programId, institutionId]
    );
    return rows[0];
}

export async function getProgramWallet(programId, institutionId) {
    const { rows } = await pool.query(
        "SELECT * FROM program_wallets WHERE program_id = $1 AND institution_id = $2",
        [programId, institutionId]
    );
    return rows[0] || null;
}

export async function fundProgramWallet(walletId, amount) {
    const { rows } = await pool.query(
        "UPDATE program_wallets SET balance = balance + $1, updated_at = now() WHERE id = $2 RETURNING *",
        [amount, walletId]
    );
    return rows[0];
}

export async function deductProgramWallet(walletId, amount) {
    const { rows } = await pool.query(
        "UPDATE program_wallets SET balance = balance - $1, updated_at = now() WHERE id = $2 RETURNING *",
        [amount, walletId]
    );
    return rows[0];
}

// === ESCROW WALLET ===
export async function createEscrowWallet(programId, heldForId, heldForType, amount, conditions, referenceId, referenceType) {
    const { rows } = await pool.query(
        `INSERT INTO escrow_wallets (program_id, held_for_id, held_for_type, amount, conditions, reference_id, reference_type)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [programId, heldForId, heldForType, amount, JSON.stringify(conditions), referenceId, referenceType]
    );
    return rows[0];
}

export async function getEscrowWallet(id) {
    const { rows } = await pool.query("SELECT * FROM escrow_wallets WHERE id = $1", [id]);
    return rows[0];
}

export async function getEscrowByReference(referenceId, referenceType) {
    const { rows } = await pool.query(
        "SELECT * FROM escrow_wallets WHERE reference_id = $1 AND reference_type = $2 AND status = 'held'",
        [referenceId, referenceType]
    );
    return rows[0];
}

export async function releaseEscrowWallet(escrowId) {
    const { rows } = await pool.query(
        "UPDATE escrow_wallets SET status = 'released', released_at = now() WHERE id = $1 RETURNING *",
        [escrowId]
    );
    return rows[0];
}
