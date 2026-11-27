import assert from 'node:assert/strict'
import { after, before, describe, it } from 'node:test'
import bcrypt from 'bcryptjs'
import { createApp } from '../src/app.js'
import { createAuditController } from '../src/controllers/auditController.js'
import { createAuthController } from '../src/controllers/authController.js'
import { createGuicheController } from '../src/controllers/guicheController.js'
import { createHealthController } from '../src/controllers/healthController.js'
import { createTicketController } from '../src/controllers/ticketController.js'
import { createUserController } from '../src/controllers/userController.js'
import { createAuthMiddleware } from '../src/middlewares/authMiddleware.js'
import { formatarCodigoSenha } from '../src/repositories/ticketRepository.js'
import { createAuditRoutes } from '../src/routes/auditRoutes.js'
import { createAuthRoutes } from '../src/routes/authRoutes.js'
import { createGuicheRoutes } from '../src/routes/guicheRoutes.js'
import { createHealthRoutes } from '../src/routes/healthRoutes.js'
import { createTicketRoutes } from '../src/routes/ticketRoutes.js'
import { createUserRoutes } from '../src/routes/userRoutes.js'
import { createAuthService } from '../src/services/authService.js'
import { createGuicheService } from '../src/services/guicheService.js'
import { createTicketService } from '../src/services/ticketService.js'
import { createUserService } from '../src/services/userService.js'

