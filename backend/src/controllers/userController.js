import { userService } from '../services/userService.js'

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
        res.status(200).json({ sucesso: true, dados: { usuarios }, usuarios })
      } catch (error) {
        next(error)
      }
    },

    async getById(req, res, next) {
      try {
        const usuario = await service.getUserById(Number(req.params.id))
        res.status(200).json({ sucesso: true, dados: { usuario }, usuario })
      } catch (error) {
        next(error)
      }
    },

    async create(req, res, next) {
      try {
        const usuario = await service.createUser(req.body || {}, getActor(req))
        res.status(201).json({ sucesso: true, dados: { usuario }, usuario })
      } catch (error) {
        next(error)
      }
    },

    async update(req, res, next) {
      try {
        const usuario = await service.updateUser(
          Number(req.params.id),
          req.body || {},
          getActor(req),
        )
        res.status(200).json({ sucesso: true, dados: { usuario }, usuario })
      } catch (error) {
        next(error)
      }
    },

    async setStatus(req, res, next) {
      try {
        const usuario = await service.setUserStatus(
          Number(req.params.id),
          req.body?.ativo,
          getActor(req),
        )
        res.status(200).json({ sucesso: true, dados: { usuario }, usuario })
      } catch (error) {
        next(error)
      }
    },
  }
}

export const userController = createUserController()
