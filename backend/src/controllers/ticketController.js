import { ticketService } from '../services/ticketService.js'
import { parsePositiveInt, sendSuccess } from '../utils/http.js'

function getActor(req) {
  return { id: req.user?.id ?? null, perfil: req.user?.perfil ?? null, ipOrigem: req.ip }
}

export function createTicketController({ service = ticketService } = {}) {
  return {
    async create(req, res, next) {
      try {
        const senha = await service.emitirSenha({
          tipo: req.body?.tipo,
          ipOrigem: req.ip,
        })
        return sendSuccess(res, { senha }, { statusCode: 201 })
      } catch (error) {
        return next(error)
      }
    },

    async list(req, res, next) {
      try {
        const senhas = await service.listarSenhas(req.query || {})
        return sendSuccess(res, { senhas })
      } catch (error) {
        return next(error)
      }
    },

    async fila(req, res, next) {
      try {
        const fila = await service.consultarFila({
          data: req.query?.data || null,
          tipo: req.query?.tipo || null,
        })
        return sendSuccess(res, fila)
      } catch (error) {
        return next(error)
      }
    },

    async painel(req, res, next) {
      try {
        const limit = req.query?.limit ? Number(req.query.limit) : 5
        const chamadas = await service.obterPainelChamadas({ limit })
        return sendSuccess(res, { chamadas })
      } catch (error) {
        return next(error)
      }
    },

    async getById(req, res, next) {
      try {
        const id = parsePositiveInt(req.params.id)
        const senha = await service.buscarSenhaPorId(id)
        return sendSuccess(res, { senha })
      } catch (error) {
        return next(error)
      }
    },

    async reservarProxima(req, res, next) {
      try {
        const senha = await service.reservarProximaSenha(req.body || {}, getActor(req))
        return sendSuccess(res, { senha })
      } catch (error) {
        return next(error)
      }
    },

    async reservarPorId(req, res, next) {
      try {
        const id = parsePositiveInt(req.params.id)
        const senha = await service.reservarSenhaPorId(id, req.body || {}, getActor(req))
        return sendSuccess(res, { senha })
      } catch (error) {
        return next(error)
      }
    },

    async chamarNovamente(req, res, next) {
      try {
        const id = parsePositiveInt(req.params.id)
        const senha = await service.registrarSegundaChamada(id, getActor(req))
        return sendSuccess(res, { senha })
      } catch (error) {
        return next(error)
      }
    },

    async iniciarAtendimento(req, res, next) {
      try {
        const id = parsePositiveInt(req.params.id)
        const senha = await service.iniciarAtendimento(id, getActor(req))
        return sendSuccess(res, { senha })
      } catch (error) {
        return next(error)
      }
    },

    async finalizarAtendimento(req, res, next) {
      try {
        const id = parsePositiveInt(req.params.id)
        const senha = await service.finalizarAtendimento(id, getActor(req))
        return sendSuccess(res, { senha })
      } catch (error) {
        return next(error)
      }
    },

    async naoCompareceu(req, res, next) {
      try {
        const id = parsePositiveInt(req.params.id)
        const senha = await service.registrarNaoCompareceu(id, getActor(req))
        return sendSuccess(res, { senha })
      } catch (error) {
        return next(error)
      }
    },

    async descartarPendentes(req, res, next) {
      try {
        const resultado = await service.descartarSenhasPendentes(req.body || {}, getActor(req))
        return sendSuccess(res, resultado)
      } catch (error) {
        return next(error)
      }
    },

    async updateStatus(req, res, next) {
      try {
        const id = parsePositiveInt(req.params.id)
        const senha = await service.atualizarStatusPersistencia(
          id,
          req.body || {},
          getActor(req),
        )
        return sendSuccess(res, { senha })
      } catch (error) {
        return next(error)
      }
    },
  }
}

export const ticketController = createTicketController()