function createInMemoryRepos() {
  const gestorHash = bcrypt.hashSync('gestor123', 4)
  const atendenteHash = bcrypt.hashSync('atendente123', 4)

  const usuarios = [
    {
      id: 1,
      nome: 'Gestor do Laboratorio',
      login: 'gestor',
      email: 'gestor@nassautickets.local',
      senha_hash: gestorHash,
      perfil: 'gestor',
      ativo: 1,
    },
    {
      id: 2,
      nome: 'Atendente 01',
      login: 'atendente1',
      email: 'atendente1@nassautickets.local',
      senha_hash: atendenteHash,
      perfil: 'atendente',
      ativo: 1,
    },
    {
      id: 3,
      nome: 'Atendente Inativo',
      login: 'inativo',
      email: 'inativo@nassautickets.local',
      senha_hash: atendenteHash,
      perfil: 'atendente',
      ativo: 0,
    },
  ]

  const guiches = [
    { id: 1, numero: 1, descricao: 'Guiche 01', ativo: 1, atendente_atual_id: null },
    { id: 2, numero: 2, descricao: 'Guiche 02', ativo: 1, atendente_atual_id: null },
  ]

  const senhas = []
  const auditoria = []

  const sanitizeUser = ({ senha_hash: _ignored, ...pub }) => ({ ...pub })

  const userRepo = {
    async findByLogin(login) {
      return usuarios.find((u) => u.login === login) || null
    },
    async findById(id) {
      const user = usuarios.find((u) => u.id === Number(id))
      return user ? sanitizeUser(user) : null
    },
    async countActiveGestores(excludeUserId = null) {
      return usuarios.filter(
        (u) => u.perfil === 'gestor' && u.ativo === 1 && u.id !== excludeUserId,
      ).length
    },
    async listAll() {
      return usuarios.map(sanitizeUser)
    },
    async create({ nome, login, email, senhaHash, perfil }) {
      const created = {
        id: usuarios.length + 1,
        nome,
        login,
        email,
        senha_hash: senhaHash,
        perfil,
        ativo: 1,
      }
      usuarios.push(created)
      return sanitizeUser(created)
    },
    async update(id, fields) {
      const target = usuarios.find((u) => u.id === Number(id))
      if (!target) return null
      Object.assign(target, fields)
      return sanitizeUser(target)
    },
    async setActive(id, ativo) {
      const target = usuarios.find((u) => u.id === Number(id))
      if (!target) return null
      target.ativo = ativo ? 1 : 0
      return sanitizeUser(target)
    },
  }

  const guicheRepo = {
    async listAll({ apenasAtivos = false } = {}) {
      return apenasAtivos ? guiches.filter((g) => g.ativo === 1) : [...guiches]
    },
    async findById(id) {
      return guiches.find((g) => g.id === Number(id)) || null
    },
    async findByNumero(numero) {
      return guiches.find((g) => g.numero === Number(numero)) || null
    },
    async create({ numero, descricao, ativo }) {
      const created = {
        id: guiches.length + 1,
        numero,
        descricao,
        ativo: ativo ? 1 : 0,
        atendente_atual_id: null,
      }
      guiches.push(created)
      return created
    },
    async update(id, fields) {
      const target = guiches.find((g) => g.id === Number(id))
      if (!target) return null
      if (fields.numero !== undefined) target.numero = fields.numero
      if (fields.descricao !== undefined) target.descricao = fields.descricao
      if (fields.ativo !== undefined) target.ativo = fields.ativo ? 1 : 0
      return target
    },
    async assignAtendente(guicheId, usuarioId) {
      const target = guiches.find((g) => g.id === Number(guicheId))
      if (!target) return { error: 'NOT_FOUND' }
      if (!target.ativo) return { error: 'INACTIVE' }
      if (target.atendente_atual_id && target.atendente_atual_id !== usuarioId) {
        return { error: 'OCCUPIED' }
      }
      for (const g of guiches) {
        if (g.atendente_atual_id === usuarioId) g.atendente_atual_id = null
      }
      target.atendente_atual_id = usuarioId
      return { error: null, guiche: target }
    },
    async releaseAtendente(guicheId, usuarioId, { force = false } = {}) {
      const target = guiches.find((g) => g.id === Number(guicheId))
      if (!target) return { error: 'NOT_FOUND' }
      if (!force && target.atendente_atual_id !== null && target.atendente_atual_id !== usuarioId) {
        return { error: 'NOT_OWNER' }
      }
      target.atendente_atual_id = null
      return { error: null, guiche: target }
    },
  }

  const ticketRepo = {
    async createTicket({ tipo, status = 'AGUARDANDO', dataReferencia = '2026-11-26' }) {
      const sameDayType = senhas.filter(
        (s) => s.data_referencia === dataReferencia && s.tipo === tipo,
      )
      const sequencial = sameDayType.length + 1
      const created = {
        id: senhas.length + 1,
        codigo: formatarCodigoSenha(dataReferencia, tipo, sequencial),
        tipo,
        data_referencia: dataReferencia,
        sequencial,
        status,
        guiche_id: null,
        atendente_id: null,
        emitida_em: new Date().toISOString(),
      }
      senhas.push(created)
      return created
    },
    async findById(id) {
      return senhas.find((s) => s.id === Number(id)) || null
    },
    async list({ tipo, status } = {}) {
      return senhas.filter(
        (s) => (!tipo || s.tipo === tipo) && (!status || s.status === status),
      )
    },
    async listPainelChamadas({ limit = 5 } = {}) {
      return senhas.filter((s) => s.status !== 'AGUARDANDO').slice(-limit).reverse()
    },
    async updateById(id, fields) {
      const target = senhas.find((s) => s.id === Number(id))
      if (!target) return null
      if (fields.status !== undefined) target.status = fields.status
      if (fields.guicheId !== undefined) target.guiche_id = fields.guicheId
      if (fields.atendenteId !== undefined) target.atendente_id = fields.atendenteId
      return target
    },
  }

  const auditRepo = {
    async registrarEvento(event) {
      const entry = { id: auditoria.length + 1, ...event, criado_em: new Date().toISOString() }
      auditoria.push(entry)
      return entry.id
    },
    async listarEventos() {
      return [...auditoria].reverse()
    },
  }

  return { userRepo, guicheRepo, ticketRepo, auditRepo }
}

