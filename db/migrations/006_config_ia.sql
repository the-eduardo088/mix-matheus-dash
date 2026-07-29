-- Configurações do sistema (chave-valor)
CREATE TABLE IF NOT EXISTS configuracoes (
  chave VARCHAR(100) PRIMARY KEY,
  valor TEXT NOT NULL,
  atualizado_em TIMESTAMPTZ DEFAULT now()
);

-- Habilitar IA para identificação de DDD por padrão
INSERT INTO configuracoes (chave, valor)
VALUES ('ia_ddd_ativa', 'true')
ON CONFLICT (chave) DO NOTHING;
