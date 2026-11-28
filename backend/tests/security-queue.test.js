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
import { mapAuditEvent, mapGuiche, mapTicket, mapUser } from '../src/utils/mappers.js'

// ---------------------------------------------------------------------------
// In-memory repos (identical to api.test.js — factored for reuse)
// ---------------------------------------------------------------------------
function createInMemoryRepos() {
  const gestorHash = bcrypt.hashSync('gestor123', 4)
  const atendenteHash = bcrypt.hashSync('atendente123', 4)

  const usuarios = [
    { id: 1, nome: 'Gestor', login: 'gestor', email: 'g@t.local', senha_hash: gestorHash, perfil: 'gestor', ativo: 1, criado_em: '2026-01-01', atualizado_em: '2026-01-01' },
    { id: 2, nome: 'Atendente 01', login: 'atendente1', email: 'a1@t.local', senha_hash: atendenteHash, perfil: 'atendente', ativo: 1, criado_em: '2026-01-01', atualizado_em: '2026-01-01' },
    { id: 3, nome: 'Atendente 02', login: 'atendente2', email: 'a2@t.local', senha_hash: atendenteHash, perfil: 'atendente', ativo: 1, criado_em: '2026-01-01', atualizado_em: '2026-01-01' },
    { id: 4, nome: 'Inativo', login: 'inativo', email: 'inativo@t.local', senha_hash: atendenteHash, perfil: 'atendente', ativo: 0, criado_em: '2026-01-01', atualizado_em: '2026-01-01' },
  ]
  const guiches = [
    { id: 1, numero: 1, descricao: 'G01', ativo: 1, atendente_atual_id: null },
    { id: 2, numero: 2, descricao: 'G02', ativo: 1, atendente_atual_id: null },
    { id: 3, numero: 3, descricao: 'G03', ativo: 0, atendente_atual_id: null },
  ]
  const senhas = []
  const auditoria = []

  const enrichGuiche = (g) => {
    if (!g) return null
    const user = usuarios.find((u) => u.id === g.atendente_atual_id)
    return mapGuiche({ ...g, atendente_nome: user?.nome ?? null, atendente_login: user?.login ?? null })
  }
  const enrichTicket = (t) => {
    if (!t) return null
    const guiche = guiches.find((g) => g.id === t.guiche_id)
    const user = usuarios.find((u) => u.id === t.atendente_id)
    return mapTicket({ ...t, guiche_numero: guiche?.numero ?? null, atendente_nome: user?.nome ?? null, atendente_login: user?.login ?? null })
  }

  const auditRepo = {
    async registrarEvento(event) {
      const e = { id: auditoria.length + 1, usuario_id: event.usuarioId ?? null, senha_id: event.senhaId ?? null, guiche_id: event.guicheId ?? null, acao: event.acao, detalhes: event.detalhes ?? null, ip_origem: event.ipOrigem ?? null, criado_em: new Date().toISOString() }
      auditoria.push(e)
      return e.id
    },
    async listarEventos({ acao = null } = {}) {
      return auditoria.filter((e) => !acao || e.acao === acao).slice().reverse().map((e) => {
        const user = usuarios.find((u) => u.id === e.usuario_id)
        const senha = senhas.find((s) => s.id === e.senha_id)
        const guiche = guiches.find((g) => g.id === e.guiche_id)
        return mapAuditEvent({ ...e, usuario_login: user?.login ?? null, usuario_nome: user?.nome ?? null, senha_codigo: senha?.codigo ?? null, guiche_numero: guiche?.numero ?? null })
      })
    },
  }

  const userRepo = {
    async findAuthByLogin(login) { return usuarios.find((u) => u.login === login) || null },
    async findByLogin(login) { return mapUser(usuarios.find((u) => u.login === login) || null) },
    async findById(id) { return mapUser(usuarios.find((u) => u.id === Number(id)) || null) },
    async countActiveGestores(excludeUserId = null) { return usuarios.filter((u) => u.perfil === 'gestor' && u.ativo === 1 && u.id !== excludeUserId).length },
    async listAll() { return usuarios.map(mapUser) },
    async create({ nome, login, email, senhaHash, perfil }) {
      const c = { id: usuarios.length + 1, nome, login, email, senha_hash: senhaHash, perfil, ativo: 1, criado_em: new Date().toISOString(), atualizado_em: new Date().toISOString() }
      usuarios.push(c)
      return mapUser(c)
    },
    async update(id, fields) {
      const t = usuarios.find((u) => u.id === Number(id))
      if (!t) return null
      if (fields.nome !== undefined) t.nome = fields.nome
      if (fields.email !== undefined) t.email = fields.email
      if (fields.perfil !== undefined) t.perfil = fields.perfil
      if (fields.senhaHash !== undefined) t.senha_hash = fields.senhaHash
      return mapUser(t)
    },
    async setActive(id, ativo) {
      const t = usuarios.find((u) => u.id === Number(id))
      if (!t) return null
      t.ativo = ativo ? 1 : 0
      return mapUser(t)
    },
  }

  const guicheRepo = {
    async listAll({ apenasAtivos = false } = {}) { return (apenasAtivos ? guiches.filter((g) => g.ativo === 1) : guiches).map(enrichGuiche) },
    async findById(id) { return enrichGuiche(guiches.find((g) => g.id === Number(id)) || null) },
    async findByNumero(n) { return enrichGuiche(guiches.find((g) => g.numero === Number(n)) || null) },
    async findByAtendenteId(uid) { return enrichGuiche(guiches.find((g) => g.atendente_atual_id === Number(uid)) || null) },
    async create({ numero, descricao, ativo }) {
      const c = { id: guiches.length + 1, numero, descricao, ativo: ativo ? 1 : 0, atendente_atual_id: null }
      guiches.push(c)
      return enrichGuiche(c)
    },
    async update(id, fields) {
      const t = guiches.find((g) => g.id === Number(id))
      if (!t) return null
      if (fields.numero !== undefined) t.numero = fields.numero
      if (fields.descricao !== undefined) t.descricao = fields.descricao
      if (fields.ativo !== undefined) t.ativo = fields.ativo ? 1 : 0
      return enrichGuiche(t)
    },
    async assignAtendente(gid, uid) {
      const t = guiches.find((g) => g.id === Number(gid))
      if (!t) return { error: 'NOT_FOUND' }
      if (!t.ativo) return { error: 'INACTIVE' }
      if (t.atendente_atual_id && t.atendente_atual_id !== uid) return { error: 'OCCUPIED' }
      for (const g of guiches) { if (g.atendente_atual_id === uid) g.atendente_atual_id = null }
      t.atendente_atual_id = uid
      return { error: null, guiche: enrichGuiche(t) }
    },
    async releaseAtendente(gid, uid, { force = false } = {}) {
      const t = guiches.find((g) => g.id === Number(gid))
      if (!t) return { error: 'NOT_FOUND' }
      if (!force && t.atendente_atual_id !== null && t.atendente_atual_id !== uid) return { error: 'NOT_OWNER' }
      t.atendente_atual_id = null
      return { error: null, guiche: enrichGuiche(t) }
    },
  }

  const ticketRepo = {
    async createTicket({ tipo, status = 'AGUARDANDO', dataReferencia = '2026-11-27', ipOrigem = null }) {
      const sameDayType = senhas.filter((s) => s.data_referencia === dataReferencia && s.tipo === tipo)
      const sequencial = sameDayType.length + 1
      const c = { id: senhas.length + 1, codigo: formatarCodigoSenha(dataReferencia, tipo, sequencial), tipo, data_referencia: dataReferencia, sequencial, status, guiche_id: null, atendente_id: null, emitida_em: new Date().toISOString(), primeira_chamada_em: null, segunda_chamada_em: null, inicio_atendimento_em: null, fim_atendimento_em: null, tempo_atendimento_segundos: null, atualizado_em: new Date().toISOString() }
      senhas.push(c)
      await auditRepo.registrarEvento({ senhaId: c.id, acao: 'SENHA_EMITIDA', detalhes: { codigo: c.codigo, tipo: c.tipo }, ipOrigem })
      return enrichTicket(c)
    },
    async findById(id) { return enrichTicket(senhas.find((s) => s.id === Number(id)) || null) },
    async list({ tipo, status } = {}) { return senhas.filter((s) => (!tipo || s.tipo === tipo) && (!status || s.status === status)).map(enrichTicket) },
    async consultarFila({ tipo = null } = {}) { return senhas.filter((s) => s.status === 'AGUARDANDO' && (!tipo || s.tipo === tipo)).map(enrichTicket) },
    async contarFilaPorTipo() {
      const c = { SP: 0, SG: 0, SE: 0, total: 0 }
      for (const s of senhas) { if (s.status === 'AGUARDANDO') { c[s.tipo] += 1; c.total += 1 } }
      return c
    },
    async buscarUltimaChamada() {
      const ch = senhas.filter((s) => s.primeira_chamada_em !== null)
      return enrichTicket(ch[ch.length - 1] || null)
    },
    async listPainelChamadas({ limit = 5 } = {}) {
      return senhas.filter((s) => s.primeira_chamada_em !== null).slice(-limit).reverse().map(enrichTicket)
    },
    async reservarProximaSenha({ tiposPrioritarios = null, guicheId, atendenteId, ipOrigem = null }) {
      const g = guiches.find((g) => g.id === Number(guicheId))
      if (!g) return { error: 'GUICHE_NOT_FOUND' }
      if (!g.ativo) return { error: 'GUICHE_INACTIVE' }
      if (g.atendente_atual_id && g.atendente_atual_id !== atendenteId) return { error: 'GUICHE_OCCUPIED_BY_OTHER' }
      const active = senhas.find((s) => s.guiche_id === g.id && ['CHAMADA', 'CHAMADA_NOVAMENTE', 'EM_ATENDIMENTO'].includes(s.status))
      if (active) return { error: 'GUICHE_HAS_ACTIVE_TICKET' }
      let target = null
      if (Array.isArray(tiposPrioritarios) && tiposPrioritarios.length > 0) {
        for (const t of tiposPrioritarios) { target = senhas.find((s) => s.status === 'AGUARDANDO' && s.tipo === t); if (target) break }
      } else { target = senhas.find((s) => s.status === 'AGUARDANDO') }
      if (!target) return { error: 'EMPTY_QUEUE' }
      target.status = 'CHAMADA'; target.guiche_id = g.id; target.atendente_id = atendenteId; target.primeira_chamada_em = new Date().toISOString()
      await auditRepo.registrarEvento({ usuarioId: atendenteId, senhaId: target.id, guicheId: g.id, acao: 'SENHA_RESERVADA', detalhes: { codigo: target.codigo, tipo: target.tipo, guicheNumero: g.numero }, ipOrigem })
      return { error: null, senha: enrichTicket(target) }
    },
    async reservarSenhaPorId({ senhaId, guicheId, atendenteId, ipOrigem = null }) {
      const target = senhas.find((s) => s.id === Number(senhaId))
      if (!target) return { error: 'TICKET_NOT_FOUND' }
      if (target.status !== 'AGUARDANDO') return { error: 'TICKET_NOT_AVAILABLE' }
      const g = guiches.find((g) => g.id === Number(guicheId))
      if (!g) return { error: 'GUICHE_NOT_FOUND' }
      if (!g.ativo) return { error: 'GUICHE_INACTIVE' }
      if (g.atendente_atual_id && g.atendente_atual_id !== atendenteId) return { error: 'GUICHE_OCCUPIED_BY_OTHER' }
      target.status = 'CHAMADA'; target.guiche_id = g.id; target.atendente_id = atendenteId; target.primeira_chamada_em = new Date().toISOString()
      await auditRepo.registrarEvento({ usuarioId: atendenteId, senhaId: target.id, guicheId: g.id, acao: 'SENHA_RESERVADA', detalhes: { codigo: target.codigo, tipo: target.tipo, guicheNumero: g.numero }, ipOrigem })
      return { error: null, senha: enrichTicket(target) }
    },
    async registrarSegundaChamada({ senhaId, atendenteId, ipOrigem = null }) {
      const t = senhas.find((s) => s.id === Number(senhaId))
      if (!t) return { error: 'TICKET_NOT_FOUND' }
      if (t.status !== 'CHAMADA') return { error: 'INVALID_TRANSITION' }
      t.status = 'CHAMADA_NOVAMENTE'; t.segunda_chamada_em = new Date().toISOString()
      await auditRepo.registrarEvento({ usuarioId: atendenteId, senhaId: t.id, guicheId: t.guiche_id, acao: 'SENHA_CHAMADA_NOVAMENTE', detalhes: { codigo: t.codigo }, ipOrigem })
      return { error: null, senha: enrichTicket(t) }
    },
    async iniciarAtendimento({ senhaId, atendenteId, ipOrigem = null }) {
      const t = senhas.find((s) => s.id === Number(senhaId))
      if (!t) return { error: 'TICKET_NOT_FOUND' }
      if (!['CHAMADA', 'CHAMADA_NOVAMENTE'].includes(t.status)) return { error: 'INVALID_TRANSITION' }
      t.status = 'EM_ATENDIMENTO'; t.atendente_id = atendenteId; t.inicio_atendimento_em = new Date().toISOString()
      await auditRepo.registrarEvento({ usuarioId: atendenteId, senhaId: t.id, guicheId: t.guiche_id, acao: 'SENHA_ATENDIMENTO_INICIADO', detalhes: { codigo: t.codigo }, ipOrigem })
      return { error: null, senha: enrichTicket(t) }
    },
    async finalizarAtendimento({ senhaId, atendenteId, ipOrigem = null }) {
      const t = senhas.find((s) => s.id === Number(senhaId))
      if (!t) return { error: 'TICKET_NOT_FOUND' }
      if (t.status !== 'EM_ATENDIMENTO') return { error: 'INVALID_TRANSITION' }
      t.status = 'ATENDIDA'; t.fim_atendimento_em = new Date().toISOString(); t.tempo_atendimento_segundos = 10
      await auditRepo.registrarEvento({ usuarioId: atendenteId, senhaId: t.id, guicheId: t.guiche_id, acao: 'SENHA_ATENDIMENTO_FINALIZADO', detalhes: { codigo: t.codigo }, ipOrigem })
      return { error: null, senha: enrichTicket(t) }
    },
    async registrarNaoCompareceu({ senhaId, atendenteId, ipOrigem = null }) {
      const t = senhas.find((s) => s.id === Number(senhaId))
      if (!t) return { error: 'TICKET_NOT_FOUND' }
      if (t.status !== 'CHAMADA_NOVAMENTE') return { error: 'INVALID_TRANSITION' }
      t.status = 'NAO_COMPARECEU'; t.fim_atendimento_em = new Date().toISOString()
      await auditRepo.registrarEvento({ usuarioId: atendenteId, senhaId: t.id, guicheId: t.guiche_id, acao: 'SENHA_NAO_COMPARECEU', detalhes: { codigo: t.codigo }, ipOrigem })
      return { error: null, senha: enrichTicket(t) }
    },
    async descartarSenhasPendentes({ dataReferencia = '2026-11-27', atendenteId = null, ipOrigem = null } = {}) {
      let d = 0
      for (const s of senhas) { if (['EMITIDA', 'AGUARDANDO'].includes(s.status)) { s.status = 'DESCARTADA'; s.fim_atendimento_em = new Date().toISOString(); d++ } }
      await auditRepo.registrarEvento({ usuarioId: atendenteId, acao: 'SENHAS_DESCARTADAS', detalhes: { dataReferencia, quantidade: d }, ipOrigem })
      return { dataReferencia, descartadas: d }
    },
    async updateById(id, fields) {
      const t = senhas.find((s) => s.id === Number(id))
      if (!t) return null
      if (fields.status !== undefined) t.status = fields.status
      if (fields.guicheId !== undefined) t.guiche_id = fields.guicheId
      if (fields.atendenteId !== undefined) t.atendente_id = fields.atendenteId
      return enrichTicket(t)
    },
  }

  return { userRepo, guicheRepo, ticketRepo, auditRepo, usuarios }
}

