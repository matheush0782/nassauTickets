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
      criado_em: '2026-11-27T08:00:00.000Z',
      atualizado_em: '2026-11-27T08:00:00.000Z',
    },
    {
      id: 2,
      nome: 'Atendente 01',
      login: 'atendente1',
      email: 'atendente1@nassautickets.local',
      senha_hash: atendenteHash,
      perfil: 'atendente',
      ativo: 1,
      criado_em: '2026-11-27T08:00:00.000Z',
      atualizado_em: '2026-11-27T08:00:00.000Z',
    },
    {
      id: 3,
      nome: 'Atendente 02',
      login: 'atendente2',
      email: 'atendente2@nassautickets.local',
      senha_hash: atendenteHash,
      perfil: 'atendente',
      ativo: 1,
      criado_em: '2026-11-27T08:00:00.000Z',
      atualizado_em: '2026-11-27T08:00:00.000Z',
    },
    {
      id: 4,
      nome: 'Atendente Inativo',
      login: 'inativo',
      email: 'inativo@nassautickets.local',
      senha_hash: atendenteHash,
      perfil: 'atendente',
      ativo: 0,
      criado_em: '2026-11-27T08:00:00.000Z',
      atualizado_em: '2026-11-27T08:00:00.000Z',
    },
  ]

  const guiches = [
    { id: 1, numero: 1, descricao: 'Guiche 01', ativo: 1, atendente_atual_id: null },
    { id: 2, numero: 2, descricao: 'Guiche 02', ativo: 1, atendente_atual_id: null },
  ]

  const senhas = []
  const auditoria = []

  const enrichGuiche = (g) => {
    if (!g) return null
    const user = usuarios.find((u) => u.id === g.atendente_atual_id)
    return mapGuiche({
      ...g,
      atendente_nome: user?.nome ?? null,
      atendente_login: user?.login ?? null,
    })
  }

  const enrichTicket = (t) => {
    if (!t) return null
    const guiche = guiches.find((g) => g.id === t.guiche_id)
    const user = usuarios.find((u) => u.id === t.atendente_id)
    return mapTicket({
      ...t,
      guiche_numero: guiche?.numero ?? null,
      atendente_nome: user?.nome ?? null,
      atendente_login: user?.login ?? null,
    })
  }

  const auditRepo = {
    async registrarEvento(event) {
      const entry = {
        id: auditoria.length + 1,
        usuario_id: event.usuarioId ?? null,
        senha_id: event.senhaId ?? null,
        guiche_id: event.guicheId ?? null,
        acao: event.acao,
        detalhes: event.detalhes ?? null,
        ip_origem: event.ipOrigem ?? null,
        criado_em: new Date().toISOString(),
      }
      auditoria.push(entry)
      return entry.id
    },
    async listarEventos({ acao = null } = {}) {
      return auditoria
        .filter((e) => !acao || e.acao === acao)
        .slice()
        .reverse()
        .map((e) => {
          const user = usuarios.find((u) => u.id === e.usuario_id)
          const senha = senhas.find((s) => s.id === e.senha_id)
          const guiche = guiches.find((g) => g.id === e.guiche_id)
          return mapAuditEvent({
            ...e,
            usuario_login: user?.login ?? null,
            usuario_nome: user?.nome ?? null,
            senha_codigo: senha?.codigo ?? null,
            guiche_numero: guiche?.numero ?? null,
          })
        })
    },
  }

  const userRepo = {
    async findAuthByLogin(login) {
      return usuarios.find((u) => u.login === login) || null
    },
    async findByLogin(login) {
      return mapUser(usuarios.find((u) => u.login === login) || null)
    },
    async findById(id) {
      return mapUser(usuarios.find((u) => u.id === Number(id)) || null)
    },
    async countActiveGestores(excludeUserId = null) {
      return usuarios.filter(
        (u) => u.perfil === 'gestor' && u.ativo === 1 && u.id !== excludeUserId,
      ).length
    },
    async listAll() {
      return usuarios.map(mapUser)
    },
    async create({ nome, login, email, senhaHash, perfil }) {
      const now = new Date().toISOString()
      const created = {
        id: usuarios.length + 1,
        nome,
        login,
        email,
        senha_hash: senhaHash,
        perfil,
        ativo: 1,
        criado_em: now,
        atualizado_em: now,
      }
      usuarios.push(created)
      return mapUser(created)
    },
    async update(id, fields) {
      const target = usuarios.find((u) => u.id === Number(id))
      if (!target) return null
      if (fields.nome !== undefined) target.nome = fields.nome
      if (fields.email !== undefined) target.email = fields.email
      if (fields.perfil !== undefined) target.perfil = fields.perfil
      if (fields.senhaHash !== undefined) target.senha_hash = fields.senhaHash
      target.atualizado_em = new Date().toISOString()
      return mapUser(target)
    },
    async setActive(id, ativo) {
      const target = usuarios.find((u) => u.id === Number(id))
      if (!target) return null
      target.ativo = ativo ? 1 : 0
      return mapUser(target)
    },
  }

  const guicheRepo = {
    async listAll({ apenasAtivos = false } = {}) {
      return (apenasAtivos ? guiches.filter((g) => g.ativo === 1) : guiches).map(enrichGuiche)
    },
    async findById(id) {
      return enrichGuiche(guiches.find((g) => g.id === Number(id)) || null)
    },
    async findByNumero(numero) {
      return enrichGuiche(guiches.find((g) => g.numero === Number(numero)) || null)
    },
    async findByAtendenteId(usuarioId) {
      return enrichGuiche(guiches.find((g) => g.atendente_atual_id === Number(usuarioId)) || null)
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
      return enrichGuiche(created)
    },
    async update(id, fields) {
      const target = guiches.find((g) => g.id === Number(id))
      if (!target) return null
      if (fields.numero !== undefined) target.numero = fields.numero
      if (fields.descricao !== undefined) target.descricao = fields.descricao
      if (fields.ativo !== undefined) target.ativo = fields.ativo ? 1 : 0
      return enrichGuiche(target)
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
      return { error: null, guiche: enrichGuiche(target) }
    },
    async releaseAtendente(guicheId, usuarioId, { force = false } = {}) {
      const target = guiches.find((g) => g.id === Number(guicheId))
      if (!target) return { error: 'NOT_FOUND' }
      if (!force && target.atendente_atual_id !== null && target.atendente_atual_id !== usuarioId) {
        return { error: 'NOT_OWNER' }
      }
      target.atendente_atual_id = null
      return { error: null, guiche: enrichGuiche(target) }
    },
  }

  const ticketRepo = {
    async createTicket({ tipo, status = 'AGUARDANDO', dataReferencia = '2026-11-27', ipOrigem = null }) {
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
        primeira_chamada_em: null,
        segunda_chamada_em: null,
        inicio_atendimento_em: null,
        fim_atendimento_em: null,
        tempo_atendimento_segundos: null,
        atualizado_em: new Date().toISOString(),
      }
      senhas.push(created)
      await auditRepo.registrarEvento({
        senhaId: created.id,
        acao: 'SENHA_EMITIDA',
        detalhes: { codigo: created.codigo, tipo: created.tipo },
        ipOrigem,
      })
      return enrichTicket(created)
    },
    async findById(id) {
      return enrichTicket(senhas.find((s) => s.id === Number(id)) || null)
    },
    async list({ tipo, status } = {}) {
      return senhas
        .filter((s) => (!tipo || s.tipo === tipo) && (!status || s.status === status))
        .map(enrichTicket)
    },
    async consultarFila({ tipo = null } = {}) {
      return senhas
        .filter((s) => s.status === 'AGUARDANDO' && (!tipo || s.tipo === tipo))
        .map(enrichTicket)
    },
    async contarFilaPorTipo() {
      const contagem = { SP: 0, SG: 0, SE: 0, total: 0 }
      for (const s of senhas) {
        if (s.status === 'AGUARDANDO') {
          contagem[s.tipo] += 1
          contagem.total += 1
        }
      }
      return contagem
    },
    async buscarUltimaChamada() {
      const chamadas = senhas.filter((s) => s.primeira_chamada_em !== null)
      return enrichTicket(chamadas[chamadas.length - 1] || null)
    },
    async listPainelChamadas({ limit = 5 } = {}) {
      return senhas
        .filter((s) => s.primeira_chamada_em !== null)
        .slice(-limit)
        .reverse()
        .map(enrichTicket)
    },
    async reservarProximaSenha({ tiposPrioritarios = null, guicheId, atendenteId, ipOrigem = null }) {
      const guiche = guiches.find((g) => g.id === Number(guicheId))
      if (!guiche) return { error: 'GUICHE_NOT_FOUND' }
      if (!guiche.ativo) return { error: 'GUICHE_INACTIVE' }
      if (guiche.atendente_atual_id && guiche.atendente_atual_id !== atendenteId) {
        return { error: 'GUICHE_OCCUPIED_BY_OTHER' }
      }
      const activeAtGuiche = senhas.find(
        (s) =>
          s.guiche_id === guiche.id &&
          ['CHAMADA', 'CHAMADA_NOVAMENTE', 'EM_ATENDIMENTO'].includes(s.status),
      )
      if (activeAtGuiche) return { error: 'GUICHE_HAS_ACTIVE_TICKET' }

      let target = null
      if (Array.isArray(tiposPrioritarios) && tiposPrioritarios.length > 0) {
        for (const tipo of tiposPrioritarios) {
          target = senhas.find((s) => s.status === 'AGUARDANDO' && s.tipo === tipo)
          if (target) break
        }
      } else {
        target = senhas.find((s) => s.status === 'AGUARDANDO')
      }

      if (!target) return { error: 'EMPTY_QUEUE' }

      target.status = 'CHAMADA'
      target.guiche_id = guiche.id
      target.atendente_id = atendenteId
      target.primeira_chamada_em = new Date().toISOString()

      await auditRepo.registrarEvento({
        usuarioId: atendenteId,
        senhaId: target.id,
        guicheId: guiche.id,
        acao: 'SENHA_RESERVADA',
        detalhes: { codigo: target.codigo, tipo: target.tipo, guicheNumero: guiche.numero },
        ipOrigem,
      })

      return { error: null, senha: enrichTicket(target) }
    },
    async reservarSenhaPorId({ senhaId, guicheId, atendenteId, ipOrigem = null }) {
      const target = senhas.find((s) => s.id === Number(senhaId))
      if (!target) return { error: 'TICKET_NOT_FOUND' }
      if (target.status !== 'AGUARDANDO') return { error: 'TICKET_NOT_AVAILABLE' }

      const guiche = guiches.find((g) => g.id === Number(guicheId))
      if (!guiche) return { error: 'GUICHE_NOT_FOUND' }
      if (!guiche.ativo) return { error: 'GUICHE_INACTIVE' }
      if (guiche.atendente_atual_id && guiche.atendente_atual_id !== atendenteId) {
        return { error: 'GUICHE_OCCUPIED_BY_OTHER' }
      }

      target.status = 'CHAMADA'
      target.guiche_id = guiche.id
      target.atendente_id = atendenteId
      target.primeira_chamada_em = new Date().toISOString()

      await auditRepo.registrarEvento({
        usuarioId: atendenteId,
        senhaId: target.id,
        guicheId: guiche.id,
        acao: 'SENHA_RESERVADA',
        detalhes: { codigo: target.codigo, tipo: target.tipo, guicheNumero: guiche.numero },
        ipOrigem,
      })

      return { error: null, senha: enrichTicket(target) }
    },
    async registrarSegundaChamada({ senhaId, atendenteId, ipOrigem = null }) {
      const target = senhas.find((s) => s.id === Number(senhaId))
      if (!target) return { error: 'TICKET_NOT_FOUND' }
      if (target.status !== 'CHAMADA') return { error: 'INVALID_TRANSITION' }
      target.status = 'CHAMADA_NOVAMENTE'
      target.segunda_chamada_em = new Date().toISOString()
      await auditRepo.registrarEvento({
        usuarioId: atendenteId,
        senhaId: target.id,
        guicheId: target.guiche_id,
        acao: 'SENHA_CHAMADA_NOVAMENTE',
        detalhes: { codigo: target.codigo },
        ipOrigem,
      })
      return { error: null, senha: enrichTicket(target) }
    },
    async iniciarAtendimento({ senhaId, atendenteId, ipOrigem = null }) {
      const target = senhas.find((s) => s.id === Number(senhaId))
      if (!target) return { error: 'TICKET_NOT_FOUND' }
      if (!['CHAMADA', 'CHAMADA_NOVAMENTE'].includes(target.status)) {
        return { error: 'INVALID_TRANSITION' }
      }
      target.status = 'EM_ATENDIMENTO'
      target.atendente_id = atendenteId
      target.inicio_atendimento_em = new Date().toISOString()
      await auditRepo.registrarEvento({
        usuarioId: atendenteId,
        senhaId: target.id,
        guicheId: target.guiche_id,
        acao: 'SENHA_ATENDIMENTO_INICIADO',
        detalhes: { codigo: target.codigo },
        ipOrigem,
      })
      return { error: null, senha: enrichTicket(target) }
    },
    async finalizarAtendimento({ senhaId, atendenteId, ipOrigem = null }) {
      const target = senhas.find((s) => s.id === Number(senhaId))
      if (!target) return { error: 'TICKET_NOT_FOUND' }
      if (target.status !== 'EM_ATENDIMENTO') return { error: 'INVALID_TRANSITION' }
      target.status = 'ATENDIDA'
      target.fim_atendimento_em = new Date().toISOString()
      target.tempo_atendimento_segundos = 10
      await auditRepo.registrarEvento({
        usuarioId: atendenteId,
        senhaId: target.id,
        guicheId: target.guiche_id,
        acao: 'SENHA_ATENDIMENTO_FINALIZADO',
        detalhes: { codigo: target.codigo },
        ipOrigem,
      })
      return { error: null, senha: enrichTicket(target) }
    },
    async registrarNaoCompareceu({ senhaId, atendenteId, ipOrigem = null }) {
      const target = senhas.find((s) => s.id === Number(senhaId))
      if (!target) return { error: 'TICKET_NOT_FOUND' }
      if (target.status !== 'CHAMADA_NOVAMENTE') return { error: 'INVALID_TRANSITION' }
      target.status = 'NAO_COMPARECEU'
      target.fim_atendimento_em = new Date().toISOString()
      await auditRepo.registrarEvento({
        usuarioId: atendenteId,
        senhaId: target.id,
        guicheId: target.guiche_id,
        acao: 'SENHA_NAO_COMPARECEU',
        detalhes: { codigo: target.codigo },
        ipOrigem,
      })
      return { error: null, senha: enrichTicket(target) }
    },
    async descartarSenhasPendentes({ dataReferencia = '2026-11-27', atendenteId = null, ipOrigem = null } = {}) {
      let descartadas = 0
      for (const s of senhas) {
        if (['EMITIDA', 'AGUARDANDO'].includes(s.status)) {
          s.status = 'DESCARTADA'
          s.fim_atendimento_em = new Date().toISOString()
          descartadas += 1
        }
      }
      await auditRepo.registrarEvento({
        usuarioId: atendenteId,
        acao: 'SENHAS_DESCARTADAS',
        detalhes: { dataReferencia, quantidade: descartadas },
        ipOrigem,
      })
      return { dataReferencia, descartadas }
    },
    async updateById(id, fields) {
      const target = senhas.find((s) => s.id === Number(id))
      if (!target) return null
      if (fields.status !== undefined) target.status = fields.status
      if (fields.guicheId !== undefined) target.guiche_id = fields.guicheId
      if (fields.atendenteId !== undefined) target.atendente_id = fields.atendenteId
      return enrichTicket(target)
    },
  }

  return { userRepo, guicheRepo, ticketRepo, auditRepo, usuarios }
}

