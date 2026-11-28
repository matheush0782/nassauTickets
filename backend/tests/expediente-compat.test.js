import assert from 'node:assert/strict'
import { after, before, describe, it } from 'node:test'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { createApp } from '../src/app.js'
import { createAuditController } from '../src/controllers/auditController.js'
import { createAuthController } from '../src/controllers/authController.js'
import { createExpedienteController } from '../src/controllers/expedienteController.js'
import { createGuicheController } from '../src/controllers/guicheController.js'
import { createHealthController } from '../src/controllers/healthController.js'
import { createTicketController } from '../src/controllers/ticketController.js'
import { createUserController } from '../src/controllers/userController.js'
import { createAuthMiddleware } from '../src/middlewares/authMiddleware.js'
import { formatarCodigoSenha } from '../src/repositories/ticketRepository.js'
import { createAuditRoutes } from '../src/routes/auditRoutes.js'
import { createAuthRoutes } from '../src/routes/authRoutes.js'
import { createExpedienteRoutes } from '../src/routes/expedienteRoutes.js'
import { createGuicheRoutes } from '../src/routes/guicheRoutes.js'
import { createHealthRoutes } from '../src/routes/healthRoutes.js'
import { createTicketRoutes } from '../src/routes/ticketRoutes.js'
import { createUserRoutes } from '../src/routes/userRoutes.js'
import { createAuthService } from '../src/services/authService.js'
import { createExpedienteService } from '../src/services/expedienteService.js'
import { createGuicheService } from '../src/services/guicheService.js'
import { createTicketService } from '../src/services/ticketService.js'
import { createUserService } from '../src/services/userService.js'
import { mapAuditEvent, mapGuiche, mapTicket, mapUser } from '../src/utils/mappers.js'

