-- Add images column to services table
ALTER TABLE services
ADD COLUMN images JSON NULL
AFTER provider_id;