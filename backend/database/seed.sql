-- Seed inicial - Sistema nassauTickets
-- Senhas padrao de desenvolvimento:
--   gestor: gestor123
--   atendente1 / atendente2: atendente123

USE nassau_tickets;

INSERT INTO usuarios (nome, login, email, senha_hash, perfil, ativo)
VALUES
  (
    'Gestor do Laboratorio',
    'gestor',
    'gestor@nassautickets.local',
    '$2a$10$VGHyJrHOBZbcSXBexM24ROPBAeULorLjVWjC/JN8Oa1cUpaIRELAW',
    'gestor',
    1
  ),
  (
    'Atendente 01',
    'atendente1',
    'atendente1@nassautickets.local',
    '$2a$10$j032gkoePZg7nfM211FQUuuyAaPzwXB5J.g1YWz0bxcGwqbY6IQea',
    'atendente',
    1
  ),
  (
    'Atendente 02',
    'atendente2',
    'atendente2@nassautickets.local',
    '$2a$10$j032gkoePZg7nfM211FQUuuyAaPzwXB5J.g1YWz0bxcGwqbY6IQea',
    'atendente',
    1
  )
ON DUPLICATE KEY UPDATE
  nome = VALUES(nome),
  email = VALUES(email),
  ativo = VALUES(ativo);

INSERT INTO guiches (numero, descricao, ativo)
VALUES
  (1, 'Guiche 01', 1),
  (2, 'Guiche 02', 1),
  (3, 'Guiche 03', 1),
  (4, 'Guiche 04', 1),
  (5, 'Guiche 05', 1)
ON DUPLICATE KEY UPDATE
  descricao = VALUES(descricao),
  ativo = VALUES(ativo);

