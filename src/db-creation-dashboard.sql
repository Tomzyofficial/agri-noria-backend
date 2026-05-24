-- Dashboard specific tables

-- System Health
CREATE TABLE IF NOT EXISTS system_health (
    id SERIAL PRIMARY KEY,
    label VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL,
    color VARCHAR(50) NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Upcoming Deadlines
CREATE TABLE IF NOT EXISTS upcoming_deadlines (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    deadline_date DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Seed Data (Optional, for initial setup)
INSERT INTO system_health (label, status, color) VALUES
('Loan Disbursement', 'Operational', 'emerald'),
('Field Verifications', 'Active', 'emerald'),
('Satellite Sync', 'Pending', 'amber'),
('Payment Gateway', 'Operational', 'emerald')
ON CONFLICT DO NOTHING;

INSERT INTO upcoming_deadlines (title, deadline_date) VALUES
('Wet Season Audit', '2026-06-15'),
('Q3 Financial Reporting', '2026-09-30')
ON CONFLICT DO NOTHING;
