-- Add condo fields to properties table
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS condo_name text;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS condo_value numeric DEFAULT 0;

-- Optional: Modify balcony_type to be more flexible text if it was restricted (it's already text)
-- COMMENT ON COLUMN public.properties.condo_name IS 'Name of the condominium';
-- COMMENT ON COLUMN public.properties.condo_value IS 'Monthly condominium fee value';