describe('nassauTickets API REST, autenticacao e controle de acesso (Desenvolvedor 1)', () => {
  let server
  let baseUrl
  let dbOnline = true
  let gestorToken
  let atendenteToken

  before(async () => {
    const { userRepo, guicheRepo, ticketRepo, auditRepo } = createInMemoryRepos()
    const jwtSecret = 'test-secret-key'

    const authMiddleware = createAuthMiddleware({
      findUserById: (id) => userRepo.findById(id),
      jwtSecret,
    })

    const authSvc = createAuthService({
      users: userRepo,
      audit: auditRepo,
      jwtConfig: { secret: jwtSecret, expiresIn: '1h' },
    })
    const userSvc = createUserService({ users: userRepo, audit: auditRepo, saltRounds: 4 })
    const guicheSvc = createGuicheService({ guiches: guicheRepo, audit: auditRepo })
    const ticketSvc = createTicketService({ tickets: ticketRepo, audit: auditRepo })

    const app = createApp({
      healthRouter: createHealthRoutes({
        controller: createHealthController({ checkDb: async () => dbOnline }),
      }),
      authRouter: createAuthRoutes({
        controller: createAuthController({ service: authSvc }),
        auth: authMiddleware,
      }),
      userRouter: createUserRoutes({
        controller: createUserController({ service: userSvc }),
        auth: authMiddleware,
      }),
      guicheRouter: createGuicheRoutes({
        controller: createGuicheController({ service: guicheSvc }),
        auth: authMiddleware,
      }),
      ticketRouter: createTicketRoutes({
        controller: createTicketController({ service: ticketSvc }),
        auth: authMiddleware,
      }),
      auditRouter: createAuditRoutes({
        controller: createAuditController({ audit: auditRepo }),
        auth: authMiddleware,
      }),
    })

    await new Promise((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const address = server.address()
        baseUrl = `http://127.0.0.1:${address.port}`
        resolve()
      })
    })
  })

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve))
    }
  })

  async function request(path, { method = 'GET', body = null, token = null } = {}) {
    const headers = {}
    if (body !== null) headers['Content-Type'] = 'application/json'
    if (token) headers.Authorization = `Bearer ${token}`

    const res = await fetch(`${baseUrl}${path}`, {
      method,
      headers,
      body: body !== null ? JSON.stringify(body) : undefined,
    })
    const data = await res.json()
    return { status: res.status, data }
  }

  it('deve formatar o codigo da senha no padrao YYMMDD-PPSQ', () => {
    assert.equal(formatarCodigoSenha('2026-11-26', 'SP', 1), '261126-SP001')
    assert.equal(formatarCodigoSenha('2026-11-26', 'SE', 12), '261126-SE012')
  })

  it('deve responder status do healthcheck conforme disponibilidade do MySQL', async () => {
    dbOnline = true
    const ok = await request('/api/health')
    assert.equal(ok.status, 200)
    assert.equal(ok.data.bancoDados, 'conectado')

    dbOnline = false
    const degraded = await request('/api/health')
    assert.equal(degraded.status, 503)
    assert.equal(degraded.data.bancoDados, 'indisponivel')
    dbOnline = true
  })

  it('deve autenticar gestor e atendente e bloquear credenciais invalidas/inativas', async () => {
    const bad = await request('/api/auth/login', {
      method: 'POST',
      body: { login: 'gestor', senha: 'errada' },
    })
    assert.equal(bad.status, 401)

    const inactive = await request('/api/auth/login', {
      method: 'POST',
      body: { login: 'inativo', senha: 'atendente123' },
    })
    assert.equal(inactive.status, 401)

    const loginGestor = await request('/api/auth/login', {
      method: 'POST',
      body: { login: 'gestor', senha: 'gestor123' },
    })
    assert.equal(loginGestor.status, 200)
    assert.equal(loginGestor.data.usuario.perfil, 'gestor')
    gestorToken = loginGestor.data.token

    const loginAtendente = await request('/api/auth/login', {
      method: 'POST',
      body: { login: 'atendente1', senha: 'atendente123' },
    })
    assert.equal(loginAtendente.status, 200)
    assert.equal(loginAtendente.data.usuario.perfil, 'atendente')
    atendenteToken = loginAtendente.data.token

    const meUnauth = await request('/api/auth/me')
    assert.equal(meUnauth.status, 401)

    const meAuth = await request('/api/auth/me', { token: atendenteToken })
    assert.equal(meAuth.status, 200)
    assert.equal(meAuth.data.usuario.login, 'atendente1')
  })

  it('deve restringir gestao de usuarios e auditoria apenas ao perfil gestor', async () => {
    const deniedList = await request('/api/usuarios', { token: atendenteToken })
    assert.equal(deniedList.status, 403)

    const deniedAudit = await request('/api/auditoria', { token: atendenteToken })
    assert.equal(deniedAudit.status, 403)

    const okList = await request('/api/usuarios', { token: gestorToken })
    assert.equal(okList.status, 200)
    assert.equal(okList.data.usuarios.length, 3)

    // Nao deve permitir segundo gestor ativo
    const secondGestor = await request('/api/usuarios', {
      method: 'POST',
      token: gestorToken,
      body: {
        nome: 'Outro Gestor',
        login: 'gestor2',
        senha: 'Password123',
        perfil: 'gestor',
      },
    })
    assert.equal(secondGestor.status, 409)

    // Deve permitir criar atendente
    const createdAtendente = await request('/api/usuarios', {
      method: 'POST',
      token: gestorToken,
      body: {
        nome: 'Atendente 03',
        login: 'atendente3',
        senha: 'Password123',
        perfil: 'atendente',
      },
    })
    assert.equal(createdAtendente.status, 201)
    assert.equal(createdAtendente.data.usuario.perfil, 'atendente')
  })

  it('deve controlar acesso a guiches e evitar ocupacao simultanea', async () => {
    const createDenied = await request('/api/guiches', {
      method: 'POST',
      token: atendenteToken,
      body: { numero: 3 },
    })
    assert.equal(createDenied.status, 403)

    const createOk = await request('/api/guiches', {
      method: 'POST',
      token: gestorToken,
      body: { numero: 3 },
    })
    assert.equal(createOk.status, 201)

    const ocupar1 = await request('/api/guiches/1/ocupar', {
      method: 'POST',
      token: atendenteToken,
    })
    assert.equal(ocupar1.status, 200)
    assert.equal(ocupar1.data.guiche.atendente_atual_id, 2)

    const ocuparConflito = await request('/api/guiches/1/ocupar', {
      method: 'POST',
      token: gestorToken,
    })
    assert.equal(ocuparConflito.status, 409)
  })

  it('deve permitir emissao anonima no totem e proteger operacoes administrativas de senhas', async () => {
    const invalidTipo = await request('/api/senhas', {
      method: 'POST',
      body: { tipo: 'XX' },
    })
    assert.equal(invalidTipo.status, 400)

    const created = await request('/api/senhas', {
      method: 'POST',
      body: { tipo: 'SP' },
    })
    assert.equal(created.status, 201)
    assert.equal(created.data.senha.codigo, '261126-SP001')

    const painel = await request('/api/senhas/painel')
    assert.equal(painel.status, 200)

    const listUnauth = await request('/api/senhas')
    assert.equal(listUnauth.status, 401)

    const listAuth = await request('/api/senhas', { token: atendenteToken })
    assert.equal(listAuth.status, 200)
    assert.equal(listAuth.data.senhas.length, 1)

    const updateOk = await request('/api/senhas/1/status', {
      method: 'PATCH',
      token: atendenteToken,
      body: { status: 'CHAMADA', guicheId: 1 },
    })
    assert.equal(updateOk.status, 200)
    assert.equal(updateOk.data.senha.status, 'CHAMADA')

    const auditOk = await request('/api/auditoria', { token: gestorToken })
    assert.equal(auditOk.status, 200)
    assert.ok(auditOk.data.eventos.length > 0)
  })
})
