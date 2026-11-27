import jwt from 'jsonwebtoken'
import { env } from '../config/env.js'
import { ForbiddenError, UnauthorizedError } from '../errors/AppError.js'
import { userRepository } from '../repositories/userRepository.js'

export function createAuthMiddleware({
  findUserById = (id) => userRepository.findById(id),
  jwtSecret = env.jwt.secret,
} = {}) {
  async function authenticate(req, _res, next) {
    try {
      const authHeader = req.headers.authorization || ''
      const [scheme, token] = authHeader.split(' ')

      if (scheme !== 'Bearer' || !token) {
        throw new UnauthorizedError('Token de autenticacao ausente ou malformado.')
      }

      let payload
      try {
        payload = jwt.verify(token, jwtSecret)
      } catch {
        throw new UnauthorizedError('Token de autenticacao invalido ou expirado.')
      }

      const user = await findUserById(payload.sub)
      if (!user || !user.ativo) {
        throw new UnauthorizedError('Usuario inativo ou inexistente.')
      }

      req.user = {
        id: user.id,
        nome: user.nome,
        login: user.login,
        perfil: user.perfil,
      }
      next()
    } catch (error) {
      next(error)
    }
  }

  function authorizeRoles(...allowedRoles) {
    return (req, _res, next) => {
      if (!req.user) {
        return next(new UnauthorizedError())
      }
      if (!allowedRoles.includes(req.user.perfil)) {
        return next(new ForbiddenError('Permissao insuficiente para acessar este recurso.'))
      }
      return next()
    }
  }

  return { authenticate, authorizeRoles }
}

const defaultAuthMiddleware = createAuthMiddleware()
export const authenticate = defaultAuthMiddleware.authenticate
export const authorizeRoles = defaultAuthMiddleware.authorizeRoles
