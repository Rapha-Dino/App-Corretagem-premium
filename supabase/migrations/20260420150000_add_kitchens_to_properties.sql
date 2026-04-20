-- Add kitchens column to properties table
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS kitchens numeric DEFAULT 1;

-- Add comment explaining the field
COMMENT ON COLUMN public.properties.kitchens IS 'Number of kitchens in the property';
