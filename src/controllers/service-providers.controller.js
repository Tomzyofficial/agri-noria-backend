const db = require("../db/connect");

// Get all service providers
exports.getAllProviders = async (req, res) => {
  try {
    const result = await db.query("SELECT * FROM service_providers");
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Create a new service provider
exports.createProvider = async (req, res) => {
  const { name, email, phone } = req.body;
  try {
    const result = await db.query(
      "INSERT INTO service_providers (name, email, phone) VALUES ($1, $2, $3) RETURNING *",
      [name, email, phone],
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get all services
exports.getAllServices = async (req, res) => {
  try {
    const result = await db.query("SELECT * FROM services");
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Create a new service
exports.createService = async (req, res) => {
  const { provider_id, title, description, price } = req.body;
  try {
    const result = await db.query(
      "INSERT INTO services (provider_id, title, description, price) VALUES ($1, $2, $3, $4) RETURNING *",
      [provider_id, title, description, price],
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Delete a service
exports.deleteService = async (req, res) => {
  const { id } = req.params;
  try {
    await db.query("DELETE FROM services WHERE id = $1", [id]);
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
