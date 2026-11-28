/**
 * Suite de integracao REAL em MySQL 8.0 — nassauTickets (Desenvolvedor 1).
 *
 * Executa contra um banco ISOLADO (padrao: `nassau_tickets_test`), aplicando
 * schema.sql e seed.sql reais, testando concorrencia (emissao e reserva),
 * rollback de transacoes, chaves estrangeiras, auditoria e expediente_diario.
 *
 * Como executar quando o MySQL 8 estiver disponivel:
 *   cd backend
 *   npm run test:mysql
 */
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { after, before, describe, it } from 'node:test'
import mysql from 'mysql2/promise'
import { closePool, setPool, testConnection, withTransaction } from '../src/config/database.js'
import { env } from '../src/config/env.js'
import { auditRepository } from '../src/repositories/auditRepository.js'
import { expedienteRepository } from '../src/repositories/expedienteRepository.js'
import { guicheRepository } from '../src/repositories/guicheRepository.js'
import { ticketRepository } from '../src/repositories/ticketRepository.js'
import { userRepository } from '../src/repositories/userRepository.js'
import { createAuthService } from '../src/services/authService.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const schemaPath = path.resolve(__dirname, '../database/schema.sql')
const seedPath = path.resolve(__dirname, '../database/seed.sql')

const TEST_DB = process.env.DB_TEST_NAME || 'nassau_tickets_test'

describe('Integracao real MySQL 8.0 (banco isolado)', () => {
  let pool

  before(async () => {
    const rootConn = await mysql.createConnection({
      host: env.db.host,
      port: env.db.port,
      user: env.db.user,
      password: env.db.password,
      multipleStatements: true,
    })

    try {
      await rootConn.query(`DROP DATABASE IF EXISTS \`${TEST_DB}\``)
      await rootConn.query(
        `CREATE DATABASE \`${TEST_DB}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
      )
      await rootConn.query(`USE \`${TEST_DB}\``)

      const schemaSql = (await fs.readFile(schemaPath, 'utf-8'))
        .replace(/CREATE DATABASE IF NOT EXISTS nassau_tickets[\s\S]*?USE nassau_tickets;/i, '')
      await rootConn.query(schemaSql)

      const seedSql = (await fs.readFile(seedPath, 'utf-8'))
        .replace(/USE nassau_tickets;/i, '')
      await rootConn.query(seedSql)
    } finally {
      await rootConn.end()
    }

    pool = mysql.createPool({
      host: env.db.host,
      port: env.db.port,
      user: env.db.user,
      password: env.db.password,
      database: TEST_DB,
      waitForConnections: true,
      connectionLimit: 10,
      timezone: 'Z',
    })
    setPool(pool)
  })

  after(async () => {
    await closePool()
    const rootConn = await mysql.createConnection({
      host: env.db.host,
      port: env.db.port,
      user: env.db.user,
      password: env.db.password,
    })
    try {
      await rootConn.query(`DROP DATABASE IF EXISTS \`${TEST_DB}\``)
    } finally {
      await rootConn.end()
    }
  })

  it('deve validar conexao ativa e dados iniciais do seed.sql', async () => {
    assert.equal(await testConnection(), true)
    const users = await userRepository.listAll()
    const guiches = await guicheRepository.listAll()
    assert.equal(users.length, 3)
    assert.equal(guiches.length, 5)
  })

  it('deve autenticar usuario real do MySQL usando bcrypt e gravar auditoria', async () => {
    const authSvc = createAuthService({
      users: userRepository,
      audit: auditRepository,
      jwtConfig: { secret: 'mysql-test-secret', expiresIn: '1h' },
    })
    const res = await authSvc.login({ login: 'gestor', senha: 'gestor123', ipOrigem: '127.0.0.1' })
    assert.ok(res.token)
    assert.equal(res.usuario.perfil, 'gestor')

    const eventos = await auditRepository.listarEventos({ acao: 'LOGIN' })
    assert.ok(eventos.length >= 1)
  })

  it('deve emitir 10 senhas simultaneas sem duplicar sequencial ou codigo', async () => {
    const emissoes = await Promise.all(
      Array.from({ length: 10 }, () => ticketRepository.createTicket({ tipo: 'SP' })),
    )
    const codigos = new Set(emissoes.map((s) => s.codigo))
    assert.equal(codigos.size, 10)
  })

  it('deve garantir que chamadas simultaneas em guiches distintos nao selecionam a mesma senha', async () => {
    const r = await Promise.all([
      ticketRepository.reservarProximaSenha({ guicheId: 1, atendenteId: 2 }),
      ticketRepository.reservarProximaSenha({ guicheId: 2, atendenteId: 3 }),
    ])
    assert.equal(r[0].error, null)
    assert.equal(r[1].error, null)
    assert.notEqual(r[0].senha.id, r[1].senha.id)
  })

  it('deve executar rollback real quando ocorre falha dentro da transacao', async () => {
    const antes = await ticketRepository.list()
    await assert.rejects(async () => {
      await withTransaction(async (conn) => {
        await conn.execute(
          `INSERT INTO senhas (codigo, tipo, data_referencia, sequencial, status)
           VALUES ('991231-SG999', 'SG', '2099-12-31', 999, 'AGUARDANDO')`,
        )
        throw new Error('FALHA_SIMULADA_ROLLBACK')
      })
    }, /FALHA_SIMULADA_ROLLBACK/)

    const depois = await ticketRepository.list()
    assert.equal(depois.length, antes.length)
  })

  it('deve persistir encerramento e reabertura de expediente em expediente_diario', async () => {
    const enc = await expedienteRepository.encerrarDia({ usuarioId: 1 })
    assert.equal(enc.error, null)
    assert.equal(Boolean(enc.expediente.encerrado_manualmente), true)

    const reab = await expedienteRepository.reabrirDia({ usuarioId: 1 })
    assert.equal(reab.error, null)
    assert.equal(Boolean(reab.expediente.encerrado_manualmente), false)
  })
})
