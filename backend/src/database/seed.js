import bcrypt from 'bcryptjs'
import { env } from '../config/env.js'
import { closePool, query } from '../config/database.js'

const initialUsers = [
  {
    nome: 'Gestor do Laboratorio',
    login: 'gestor',
    email: 'gestor@nassautickets.local',
    senhaPlana: 'gestor123',
    perfil: 'gestor',
  },
  {
    nome: 'Atendente 01',
    login: 'atendente1',
    email: 'atendente1@nassautickets.local',
    senhaPlana: 'atendente123',
    perfil: 'atendente',
  },
  {
    nome: 'Atendente 02',
    login: 'atendente2',
    email: 'atendente2@nassautickets.local',
    senhaPlana: 'atendente123',
    perfil: 'atendente',
  },
]

const initialGuiches = [
  { numero: 1, descricao: 'Guiche 01' },
  { numero: 2, descricao: 'Guiche 02' },
  { numero: 3, descricao: 'Guiche 03' },
  { numero: 4, descricao: 'Guiche 04' },
  { numero: 5, descricao: 'Guiche 05' },
]

async function runSeed() {
  for (const user of initialUsers) {
    const senhaHash = await bcrypt.hash(user.senhaPlana, env.bcryptSaltRounds)
    await query(
      `INSERT INTO usuarios (nome, login, email, senha_hash, perfil, ativo)
       VALUES (?, ?, ?, ?, ?, 1)
       ON DUPLICATE KEY UPDATE
         nome = VALUES(nome),
         email = VALUES(email),
         ativo = VALUES(ativo)`,
      [user.nome, user.login, user.email, senhaHash, user.perfil],
    )
  }

  for (const guiche of initialGuiches) {
    await query(
      `INSERT INTO guiches (numero, descricao, ativo)
       VALUES (?, ?, 1)
       ON DUPLICATE KEY UPDATE
         descricao = VALUES(descricao),
         ativo = VALUES(ativo)`,
      [guiche.numero, guiche.descricao],
    )
  }

  console.log('[db:seed] Usuarios e guiches iniciais inseridos/atualizados.')
}

runSeed()
  .catch((error) => {
    console.error('[db:seed] Erro ao executar seed:', error.message)
    process.exitCode = 1
  })
  .finally(() => closePool())
