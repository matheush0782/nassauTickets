import { authService } from '../services/authService.js'

export function createAuthController({ service = authService } = {}) {
  return {
    async login(req, res, next) {
      try {
        const result = await service.login({
          login: req.body?.login,
          senha: req.body?.senha,
          ipOrigem: req.ip,
        })
        res.status(200).json(result)
      } catch (error) {
        next(error)
      }
    },

    async me(req, res, next) {
      try {
        const usuario = await service.getProfile(req.user.id)
        res.status(200).json({ usuario })
      } catch (error) {
        next(error)
      }
    },
  }
}

export const authController = createAuthController()
