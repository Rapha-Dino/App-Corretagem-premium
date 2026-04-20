-- Migration to create properties table for Real Estate CRM
CREATE TABLE IF NOT EXISTS public.properties (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    owner_name text NOT NULL,
    owner_phone text,
    owner_whatsapp text,
    owner_email text,
    owner_cpf_rg text,
    owner_birth_date date,
    owner_photo_url text,
    address text,
    neighborhood text,
    cep text,
    sale_value numeric DEFAULT 0,
    proximity text DEFAULT 'N/A',
    front_m numeric DEFAULT 0,
    depth_m numeric DEFAULT 0,
    total_size_m2 numeric DEFAULT 0,
    built_area_m2 numeric DEFAULT 0,
    property_type text DEFAULT 'Casa',
    unit_ap text,
    block text,
    iptu numeric DEFAULT 0,
    property_code text,
    floor_text text,
    parking_spaces numeric DEFAULT 0,
    parking_number text,
    has_backyard boolean DEFAULT false,
    has_edicula boolean DEFAULT false,
    rooms numeric DEFAULT 0,
    living_rooms numeric DEFAULT 0,
    balcony_type text DEFAULT 'Nenhuma',
    suites numeric DEFAULT 0,
    bathrooms numeric DEFAULT 0,
    has_sign boolean DEFAULT false,
    exchange_possible boolean DEFAULT false,
    observations text,
    property_photos text[] DEFAULT '{}',
    data_entrada date DEFAULT now(),
    created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their own properties" ON public.properties 
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own properties" ON public.properties 
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own properties" ON public.properties 
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own properties" ON public.properties 
    FOR DELETE USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER on_properties_updated
  BEFORE UPDATE ON public.properties
  FOR EACH ROW EXECUTE PROCEDURE handle_updated_at();
