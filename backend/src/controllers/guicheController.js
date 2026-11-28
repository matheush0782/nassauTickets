import { guicheService } from '../services/guicheService.js'
import { parsePositiveInt, sendSuccess } from '../utils/http.js'

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
        return sendSuccess(res, { guiches })
      } catch (error) {
        return next(error)
      }
    },

    async create(req, res, next) {
      try {
        const guiche = await service.createGuiche(req.body || {}, getActor(req))
        return sendSuccess(res, { guiche }, { statusCode: 201 })
      } catch (error) {
        return next(error)
      }
    },

    async update(req, res, next) {
      try {
        const id = parsePositiveInt(req.params.id)
        const guiche = await service.updateGuiche(id, req.body || {}, getActor(req))
        return sendSuccess(res, { guiche })
      } catch (error) {
        return next(error)
      }
    },

    async ocupar(req, res, next) {
      try {
        const id = parsePositiveInt(req.params.id)
        const guiche = await service.ocuparGuiche(id, getActor(req))
        return sendSuccess(res, { guiche })
      } catch (error) {
        return next(error)
      }
    },

    async liberar(req, res, next) {
      try {
        const id = parsePositiveInt(req.params.id)
        const guiche = await service.liberarGuiche(id, getActor(req))
        return sendSuccess(res, { guiche })
      } catch (error) {
        return next(error)
      }
    },
  }
}

export const guicheController = createGuicheController()
