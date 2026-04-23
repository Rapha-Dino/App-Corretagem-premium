-- Adiciona colunas para controle de lembretes automáticos
ALTER TABLE appointments 
ADD COLUMN reminder_24h_sent BOOLEAN DEFAULT FALSE,
ADD COLUMN reminder_3h_sent BOOLEAN DEFAULT FALSE;
