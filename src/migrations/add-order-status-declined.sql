-- Add 'declined' to order_status_type for logistics partner declines
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'order_status_type' AND e.enumlabel = 'declined'
  ) THEN
    ALTER TYPE order_status_type ADD VALUE 'declined';
  END IF;
END$$;