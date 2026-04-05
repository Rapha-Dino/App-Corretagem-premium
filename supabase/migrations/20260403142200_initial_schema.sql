-- Initial Schema for CRM Imobiliário "Livro Arquitetônico"

-- 1. Users Table (Profiles)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  role TEXT DEFAULT 'corretor' CHECK (role IN ('admin', 'corretor', 'suporte')),
  photo_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Clients Table (Leads)
CREATE TABLE IF NOT EXISTS clients (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  nome TEXT NOT NULL,
  data_entrada DATE DEFAULT CURRENT_DATE NOT NULL,
  telefone TEXT,
  email TEXT,
  whatsapp TEXT,
  rede_social TEXT,
  aniversario DATE,
  documento TEXT,
  profissao TEXT,
  v_l TEXT, -- Venda / Locação
  codigo TEXT, -- Código do Imóvel
  valor_buscado NUMERIC,
  status TEXT DEFAULT 'Novo' CHECK (status IN ('Novo', 'Ativo', 'Visita', 'Negociação', 'Fechado', 'Parado', 'Perdido')),
  bairros TEXT[], -- Array of neighborhoods
  tipo TEXT, -- Casa, Apartamento, etc.
  metragem_quadrada NUMERIC,
  andar INTEGER,
  dormitorios INTEGER,
  suites INTEGER,
  vagas INTEGER,
  banheiros INTEGER,
  outros TEXT,
  imovel_enviado TEXT,
  feedback TEXT,
  observacoes TEXT,
  contato TEXT,
  foto_url TEXT,
  historico_conversas JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Change Logs
CREATE TABLE IF NOT EXISTS change_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID REFERENCES clients ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users ON DELETE SET NULL,
  action TEXT NOT NULL,
  changes JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Row Level Security (RLS)

-- Profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public profiles are viewable by everyone." ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert their own profile." ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile." ON profiles FOR UPDATE USING (auth.uid() = id);

-- Clients
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own clients." ON clients FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own clients." ON clients FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own clients." ON clients FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own clients." ON clients FOR DELETE USING (auth.uid() = user_id);

-- Change Logs
ALTER TABLE change_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view logs for their clients." ON change_logs FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM clients WHERE clients.id = change_logs.client_id AND clients.user_id = auth.uid()
  )
);

-- 5. Triggers for updated_at
CREATE OR REPLACE FUNCTION handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER on_profiles_updated
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE PROCEDURE handle_updated_at();

CREATE TRIGGER on_clients_updated
  BEFORE UPDATE ON clients
  FOR EACH ROW EXECUTE PROCEDURE handle_updated_at();