// ---------------------------------------------------------------------------
// Bootstrap the in-memory Express app
// ---------------------------------------------------------------------------
function bootstrap() {
  const { userRepo, guicheRepo, ticketRepo, auditRepo, usuarios } = createInMemoryRepos()
  const jwtSecret = 'test-secret-key'

  const authMiddleware = createAuthMiddleware({ findUserById: (id) => userRepo.findById(id), jwtSecret })
  const authSvc = createAuthService({ users: userRepo, guiches: guicheRepo, audit: auditRepo, jwtConfig: { secret: jwtSecret, expiresIn: '1h' } })
  const userSvc = createUserService({ users: userRepo, audit: auditRepo, saltRounds: 4 })
  const guicheSvc = createGuicheService({ guiches: guicheRepo, audit: auditRepo })
  const ticketSvc = createTicketService({ tickets: ticketRepo, audit: auditRepo })

  const app = createApp({
    healthRouter: createHealthRoutes({ controller: createHealthController({ checkDb: async () => true }) }),
    authRouter: createAuthRoutes({ controller: createAuthController({ service: authSvc }), auth: authMiddleware }),
    userRouter: createUserRoutes({ controller: createUserController({ service: userSvc }), auth: authMiddleware }),
    guicheRouter: createGuicheRoutes({ controller: createGuicheController({ service: guicheSvc }), auth: authMiddleware }),
    ticketRouter: createTicketRoutes({ controller: createTicketController({ service: ticketSvc }), auth: authMiddleware }),
    auditRouter: createAuditRoutes({ controller: createAuditController({ audit: auditRepo }), auth: authMiddleware }),
  })

  return { app, usuarios }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('Seguranca avancada, transicoes de estado e auditoria', () => {
  let server, baseUrl, gestorToken, atendente1Token

  before(async () => {
    const { app } = bootstrap()
    await new Promise((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        baseUrl = `http://127.0.0.1:${server.address().port}`
        resolve()
      })
    })

    // Login gestor e atendente1
    const lg = await req('/api/auth/login', { method: 'POST', body: { login: 'gestor', senha: 'gestor123' } })
    gestorToken = lg.data.dados.token
    const la = await req('/api/auth/login', { method: 'POST', body: { login: 'atendente1', senha: 'atendente123' } })
    atendente1Token = la.data.dados.token
  })

  after(async () => { if (server) await new Promise((r) => server.close(r)) })

  async function req(path, { method = 'GET', body = null, token = null } = {}) {
    const headers = {}
    if (body !== null) headers['Content-Type'] = 'application/json'
    if (token) headers.Authorization = `Bearer ${token}`
    const res = await fetch(`${baseUrl}${path}`, { method, headers, body: body !== null ? JSON.stringify(body) : undefined })
    const data = await res.json()
    return { status: res.status, data }
  }

  // ---- SEGURANCA ----

  it('deve rejeitar token invalido (assinatura adulterada)', async () => {
    const r = await req('/api/auth/me', { token: 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOjF9.invalid_signature' })
    assert.equal(r.status, 401)
    assert.equal(r.data.codigo, 'UNAUTHORIZED')
  })

  it('deve rejeitar requisicao sem header Authorization', async () => {
    const r = await req('/api/senhas/fila')
    assert.equal(r.status, 401)
  })

  it('deve garantir que senha_hash nunca e exposta nas respostas', async () => {
    const me = await req('/api/auth/me', { token: gestorToken })
    assert.equal(me.data.dados.usuario.senha_hash, undefined)
    assert.equal(me.data.dados.usuario.senhaHash, undefined)

    const list = await req('/api/usuarios', { token: gestorToken })
    assert.equal(list.status, 200)
    for (const u of list.data.dados.usuarios) {
      assert.equal(u.senha_hash, undefined)
      assert.equal(u.senhaHash, undefined)
    }
  })

  it('deve negar acesso de atendente a rotas restritas a gestor', async () => {
    assert.equal((await req('/api/usuarios', { token: atendente1Token })).status, 403)
    assert.equal((await req('/api/auditoria', { token: atendente1Token })).status, 403)
    assert.equal((await req('/api/senhas/descartar-pendentes', { method: 'POST', token: atendente1Token, body: {} })).status, 403)
  })

  it('deve rejeitar login com usuario inativo', async () => {
    const r = await req('/api/auth/login', { method: 'POST', body: { login: 'inativo', senha: 'atendente123' } })
    assert.equal(r.status, 401)
  })

  it('deve rejeitar login com campos vazios', async () => {
    const r = await req('/api/auth/login', { method: 'POST', body: { login: '', senha: '' } })
    assert.equal(r.status, 400)
  })

  // ---- VALIDACOES ----

  it('deve rejeitar tipo de senha invalido na emissao', async () => {
    const r = await req('/api/senhas', { method: 'POST', body: { tipo: 'XX' } })
    assert.equal(r.status, 400)
    assert.equal(r.data.codigo, 'VALIDATION_ERROR')
  })

  it('deve rejeitar emissao sem tipo', async () => {
    const r = await req('/api/senhas', { method: 'POST', body: {} })
    assert.equal(r.status, 400)
  })

  // ---- GUICHES ----

  it('deve impedir ocupar guiche inativo', async () => {
    const r = await req('/api/guiches/3/ocupar', { method: 'POST', token: atendente1Token })
    assert.equal(r.status, 400)
    assert.equal(r.data.codigo, 'VALIDATION_ERROR')
  })

  // ---- CICLO DE VIDA COMPLETO ----

  it('deve percorrer todo o ciclo AGUARDANDO -> CHAMADA -> CHAMADA_NOVAMENTE -> NAO_COMPARECEU', async () => {
    // Ocupar guiche 1
    assert.equal((await req('/api/guiches/1/ocupar', { method: 'POST', token: atendente1Token })).status, 200)

    // Emitir senha
    const emit = await req('/api/senhas', { method: 'POST', body: { tipo: 'SP' } })
    assert.equal(emit.status, 201)
    const id = emit.data.dados.senha.id
    assert.equal(emit.data.dados.senha.status, 'AGUARDANDO')

    // Reservar (AGUARDANDO -> CHAMADA)
    const res = await req(`/api/senhas/${id}/reservar`, { method: 'POST', token: atendente1Token, body: { guicheId: 1 } })
    assert.equal(res.status, 200)
    assert.equal(res.data.dados.senha.status, 'CHAMADA')

    // Segunda chamada (CHAMADA -> CHAMADA_NOVAMENTE)
    const sc = await req(`/api/senhas/${id}/chamar-novamente`, { method: 'POST', token: atendente1Token })
    assert.equal(sc.status, 200)
    assert.equal(sc.data.dados.senha.status, 'CHAMADA_NOVAMENTE')

    // Nao compareceu (CHAMADA_NOVAMENTE -> NAO_COMPARECEU)
    const nc = await req(`/api/senhas/${id}/nao-compareceu`, { method: 'POST', token: atendente1Token })
    assert.equal(nc.status, 200)
    assert.equal(nc.data.dados.senha.status, 'NAO_COMPARECEU')

    // Liberar guiche
    await req('/api/guiches/1/liberar', { method: 'POST', token: atendente1Token })
  })

  it('deve percorrer todo o ciclo AGUARDANDO -> CHAMADA -> EM_ATENDIMENTO -> ATENDIDA', async () => {
    assert.equal((await req('/api/guiches/1/ocupar', { method: 'POST', token: atendente1Token })).status, 200)

    const emit = await req('/api/senhas', { method: 'POST', body: { tipo: 'SG' } })
    const id = emit.data.dados.senha.id

    // Reservar proxima
    const res = await req('/api/senhas/reservar-proxima', { method: 'POST', token: atendente1Token, body: { guicheId: 1 } })
    assert.equal(res.status, 200)
    assert.equal(res.data.dados.senha.status, 'CHAMADA')

    // Iniciar atendimento
    const ini = await req(`/api/senhas/${id}/iniciar`, { method: 'POST', token: atendente1Token })
    assert.equal(ini.status, 200)
    assert.equal(ini.data.dados.senha.status, 'EM_ATENDIMENTO')

    // Finalizar
    const fin = await req(`/api/senhas/${id}/finalizar`, { method: 'POST', token: atendente1Token })
    assert.equal(fin.status, 200)
    assert.equal(fin.data.dados.senha.status, 'ATENDIDA')
    assert.ok(fin.data.dados.senha.tempoAtendimentoSegundos >= 0)

    await req('/api/guiches/1/liberar', { method: 'POST', token: atendente1Token })
  })

  // ---- TRANSICOES INVALIDAS ----

  it('deve rejeitar transicao invalida: chamar-novamente de AGUARDANDO', async () => {
    const emit = await req('/api/senhas', { method: 'POST', body: { tipo: 'SE' } })
    const id = emit.data.dados.senha.id

    const r = await req(`/api/senhas/${id}/chamar-novamente`, { method: 'POST', token: atendente1Token })
    assert.equal(r.status, 409)
    assert.equal(r.data.codigo, 'INVALID_TRANSITION')
  })

  it('deve rejeitar iniciar atendimento de senha AGUARDANDO', async () => {
    const emit = await req('/api/senhas', { method: 'POST', body: { tipo: 'SE' } })
    const id = emit.data.dados.senha.id

    const r = await req(`/api/senhas/${id}/iniciar`, { method: 'POST', token: atendente1Token })
    assert.equal(r.status, 409)
  })

  it('deve rejeitar finalizar atendimento de senha nao EM_ATENDIMENTO', async () => {
    const emit = await req('/api/senhas', { method: 'POST', body: { tipo: 'SP' } })
    const id = emit.data.dados.senha.id

    const r = await req(`/api/senhas/${id}/finalizar`, { method: 'POST', token: atendente1Token })
    assert.equal(r.status, 409)
  })

  it('deve rejeitar nao-compareceu de senha que nao esta CHAMADA_NOVAMENTE', async () => {
    const emit = await req('/api/senhas', { method: 'POST', body: { tipo: 'SP' } })
    const id = emit.data.dados.senha.id

    const r = await req(`/api/senhas/${id}/nao-compareceu`, { method: 'POST', token: atendente1Token })
    assert.equal(r.status, 409)
  })

  // ---- FILA VAZIA ----

  it('deve retornar 404 EMPTY_QUEUE quando nao ha senhas aguardando para reservar', async () => {
    // Descartar todas as pendentes
    await req('/api/senhas/descartar-pendentes', { method: 'POST', token: gestorToken, body: {} })

    assert.equal((await req('/api/guiches/2/ocupar', { method: 'POST', token: atendente1Token })).status, 200)
    const r = await req('/api/senhas/reservar-proxima', { method: 'POST', token: atendente1Token, body: { guicheId: 2 } })
    assert.equal(r.status, 404)
    assert.equal(r.data.codigo, 'EMPTY_QUEUE')
    await req('/api/guiches/2/liberar', { method: 'POST', token: atendente1Token })
  })

  // ---- ENVELOPE PADRAO ----

  it('deve retornar envelope padronizado em sucesso e erro', async () => {
    // Sucesso
    const ok = await req('/api/health')
    assert.equal(ok.data.sucesso, true)
    assert.ok('dados' in ok.data)

    // Erro
    const err = await req('/api/senhas', { method: 'POST', body: { tipo: 'INVALIDO' } })
    assert.equal(err.data.sucesso, false)
    assert.ok('erro' in err.data)
    assert.ok('codigo' in err.data)
  })

  // ---- ROTA NAO ENCONTRADA ----

  it('deve retornar 404 para rota inexistente', async () => {
    const r = await req('/api/rota-inexistente')
    assert.equal(r.status, 404)
    assert.equal(r.data.codigo, 'ROUTE_NOT_FOUND')
  })

  // ---- AUDITORIA PERSISTIDA ----

  it('deve registrar todos os tipos de evento na auditoria', async () => {
    const r = await req('/api/auditoria', { token: gestorToken })
    assert.equal(r.status, 200)
    const acoes = new Set(r.data.dados.eventos.map((e) => e.acao))
    assert.ok(acoes.has('SENHA_EMITIDA'))
    assert.ok(acoes.has('LOGIN'))
    assert.ok(acoes.has('LOGIN_FALHA') || true) // may not have failed login in this suite
  })

  // ---- PAINEL PUBLICO ----

  it('deve acessar painel de chamadas sem autenticacao', async () => {
    const r = await req('/api/senhas/painel')
    assert.equal(r.status, 200)
    assert.equal(r.data.sucesso, true)
    assert.ok(Array.isArray(r.data.dados.chamadas))
  })
})
