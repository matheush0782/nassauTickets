import { userService } from '../services/userService.js'
import { parsePositiveInt, sendSuccess } from '../utils/http.js'

function getActor(req) {
  return { id: req.user?.id ?? null, ipOrigem: req.ip }
}

export function createUserController({ service = userService } = {}) {
  return {
    async list(req, res, next) {
      try {
        const ativo =
          req.query.ativo !== undefined ? req.query.ativo === 'true' || req.query.ativo === '1' : null
        const usuarios = await service.listUsers({
          perfil: req.query.perfil || null,
          ativo,
        })
        return sendSuccess(res, { usuarios })
      } catch (error) {
        return next(error)
      }
    },

    async getById(req, res, next) {
      try {
        const id = parsePositiveInt(req.params.id)
        const usuario = await service.getUserById(id)
        return sendSuccess(res, { usuario })
      } catch (error) {
        return next(error)
      }
    },

    async create(req, res, next) {
      try {
        const usuario = await service.createUser(req.body || {}, getActor(req))
        return sendSuccess(res, { usuario }, { statusCode: 201 })
      } catch (error) {
        return next(error)
      }
    },

    async update(req, res, next) {
      try {
        const id = parsePositiveInt(req.params.id)
        const usuario = await service.updateUser(id, req.body || {}, getActor(req))
        return sendSuccess(res, { usuario })
      } catch (error) {
        return next(error)
      }
    },

    async setStatus(req, res, next) {
      try {
        const id = parsePositiveInt(req.params.id)
        const usuario = await service.setUserStatus(id, req.body?.ativo, getActor(req))
        return sendSuccess(res, { usuario })
      } catch (error) {
        return next(error)
      }
    },
  }
}

export const userController = createUserController()
