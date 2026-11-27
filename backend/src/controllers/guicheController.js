import { guicheService } from '../services/guicheService.js'

function getActor(req) {
  return { id: req.user.id, perfil: req.user.perfil, ipOrigem: req.ip }
}

export function createGuicheController({ service = guicheService } = {}) {
  return {
    async list(req, res, next) {
      try {
        const apenasAtivos =
          req.query.ativos === 'true' || req.query.ativos === '1'
        const guiches = await service.listGuiches({ apenasAtivos })
        res.status(200).json({ guiches })
      } catch (error) {
        next(error)
      }
    },

    async create(req, res, next) {
      try {
        const guiche = await service.createGuiche(req.body || {}, getActor(req))
        res.status(201).json({ guiche })
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
        res.status(200).json({ guiche })
      } catch (error) {
        next(error)
      }
    },

    async ocupar(req, res, next) {
      try {
        const guiche = await service.ocuparGuiche(Number(req.params.id), getActor(req))
        res.status(200).json({ guiche })
      } catch (error) {
        next(error)
      }
    },

    async liberar(req, res, next) {
      try {
        const guiche = await service.liberarGuiche(Number(req.params.id), getActor(req))
        res.status(200).json({ guiche })
      } catch (error) {
        next(error)
      }
    },
  }
}

export const guicheController = createGuicheController()
