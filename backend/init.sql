-- Inicialização do Banco de Dados Nova Lab

CREATE EXTENSION IF NOT EXISTS pgvector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Definição dos Status das Ordens de Serviço
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'os_status') THEN
        CREATE TYPE os_status AS ENUM ('Recebida', 'Separação', 'Produção', 'Montagem', 'CQ', 'Expedição', 'Cancelada');
    END IF;
END$$;
