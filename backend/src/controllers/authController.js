import { authService } from '../services/authService.js'

export function createAuthController({ service = authService } = {}) {
  return {
    async login(req, res, next) {
      try {
        const result = await service.login({
          login: req.body?.login || req.body?.usuario,
          usuario: req.body?.usuario,
          senha: req.body?.senha,
          ipOrigem: req.ip,
        })
        res.status(200).json({
          sucesso: true,
          dados: result,
          token: result.token,
          usuario: result.usuario,
          nome: result.nome,
          perfil: result.perfil,
        })
      } catch (error) {
        next(error)
      }
    },

    async me(req, res, next) {
      try {
        const usuario = await service.getProfile(req.user.id)
        res.status(200).json({
          sucesso: true,
          dados: { usuario },
          usuario,
        })
      } catch (error) {
        next(error)
      }
    },
  }
}

export const authController = createAuthController()