function createInMemoryEnv() {
  const gestorHash = bcrypt.hashSync('gestor123', 4)
  const atendenteHash = bcrypt.hashSync('atendente123', 4)

  const usuarios = [
    { id: 1, nome: 'Gestor', login: 'gestor', email: 'g@t.local', senha_hash: gestorHash, perfil: 'gestor', ativo: 1 },
    { id: 2, nome: 'Atendente 01', login: 'atendente1', email: 'a1@t.local', senha_hash: atendenteHash, perfil: 'atendente', ativo: 1 },
    { id: 3, nome: 'Atendente 02', login: 'atendente2', email: 'a2@t.local', senha_hash: atendenteHash, perfil: 'atendente', ativo: 1 },
  ]
  const guiches = [
    { id: 1, numero: 1, descricao: 'G01', ativo: 1, atendente_atual_id: null },
    { id: 2, numero: 2, descricao: 'G02', ativo: 1, atendente_atual_id: null },
  ]
  const senhas = []
  const auditoria = []
  const expedientes = new Map()

  const getExp = (refDate = '2026-11-28') => {
    if (!expedientes.has(refDate)) {
      expedientes.set(refDate, {
        data_referencia: refDate,
        encerrado_manualmente: 0,
        encerrado_em: null,
        encerrado_por: null,
        reaberto_em: null,
        reaberto_por: null,
        ultimo_tipo_chamado: null,
      })
    }
    return expedientes.get(refDate)
  }

  const auditRepo = {
    async registrarEvento(event) {
      const e = { id: auditoria.length + 1, ...event, criado_em: new Date().toISOString() }
      auditoria.push(e)
      return e.id
    },
    async listarEventos() {
      return [...auditoria].reverse().map(mapAuditEvent)
    },
  }

  const userRepo = {
    async findAuthByLogin(login) { return usuarios.find((u) => u.login === login) || null },
    async findByLogin(login) { return mapUser(usuarios.find((u) => u.login === login) || null) },
    async findById(id) { return mapUser(usuarios.find((u) => u.id === Number(id)) || null) },
    async countActiveGestores(ex = null) { return usuarios.filter((u) => u.perfil === 'gestor' && u.ativo === 1 && u.id !== ex).length },
    async listAll() { return usuarios.map(mapUser) },
  }

  const guicheRepo = {
    async listAll({ apenasAtivos = false } = {}) { return (apenasAtivos ? guiches.filter((g) => g.ativo === 1) : guiches).map(mapGuiche) },
    async findById(id) { return mapGuiche(guiches.find((g) => g.id === Number(id)) || null) },
    async findByNumero(n) { return mapGuiche(guiches.find((g) => g.numero === Number(n)) || null) },
    async assignAtendente(gid, uid) {
      const t = guiches.find((g) => g.id === Number(gid))
      if (!t) return { error: 'NOT_FOUND' }
      if (!t.ativo) return { error: 'INACTIVE' }
      if (t.atendente_atual_id && t.atendente_atual_id !== uid) return { error: 'OCCUPIED' }
      t.atendente_atual_id = uid
      return { error: null, guiche: mapGuiche(t) }
    },
    async releaseAtendente(gid, uid, { force = false } = {}) {
      const t = guiches.find((g) => g.id === Number(gid))
      if (!t) return { error: 'NOT_FOUND' }
      if (!force && t.atendente_atual_id !== null && t.atendente_atual_id !== uid) return { error: 'NOT_OWNER' }
      t.atendente_atual_id = null
      return { error: null, guiche: mapGuiche(t) }
    },
  }

  const ticketRepo = {
    async createTicket({ tipo, status = 'AGUARDANDO', dataReferencia = '2026-11-28' }) {
      const seq = senhas.filter((s) => s.data_referencia === dataReferencia && s.tipo === tipo).length + 1
      const c = {
        id: senhas.length + 1,
        codigo: formatarCodigoSenha(dataReferencia, tipo, seq),
        tipo,
        data_referencia: dataReferencia,
        sequencial: seq,
        status,
        guiche_id: null,
        atendente_id: null,
        emitida_em: new Date().toISOString(),
        primeira_chamada_em: null,
        segunda_chamada_em: null,
        inicio_atendimento_em: null,
        fim_atendimento_em: null,
        tempo_atendimento_segundos: null,
      }
      senhas.push(c)
      return c
    },
    async findById(id) { return senhas.find((s) => s.id === Number(id)) || null },
    async list({ dataReferencia, tipo, status } = {}) {
      return senhas.filter((s) => (!dataReferencia || s.data_referencia === dataReferencia) && (!tipo || s.tipo === tipo) && (!status || s.status === status))
    },
    async listByPeriodo({ periodo, referencia }) {
      return senhas.filter((s) => periodo === 'mensal' ? s.data_referencia.startsWith(referencia) : s.data_referencia === referencia)
    },
    async findAtendimentoAtualByGuiche(gIdOrNum) {
      return senhas.find((s) => s.guiche_id === Number(gIdOrNum) && ['CHAMADA', 'CHAMADA_NOVAMENTE', 'EM_ATENDIMENTO'].includes(s.status)) || null
    },
    async consultarFila({ tipo = null } = {}) {
      return senhas.filter((s) => s.status === 'AGUARDANDO' && (!tipo || s.tipo === tipo))
    },
    async contarFilaPorTipo() {
      const c = { SP: 0, SG: 0, SE: 0, total: 0 }
      for (const s of senhas) if (s.status === 'AGUARDANDO') { c[s.tipo] += 1; c.total += 1 }
      return c
    },
    async buscarUltimaChamada() {
      const ch = senhas.filter((s) => s.primeira_chamada_em !== null)
      return ch[ch.length - 1] || null
    },
    async listPainelChamadas({ limit = 5 } = {}) {
      return senhas.filter((s) => s.primeira_chamada_em !== null).slice(-limit).reverse()
    },
    async reservarProximaSenha({ guicheId, atendenteId, resolverOrdemDeBusca }) {
      const exp = getExp()
      if (exp.encerrado_manualmente) return { error: 'EXPEDIENTE_ENCERRADO' }
      const g = guiches.find((x) => x.id === Number(guicheId) || x.numero === Number(guicheId))
      if (!g) return { error: 'GUICHE_NOT_FOUND' }
      if (!g.ativo) return { error: 'GUICHE_INACTIVE' }
      if (g.atendente_atual_id && g.atendente_atual_id !== atendenteId) return { error: 'GUICHE_OCCUPIED_BY_OTHER' }
      if (senhas.find((s) => s.guiche_id === g.id && ['CHAMADA', 'CHAMADA_NOVAMENTE', 'EM_ATENDIMENTO'].includes(s.status))) {
        return { error: 'GUICHE_HAS_ACTIVE_TICKET' }
      }
      const ordem = (resolverOrdemDeBusca || ((u) => (u === 'SP' ? ['SE', 'SG', 'SP'] : ['SP', 'SE', 'SG'])))(exp.ultimo_tipo_chamado)
      let target = null
      for (const t of ordem) {
        target = senhas.find((s) => s.status === 'AGUARDANDO' && s.tipo === t)
        if (target) break
      }
      if (!target) return { error: 'EMPTY_QUEUE' }
      target.status = 'CHAMADA'
      target.guiche_id = g.id
      target.atendente_id = atendenteId
      target.primeira_chamada_em = new Date().toISOString()
      exp.ultimo_tipo_chamado = target.tipo
      return { error: null, senha: target }
    },
    async updateById(id, fields) {
      const t = senhas.find((s) => s.id === Number(id))
      if (!t) return null
      if (fields.status !== undefined) t.status = fields.status
      if (fields.guicheId !== undefined) t.guiche_id = fields.guicheId
      if (fields.atendenteId !== undefined) t.atendente_id = fields.atendenteId
      return t
    },
  }

  const expedienteRepo = {
    async getOrCreateDia(refDate = '2026-11-28') {
      return getExp(refDate || '2026-11-28')
    },
    async encerrarDia({ dataReferencia = '2026-11-28', usuarioId = null } = {}) {
      const exp = getExp(dataReferencia || '2026-11-28')
      if (exp.encerrado_manualmente) return { error: 'ALREADY_CLOSED' }
      exp.encerrado_manualmente = 1
      exp.encerrado_em = new Date().toISOString()
      exp.encerrado_por = usuarioId
      let descartadas = 0
      for (const s of senhas) {
        if (['EMITIDA', 'AGUARDANDO'].includes(s.status)) {
          s.status = 'DESCARTADA'
          descartadas += 1
        }
      }
      return { error: null, expediente: exp, descartadas }
    },
    async reabrirDia({ dataReferencia = '2026-11-28', usuarioId = null } = {}) {
      const exp = getExp(dataReferencia || '2026-11-28')
      if (!exp.encerrado_manualmente) return { error: 'NOT_CLOSED' }
      exp.encerrado_manualmente = 0
      exp.reaberto_em = new Date().toISOString()
      exp.reaberto_por = usuarioId
      return { error: null, expediente: exp }
    },
  }

  return { userRepo, guicheRepo, ticketRepo, auditRepo, expedienteRepo, auditoria }
}

