import { authService } from '../services/authService.js'
import { sendSuccess } from '../utils/http.js'

export function createAuthController({ service = authService } = {}) {
  return {
    async login(req, res, next) {
      try {
        const dados = await service.login({
          login: req.body?.login,
          senha: req.body?.senha,
          ipOrigem: req.ip,
        })
        return sendSuccess(res, dados)
      } catch (error) {
        return next(error)
      }
    },

    async me(req, res, next) {
      try {
        const dados = await service.getProfile(req.user.id)
        return sendSuccess(res, dados)
      } catch (error) {
        return next(error)
      }
    },
  }
}

export const authController = createAuthController()
