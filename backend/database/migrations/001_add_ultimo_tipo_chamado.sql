-- Migracao segura e idempotente para bancos nassau_tickets ja existentes
-- Preserva todos os dados existentes em usuarios, guiches, senhas e auditoria_eventos.

USE nassau_tickets;

-- 1. Adiciona indice de busca de chamadas caso nao exista
SET @idx_exists := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'senhas'
    AND INDEX_NAME = 'idx_senhas_busca_chamada'
);
SET @sql_idx := IF(
  @idx_exists = 0,
  'CREATE INDEX idx_senhas_busca_chamada ON senhas (status, data_referencia, tipo, emitida_em)',
  'SELECT 1'
);
PREPARE stmt_idx FROM @sql_idx;
EXECUTE stmt_idx;
DEALLOCATE PREPARE stmt_idx;

-- 2. Cria tabela expediente_diario caso nao exista
CREATE TABLE IF NOT EXISTS expediente_diario (
  data_referencia DATE NOT NULL,
  encerrado_manualmente TINYINT(1) NOT NULL DEFAULT 0,
  encerrado_em DATETIME NULL,
  encerrado_por INT UNSIGNED NULL,
  reaberto_em DATETIME NULL,
  reaberto_por INT UNSIGNED NULL,
  ultimo_tipo_chamado ENUM('SP', 'SG', 'SE') NULL,
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (data_referencia),
  CONSTRAINT fk_expediente_encerrado_por
    FOREIGN KEY (encerrado_por) REFERENCES usuarios(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE,
  CONSTRAINT fk_expediente_reaberto_por
    FOREIGN KEY (reaberto_por) REFERENCES usuarios(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Adiciona coluna ultimo_tipo_chamado caso expediente_diario ja exista sem ela
SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'expediente_diario'
    AND COLUMN_NAME = 'ultimo_tipo_chamado'
);
SET @sql_col := IF(
  @col_exists = 0,
  'ALTER TABLE expediente_diario ADD COLUMN ultimo_tipo_chamado ENUM(''SP'', ''SG'', ''SE'') NULL AFTER reaberto_por',
  'SELECT 1'
);
PREPARE stmt_col FROM @sql_col;
EXECUTE stmt_col;
DEALLOCATE PREPARE stmt_col;
