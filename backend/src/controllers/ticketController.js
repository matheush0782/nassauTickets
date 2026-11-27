import { ticketService } from '../services/ticketService.js'

export function createTicketController({ service = ticketService } = {}) {
  return {
    async create(req, res, next) {
      try {
        const senha = await service.emitirSenha({
          tipo: req.body?.tipo,
          ipOrigem: req.ip,
        })
        res.status(201).json({ senha })
      } catch (error) {
        next(error)
      }
    },

    async list(req, res, next) {
      try {
        const senhas = await service.listarSenhas(req.query || {})
        res.status(200).json({ senhas })
      } catch (error) {
        next(error)
      }
    },

    async painel(req, res, next) {
      try {
        const limit = req.query?.limit ? Number(req.query.limit) : 5
        const chamadas = await service.obterPainelChamadas({ limit })
        res.status(200).json({ chamadas })
      } catch (error) {
        next(error)
      }
    },

    async getById(req, res, next) {
      try {
        const senha = await service.buscarSenhaPorId(Number(req.params.id))
        res.status(200).json({ senha })
      } catch (error) {
        next(error)
      }
    },

    async updateStatus(req, res, next) {
      try {
        const senha = await service.atualizarStatusPersistencia(
          Number(req.params.id),
          req.body || {},
          { id: req.user?.id ?? null, ipOrigem: req.ip },
        )
        res.status(200).json({ senha })
      } catch (error) {
        next(error)
      }
    },
  }
}

export const ticketController = createTicketController()