describe('Expediente, tokens expirados, prioridade no servidor e aliases de compatibilidade', () => {
  let server
  let baseUrl
  let gestorToken
  let atendenteToken
  const jwtSecret = 'test-secret-key'
  let envData

  before(async () => {
    envData = createInMemoryEnv()
    const { userRepo, guicheRepo, ticketRepo, auditRepo, expedienteRepo } = envData

    const authMiddleware = createAuthMiddleware({
      findUserById: (id) => userRepo.findById(id),
      jwtSecret,
    })

    const authSvc = createAuthService({ users: userRepo, audit: auditRepo, jwtConfig: { secret: jwtSecret, expiresIn: '1h' } })
    const userSvc = createUserService({ users: userRepo, audit: auditRepo, saltRounds: 4 })
    const guicheSvc = createGuicheService({ guiches: guicheRepo, audit: auditRepo })
    const ticketSvc = createTicketService({ tickets: ticketRepo, audit: auditRepo })
    const expedienteSvc = createExpedienteService({ expedientes: expedienteRepo, audit: auditRepo })

    const ticketCtrl = createTicketController({ service: ticketSvc })

    const app = createApp({
      healthRouter: createHealthRoutes({ controller: createHealthController({ checkDb: async () => true }) }),
      authRouter: createAuthRoutes({ controller: createAuthController({ service: authSvc }), auth: authMiddleware }),
      userRouter: createUserRoutes({ controller: createUserController({ service: userSvc }), auth: authMiddleware }),
      guicheRouter: createGuicheRoutes({
        controller: createGuicheController({ service: guicheSvc, tickets: ticketSvc }),
        auth: authMiddleware,
      }),
      ticketRouter: createTicketRoutes({ controller: ticketCtrl, auth: authMiddleware }),
      expedienteRouter: createExpedienteRoutes({
        controller: createExpedienteController({ service: expedienteSvc }),
        auth: authMiddleware,
      }),
      auditRouter: createAuditRoutes({ controller: createAuditController({ audit: auditRepo }), auth: authMiddleware }),
      compatTickets: ticketCtrl,
      compatAuth: authMiddleware,
    })

    await new Promise((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        baseUrl = `http://127.0.0.1:${server.address().port}`
        resolve()
      })
    })

    const lg = await req('/api/auth/login', { method: 'POST', body: { login: 'gestor', senha: 'gestor123' } })
    gestorToken = lg.data.token
    const la = await req('/api/auth/login', { method: 'POST', body: { login: 'atendente1', senha: 'atendente123' } })
    atendenteToken = la.data.token
  })

  after(async () => {
    if (server) await new Promise((resolve) => server.close(resolve))
  })

  async function req(path, { method = 'GET', body = null, token = null } = {}) {
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

  it('deve rejeitar token JWT expirado com 401 UNAUTHORIZED', async () => {
    const expiredToken = jwt.sign({ sub: 1, login: 'gestor', perfil: 'gestor' }, jwtSecret, { expiresIn: '-10s' })
    const r = await req('/api/auth/me', { token: expiredToken })
    assert.equal(r.status, 401)
    assert.equal(r.data.codigo, 'UNAUTHORIZED')
  })

  it('deve impedir contorno da maquina de estados via PATCH /api/senhas/:id/status', async () => {
    const emit = await req('/api/senhas', { method: 'POST', body: { tipo: 'SG' } })
    const id = emit.data.dados.senha.id

    // Nao pode pular AGUARDANDO -> ATENDIDA
    const jump = await req(`/api/senhas/${id}/status`, {
      method: 'PATCH',
      token: atendenteToken,
      body: { status: 'ATENDIDA' },
    })
    assert.equal(jump.status, 409)
    assert.equal(jump.data.codigo, 'INVALID_TRANSITION')

    // Nao pode ir AGUARDANDO -> CHAMADA sem guicheId
    const noGuiche = await req(`/api/senhas/${id}/status`, {
      method: 'PATCH',
      token: atendenteToken,
      body: { status: 'CHAMADA' },
    })
    assert.equal(noGuiche.status, 400)
  })

  it('deve determinar prioridade no servidor (SP -> SE -> SG) ignorando tiposPrioritarios do cliente', async () => {
    await req('/api/senhas', { method: 'POST', body: { tipo: 'SG' } })
    await req('/api/senhas', { method: 'POST', body: { tipo: 'SP' } })
    await req('/api/senhas', { method: 'POST', body: { tipo: 'SE' } })

    // Cliente tenta forcar SG via tiposPrioritarios, mas servidor deve escolher SP primeiro
    const r1 = await req('/api/senhas/reservar-proxima', {
      method: 'POST',
      token: atendenteToken,
      body: { guicheId: 1, tiposPrioritarios: ['SG'] },
    })
    assert.equal(r1.status, 200)
    assert.equal(r1.data.dados.senha.tipo, 'SP')

    // Atendimento atual do guiche 1 deve retornar a senha SP chamada
    const atual = await req('/api/guiches/1/atendimento-atual', { token: atendenteToken })
    assert.equal(atual.status, 200)
    assert.equal(atual.data.dados.senha.id, r1.data.dados.senha.id)

    // Proxima chamada no guiche 2 apos SP deve ser SE (alternancia SP -> SE/SG)
    const r2 = await req('/api/atendimentos/chamar-proxima', {
      method: 'POST',
      token: gestorToken,
      body: { guiche: 2 },
    })
    assert.equal(r2.status, 200)
    assert.equal(r2.data.dados.senha.tipo, 'SE')
  })

  it('deve manter consistencia entre operacoes falhas e auditoria (nao registrar sucesso se falhou)', async () => {
    const antes = envData.auditoria.length
    // Guiche 1 ja tem senha ativa -> deve falhar com 409 e nao gravar SENHA_RESERVADA
    const fail = await req('/api/senhas/reservar-proxima', {
      method: 'POST',
      token: atendenteToken,
      body: { guicheId: 1 },
    })
    assert.equal(fail.status, 409)
    assert.equal(envData.auditoria.length, antes)
  })

  it('deve suportar rotas de compatibilidade do frontend (/painel/ultimas-chamadas, /fila/resumo, /relatorios/senhas)', async () => {
    const painel = await req('/api/painel/ultimas-chamadas?limite=5')
    assert.equal(painel.status, 200)
    assert.ok(Array.isArray(painel.data.chamadas))

    const fila = await req('/api/fila/resumo', { token: atendenteToken })
    assert.equal(fila.status, 200)
    assert.ok('contagem' in fila.data.dados)

    const relDenied = await req('/api/relatorios/senhas?periodo=diario&referencia=2026-11-28', { token: atendenteToken })
    assert.equal(relDenied.status, 403)

    const relOk = await req('/api/relatorios/senhas?periodo=diario&referencia=2026-11-28', { token: gestorToken })
    assert.equal(relOk.status, 200)
    assert.ok(Array.isArray(relOk.data.senhas))
  })

  it('deve consultar, encerrar (apenas gestor) e reabrir o expediente com auditoria', async () => {
    const consulta = await req('/api/expediente')
    assert.equal(consulta.status, 200)
    assert.equal(consulta.data.dados.expedienteAberto, true)

    // Atendente nao pode encerrar expediente
    const denied = await req('/api/expediente/encerrar', { method: 'POST', token: atendenteToken })
    assert.equal(denied.status, 403)

    // Gestor encerra expediente e descarta pendentes
    const encerrar = await req('/api/expediente/encerrar', { method: 'POST', token: gestorToken })
    assert.equal(encerrar.status, 200)
    assert.equal(encerrar.data.dados.expedienteEncerrado, true)
    assert.ok(encerrar.data.dados.descartadas >= 1)

    // Nova chamada deve ser bloqueada com 409 EXPEDIENTE_ENCERRADO
    const bloqueada = await req('/api/senhas/reservar-proxima', {
      method: 'POST',
      token: atendenteToken,
      body: { guicheId: 2 },
    })
    assert.equal(bloqueada.status, 409)
    assert.equal(bloqueada.data.codigo, 'EXPEDIENTE_ENCERRADO')

    // Reabrir expediente (apenas gestor)
    const reabrirDenied = await req('/api/expediente/reabrir', { method: 'POST', token: atendenteToken })
    assert.equal(reabrirDenied.status, 403)

    const reabrir = await req('/api/expediente/reabrir', { method: 'POST', token: gestorToken })
    assert.equal(reabrir.status, 200)
    assert.equal(reabrir.data.dados.expedienteAberto, true)
  })

  it('deve impedir que outro atendente altere atendimento ativo de outro guiche (403)', async () => {
    const la2 = await req('/api/auth/login', { method: 'POST', body: { login: 'atendente2', senha: 'atendente123' } })
    const atendente2Token = la2.data.token

    // Senha 2 foi reservada pelo atendente1 no guiche 1; atendente2 nao pode inicia-la
    const atual = await req('/api/guiches/1/atendimento-atual', { token: atendenteToken })
    const senhaId = atual.data.dados.senha.id

    const hijack = await req(`/api/senhas/${senhaId}/iniciar`, {
      method: 'POST',
      token: atendente2Token,
    })
    assert.equal(hijack.status, 403)
    assert.equal(hijack.data.codigo, 'FORBIDDEN')
  })
})
