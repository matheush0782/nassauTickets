import { guicheService } from '../services/guicheService.js'
import { ticketService } from '../services/ticketService.js'
import { mapTicket } from '../utils/mappers.js'

function getActor(req) {
  return { id: req.user.id, perfil: req.user.perfil, ipOrigem: req.ip }
}

export function createGuicheController({
  service = guicheService,
  tickets = ticketService,
} = {}) {
  return {
    async list(req, res, next) {
      try {
        const apenasAtivos =
          req.query.ativos === 'true' || req.query.ativos === '1'
        const guiches = await service.listGuiches({ apenasAtivos })
        res.status(200).json({ sucesso: true, dados: { guiches }, guiches })
      } catch (error) {
        next(error)
      }
    },

    async create(req, res, next) {
      try {
        const guiche = await service.createGuiche(req.body || {}, getActor(req))
        res.status(201).json({ sucesso: true, dados: { guiche }, guiche })
      } catch (error) {
        next(error)
      }
    },

    async update(req, res, next) {
      try {
        const guiche = await service.updateGuiche(
          Number(req.params.id),
          req.body || {},
          getActor(req),
        )
        res.status(200).json({ sucesso: true, dados: { guiche }, guiche })
      } catch (error) {
        next(error)
      }
    },

    async ocupar(req, res, next) {
      try {
        const guiche = await service.ocuparGuiche(Number(req.params.id), getActor(req))
        res.status(200).json({ sucesso: true, dados: { guiche }, guiche })
      } catch (error) {
        next(error)
      }
    },

    async liberar(req, res, next) {
      try {
        const guiche = await service.liberarGuiche(Number(req.params.id), getActor(req))
        res.status(200).json({ sucesso: true, dados: { guiche }, guiche })
      } catch (error) {
        next(error)
      }
    },

    async atendimentoAtual(req, res, next) {
      try {
        const atual = await tickets.atendimentoAtualDoGuiche(Number(req.params.id))
        const mapped = atual ? mapTicket(atual) : null
        res.status(200).json({ sucesso: true, dados: { senha: mapped }, senha: mapped })
      } catch (error) {
        next(error)
      }
    },
  }
}

export const guicheController = createGuicheController()