describe('nassauTickets API REST - Seguranca, Persistencia, Fila e Contrato', () => {
  let server
  let baseUrl
  let dbOnline = true
  let gestorToken
  let atendente1Token
  let atendente2Token
  let usuariosRef

  before(async () => {
    const { userRepo, guicheRepo, ticketRepo, auditRepo, usuarios } = createInMemoryRepos()
    usuariosRef = usuarios
    const jwtSecret = 'test-secret-key'

    const authMiddleware = createAuthMiddleware({
      findUserById: (id) => userRepo.findById(id),
      jwtSecret,
    })

    const authSvc = createAuthService({
      users: userRepo,
      guiches: guicheRepo,
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
    assert.equal(formatarCodigoSenha('2026-11-27', 'SP', 1), '261127-SP001')
    assert.equal(formatarCodigoSenha('2026-11-27', 'SE', 12), '261127-SE012')
  })

  it('deve responder healthcheck no envelope padrao conforme disponibilidade do MySQL', async () => {
    dbOnline = true
    const ok = await request('/api/health')
    assert.equal(ok.status, 200)
    assert.equal(ok.data.sucesso, true)
    assert.equal(ok.data.dados.bancoDados, 'conectado')

    dbOnline = false
    const degraded = await request('/api/health')
    assert.equal(degraded.status, 503)
    assert.equal(degraded.data.sucesso, false)
    assert.equal(degraded.data.codigo, 'DATABASE_UNAVAILABLE')
    dbOnline = true
  })

  it('deve validar login, hash de senha, JWT e registrar falhas e sucessos na auditoria', async () => {
    // Senhas armazenadas em hash bcrypt (nunca texto puro)
    for (const u of usuariosRef) {
      assert.ok(u.senha_hash.startsWith('$2'))
    }

    const bad = await request('/api/auth/login', {
      method: 'POST',
      body: { login: 'gestor', senha: 'errada' },
    })
    assert.equal(bad.status, 401)
    assert.equal(bad.data.sucesso, false)

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
    assert.equal(loginGestor.data.sucesso, true)
    assert.equal(loginGestor.data.dados.tipoToken, 'Bearer')
    assert.equal(loginGestor.data.dados.usuario.perfil, 'gestor')
    assert.equal(loginGestor.data.dados.usuario.senha_hash, undefined)
    gestorToken = loginGestor.data.dados.token

    const loginAt1 = await request('/api/auth/login', {
      method: 'POST',
      body: { login: 'atendente1', senha: 'atendente123' },
    })
    assert.equal(loginAt1.status, 200)
    atendente1Token = loginAt1.data.dados.token

    const loginAt2 = await request('/api/auth/login', {
      method: 'POST',
      body: { login: 'atendente2', senha: 'atendente123' },
    })
    assert.equal(loginAt2.status, 200)
    atendente2Token = loginAt2.data.dados.token

    const meUnauth = await request('/api/auth/me')
    assert.equal(meUnauth.status, 401)

    const meAuth = await request('/api/auth/me', { token: atendente1Token })
    assert.equal(meAuth.status, 200)
    assert.equal(meAuth.data.dados.usuario.login, 'atendente1')

    const auditLogin = await request('/api/auditoria?acao=LOGIN_FALHA', { token: gestorToken })
    assert.equal(auditLogin.status, 200)
    assert.ok(auditLogin.data.dados.eventos.length >= 2)
  })

  it('deve garantir RBAC entre gestor e atendente e validar parametros', async () => {
    const invalidParam = await request('/api/usuarios/abc', { token: gestorToken })
    assert.equal(invalidParam.status, 400)
    assert.equal(invalidParam.data.codigo, 'VALIDATION_ERROR')

    const deniedList = await request('/api/usuarios', { token: atendente1Token })
    assert.equal(deniedList.status, 403)

    const deniedAudit = await request('/api/auditoria', { token: atendente1Token })
    assert.equal(deniedAudit.status, 403)

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
    assert.equal(secondGestor.data.codigo, 'SINGLE_GESTOR_LIMIT')

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
    assert.equal(createdAtendente.data.dados.usuario.perfil, 'atendente')
    assert.equal(createdAtendente.data.dados.usuario.senhaHash, undefined)
  })

  it('deve consultar fila, reservar senhas sem colisao simultanea e registrar ciclo completo', async () => {
    // Atendentes ocupam guiches 1 e 2
    assert.equal((await request('/api/guiches/1/ocupar', { method: 'POST', token: atendente1Token })).status, 200)
    assert.equal((await request('/api/guiches/2/ocupar', { method: 'POST', token: atendente2Token })).status, 200)

    // Totem emite 3 senhas anonimamente
    const s1 = await request('/api/senhas', { method: 'POST', body: { tipo: 'SP' } })
    const s2 = await request('/api/senhas', { method: 'POST', body: { tipo: 'SG' } })
    const s3 = await request('/api/senhas', { method: 'POST', body: { tipo: 'SE' } })
    assert.equal(s1.status, 201)
    assert.equal(s2.status, 201)
    assert.equal(s3.status, 201)

    // Consulta da fila
    const filaRes = await request('/api/senhas/fila', { token: atendente1Token })
    assert.equal(filaRes.status, 200)
    assert.equal(filaRes.data.dados.contagem.total, 3)
    assert.equal(filaRes.data.dados.contagem.SP, 1)

    // Chamadas simultaneas de dois guiches nao podem receber a mesma senha
    const [res1, res2] = await Promise.all([
      request('/api/senhas/reservar-proxima', {
        method: 'POST',
        token: atendente1Token,
        body: { guicheId: 1, tiposPrioritarios: ['SP', 'SE', 'SG'] },
      }),
      request('/api/senhas/reservar-proxima', {
        method: 'POST',
        token: atendente2Token,
        body: { guicheId: 2, tiposPrioritarios: ['SP', 'SE', 'SG'] },
      }),
    ])
    assert.equal(res1.status, 200)
    assert.equal(res2.status, 200)
    assert.notEqual(res1.data.dados.senha.id, res2.data.dados.senha.id)

    // Agora os dois guiches disputam exatamente a senha restante (s2 = SG) simultaneamente
    const idRestante = s2.data.dados.senha.id
    // Libera guiche 1 finalizando a primeira senha antes de disputar idRestante
    const id1 = res1.data.dados.senha.id
    assert.equal((await request(`/api/senhas/${id1}/iniciar`, { method: 'POST', token: atendente1Token })).status, 200)
    const fin = await request(`/api/senhas/${id1}/finalizar`, { method: 'POST', token: atendente1Token })
    assert.equal(fin.status, 200)
    assert.equal(fin.data.dados.senha.status, 'ATENDIDA')

    // Segunda chamada + nao compareceu na senha do guiche 2
    const id2 = res2.data.dados.senha.id
    const rechamada = await request(`/api/senhas/${id2}/chamar-novamente`, {
      method: 'POST',
      token: atendente2Token,
    })
    assert.equal(rechamada.status, 200)
    assert.equal(rechamada.data.dados.senha.status, 'CHAMADA_NOVAMENTE')

    const naoComp = await request(`/api/senhas/${id2}/nao-compareceu`, {
      method: 'POST',
      token: atendente2Token,
    })
    assert.equal(naoComp.status, 200)
    assert.equal(naoComp.data.dados.senha.status, 'NAO_COMPARECEU')

    const [race1, race2] = await Promise.all([
      request(`/api/senhas/${idRestante}/reservar`, {
        method: 'POST',
        token: atendente1Token,
        body: { guicheId: 1 },
      }),
      request(`/api/senhas/${idRestante}/reservar`, {
        method: 'POST',
        token: atendente2Token,
        body: { guicheId: 2 },
      }),
    ])
    const statuses = [race1.status, race2.status].sort()
    assert.deepEqual(statuses, [200, 409])

    // Painel publico e auditoria
    const painel = await request('/api/senhas/painel')
    assert.equal(painel.status, 200)
    assert.ok(painel.data.dados.chamadas.length >= 1)

    const auditAll = await request('/api/auditoria', { token: gestorToken })
    assert.equal(auditAll.status, 200)
    const acoes = new Set(auditAll.data.dados.eventos.map((e) => e.acao))
    assert.ok(acoes.has('SENHA_EMITIDA'))
    assert.ok(acoes.has('SENHA_RESERVADA'))
    assert.ok(acoes.has('SENHA_ATENDIMENTO_FINALIZADO'))
    assert.ok(acoes.has('SENHA_NAO_COMPARECEU'))
  })
})
