import pool from "../../lib/connect.js";

// === PROGRAMME WALLET ===
export async function createProgramWallet(programId, institutionId) {
    let { rows } = await pool.query("SELECT * FROM program_wallets WHERE program_id = $1", [programId]);
    if (rows[0]) return rows[0];
    const res = await pool.query(
        `INSERT INTO program_wallets (program_id, institution_id, balance)
         VALUES ($1, $2, 0.00)
         ON CONFLICT (program_id, institution_id) DO UPDATE SET updated_at = now()
         RETURNING *`,
        [programId, institutionId]
    );
    return res.rows[0];
}

export async function getProgramWallet(programId, institutionId = null) {
    if (institutionId) {
        const { rows } = await pool.query(
            "SELECT * FROM program_wallets WHERE program_id = $1 AND institution_id = $2",
            [programId, institutionId]
        );
        return rows[0] || null;
    } else {
        const { rows } = await pool.query("SELECT * FROM program_wallets WHERE program_id = $1", [programId]);
        return rows[0] || null;
    }
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
    // Automatically credit the locked_balance of the recipient's wallet
    const updateRes = await pool.query(
        "UPDATE wallets SET locked_balance = COALESCE(locked_balance, 0) + $1 WHERE owner_id = $2 AND owner_type = $3",
        [amount, heldForId, heldForType]
    );
    if (updateRes.rowCount === 0) {
        await pool.query(
            "INSERT INTO wallets (owner_id, owner_type, balance, locked_balance, currency) VALUES ($1, $2, 0.00, $3, 'NGN') ON CONFLICT DO NOTHING",
            [heldForId, heldForType, amount]
        );
        await pool.query(
            "UPDATE wallets SET locked_balance = COALESCE(locked_balance, 0) + $1 WHERE owner_id = $2 AND owner_type = $3 AND locked_balance = 0.00",
            [amount, heldForId, heldForType]
        );
    }
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
    const escrow = rows[0];
    if (escrow && escrow.held_for_id && escrow.held_for_type) {
        await pool.query(
            "UPDATE wallets SET locked_balance = GREATEST(0, COALESCE(locked_balance, 0) - $1) WHERE owner_id = $2 AND owner_type = $3",
            [escrow.amount, escrow.held_for_id, escrow.held_for_type]
        );
    }
    return escrow;
}
