-- Email verification table for both vendors and buyers
CREATE TABLE IF NOT EXISTS email_verifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL,
    user_type VARCHAR(10) NOT NULL CHECK (user_type IN ('vendor', 'buyer')),
    verification_code_hash VARCHAR(255) NOT NULL,
    is_verified BOOLEAN DEFAULT FALSE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT email_verifications_email_user_type_unique UNIQUE (email, user_type)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_email_verifications_email ON email_verifications(email);
CREATE INDEX IF NOT EXISTS idx_email_verifications_user_type ON email_verifications(user_type);
CREATE INDEX IF NOT EXISTS idx_email_verifications_expires_at ON email_verifications(expires_at);

-- Function to clean up expired verification codes
CREATE OR REPLACE FUNCTION cleanup_expired_verifications() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    DELETE FROM email_verifications 
    WHERE expires_at < NOW() 
    OR (is_verified = TRUE AND updated_at < NOW() - INTERVAL '24 hours');
    RETURN NEW;
END;
$$;

-- Trigger to automatically clean up expired codes (optional, or run as cron job)
-- Uncomment if you want automatic cleanup
DROP TRIGGER IF EXISTS trigger_cleanup_expired_verifications ON email_verifications;
CREATE TRIGGER trigger_cleanup_expired_verifications
AFTER INSERT ON email_verifications
FOR EACH ROW
EXECUTE FUNCTION cleanup_expired_verifications();

-- Add email verification status to vendors table
-- ALTER TABLE vendors 
-- ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE,
-- ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMP WITH TIME ZONE;

-- Add email verification status to buyers table  
-- ALTER TABLE buyers
-- ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE,
-- ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMP WITH TIME ZONE;

-- Indexes for email verification status
-- CREATE INDEX IF NOT EXISTS idx_vendors_email_verified ON vendors(email_verified);
-- CREATE INDEX IF NOT EXISTS idx_buyers_email_verified ON buyers(email_verified);
