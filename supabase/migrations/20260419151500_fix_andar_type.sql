-- Alterar a coluna andar de INTEGER para TEXT usando uma abordagem de renomeação para evitar conflitos de tipo
ALTER TABLE clients RENAME COLUMN andar TO andar_int;
ALTER TABLE clients ADD COLUMN andar TEXT;
UPDATE clients SET andar = andar_int::TEXT;
-- Não vamos remover a coluna antiga agora para evitar perda de dados se a migração falhar parcialmente, mas marcamos como legada
COMMENT ON COLUMN clients.andar_int IS 'Coluna legada (inteiro). Use a nova coluna andar (texto).';
