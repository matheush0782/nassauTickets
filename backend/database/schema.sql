-- Schema MySQL 8.0 - Sistema nassauTickets
-- Controle de Atendimento - Laboratorio de Analises Clinicas

CREATE DATABASE IF NOT EXISTS nassau_tickets
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE nassau_tickets;

-- Usuarios do sistema (Agente Atendente - AA e unico AA com perfil de Gestor)
CREATE TABLE IF NOT EXISTS usuarios (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nome VARCHAR(120) NOT NULL,
  login VARCHAR(60) NOT NULL,
  email VARCHAR(120) NULL,
  senha_hash VARCHAR(255) NOT NULL,
  perfil ENUM('atendente', 'gestor') NOT NULL DEFAULT 'atendente',
  ativo TINYINT(1) NOT NULL DEFAULT 1,
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_usuarios_login (login),
  UNIQUE KEY uq_usuarios_email (email),
  INDEX idx_usuarios_perfil_ativo (perfil, ativo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Guiches de atendimento (qualquer guiche pode atender qualquer tipo de senha)
CREATE TABLE IF NOT EXISTS guiches (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  numero INT UNSIGNED NOT NULL,
  descricao VARCHAR(100) NULL,
  ativo TINYINT(1) NOT NULL DEFAULT 1,
  atendente_atual_id INT UNSIGNED NULL,
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_guiches_numero (numero),
  CONSTRAINT fk_guiches_atendente_atual
    FOREIGN KEY (atendente_atual_id) REFERENCES usuarios(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Senhas emitidas e ciclo de vida do atendimento
-- Modelo de numeracao: YYMMDD-PPSQ (ex.: 261126-SP001)
CREATE TABLE IF NOT EXISTS senhas (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  codigo VARCHAR(20) NOT NULL,
  tipo ENUM('SP', 'SG', 'SE') NOT NULL,
  data_referencia DATE NOT NULL,
  sequencial SMALLINT UNSIGNED NOT NULL,
  status ENUM(
    'EMITIDA',
    'AGUARDANDO',
    'CHAMADA',
    'CHAMADA_NOVAMENTE',
    'EM_ATENDIMENTO',
    'ATENDIDA',
    'NAO_COMPARECEU',
    'DESCARTADA'
  ) NOT NULL DEFAULT 'EMITIDA',
  guiche_id INT UNSIGNED NULL,
  atendente_id INT UNSIGNED NULL,
  emitida_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  primeira_chamada_em DATETIME NULL,
  segunda_chamada_em DATETIME NULL,
  inicio_atendimento_em DATETIME NULL,
  fim_atendimento_em DATETIME NULL,
  tempo_atendimento_segundos INT UNSIGNED NULL,
  atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_senhas_codigo (codigo),
  UNIQUE KEY uq_senhas_data_tipo_seq (data_referencia, tipo, sequencial),
  INDEX idx_senhas_status_data (status, data_referencia),
  INDEX idx_senhas_tipo_data (tipo, data_referencia),
  INDEX idx_senhas_primeira_chamada (primeira_chamada_em),
  CONSTRAINT fk_senhas_guiche
    FOREIGN KEY (guiche_id) REFERENCES guiches(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE,
  CONSTRAINT fk_senhas_atendente
    FOREIGN KEY (atendente_id) REFERENCES usuarios(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Trilha de auditoria das acoes operacionais e administrativas
CREATE TABLE IF NOT EXISTS auditoria_eventos (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  usuario_id INT UNSIGNED NULL,
  senha_id BIGINT UNSIGNED NULL,
  guiche_id INT UNSIGNED NULL,
  acao VARCHAR(60) NOT NULL,
  detalhes JSON NULL,
  ip_origem VARCHAR(45) NULL,
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_auditoria_criado_em (criado_em),
  INDEX idx_auditoria_acao (acao),
  CONSTRAINT fk_auditoria_usuario
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE,
  CONSTRAINT fk_auditoria_senha
    FOREIGN KEY (senha_id) REFERENCES senhas(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE,
  CONSTRAINT fk_auditoria_guiche
    FOREIGN KEY (guiche_id) REFERENCES guiches(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
