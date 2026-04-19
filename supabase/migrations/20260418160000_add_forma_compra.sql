-- Migration to add payment method field to clients table
ALTER TABLE clients ADD COLUMN IF NOT EXISTS forma_compra TEXT DEFAULT 'A vista';
